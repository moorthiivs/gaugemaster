import { OnModuleInit } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { UploadJob } from './upload-job.entity';
import { InstrumentsService } from '../instruments/instruments.service';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
export declare class UploadJobsService implements OnModuleInit {
    private readonly jobRepository;
    private readonly dataSource;
    private readonly instrumentsService;
    private readonly logger;
    constructor(jobRepository: Repository<UploadJob>, dataSource: DataSource, instrumentsService: InstrumentsService);
    onModuleInit(): Promise<void>;
    getJobsByCompany(companyId: string): Promise<UploadJob[]>;
    getJob(jobId: string): Promise<UploadJob | null>;
    cancelJob(jobId: string): Promise<UploadJob | null>;
    startBackgroundUpload(companyId: string, fileName: string, instruments: CreateInstrumentDto[], userId: string): Promise<UploadJob>;
    private processUploadInBackground;
}
