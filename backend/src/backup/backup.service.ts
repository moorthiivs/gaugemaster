import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackupRecord } from './backup-record.entity';
import { BackupSchedule } from './backup-schedule.entity';
import { CreateBackupScheduleDto } from './dto/create-backup-schedule.dto';
import { GoogleDriveService } from './google-drive.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);


const execAsync = promisify(exec);

@Injectable()
export class BackupService {
    private readonly logger = new Logger(BackupService.name);
    private readonly backupDir: string;
    private readonly pgDumpPath: string;

    constructor(
        @InjectRepository(BackupRecord)
        private readonly backupRecordRepo: Repository<BackupRecord>,
        @InjectRepository(BackupSchedule)
        private readonly backupScheduleRepo: Repository<BackupSchedule>,
        private readonly configService: ConfigService,
        private readonly googleDriveService: GoogleDriveService,
    ) {
        // Store backups in a 'backups' directory at project root
        this.backupDir = path.resolve(process.cwd(), 'backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }

        // Auto-detect pg_dump path
        this.pgDumpPath = this.findPgDump();
        this.logger.log(`pg_dump located at: ${this.pgDumpPath}`);
    }

    /** Search for pg_dump in common installation paths (Windows) or fall back to PATH */
    private findPgDump(): string {
        if (process.platform === 'win32') {
            // Search common PostgreSQL install locations on Windows
            const programDirs = [
                'C:\\Program Files\\PostgreSQL',
                'C:\\Program Files (x86)\\PostgreSQL',
            ];
            for (const baseDir of programDirs) {
                if (fs.existsSync(baseDir)) {
                    try {
                        const versions = fs.readdirSync(baseDir).sort().reverse(); // newest first
                        for (const ver of versions) {
                            const pgDump = path.join(baseDir, ver, 'bin', 'pg_dump.exe');
                            if (fs.existsSync(pgDump)) {
                                return `"${pgDump}"`;
                            }
                        }
                    } catch { /* ignore read errors */ }
                }
            }
        }
        // Fallback: assume pg_dump is in PATH (Linux, Mac, Docker, or custom install)
        return 'pg_dump';
    }

    // ─── INSTANT BACKUP ──────────────────────────────────────────────

    async createBackup(companyId: string, userId?: string): Promise<BackupRecord> {
        // Create a record first
        const record = this.backupRecordRepo.create({
            companyId,
            triggeredBy: userId || undefined,
            type: userId ? 'manual' : 'scheduled',
            status: 'in_progress',
            storageType: 'local',
        });
        const saved = await this.backupRecordRepo.save(record);

        // Run in background (don't await to unblock the response)
        this.runBackup(saved).catch(err => {
            this.logger.error(`Backup ${saved.id} failed: ${err.message}`);
        });

        return saved;
    }

    private async runBackup(record: BackupRecord): Promise<void> {
        const dbHost = this.configService.get('DB_HOST');
        const dbPort = this.configService.get('DB_PORT') || '5432';
        const dbUser = this.configService.get('DB_USERNAME');
        const dbPass = this.configService.get('DB_PASSWORD');
        const dbName = this.configService.get('DB_NAME');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sqlFileName = `backup_${record.companyId}_${timestamp}.sql`;
        const gzFileName = `${sqlFileName}.gz`;
        const sqlFilePath = path.join(this.backupDir, sqlFileName);
        const gzFilePath = path.join(this.backupDir, gzFileName);

        try {
            // Build pg_dump command with SSL mode for Azure
            const pgDumpCmd = `${this.pgDumpPath} --host=${dbHost} --port=${dbPort} --username=${dbUser} --dbname=${dbName} --no-password --file="${sqlFilePath}"`;

            // Set password and SSL mode via env variable
            const sslMode = this.configService.get('DB_SSLMODE') || 'prefer';
            const env = { ...process.env, PGPASSWORD: dbPass, PGSSLMODE: sslMode };

            this.logger.log(`Starting pg_dump for company ${record.companyId}...`);
            await execAsync(pgDumpCmd, { env, timeout: 300000 }); // 5 min timeout

            // Compress the SQL file
            this.logger.log('Compressing backup...');
            await pipeline(
                fs.createReadStream(sqlFilePath),
                zlib.createGzip({ level: 9 }),
                fs.createWriteStream(gzFilePath),
            );

            // Remove the uncompressed file
            fs.unlinkSync(sqlFilePath);

            // Get file size
            const stats = fs.statSync(gzFilePath);

            // Upload to Google Drive if connected
            let driveFileId: string | undefined;
            try {
                const driveStatus = await this.googleDriveService.getConnectionStatus(record.companyId);
                if (driveStatus.connected) {
                    this.logger.log('Uploading backup to Google Drive...');
                    driveFileId = await this.googleDriveService.uploadBackup(record.companyId, gzFilePath, gzFileName);
                    this.logger.log(`Uploaded to Google Drive (File ID: ${driveFileId})`);
                }
            } catch (driveError: any) {
                this.logger.warn(`Google Drive upload failed (backup still saved locally): ${driveError.message}`);
            }

            // Update record
            record.status = 'completed';
            record.fileName = gzFileName;
            record.fileSizeBytes = stats.size;
            record.storagePath = gzFilePath;
            record.storageType = driveFileId ? 'google_drive' : 'local';
            record.completedAt = new Date();
            await this.backupRecordRepo.save(record);

            this.logger.log(`Backup completed: ${gzFileName} (${this.formatBytes(stats.size)})${driveFileId ? ' + uploaded to Drive' : ''}`);
        } catch (error: any) {
            record.status = 'failed';
            record.errorMessage = error.message?.substring(0, 500);
            record.completedAt = new Date();
            await this.backupRecordRepo.save(record);

            // Cleanup partial files
            if (fs.existsSync(sqlFilePath)) fs.unlinkSync(sqlFilePath);
            if (fs.existsSync(gzFilePath)) fs.unlinkSync(gzFilePath);

            this.logger.error(`Backup failed: ${error.message}`);
            throw error;
        }
    }

    // ─── LIST BACKUPS ────────────────────────────────────────────────

    async listBackups(companyId: string): Promise<BackupRecord[]> {
        return this.backupRecordRepo.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
            take: 50,
        });
    }

    // ─── DOWNLOAD BACKUP ─────────────────────────────────────────────

    async getBackupFilePath(backupId: string, companyId: string): Promise<{ filePath: string; fileName: string }> {
        const record = await this.backupRecordRepo.findOne({
            where: { id: backupId, companyId },
        });

        if (!record) {
            throw new NotFoundException('Backup not found');
        }
        if (record.status !== 'completed') {
            throw new BadRequestException('Backup is not yet completed');
        }
        if (!record.storagePath || !fs.existsSync(record.storagePath)) {
            throw new NotFoundException('Backup file not found on disk');
        }

        return { filePath: record.storagePath, fileName: record.fileName };
    }

    // ─── DELETE BACKUP ───────────────────────────────────────────────

    async deleteBackup(backupId: string, companyId: string): Promise<void> {
        const record = await this.backupRecordRepo.findOne({
            where: { id: backupId, companyId },
        });

        if (!record) {
            throw new NotFoundException('Backup not found');
        }

        // Delete file from disk
        if (record.storagePath && fs.existsSync(record.storagePath)) {
            fs.unlinkSync(record.storagePath);
        }

        await this.backupRecordRepo.remove(record);
    }

    // ─── SCHEDULE MANAGEMENT ─────────────────────────────────────────

    async getSchedule(companyId: string): Promise<BackupSchedule | null> {
        return this.backupScheduleRepo.findOne({ where: { companyId } });
    }

    async saveSchedule(dto: CreateBackupScheduleDto): Promise<BackupSchedule> {
        let schedule = await this.backupScheduleRepo.findOne({ where: { companyId: dto.companyId } });

        if (schedule) {
            Object.assign(schedule, dto);
        } else {
            schedule = this.backupScheduleRepo.create(dto);
        }

        return this.backupScheduleRepo.save(schedule);
    }

    async deleteSchedule(companyId: string): Promise<void> {
        await this.backupScheduleRepo.delete({ companyId });
    }

    // ─── SCHEDULED JOB — runs every minute, checks if any schedule is due ─

    @Cron(CronExpression.EVERY_MINUTE)
    async handleScheduledBackups(): Promise<void> {
        const schedules = await this.backupScheduleRepo.find({ where: { enabled: true } });
        if (!schedules.length) return;

        // Get current local time in India (IST, Asia/Kolkata)
        const nowIST = dayjs().tz('Asia/Kolkata');
        const currentHour = nowIST.hour();
        const currentMinute = nowIST.minute();
        const currentDay = nowIST.day(); // 0=Sun
        const currentDate = nowIST.date();

        for (const schedule of schedules) {
            const [schedHour, schedMinute] = (schedule.timeOfDay || '02:00').split(':').map(Number);
            if (currentHour !== schedHour || currentMinute !== schedMinute) continue;

            let shouldRun = false;

            switch (schedule.frequency) {
                case 'daily':
                    shouldRun = true;
                    break;
                case 'weekly':
                    shouldRun = currentDay === (schedule.dayOfWeek ?? 0);
                    break;
                case 'monthly':
                    shouldRun = currentDate === (schedule.dayOfMonth ?? 1);
                    break;
            }

            if (shouldRun) {
                // Check if backup already ran in the last 5 minutes (avoid duplicate runs)
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                const recentBackup = await this.backupRecordRepo.findOne({
                    where: {
                        companyId: schedule.companyId,
                        type: 'scheduled',
                        createdAt: LessThan(new Date()),
                    },
                    order: { createdAt: 'DESC' },
                });

                if (recentBackup && recentBackup.createdAt > fiveMinutesAgo) {
                    continue; // Already ran recently
                }

                this.logger.log(`Running scheduled backup for company ${schedule.companyId}`);
                await this.createBackup(schedule.companyId);
            }
        }

        // Run retention cleanup once a day at 2:00 AM local time
        if (currentHour === 2 && currentMinute === 0) {
            await this.cleanupOldBackups();
        }
    }

    // ─── CLEANUP OLD BACKUPS ─────────────────────────────────────────

    private async cleanupOldBackups(): Promise<void> {
        const schedules = await this.backupScheduleRepo.find({ where: { enabled: true } });

        for (const schedule of schedules) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - schedule.retentionDays);

            const oldBackups = await this.backupRecordRepo.find({
                where: {
                    companyId: schedule.companyId,
                    createdAt: LessThan(cutoffDate),
                },
            });

            for (const backup of oldBackups) {
                if (backup.storagePath && fs.existsSync(backup.storagePath)) {
                    fs.unlinkSync(backup.storagePath);
                    this.logger.log(`Deleted old backup file: ${backup.fileName}`);
                }
                await this.backupRecordRepo.remove(backup);
            }
        }
    }

    // ─── HELPERS ─────────────────────────────────────────────────────

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
