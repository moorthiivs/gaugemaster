export declare class UploadJob {
    id: string;
    companyId: string;
    fileName: string;
    status: string;
    totalRows: number;
    processedRows: number;
    successCount: number;
    failedCount: number;
    errors: any[];
    createdBy: string;
    created_at: Date;
    updated_at: Date;
}
