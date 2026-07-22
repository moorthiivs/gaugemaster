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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const express = __importStar(require("express"));
const backup_service_1 = require("./backup.service");
const google_drive_service_1 = require("./google-drive.service");
const create_backup_schedule_dto_1 = require("./dto/create-backup-schedule.dto");
let BackupController = class BackupController {
    backupService;
    googleDriveService;
    configService;
    frontendUrl;
    constructor(backupService, googleDriveService, configService) {
        this.backupService = backupService;
        this.googleDriveService = googleDriveService;
        this.configService = configService;
        this.frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:8080';
    }
    async createBackup(companyId, userId) {
        return this.backupService.createBackup(companyId, userId);
    }
    async listBackups(companyId) {
        return this.backupService.listBackups(companyId);
    }
    async downloadBackup(id, companyId, res) {
        const { filePath, fileName } = await this.backupService.getBackupFilePath(id, companyId);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/gzip');
        res.sendFile(filePath);
    }
    async deleteBackup(id, companyId) {
        await this.backupService.deleteBackup(id, companyId);
        return { message: 'Backup deleted' };
    }
    async getSchedule(companyId) {
        return this.backupService.getSchedule(companyId);
    }
    async saveSchedule(dto) {
        return this.backupService.saveSchedule(dto);
    }
    async deleteSchedule(companyId) {
        await this.backupService.deleteSchedule(companyId);
        return { message: 'Schedule deleted' };
    }
    async driveStatus(companyId) {
        return {
            enabled: this.googleDriveService.enabled,
            ...await this.googleDriveService.getConnectionStatus(companyId),
        };
    }
    async driveAuthUrl(companyId) {
        if (!this.googleDriveService.enabled) {
            return { error: 'Google Drive is not configured on this server' };
        }
        return { url: this.googleDriveService.getAuthUrl(companyId) };
    }
    async driveCallback(code, companyId, req, res) {
        try {
            await this.googleDriveService.handleCallback(code, companyId);
            const envUrl = this.configService.get('FRONTEND_URL');
            const host = req.get('host');
            const proto = req.headers['x-forwarded-proto'] || req.protocol;
            const baseUrl = envUrl || (host && host.includes('localhost') ? 'http://localhost:8080' : `${proto}://${host}`);
            res.redirect(`${baseUrl}/settings?tab=backup&drive=connected`);
        }
        catch (error) {
            const envUrl = this.configService.get('FRONTEND_URL');
            const host = req.get('host');
            const proto = req.headers['x-forwarded-proto'] || req.protocol;
            const baseUrl = envUrl || (host && host.includes('localhost') ? 'http://localhost:8080' : `${proto}://${host}`);
            res.redirect(`${baseUrl}/settings?tab=backup&drive=error&message=${encodeURIComponent(error.message)}`);
        }
    }
    async driveDisconnect(companyId) {
        await this.googleDriveService.disconnect(companyId);
        return { message: 'Google Drive disconnected' };
    }
};
exports.BackupController = BackupController;
__decorate([
    (0, common_1.Post)('now'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger an instant database backup' }),
    __param(0, (0, common_1.Body)('companyId')),
    __param(1, (0, common_1.Body)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "createBackup", null);
__decorate([
    (0, common_1.Get)('list'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiOperation)({ summary: 'List all backups for a company' }),
    __param(0, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "listBackups", null);
__decorate([
    (0, common_1.Get)('download/:id'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiOperation)({ summary: 'Download a backup file' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('companyId')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, typeof (_a = typeof express !== "undefined" && express.Response) === "function" ? _a : Object]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "downloadBackup", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a backup' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "deleteBackup", null);
__decorate([
    (0, common_1.Get)('schedule'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiOperation)({ summary: 'Get backup schedule for a company' }),
    __param(0, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "getSchedule", null);
__decorate([
    (0, common_1.Post)('schedule'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiOperation)({ summary: 'Create or update backup schedule' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_backup_schedule_dto_1.CreateBackupScheduleDto]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "saveSchedule", null);
__decorate([
    (0, common_1.Delete)('schedule'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiOperation)({ summary: 'Delete backup schedule' }),
    __param(0, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "deleteSchedule", null);
__decorate([
    (0, common_1.Get)('drive/status'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiOperation)({ summary: 'Check Google Drive connection status' }),
    __param(0, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "driveStatus", null);
__decorate([
    (0, common_1.Get)('drive/auth-url'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiOperation)({ summary: 'Get Google Drive OAuth URL' }),
    __param(0, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "driveAuthUrl", null);
__decorate([
    (0, common_1.Get)('drive/callback'),
    (0, swagger_1.ApiOperation)({ summary: 'Handle Google Drive OAuth callback' }),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, typeof (_b = typeof express !== "undefined" && express.Request) === "function" ? _b : Object, typeof (_c = typeof express !== "undefined" && express.Response) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "driveCallback", null);
__decorate([
    (0, common_1.Delete)('drive/disconnect'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiOperation)({ summary: 'Disconnect Google Drive' }),
    __param(0, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BackupController.prototype, "driveDisconnect", null);
exports.BackupController = BackupController = __decorate([
    (0, swagger_1.ApiTags)('api/backup'),
    (0, common_1.Controller)('api/backup'),
    __metadata("design:paramtypes", [backup_service_1.BackupService,
        google_drive_service_1.GoogleDriveService,
        config_1.ConfigService])
], BackupController);
//# sourceMappingURL=backup.controller.js.map