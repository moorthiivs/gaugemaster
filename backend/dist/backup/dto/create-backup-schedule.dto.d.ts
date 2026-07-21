export declare class CreateBackupScheduleDto {
    companyId: string;
    enabled?: boolean;
    frequency: string;
    timeOfDay?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    retentionDays?: number;
    storageType?: string;
}
