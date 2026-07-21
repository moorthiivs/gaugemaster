import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BackupRecord } from './backup-record.entity';
import { BackupSchedule } from './backup-schedule.entity';
import { CreateBackupScheduleDto } from './dto/create-backup-schedule.dto';
import { GoogleDriveService } from './google-drive.service';
export declare class BackupService {
    private readonly backupRecordRepo;
    private readonly backupScheduleRepo;
    private readonly configService;
    private readonly googleDriveService;
    private readonly logger;
    private readonly backupDir;
    private readonly pgDumpPath;
    constructor(backupRecordRepo: Repository<BackupRecord>, backupScheduleRepo: Repository<BackupSchedule>, configService: ConfigService, googleDriveService: GoogleDriveService);
    private findPgDump;
    createBackup(companyId: string, userId?: string): Promise<BackupRecord>;
    private runBackup;
    listBackups(companyId: string): Promise<BackupRecord[]>;
    getBackupFilePath(backupId: string, companyId: string): Promise<{
        filePath: string;
        fileName: string;
    }>;
    deleteBackup(backupId: string, companyId: string): Promise<void>;
    getSchedule(companyId: string): Promise<BackupSchedule | null>;
    saveSchedule(dto: CreateBackupScheduleDto): Promise<BackupSchedule>;
    deleteSchedule(companyId: string): Promise<void>;
    handleScheduledBackups(): Promise<void>;
    private cleanupOldBackups;
    private formatBytes;
}
