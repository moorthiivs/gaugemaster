import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { MailerService } from '../mail/mailer.service';
export declare class SettingsController {
    private readonly settingsService;
    private readonly mailerService;
    constructor(settingsService: SettingsService, mailerService: MailerService);
    saveSettings(createSettingDto: CreateSettingDto): Promise<import("./entities/setting.entity").Setting | null | undefined>;
    getSettings(userId: string, companyId: string): Promise<import("./entities/setting.entity").Setting | null>;
    create(createSettingDto: CreateSettingDto, authHeader: string): Promise<import("./entities/setting.entity").Setting | null | undefined>;
    fetchMailConfig(userId: string, companyId: string): Promise<import("./entities/setting.entity").Setting | null>;
    sendTestEmail(userId: string, targetEmail: string): Promise<{
        message: string;
    }>;
}
