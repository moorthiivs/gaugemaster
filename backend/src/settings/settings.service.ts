import { Injectable } from '@nestjs/common';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Setting } from './entities/setting.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
  ) { }
  async create(createSettingDto: CreateSettingDto) {
    try {
      try {
        await this.settingsRepository.query(`ALTER TABLE settings ADD COLUMN "reportConfig" jsonb`);
      } catch (e) {
        // Column likely already exists, ignore
      }

      const { userId, companyId } = createSettingDto;
      let existing: Setting | null = null;
      if (companyId) {
        existing = await this.settingsRepository.findOne({ where: { companyId } });
      }
      if (!existing && userId) {
        existing = await this.settingsRepository.findOne({ where: { userId } });
      }

      if (existing) {
        const mergedCertConfig = createSettingDto.certificateConfig
          ? { ...(existing.certificateConfig || {}), ...createSettingDto.certificateConfig }
          : existing.certificateConfig;

        const updatePayload = {
          ...createSettingDto,
          ...(mergedCertConfig ? { certificateConfig: mergedCertConfig } : {}),
        };

        await this.settingsRepository.update(existing.id, updatePayload);
        return await this.settingsRepository.findOne({ where: { id: existing.id } });
      }

      const newSetting = this.settingsRepository.create(createSettingDto);
      const saved = await this.settingsRepository.save(newSetting);
      return saved;

    } catch (error) {
      console.log(error);
    }
  }

  async findOne(userId: string, companyId: string) {
    let setting: Setting | null = null;
    if (companyId) {
      setting = await this.settingsRepository.findOne({ where: { companyId } });
    }
    if (!setting && userId) {
      setting = await this.settingsRepository.findOne({ where: { userId } });
    }
    return setting;
  }

  findOneByUserId(userId: string) {
    return this.settingsRepository.findOne({ where: { userId } });
  }


}
