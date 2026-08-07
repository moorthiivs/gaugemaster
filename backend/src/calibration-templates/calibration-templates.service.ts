import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalibrationTemplate } from './entities/calibration-template.entity';
import { CreateCalibrationTemplateDto } from './dto/create-calibration-template.dto';
import { UpdateCalibrationTemplateDto } from './dto/update-calibration-template.dto';

@Injectable()
export class CalibrationTemplatesService {
  constructor(
    @InjectRepository(CalibrationTemplate)
    private readonly repository: Repository<CalibrationTemplate>,
  ) {}

  async create(dto: CreateCalibrationTemplateDto): Promise<CalibrationTemplate> {
    if (dto.name) {
      const qb = this.repository
        .createQueryBuilder('template')
        .where('LOWER(template.name) = LOWER(:name)', { name: dto.name.trim() });

      if (dto.companyId) {
        qb.andWhere('(template.companyId = :companyId OR template.companyId IS NULL)', { companyId: dto.companyId });
      } else if (dto.userId) {
        qb.andWhere('(template.userId = :userId OR template.companyId IS NULL)', { userId: dto.userId });
      }

      const existing = await qb.getOne();

      if (existing) {
        throw new BadRequestException(
          `A template with the name "${dto.name}" already exists. Please choose a unique name.`,
        );
      }
    }
    const template = this.repository.create(dto);
    return this.repository.save(template);
  }

  async findAll(filters: {
    userId?: string;
    companyId?: string;
    calibrationType?: string;
  }): Promise<CalibrationTemplate[]> {
    const { userId, companyId, calibrationType } = filters;

    const qb = this.repository.createQueryBuilder('template');

    if (companyId && userId) {
      qb.where('(template.companyId = :companyId OR template.companyId IS NULL OR template.userId = :userId)', {
        companyId,
        userId,
      });
    } else if (companyId) {
      qb.where('(template.companyId = :companyId OR template.companyId IS NULL)', { companyId });
    } else if (userId) {
      qb.where('(template.userId = :userId OR template.companyId IS NULL)', { userId });
    }

    if (calibrationType && calibrationType !== 'All') {
      const typeLower = calibrationType.toLowerCase().trim();
      const firstWord = typeLower.split('/')[0].split(' ')[0].trim();
      qb.andWhere(
        '(LOWER(template.calibration_type) LIKE :typeFull OR LOWER(template.calibration_type) LIKE :typeWord)',
        {
          typeFull: `%${typeLower}%`,
          typeWord: `%${firstWord}%`,
        },
      );
    }

    qb.orderBy('template.createdAt', 'DESC');

    return qb.getMany();
  }

  async findOne(id: string): Promise<CalibrationTemplate> {
    const template = await this.repository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Calibration template with ID ${id} not found`);
    }
    return template;
  }

  async update(
    id: string,
    dto: UpdateCalibrationTemplateDto,
  ): Promise<CalibrationTemplate> {
    const template = await this.findOne(id);
    if (dto.name) {
      const qb = this.repository
        .createQueryBuilder('template')
        .where('LOWER(template.name) = LOWER(:name)', { name: dto.name.trim() })
        .andWhere('template.id != :id', { id });

      const targetCompanyId = dto.companyId || template.companyId;
      const targetUserId = dto.userId || template.userId;

      if (targetCompanyId) {
        qb.andWhere('(template.companyId = :companyId OR template.companyId IS NULL)', { companyId: targetCompanyId });
      } else if (targetUserId) {
        qb.andWhere('(template.userId = :userId OR template.companyId IS NULL)', { userId: targetUserId });
      }

      const existing = await qb.getOne();

      if (existing) {
        throw new BadRequestException(
          `A template with the name "${dto.name}" already exists. Please choose a unique name.`,
        );
      }
    }
    Object.assign(template, dto);
    return this.repository.save(template);
  }

  async remove(id: string): Promise<void> {
    const template = await this.findOne(id);
    await this.repository.remove(template);
  }
}
