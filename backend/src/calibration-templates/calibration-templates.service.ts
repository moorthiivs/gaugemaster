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
      const existing = await this.repository
        .createQueryBuilder('template')
        .where('LOWER(template.name) = LOWER(:name)', { name: dto.name.trim() })
        .getOne();

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
    const where: any = {};

    if (userId) where.userId = userId;
    if (companyId) where.companyId = companyId;
    if (calibrationType && calibrationType !== 'All') {
      where.calibration_type = calibrationType;
    }

    return this.repository.find({
      where,
      order: { createdAt: 'DESC' },
    });
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
      const existing = await this.repository
        .createQueryBuilder('template')
        .where('LOWER(template.name) = LOWER(:name)', { name: dto.name.trim() })
        .andWhere('template.id != :id', { id })
        .getOne();

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
