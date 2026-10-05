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

        let mergedAiConfig = existing.aiConfig;
        if (createSettingDto.aiConfig) {
          const newKey = createSettingDto.aiConfig.apiKey?.trim();
          // If the new key is omitted or is a masked string, keep the existing key
          const isMaskedOrEmpty = !newKey || newKey.includes('•') || newKey.includes('*');
          mergedAiConfig = {
            ...(existing.aiConfig || {}),
            ...createSettingDto.aiConfig,
            apiKey: isMaskedOrEmpty ? existing.aiConfig?.apiKey : newKey,
          };
        }

        const updatePayload: any = {
          ...createSettingDto,
          ...(mergedCertConfig ? { certificateConfig: mergedCertConfig } : {}),
          ...(mergedAiConfig ? { aiConfig: mergedAiConfig } : {}),
        };

        if (createSettingDto.themeSettings && (existing.themeSettings as any)?.userThemes) {
          updatePayload.themeSettings = {
            ...createSettingDto.themeSettings,
            userThemes: {
              ...((existing.themeSettings as any).userThemes || {}),
              ...((createSettingDto.themeSettings as any).userThemes || {}),
              ...(userId ? { [userId]: createSettingDto.themeSettings } : {}),
            },
          };
        }

        await this.settingsRepository.update(existing.id, updatePayload);
        const updated = await this.settingsRepository.findOne({ where: { id: existing.id } });
        return this.sanitizeSetting(updated);
      }

      const newSetting = this.settingsRepository.create(createSettingDto);
      const saved = await this.settingsRepository.save(newSetting);
      return this.sanitizeSetting(saved);

    } catch (error) {
      console.log(error);
    }
  }

  private sanitizeSetting(setting: Setting | null): Setting | null {
    if (!setting) return null;
    if (setting.aiConfig?.apiKey) {
      const raw = setting.aiConfig.apiKey;
      const masked = raw.length > 8
        ? `${raw.slice(0, 6)}•••••••••••••••${raw.slice(-4)}`
        : '••••••••••••••••';
      setting.aiConfig = {
        ...setting.aiConfig,
        apiKey: masked,
      };
    }
    return setting;
  }

  async findOne(userId: string, companyId: string) {
    let setting: Setting | null = null;
    if (companyId) {
      setting = await this.settingsRepository.findOne({ where: { companyId } });
    }
    if (!setting && userId) {
      setting = await this.settingsRepository.findOne({ where: { userId } });
    }
    return this.sanitizeSetting(setting);
  }

  async findOneByUserId(userId: string) {
    const setting = await this.settingsRepository.findOne({ where: { userId } });
    return this.sanitizeSetting(setting);
  }

  async getThemeSettings(userId?: string, companyId?: string) {
    const defaultTheme = {
      colorScheme: 'dark',
      fontSize: 'medium',
      compactMode: false,
      animations: true,
      highContrast: false,
      reducedMotion: false,
      fontFamily: 'Geist',
      baseColor: 'mist',
      themeColor: 'mist',
    };

    let setting: Setting | null = null;
    if (companyId) {
      setting = await this.settingsRepository.findOne({ where: { companyId } });
    }
    if (!setting && userId) {
      setting = await this.settingsRepository.findOne({ where: { userId } });
    }

    if (!setting || !setting.themeSettings) {
      return defaultTheme;
    }

    const companyTheme = { ...setting.themeSettings };
    const userThemes = (companyTheme as any).userThemes || {};
    const userSpecific = userId ? userThemes[userId] : null;

    delete (companyTheme as any).userThemes;

    return {
      ...defaultTheme,
      ...companyTheme,
      ...(userSpecific || {}),
    };
  }

  async saveThemeSettings(userId?: string, companyId?: string, themeSettings?: any, jwtUser?: any) {
    if (!companyId && !userId) return null;
    if (!themeSettings) return null;

    let existing: Setting | null = null;
    if (companyId) {
      existing = await this.settingsRepository.findOne({ where: { companyId } });
    }
    if (!existing && userId) {
      existing = await this.settingsRepository.findOne({ where: { userId } });
    }

    const isAdmin =
      jwtUser?.isSuperAdmin ||
      (jwtUser?.role && typeof jwtUser.role === 'object' && jwtUser.role.name?.toLowerCase().includes('admin')) ||
      (typeof jwtUser?.userRole === 'string' && jwtUser.userRole.toLowerCase().includes('admin'));

    if (!existing) {
      const newSetting = this.settingsRepository.create({
        companyId: companyId || userId,
        userId: userId || companyId,
        themeSettings: {
          ...themeSettings,
          userThemes: userId ? { [userId]: themeSettings } : {},
        },
      });
      const saved = await this.settingsRepository.save(newSetting);
      const res = { ...saved.themeSettings };
      delete (res as any).userThemes;
      return res;
    }

    const currentThemeSettings = existing.themeSettings || ({} as any);
    const userThemes = { ...((currentThemeSettings as any).userThemes || {}) };

    if (userId) {
      userThemes[userId] = themeSettings;
    }

    const updatedThemeSettings = {
      ...currentThemeSettings,
      ...(isAdmin ? themeSettings : {}),
      userThemes,
    };

    await this.settingsRepository.update(existing.id, {
      themeSettings: updatedThemeSettings,
    });

    const res = { ...updatedThemeSettings };
    delete (res as any).userThemes;
    return res;
  }

  /**
   * Internal method used exclusively by AiService to retrieve raw (unmasked) API key.
   */
  async findRawForAi(companyId: string): Promise<Setting | null> {
    if (!companyId) return null;
    return this.settingsRepository.findOne({ where: { companyId } });
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

