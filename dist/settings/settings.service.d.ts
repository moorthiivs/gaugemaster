import { CreateSettingDto } from './dto/create-setting.dto';
import { Setting } from './entities/setting.entity';
import { Repository } from 'typeorm';
export declare class SettingsService {
    private readonly settingsRepository;
    constructor(settingsRepository: Repository<Setting>);
    create(createSettingDto: CreateSettingDto): Promise<Setting | null | undefined>;
    findOne(userId: string, companyId: string): Promise<Setting | null>;
}
