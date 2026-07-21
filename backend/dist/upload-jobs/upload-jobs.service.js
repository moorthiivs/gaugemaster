"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var UploadJobsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadJobsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const upload_job_entity_1 = require("./upload-job.entity");
const instruments_service_1 = require("../instruments/instruments.service");
let UploadJobsService = UploadJobsService_1 = class UploadJobsService {
    jobRepository;
    dataSource;
    instrumentsService;
    logger = new common_1.Logger(UploadJobsService_1.name);
    constructor(jobRepository, dataSource, instrumentsService) {
        this.jobRepository = jobRepository;
        this.dataSource = dataSource;
        this.instrumentsService = instrumentsService;
    }
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
        }
        catch (err) {
            this.logger.error('Failed to create upload_jobs table:', err.message);
        }
    }
    async getJobsByCompany(companyId) {
        return await this.jobRepository.find({
            where: { companyId },
            order: { created_at: 'DESC' },
        });
    }
    async getJob(jobId) {
        return await this.jobRepository.findOne({
            where: { id: jobId },
        });
    }
    async cancelJob(jobId) {
        const job = await this.jobRepository.findOne({ where: { id: jobId } });
        if (!job)
            return null;
        if (job.status === 'processing') {
            job.status = 'cancelled';
            return await this.jobRepository.save(job);
        }
        return job;
    }
    async startBackgroundUpload(companyId, fileName, instruments, userId) {
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
        this.processUploadInBackground(savedJob.id, instruments);
        return savedJob;
    }
    async processUploadInBackground(jobId, instruments) {
        const batchSize = 1;
        let processed = 0;
        let success = 0;
        let failed = 0;
        const errorsList = [];
        this.logger.log(`Starting background upload process for Job ID: ${jobId} with ${instruments.length} rows.`);
        try {
            for (let i = 0; i < instruments.length; i += batchSize) {
                const liveJob = await this.jobRepository.findOne({ where: { id: jobId } });
                if (!liveJob || liveJob.status === 'cancelled') {
                    this.logger.log(`Job ID: ${jobId} was cancelled by user. Terminating background loop.`);
                    return;
                }
                const batch = instruments.slice(i, i + batchSize);
                const result = await this.instrumentsService.bulkUpload(batch);
                if (result) {
                    success += result.successCount;
                    failed += result.failedCount;
                    if (result.rejected && result.rejected.length > 0) {
                        const batchRejected = result.rejected.map((rej, index) => {
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
                }
                else {
                    failed += batch.length;
                    errorsList.push(...batch.map((item, index) => ({
                        row: i + index + 1,
                        id_code: item.id_code,
                        error: 'Failed to process batch',
                        raw: item,
                    })));
                }
                processed += batch.length;
                await this.jobRepository.update(jobId, {
                    processedRows: processed,
                    successCount: success,
                    failedCount: failed,
                    errors: errorsList,
                });
                await new Promise(resolve => setTimeout(resolve, 2));
            }
            await this.jobRepository.update(jobId, {
                status: 'completed',
            });
            this.logger.log(`Background upload completed successfully for Job ID: ${jobId}.`);
        }
        catch (err) {
            this.logger.error(`Error processing background job ${jobId}: ${err.message}`);
            await this.jobRepository.update(jobId, {
                status: 'failed',
            });
        }
    }
};
exports.UploadJobsService = UploadJobsService;
exports.UploadJobsService = UploadJobsService = UploadJobsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(upload_job_entity_1.UploadJob)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        instruments_service_1.InstrumentsService])
], UploadJobsService);
//# sourceMappingURL=upload-jobs.service.js.map