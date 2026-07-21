export declare class BackupRecord {
    id: string;
    companyId: string;
    triggeredBy: string;
    type: string;
    status: string;
    fileName: string;
    fileSizeBytes: number;
    storageType: string;
    storagePath: string;
    errorMessage: string;
    createdAt: Date;
    completedAt: Date;
}
