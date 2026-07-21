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
var GoogleDriveService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const googleapis_1 = require("googleapis");
const fs = __importStar(require("fs"));
const drive_token_entity_1 = require("./drive-token.entity");
let GoogleDriveService = GoogleDriveService_1 = class GoogleDriveService {
    driveTokenRepo;
    configService;
    logger = new common_1.Logger(GoogleDriveService_1.name);
    clientId;
    clientSecret;
    redirectUri;
    enabled;
    constructor(driveTokenRepo, configService) {
        this.driveTokenRepo = driveTokenRepo;
        this.configService = configService;
        this.clientId = this.configService.get('GOOGLE_CLIENT_ID') || '';
        this.clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET') || '';
        const baseCallback = this.configService.get('GOOGLE_CALLBACK_URL') || 'http://localhost:5000/api/auth/google/callback';
        this.redirectUri = baseCallback.replace('/auth/google/callback', '/backup/drive/callback');
        this.enabled = !!this.clientId && !!this.clientSecret;
        if (this.enabled) {
            this.logger.log('Google Drive integration is enabled');
        }
        else {
            this.logger.log('Google Drive integration is disabled (no GOOGLE_CLIENT_ID/SECRET)');
        }
    }
    createOAuth2Client() {
        return new googleapis_1.google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
    }
    getAuthUrl(companyId) {
        const oauth2Client = this.createOAuth2Client();
        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/userinfo.email',
            ],
            state: companyId,
        });
    }
    async handleCallback(code, companyId) {
        const oauth2Client = this.createOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);
        if (!tokens.refresh_token) {
            throw new Error('No refresh token received. Please revoke access and try again.');
        }
        oauth2Client.setCredentials(tokens);
        const oauth2 = googleapis_1.google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const email = userInfo.data.email || '';
        const drive = googleapis_1.google.drive({ version: 'v3', auth: oauth2Client });
        let folderId;
        const folderSearch = await drive.files.list({
            q: `name='Gaugemaster Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
        });
        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
            folderId = folderSearch.data.files[0].id;
        }
        else {
            const folder = await drive.files.create({
                requestBody: {
                    name: 'Gaugemaster Backups',
                    mimeType: 'application/vnd.google-apps.folder',
                },
                fields: 'id',
            });
            folderId = folder.data.id;
        }
        let driveToken = await this.driveTokenRepo.findOne({ where: { companyId } });
        if (driveToken) {
            driveToken.refreshToken = tokens.refresh_token;
            driveToken.accessToken = tokens.access_token || '';
            driveToken.email = email;
            driveToken.folderId = folderId;
        }
        else {
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
    async getConnectionStatus(companyId) {
        const token = await this.driveTokenRepo.findOne({ where: { companyId } });
        if (!token)
            return { connected: false };
        return { connected: true, email: token.email };
    }
    async disconnect(companyId) {
        await this.driveTokenRepo.delete({ companyId });
        this.logger.log(`Google Drive disconnected for company ${companyId}`);
    }
    async uploadBackup(companyId, filePath, fileName) {
        const token = await this.driveTokenRepo.findOne({ where: { companyId } });
        if (!token) {
            throw new Error('Google Drive not connected for this company');
        }
        const oauth2Client = this.createOAuth2Client();
        oauth2Client.setCredentials({
            refresh_token: token.refreshToken,
        });
        const drive = googleapis_1.google.drive({ version: 'v3', auth: oauth2Client });
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
    async uploadCertificate(companyId, filePath, fileName) {
        const token = await this.driveTokenRepo.findOne({ where: { companyId } });
        if (!token) {
            throw new Error('Google Drive not connected for this company');
        }
        const oauth2Client = this.createOAuth2Client();
        oauth2Client.setCredentials({
            refresh_token: token.refreshToken,
        });
        const drive = googleapis_1.google.drive({ version: 'v3', auth: oauth2Client });
        let certFolderId;
        const folderSearch = await drive.files.list({
            q: `name='Gaugemaster Certificates' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
        });
        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
            certFolderId = folderSearch.data.files[0].id;
        }
        else {
            const folder = await drive.files.create({
                requestBody: {
                    name: 'Gaugemaster Certificates',
                    mimeType: 'application/vnd.google-apps.folder',
                },
                fields: 'id',
            });
            certFolderId = folder.data.id;
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
                fileId: response.data.id,
                requestBody: {
                    role: 'writer',
                    type: 'anyone',
                },
            });
        }
        catch (err) {
            this.logger.error(`Could not set permissions for file ${response.data.id}`, err);
        }
        return response.data.webViewLink || '';
    }
};
exports.GoogleDriveService = GoogleDriveService;
exports.GoogleDriveService = GoogleDriveService = GoogleDriveService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(drive_token_entity_1.DriveToken)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], GoogleDriveService);
//# sourceMappingURL=google-drive.service.js.map