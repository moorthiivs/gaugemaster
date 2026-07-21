export declare class BackupSchedule {
    id: string;
    companyId: string;
    enabled: boolean;
    frequency: string;
    timeOfDay: string;
    dayOfWeek: number;
    dayOfMonth: number;
    retentionDays: number;
    storageType: string;
    createdAt: Date;
    updatedAt: Date;
}
