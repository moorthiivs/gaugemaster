import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { BackupService } from './backup.service';
import { GoogleDriveService } from './google-drive.service';
import { CreateBackupScheduleDto } from './dto/create-backup-schedule.dto';
export declare class BackupController {
    private readonly backupService;
    private readonly googleDriveService;
    private readonly configService;
    private readonly frontendUrl;
    constructor(backupService: BackupService, googleDriveService: GoogleDriveService, configService: ConfigService);
    createBackup(companyId: string, userId: string): Promise<import("./backup-record.entity").BackupRecord>;
    listBackups(companyId: string): Promise<import("./backup-record.entity").BackupRecord[]>;
    downloadBackup(id: string, companyId: string, res: express.Response): Promise<void>;
    deleteBackup(id: string, companyId: string): Promise<{
        message: string;
    }>;
    getSchedule(companyId: string): Promise<import("./backup-schedule.entity").BackupSchedule | null>;
    saveSchedule(dto: CreateBackupScheduleDto): Promise<import("./backup-schedule.entity").BackupSchedule>;
    deleteSchedule(companyId: string): Promise<{
        message: string;
    }>;
    driveStatus(companyId: string): Promise<{
        connected: boolean;
        email?: string;
        enabled: boolean;
    }>;
    driveAuthUrl(companyId: string): Promise<{
        error: string;
        url?: undefined;
    } | {
        url: string;
        error?: undefined;
    }>;
    driveCallback(code: string, companyId: string, req: express.Request, res: express.Response): Promise<void>;
    driveDisconnect(companyId: string): Promise<{
        message: string;
    }>;
}
