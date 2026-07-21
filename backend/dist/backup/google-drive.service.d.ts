import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DriveToken } from './drive-token.entity';
export declare class GoogleDriveService {
    private readonly driveTokenRepo;
    private readonly configService;
    private readonly logger;
    private readonly clientId;
    private readonly clientSecret;
    private readonly redirectUri;
    readonly enabled: boolean;
    constructor(driveTokenRepo: Repository<DriveToken>, configService: ConfigService);
    private createOAuth2Client;
    getAuthUrl(companyId: string): string;
    handleCallback(code: string, companyId: string): Promise<DriveToken>;
    getConnectionStatus(companyId: string): Promise<{
        connected: boolean;
        email?: string;
    }>;
    disconnect(companyId: string): Promise<void>;
    uploadBackup(companyId: string, filePath: string, fileName: string): Promise<string>;
    uploadCertificate(companyId: string, filePath: string, fileName: string): Promise<string>;
}
