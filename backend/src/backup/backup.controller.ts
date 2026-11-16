import {
    Controller, Get, Post, Delete, Body, Param, Query, Res, Req, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import * as express from 'express';
import { BackupService } from './backup.service';
import { GoogleDriveService } from './google-drive.service';
import { CreateBackupScheduleDto } from './dto/create-backup-schedule.dto';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

@ApiTags('api/backup')
@ApiBearerAuth()
@Controller('api/backup')
export class BackupController {
    private readonly frontendUrl: string;

    constructor(
        private readonly backupService: BackupService,
        private readonly googleDriveService: GoogleDriveService,
        private readonly configService: ConfigService,
    ) {
        // In dev, frontend is on 8080; in prod, same origin serves both
        this.frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:8080';
    }

    private getEffectiveCompanyId(req: any, clientCompanyId?: string): string {
        const user = req.user || {};
        const companyId = user.isSuperAdmin ? (clientCompanyId || user.companyId) : user.companyId;
        if (!companyId) {
            throw new ForbiddenException('Company context required');
        }
        if (!user.isSuperAdmin && clientCompanyId && clientCompanyId !== user.companyId) {
            throw new ForbiddenException('Access denied to other company backups');
        }
        return companyId;
    }

    // ─── INSTANT BACKUP ──────────────────────────────────────────

    @Post('now')
    @UseGuards(AuthGuard('jwt'), PermissionsGuard)
    @RequirePermission('settings', 'edit')
    @ApiOperation({ summary: 'Trigger an instant database backup' })
    async createBackup(
        @Body('companyId') clientCompanyId: string,
        @Body('userId') bodyUserId: string,
        @Req() req: any,
    ) {
        const user = req.user || {};
        const companyId = this.getEffectiveCompanyId(req, clientCompanyId);
        const userId = user.userId || user.id || bodyUserId;
        return this.backupService.createBackup(companyId, userId);
    }

    // ─── LIST BACKUPS ────────────────────────────────────────────

    @Get('list')
    @UseGuards(AuthGuard('jwt'), PermissionsGuard)
    @RequirePermission('settings', 'view')
    @ApiOperation({ summary: 'List all backups for a company' })
    async listBackups(@Query('companyId') clientCompanyId: string, @Req() req: any) {
        const companyId = this.getEffectiveCompanyId(req, clientCompanyId);
        return this.backupService.listBackups(companyId);
    }

    // ─── DOWNLOAD BACKUP ─────────────────────────────────────────

    @Get('download/:id')
    @UseGuards(AuthGuard('jwt'), PermissionsGuard)
    @RequirePermission('settings', 'view')
    @ApiOperation({ summary: 'Download a backup file' })
    async downloadBackup(
        @Param('id') id: string,
        @Query('companyId') clientCompanyId: string,
        @Res() res: express.Response,
        @Req() req: any,
    ) {
        const companyId = this.getEffectiveCompanyId(req, clientCompanyId);
        const { filePath, fileName } = await this.backupService.getBackupFilePath(id, companyId);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/gzip');
        res.sendFile(filePath);
    }

    // ─── DELETE BACKUP ───────────────────────────────────────────

    @Delete(':id')
    @UseGuards(AuthGuard('jwt'), PermissionsGuard)
    @RequirePermission('settings', 'edit')
    @ApiOperation({ summary: 'Delete a backup' })
    async deleteBackup(
        @Param('id') id: string,
        @Query('companyId') clientCompanyId: string,
        @Req() req: any,
    ) {
        const companyId = this.getEffectiveCompanyId(req, clientCompanyId);
        await this.backupService.deleteBackup(id, companyId);
        return { message: 'Backup deleted' };
    }

    // ─── SCHEDULE ────────────────────────────────────────────────

    @Get('schedule')
    @UseGuards(AuthGuard('jwt'), PermissionsGuard)
    @RequirePermission('settings', 'view')
    @ApiOperation({ summary: 'Get backup schedule for a company' })
    async getSchedule(@Query('companyId') clientCompanyId: string, @Req() req: any) {
        const companyId = this.getEffectiveCompanyId(req, clientCompanyId);
        return this.backupService.getSchedule(companyId);
    }

    @Post('schedule')
    @UseGuards(AuthGuard('jwt'), PermissionsGuard)
    @RequirePermission('settings', 'edit')
    @ApiOperation({ summary: 'Create or update backup schedule' })
    async saveSchedule(@Body() dto: CreateBackupScheduleDto, @Req() req: any) {
        const companyId = this.getEffectiveCompanyId(req, dto.companyId);
        return this.backupService.saveSchedule({
            ...dto,
            companyId,
        });
    }

    @Delete('schedule')
    @UseGuards(AuthGuard('jwt'), PermissionsGuard)
    @RequirePermission('settings', 'edit')
    @ApiOperation({ summary: 'Delete backup schedule' })
    async deleteSchedule(@Query('companyId') clientCompanyId: string, @Req() req: any) {
        const companyId = this.getEffectiveCompanyId(req, clientCompanyId);
        await this.backupService.deleteSchedule(companyId);
        return { message: 'Schedule deleted' };
    }

    // ─── GOOGLE DRIVE ────────────────────────────────────────────

    @Get('drive/status')
    @UseGuards(AuthGuard('jwt'), PermissionsGuard)
    @RequirePermission('settings', 'view')
    @ApiOperation({ summary: 'Check Google Drive connection status' })
    async driveStatus(@Query('companyId') clientCompanyId: string, @Req() req: any) {
        const companyId = this.getEffectiveCompanyId(req, clientCompanyId);
        return {
            enabled: this.googleDriveService.enabled,
            ...await this.googleDriveService.getConnectionStatus(companyId),
        };
    }

    @Get('drive/auth-url')
    @UseGuards(AuthGuard('jwt'), PermissionsGuard)
    @RequirePermission('settings', 'view')
    @ApiOperation({ summary: 'Get Google Drive OAuth URL' })
    async driveAuthUrl(@Query('companyId') clientCompanyId: string, @Req() req: any) {
        if (!this.googleDriveService.enabled) {
            return { error: 'Google Drive is not configured on this server' };
        }
        const companyId = this.getEffectiveCompanyId(req, clientCompanyId);
        return { url: this.googleDriveService.getAuthUrl(companyId) };
    }

    /** PUBLIC — Google redirects here after OAuth consent (no JWT) */
    @Get('drive/callback')
    @ApiOperation({ summary: 'Handle Google Drive OAuth callback' })
    async driveCallback(
        @Query('code') code: string,
        @Query('state') rawState: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ) {
        try {
            await this.googleDriveService.handleCallback(code, rawState);
            
            const envUrl = this.configService.get('FRONTEND_URL');
            const host = req.get('host');
            const proto = req.headers['x-forwarded-proto'] || req.protocol;
            const baseUrl = envUrl || (host && host.includes('localhost') ? 'http://localhost:8080' : `${proto}://${host}`);
            
            res.redirect(`${baseUrl}/settings?tab=backup&drive=connected`);
        } catch (error: any) {
            const envUrl = this.configService.get('FRONTEND_URL');
            const host = req.get('host');
            const proto = req.headers['x-forwarded-proto'] || req.protocol;
            const baseUrl = envUrl || (host && host.includes('localhost') ? 'http://localhost:8080' : `${proto}://${host}`);
            
            res.redirect(`${baseUrl}/settings?tab=backup&drive=error&message=${encodeURIComponent(error.message)}`);
        }
    }

    @Delete('drive/disconnect')
    @UseGuards(AuthGuard('jwt'), PermissionsGuard)
    @RequirePermission('settings', 'edit')
    @ApiOperation({ summary: 'Disconnect Google Drive' })
    async driveDisconnect(@Query('companyId') clientCompanyId: string, @Req() req: any) {
        const companyId = this.getEffectiveCompanyId(req, clientCompanyId);
        await this.googleDriveService.disconnect(companyId);
        return { message: 'Google Drive disconnected' };
    }
}
