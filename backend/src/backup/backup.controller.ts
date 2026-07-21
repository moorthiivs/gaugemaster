import {
    Controller, Get, Post, Delete, Body, Param, Query, Res, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import * as express from 'express';
import { BackupService } from './backup.service';
import { GoogleDriveService } from './google-drive.service';
import { CreateBackupScheduleDto } from './dto/create-backup-schedule.dto';

@ApiTags('api/backup')
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

    // ─── INSTANT BACKUP ──────────────────────────────────────────

    @Post('now')
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({ summary: 'Trigger an instant database backup' })
    async createBackup(
        @Body('companyId') companyId: string,
        @Body('userId') userId: string,
    ) {
        return this.backupService.createBackup(companyId, userId);
    }

    // ─── LIST BACKUPS ────────────────────────────────────────────

    @Get('list')
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({ summary: 'List all backups for a company' })
    async listBackups(@Query('companyId') companyId: string) {
        return this.backupService.listBackups(companyId);
    }

    // ─── DOWNLOAD BACKUP ─────────────────────────────────────────

    @Get('download/:id')
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({ summary: 'Download a backup file' })
    async downloadBackup(
        @Param('id') id: string,
        @Query('companyId') companyId: string,
        @Res() res: express.Response,
    ) {
        const { filePath, fileName } = await this.backupService.getBackupFilePath(id, companyId);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/gzip');
        res.sendFile(filePath);
    }

    // ─── DELETE BACKUP ───────────────────────────────────────────

    @Delete(':id')
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({ summary: 'Delete a backup' })
    async deleteBackup(
        @Param('id') id: string,
        @Query('companyId') companyId: string,
    ) {
        await this.backupService.deleteBackup(id, companyId);
        return { message: 'Backup deleted' };
    }

    // ─── SCHEDULE ────────────────────────────────────────────────

    @Get('schedule')
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({ summary: 'Get backup schedule for a company' })
    async getSchedule(@Query('companyId') companyId: string) {
        return this.backupService.getSchedule(companyId);
    }

    @Post('schedule')
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({ summary: 'Create or update backup schedule' })
    async saveSchedule(@Body() dto: CreateBackupScheduleDto) {
        return this.backupService.saveSchedule(dto);
    }

    @Delete('schedule')
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({ summary: 'Delete backup schedule' })
    async deleteSchedule(@Query('companyId') companyId: string) {
        await this.backupService.deleteSchedule(companyId);
        return { message: 'Schedule deleted' };
    }

    // ─── GOOGLE DRIVE ────────────────────────────────────────────

    @Get('drive/status')
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({ summary: 'Check Google Drive connection status' })
    async driveStatus(@Query('companyId') companyId: string) {
        return {
            enabled: this.googleDriveService.enabled,
            ...await this.googleDriveService.getConnectionStatus(companyId),
        };
    }

    @Get('drive/auth-url')
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({ summary: 'Get Google Drive OAuth URL' })
    async driveAuthUrl(@Query('companyId') companyId: string) {
        if (!this.googleDriveService.enabled) {
            return { error: 'Google Drive is not configured on this server' };
        }
        return { url: this.googleDriveService.getAuthUrl(companyId) };
    }

    /** PUBLIC — Google redirects here after OAuth consent (no JWT) */
    @Get('drive/callback')
    @ApiOperation({ summary: 'Handle Google Drive OAuth callback' })
    async driveCallback(
        @Query('code') code: string,
        @Query('state') companyId: string,
        @Req() req: express.Request,
        @Res() res: express.Response,
    ) {
        try {
            await this.googleDriveService.handleCallback(code, companyId);
            
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
    @UseGuards(AuthGuard('jwt'))
    @ApiOperation({ summary: 'Disconnect Google Drive' })
    async driveDisconnect(@Query('companyId') companyId: string) {
        await this.googleDriveService.disconnect(companyId);
        return { message: 'Google Drive disconnected' };
    }
}
