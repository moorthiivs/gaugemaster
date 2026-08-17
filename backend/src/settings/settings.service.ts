import { Injectable } from '@nestjs/common';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Setting } from './entities/setting.entity';
import { LocationEmail } from './entities/location-email.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
    @InjectRepository(LocationEmail)
    private readonly locationEmailRepository: Repository<LocationEmail>,
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

  // Location-to-Email Mapping methods
  async getLocationEmails(companyId: string): Promise<LocationEmail[]> {
    return this.locationEmailRepository.find({
      where: { companyId },
      order: { location: 'ASC' },
    });
  }

  async getLocationEmailByLocation(companyId: string, location: string): Promise<LocationEmail | null> {
    if (!companyId || !location) return null;
    return this.locationEmailRepository.findOne({
      where: { companyId, location },
    });
  }

  async upsertLocationEmail(payload: {
    id?: string;
    companyId: string;
    location: string;
    headName?: string;
    headEmail: string;
    managementEmails?: string[];
  }): Promise<LocationEmail> {
    if (payload.id) {
      const existing = await this.locationEmailRepository.findOne({ where: { id: payload.id } });
      if (existing) {
        const merged = this.locationEmailRepository.merge(existing, payload);
        return await this.locationEmailRepository.save(merged);
      }
    }

    // Check by location and companyId to prevent duplicate
    const existingByLoc = await this.locationEmailRepository.findOne({
      where: { companyId: payload.companyId, location: payload.location },
    });

    if (existingByLoc) {
      const merged = this.locationEmailRepository.merge(existingByLoc, payload);
      return await this.locationEmailRepository.save(merged);
    }

    const created = this.locationEmailRepository.create(payload);
    return await this.locationEmailRepository.save(created);
  }

  async deleteLocationEmail(id: string): Promise<{ success: boolean; message: string }> {
    await this.locationEmailRepository.delete(id);
    return { success: true, message: 'Location mapping deleted successfully' };
  }
}

