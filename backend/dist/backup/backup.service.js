"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var BackupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const backup_record_entity_1 = require("./backup-record.entity");
const backup_schedule_entity_1 = require("./backup-schedule.entity");
const google_drive_service_1 = require("./google-drive.service");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zlib = __importStar(require("zlib"));
const promises_1 = require("stream/promises");
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let BackupService = BackupService_1 = class BackupService {
    backupRecordRepo;
    backupScheduleRepo;
    configService;
    googleDriveService;
    logger = new common_1.Logger(BackupService_1.name);
    backupDir;
    pgDumpPath;
    constructor(backupRecordRepo, backupScheduleRepo, configService, googleDriveService) {
        this.backupRecordRepo = backupRecordRepo;
        this.backupScheduleRepo = backupScheduleRepo;
        this.configService = configService;
        this.googleDriveService = googleDriveService;
        this.backupDir = path.resolve(process.cwd(), 'backups');
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
        this.pgDumpPath = this.findPgDump();
        this.logger.log(`pg_dump located at: ${this.pgDumpPath}`);
    }
    findPgDump() {
        if (process.platform === 'win32') {
            const programDirs = [
                'C:\\Program Files\\PostgreSQL',
                'C:\\Program Files (x86)\\PostgreSQL',
            ];
            for (const baseDir of programDirs) {
                if (fs.existsSync(baseDir)) {
                    try {
                        const versions = fs.readdirSync(baseDir).sort().reverse();
                        for (const ver of versions) {
                            const pgDump = path.join(baseDir, ver, 'bin', 'pg_dump.exe');
                            if (fs.existsSync(pgDump)) {
                                return `"${pgDump}"`;
                            }
                        }
                    }
                    catch { }
                }
            }
        }
        return 'pg_dump';
    }
    async createBackup(companyId, userId) {
        const record = this.backupRecordRepo.create({
            companyId,
            triggeredBy: userId || undefined,
            type: userId ? 'manual' : 'scheduled',
            status: 'in_progress',
            storageType: 'local',
        });
        const saved = await this.backupRecordRepo.save(record);
        this.runBackup(saved).catch(err => {
            this.logger.error(`Backup ${saved.id} failed: ${err.message}`);
        });
        return saved;
    }
    async runBackup(record) {
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
            const pgDumpCmd = `${this.pgDumpPath} --host=${dbHost} --port=${dbPort} --username=${dbUser} --dbname=${dbName} --no-password --file="${sqlFilePath}"`;
            const sslMode = this.configService.get('DB_SSLMODE') || 'prefer';
            const env = { ...process.env, PGPASSWORD: dbPass, PGSSLMODE: sslMode };
            this.logger.log(`Starting pg_dump for company ${record.companyId}...`);
            await execAsync(pgDumpCmd, { env, timeout: 300000 });
            this.logger.log('Compressing backup...');
            await (0, promises_1.pipeline)(fs.createReadStream(sqlFilePath), zlib.createGzip({ level: 9 }), fs.createWriteStream(gzFilePath));
            fs.unlinkSync(sqlFilePath);
            const stats = fs.statSync(gzFilePath);
            let driveFileId;
            try {
                const driveStatus = await this.googleDriveService.getConnectionStatus(record.companyId);
                if (driveStatus.connected) {
                    this.logger.log('Uploading backup to Google Drive...');
                    driveFileId = await this.googleDriveService.uploadBackup(record.companyId, gzFilePath, gzFileName);
                    this.logger.log(`Uploaded to Google Drive (File ID: ${driveFileId})`);
                }
            }
            catch (driveError) {
                this.logger.warn(`Google Drive upload failed (backup still saved locally): ${driveError.message}`);
            }
            record.status = 'completed';
            record.fileName = gzFileName;
            record.fileSizeBytes = stats.size;
            record.storagePath = gzFilePath;
            record.storageType = driveFileId ? 'google_drive' : 'local';
            record.completedAt = new Date();
            await this.backupRecordRepo.save(record);
            this.logger.log(`Backup completed: ${gzFileName} (${this.formatBytes(stats.size)})${driveFileId ? ' + uploaded to Drive' : ''}`);
        }
        catch (error) {
            record.status = 'failed';
            record.errorMessage = error.message?.substring(0, 500);
            record.completedAt = new Date();
            await this.backupRecordRepo.save(record);
            if (fs.existsSync(sqlFilePath))
                fs.unlinkSync(sqlFilePath);
            if (fs.existsSync(gzFilePath))
                fs.unlinkSync(gzFilePath);
            this.logger.error(`Backup failed: ${error.message}`);
            throw error;
        }
    }
    async listBackups(companyId) {
        return this.backupRecordRepo.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
            take: 50,
        });
    }
    async getBackupFilePath(backupId, companyId) {
        const record = await this.backupRecordRepo.findOne({
            where: { id: backupId, companyId },
        });
        if (!record) {
            throw new common_1.NotFoundException('Backup not found');
        }
        if (record.status !== 'completed') {
            throw new common_1.BadRequestException('Backup is not yet completed');
        }
        if (!record.storagePath || !fs.existsSync(record.storagePath)) {
            throw new common_1.NotFoundException('Backup file not found on disk');
        }
        return { filePath: record.storagePath, fileName: record.fileName };
    }
    async deleteBackup(backupId, companyId) {
        const record = await this.backupRecordRepo.findOne({
            where: { id: backupId, companyId },
        });
        if (!record) {
            throw new common_1.NotFoundException('Backup not found');
        }
        if (record.storagePath && fs.existsSync(record.storagePath)) {
            fs.unlinkSync(record.storagePath);
        }
        await this.backupRecordRepo.remove(record);
    }
    async getSchedule(companyId) {
        return this.backupScheduleRepo.findOne({ where: { companyId } });
    }
    async saveSchedule(dto) {
        let schedule = await this.backupScheduleRepo.findOne({ where: { companyId: dto.companyId } });
        if (schedule) {
            Object.assign(schedule, dto);
        }
        else {
            schedule = this.backupScheduleRepo.create(dto);
        }
        return this.backupScheduleRepo.save(schedule);
    }
    async deleteSchedule(companyId) {
        await this.backupScheduleRepo.delete({ companyId });
    }
    async handleScheduledBackups() {
        const schedules = await this.backupScheduleRepo.find({ where: { enabled: true } });
        if (!schedules.length)
            return;
        const nowIST = (0, dayjs_1.default)().tz('Asia/Kolkata');
        const currentHour = nowIST.hour();
        const currentMinute = nowIST.minute();
        const currentDay = nowIST.day();
        const currentDate = nowIST.date();
        for (const schedule of schedules) {
            const [schedHour, schedMinute] = (schedule.timeOfDay || '02:00').split(':').map(Number);
            if (currentHour !== schedHour || currentMinute !== schedMinute)
                continue;
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
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                const recentBackup = await this.backupRecordRepo.findOne({
                    where: {
                        companyId: schedule.companyId,
                        type: 'scheduled',
                        createdAt: (0, typeorm_2.LessThan)(new Date()),
                    },
                    order: { createdAt: 'DESC' },
                });
                if (recentBackup && recentBackup.createdAt > fiveMinutesAgo) {
                    continue;
                }
                this.logger.log(`Running scheduled backup for company ${schedule.companyId}`);
                await this.createBackup(schedule.companyId);
            }
        }
        if (currentHour === 2 && currentMinute === 0) {
            await this.cleanupOldBackups();
        }
    }
    async cleanupOldBackups() {
        const schedules = await this.backupScheduleRepo.find({ where: { enabled: true } });
        for (const schedule of schedules) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - schedule.retentionDays);
            const oldBackups = await this.backupRecordRepo.find({
                where: {
                    companyId: schedule.companyId,
                    createdAt: (0, typeorm_2.LessThan)(cutoffDate),
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
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};
exports.BackupService = BackupService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BackupService.prototype, "handleScheduledBackups", null);
exports.BackupService = BackupService = BackupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(backup_record_entity_1.BackupRecord)),
    __param(1, (0, typeorm_1.InjectRepository)(backup_schedule_entity_1.BackupSchedule)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        config_1.ConfigService,
        google_drive_service_1.GoogleDriveService])
], BackupService);
//# sourceMappingURL=backup.service.js.map