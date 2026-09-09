import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CalibrationTemplate } from './entities/calibration-template.entity';
import { CreateCalibrationTemplateDto } from './dto/create-calibration-template.dto';
import { UpdateCalibrationTemplateDto } from './dto/update-calibration-template.dto';
import { BulkDeleteCalibrationTemplatesDto } from './dto/bulk-delete-calibration-templates.dto';

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
    if (!id || id === 'undefined' || id === 'null' || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      throw new NotFoundException(`Calibration template with ID ${id} not found`);
    }
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
    if (dto.diagram_image !== undefined) {
      template.diagram_image = dto.diagram_image ? dto.diagram_image : (null as any);
    }
    return this.repository.save(template);
  }

  async remove(id: string, currentUser?: any): Promise<void> {
    const template = await this.findOne(id);

    const isSuperAdmin = !!currentUser?.isSuperAdmin;
    const userCompanyId = currentUser?.companyId;

    if (!isSuperAdmin) {
      if (!template.companyId) {
        throw new BadRequestException(
          `System default template "${template.name}" cannot be deleted.`,
        );
      }
      if (userCompanyId && template.companyId !== userCompanyId) {
        throw new ForbiddenException(
          'You do not have permission to delete this template.',
        );
      }
    }

    await this.repository.remove(template);
  }

  async bulkRemove(
    dto: BulkDeleteCalibrationTemplatesDto,
    currentUser?: any,
  ): Promise<{
    success: boolean;
    deletedCount: number;
    notFoundCount: number;
    message: string;
  }> {
    if (!dto?.ids || dto.ids.length === 0) {
      throw new BadRequestException('Please provide at least one template ID to delete.');
    }

    const uniqueIds = Array.from(new Set(dto.ids.map((id) => id?.trim()).filter(Boolean)));
    if (uniqueIds.length === 0) {
      throw new BadRequestException('No valid template IDs provided.');
    }

    const templates = await this.repository.findBy({ id: In(uniqueIds) });
    if (templates.length === 0) {
      throw new NotFoundException('No matching calibration templates found for deletion.');
    }

    const isSuperAdmin = !!currentUser?.isSuperAdmin;
    const userCompanyId = currentUser?.companyId;

    if (!isSuperAdmin) {
      // 1. System templates protection (companyId IS NULL)
      const systemTemplates = templates.filter((t) => !t.companyId);
      if (systemTemplates.length > 0) {
        const names = systemTemplates.map((t) => `"${t.name}"`).join(', ');
        throw new BadRequestException(
          `System default templates cannot be deleted: ${names}. Only custom organization templates can be deleted.`,
        );
      }

      // 2. Multi-tenant isolation check
      if (userCompanyId) {
        const foreignTemplates = templates.filter(
          (t) => t.companyId && t.companyId !== userCompanyId,
        );
        if (foreignTemplates.length > 0) {
          throw new ForbiddenException(
            'You do not have permission to delete calibration templates belonging to another organization.',
          );
        }
      }
    }

    const targetTemplateIds = templates.map((t) => t.id);

    // 3. Referential validation against calibrations
    try {
      const usageRows: { template_id: string; count: string }[] =
        await this.repository.manager.query(
          `SELECT template_id, COUNT(*)::text as count
           FROM calibrations
           WHERE template_id = ANY($1)
           GROUP BY template_id`,
          [targetTemplateIds],
        );

      if (usageRows && usageRows.length > 0 && !dto.force) {
        const usageMap = new Map<string, number>();
        usageRows.forEach((row) =>
          usageMap.set(row.template_id, parseInt(row.count, 10) || 0),
        );

        const inUseTemplates = templates
          .filter((t) => usageMap.has(t.id))
          .map((t) => ({
            id: t.id,
            name: t.name,
            calibrationCount: usageMap.get(t.id) || 0,
          }));

        const totalCount = inUseTemplates.reduce(
          (sum, item) => sum + item.calibrationCount,
          0,
        );
        const names = inUseTemplates
          .map((t) => `"${t.name}" (${t.calibrationCount} records)`)
          .join(', ');

        throw new BadRequestException({
          message: `${inUseTemplates.length} template(s) are currently referenced by ${totalCount} existing calibration record(s): ${names}. Confirm force deletion to proceed.`,
          code: 'TEMPLATES_IN_USE',
          inUseTemplates,
        });
      }
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      // If table query encounters an issue (e.g. table not created in dev), continue with deletion
    }

    // 4. Atomic transaction deletion
    await this.repository.manager.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.remove(CalibrationTemplate, templates);
    });

    return {
      success: true,
      deletedCount: templates.length,
      notFoundCount: uniqueIds.length - templates.length,
      message: `${templates.length} calibration template(s) deleted successfully.`,
    };
  }
}

