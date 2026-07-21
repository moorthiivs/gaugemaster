import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UploadJob } from './upload-job.entity';
import { InstrumentsService } from '../instruments/instruments.service';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';

@Injectable()
export class UploadJobsService implements OnModuleInit {
  private readonly logger = new Logger(UploadJobsService.name);

  constructor(
    @InjectRepository(UploadJob)
    private readonly jobRepository: Repository<UploadJob>,
    private readonly dataSource: DataSource,
    private readonly instrumentsService: InstrumentsService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing UploadJobs table...');
    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS upload_jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "companyId" UUID NOT NULL,
          "fileName" VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          "totalRows" INTEGER NOT NULL DEFAULT 0,
          "processedRows" INTEGER NOT NULL DEFAULT 0,
          "successCount" INTEGER NOT NULL DEFAULT 0,
          "failedCount" INTEGER NOT NULL DEFAULT 0,
          errors JSONB DEFAULT '[]'::jsonb,
          "createdBy" UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      this.logger.log('UploadJobs table checked/created successfully!');
    } catch (err) {
      this.logger.error('Failed to create upload_jobs table:', err.message);
    }
  }

  async getJobsByCompany(companyId: string): Promise<UploadJob[]> {
    return await this.jobRepository.find({
      where: { companyId },
      order: { created_at: 'DESC' },
    });
  }

  async getJob(jobId: string): Promise<UploadJob | null> {
    return await this.jobRepository.findOne({
      where: { id: jobId },
    });
  }

  async cancelJob(jobId: string): Promise<UploadJob | null> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) return null;
    
    if (job.status === 'processing') {
      job.status = 'cancelled';
      return await this.jobRepository.save(job);
    }
    return job;
  }

  async startBackgroundUpload(
    companyId: string,
    fileName: string,
    instruments: CreateInstrumentDto[],
    userId: string,
  ): Promise<UploadJob> {
    const newJob = this.jobRepository.create({
      companyId,
      fileName,
      status: 'processing',
      totalRows: instruments.length,
      processedRows: 0,
      successCount: 0,
      failedCount: 0,
      errors: [],
      createdBy: userId,
    });

    const savedJob = await this.jobRepository.save(newJob);

    // Spawn background task without awaiting to return immediately to frontend
    this.processUploadInBackground(savedJob.id, instruments);

    return savedJob;
  }

  private async processUploadInBackground(jobId: string, instruments: CreateInstrumentDto[]) {
    const batchSize = 1;
    let processed = 0;
    let success = 0;
    let failed = 0;
    const errorsList: any[] = [];

    this.logger.log(`Starting background upload process for Job ID: ${jobId} with ${instruments.length} rows.`);

    try {
      for (let i = 0; i < instruments.length; i += batchSize) {
        // Check if the job has been cancelled by the user
        const liveJob = await this.jobRepository.findOne({ where: { id: jobId } });
        if (!liveJob || liveJob.status === 'cancelled') {
          this.logger.log(`Job ID: ${jobId} was cancelled by user. Terminating background loop.`);
          return;
        }

        const batch = instruments.slice(i, i + batchSize);
        
        // Process this batch
        const result = await this.instrumentsService.bulkUpload(batch);
        
        if (result) {
          success += result.successCount;
          failed += result.failedCount;
          
          if (result.rejected && result.rejected.length > 0) {
            // Map the rejected items to include their row numbers relative to the original index
            const batchRejected = result.rejected.map((rej, index) => {
              // Extract raw values without the 'error' field for template restoration
              const { error, ...rawValues } = rej;
              return {
                row: i + (batch.findIndex(b => b.id_code === rej.id_code) !== -1 ? batch.findIndex(b => b.id_code === rej.id_code) + 1 : index + 1),
                id_code: rej.id_code,
                error: error || 'Validation error',
                raw: rawValues,
              };
            });
            errorsList.push(...batchRejected);
          }
        } else {
          failed += batch.length;
          errorsList.push(...batch.map((item, index) => ({
            row: i + index + 1,
            id_code: item.id_code,
            error: 'Failed to process batch',
            raw: item,
          })));
        }

        processed += batch.length;

        // Update progress in database
        await this.jobRepository.update(jobId, {
          processedRows: processed,
          successCount: success,
          failedCount: failed,
          errors: errorsList,
        });

        // Yield execution to the Node.js event loop to keep server highly responsive
        await new Promise(resolve => setTimeout(resolve, 2));
      }

      // Mark as completed
      await this.jobRepository.update(jobId, {
        status: 'completed',
      });
      this.logger.log(`Background upload completed successfully for Job ID: ${jobId}.`);
    } catch (err) {
      this.logger.error(`Error processing background job ${jobId}: ${err.message}`);
      await this.jobRepository.update(jobId, {
        status: 'failed',
      });
    }
  }
}
