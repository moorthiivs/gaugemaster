import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
export declare class SettingsController {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    create(createSettingDto: CreateSettingDto): Promise<import("./entities/setting.entity").Setting | null | undefined>;
    findOne(userId: string, companyId: string): Promise<import("./entities/setting.entity").Setting | null>;
}
