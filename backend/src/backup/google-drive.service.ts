import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { DriveToken } from './drive-token.entity';

@Injectable()
export class GoogleDriveService {
    private readonly logger = new Logger(GoogleDriveService.name);
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly redirectUri: string;
    readonly enabled: boolean;

    constructor(
        @InjectRepository(DriveToken)
        private readonly driveTokenRepo: Repository<DriveToken>,
        private readonly configService: ConfigService,
    ) {
        this.clientId = this.configService.get('GOOGLE_CLIENT_ID') || '';
        this.clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET') || '';

        // Derive the redirect URI from the existing callback URL pattern
        const baseCallback = this.configService.get('GOOGLE_CALLBACK_URL') || 'http://localhost:5000/api/auth/google/callback';
        this.redirectUri = baseCallback.replace('/auth/google/callback', '/backup/drive/callback');

        this.enabled = !!this.clientId && !!this.clientSecret;
        if (this.enabled) {
            this.logger.log('Google Drive integration is enabled');
        } else {
            this.logger.log('Google Drive integration is disabled (no GOOGLE_CLIENT_ID/SECRET)');
        }
    }

    /** Create an OAuth2 client */
    private createOAuth2Client() {
        return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
    }

    // ─── OAUTH FLOW ─────────────────────────────────────────────

    /** Generate the URL to redirect the user to for Google consent */
    getAuthUrl(companyId: string): string {
        const oauth2Client = this.createOAuth2Client();
        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent', // Force consent to always get refresh_token
            scope: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/userinfo.email',
            ],
            state: companyId, // Pass companyId through OAuth state
        });
    }

    /** Exchange the authorization code for tokens and store them */
    async handleCallback(code: string, companyId: string): Promise<DriveToken> {
        const oauth2Client = this.createOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
            throw new Error('No refresh token received. Please revoke access and try again.');
        }

        // Get the user's email
        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const email = userInfo.data.email || '';

        // Create a backup folder in Drive
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        let folderId: string | undefined;

        // Check if folder already exists
        const folderSearch = await drive.files.list({
            q: `name='Gaugemaster Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
        });

        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
            folderId = folderSearch.data.files[0].id!;
        } else {
            // Create the folder
            const folder = await drive.files.create({
                requestBody: {
                    name: 'Gaugemaster Backups',
                    mimeType: 'application/vnd.google-apps.folder',
                },
                fields: 'id',
            });
            folderId = folder.data.id!;
        }

        // Save or update token
        let driveToken = await this.driveTokenRepo.findOne({ where: { companyId } });
        if (driveToken) {
            driveToken.refreshToken = tokens.refresh_token;
            driveToken.accessToken = tokens.access_token || '';
            driveToken.email = email;
            driveToken.folderId = folderId;
        } else {
            driveToken = this.driveTokenRepo.create({
                companyId,
                refreshToken: tokens.refresh_token,
                accessToken: tokens.access_token || '',
                email,
                folderId,
            });
        }

        await this.driveTokenRepo.save(driveToken);
        this.logger.log(`Google Drive connected for company ${companyId} (${email})`);
        return driveToken;
    }

    // ─── CONNECTION STATUS ───────────────────────────────────────

    async getConnectionStatus(companyId: string): Promise<{ connected: boolean; email?: string }> {
        const token = await this.driveTokenRepo.findOne({ where: { companyId } });
        if (!token) return { connected: false };
        return { connected: true, email: token.email };
    }

    async disconnect(companyId: string): Promise<void> {
        await this.driveTokenRepo.delete({ companyId });
        this.logger.log(`Google Drive disconnected for company ${companyId}`);
    }

    // ─── UPLOAD FILE ─────────────────────────────────────────────

    async uploadBackup(companyId: string, filePath: string, fileName: string): Promise<string> {
        const token = await this.driveTokenRepo.findOne({ where: { companyId } });
        if (!token) {
            throw new Error('Google Drive not connected for this company');
        }

        const oauth2Client = this.createOAuth2Client();
        oauth2Client.setCredentials({
            refresh_token: token.refreshToken,
        });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: token.folderId ? [token.folderId] : [],
            },
            media: {
                mimeType: 'application/gzip',
                body: fs.createReadStream(filePath),
            },
            fields: 'id, webViewLink',
        });

        this.logger.log(`Uploaded ${fileName} to Google Drive (ID: ${response.data.id})`);
        return response.data.id || '';
    }

    async uploadCertificate(companyId: string, filePath: string, fileName: string): Promise<string> {
        const token = await this.driveTokenRepo.findOne({ where: { companyId } });
        if (!token) {
            throw new Error('Google Drive not connected for this company');
        }

        const oauth2Client = this.createOAuth2Client();
        oauth2Client.setCredentials({
            refresh_token: token.refreshToken,
        });

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Find or create 'Gaugemaster Certificates' folder
        let certFolderId: string;
        const folderSearch = await drive.files.list({
            q: `name='Gaugemaster Certificates' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
        });

        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
            certFolderId = folderSearch.data.files[0].id!;
        } else {
            const folder = await drive.files.create({
                requestBody: {
                    name: 'Gaugemaster Certificates',
                    mimeType: 'application/vnd.google-apps.folder',
                },
                fields: 'id',
            });
            certFolderId = folder.data.id!;
        }

        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [certFolderId],
                mimeType: 'application/vnd.google-apps.spreadsheet',
            },
            media: {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                body: fs.createReadStream(filePath),
            },
            fields: 'id, webViewLink',
        });

        this.logger.log(`Uploaded certificate ${fileName} to Google Drive (ID: ${response.data.id})`);
        
        try {
            await drive.permissions.create({
                fileId: response.data.id!,
                requestBody: {
                    role: 'writer',
                    type: 'anyone',
                },
            });
        } catch (err) {
            this.logger.error(`Could not set permissions for file ${response.data.id}`, err);
        }

        return response.data.webViewLink || '';
    }
}
