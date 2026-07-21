import { UploadJobsService } from './upload-jobs.service';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
export declare class UploadJobsController {
    private readonly uploadJobsService;
    constructor(uploadJobsService: UploadJobsService);
    startBackgroundUpload(companyId: string, body: {
        fileName: string;
        instruments: CreateInstrumentDto[];
        userId: string;
    }): Promise<import("./upload-job.entity").UploadJob>;
    getJobStatus(id: string): Promise<import("./upload-job.entity").UploadJob | null>;
    getCompanyJobs(companyId: string): Promise<import("./upload-job.entity").UploadJob[]>;
    cancelJob(id: string): Promise<import("./upload-job.entity").UploadJob | null>;
}
