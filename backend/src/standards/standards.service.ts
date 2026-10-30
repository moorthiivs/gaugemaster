import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Standard } from './standard.entity';
import { StandardHistory } from './standard-history.entity';
import { CreateStandardDto } from './dto/create-standard.dto';
import { UpdateStandardDto } from './dto/update-standard.dto';

@Injectable()
export class StandardsService {
  constructor(
    @InjectRepository(Standard)
    private readonly standardRepo: Repository<Standard>,
    @InjectRepository(StandardHistory)
    private readonly historyRepo: Repository<StandardHistory>,
  ) {}

  async findAll(companyId?: string, search?: string, type?: string) {
    const qb = this.standardRepo.createQueryBuilder('standard');

    if (companyId) {
      qb.andWhere('standard.companyId = :companyId', { companyId });
    }

    if (type && type !== 'All') {
      qb.andWhere('LOWER(TRIM(standard.standard_type)) = LOWER(TRIM(:type))', { type });
    }

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(standard.standard_number) LIKE :s OR LOWER(standard.standard_name) LIKE :s OR LOWER(standard.standard_type) LIKE :s OR LOWER(COALESCE(standard.description, \'\')) LIKE :s OR LOWER(COALESCE(standard.document_name, \'\')) LIKE :s)',
        { s },
      );
    }

    qb.orderBy('standard.created_at', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string, companyId?: string) {
    const where: any = { id };
    if (companyId) {
      where.companyId = companyId;
    }
    const standard = await this.standardRepo.findOne({ where });
    if (!standard) {
      throw new NotFoundException(`Standard with ID ${id} not found`);
    }
    return standard;
  }

  async create(
    dto: CreateStandardDto,
    file: any,
    user: { id?: string; name?: string; companyId?: string },
  ) {
    const targetCompanyId = dto.companyId || user.companyId;

    const standard = this.standardRepo.create({
      standard_number: dto.standard_number.trim(),
      standard_name: dto.standard_name.trim(),
      standard_type: dto.standard_type.trim(),
      description: dto.description ? dto.description.trim() : undefined,
      companyId: targetCompanyId,
      version: 1,
      created_by_id: user.id,
      created_by_name: user.name || 'User',
      updated_by_id: user.id,
      updated_by_name: user.name || 'User',
      document_name: file ? file.originalname : undefined,
      file_type: file ? file.mimetype : undefined,
      file_path: file ? `/uploads/standards/${file.filename}` : undefined,
    });

    const saved = await this.standardRepo.save(standard);

    // Save initial history record
    const history = this.historyRepo.create({
      standard_id: saved.id,
      standard_number: saved.standard_number,
      standard_name: saved.standard_name,
      standard_type: saved.standard_type,
      document_name: saved.document_name,
      file_type: saved.file_type,
      file_path: saved.file_path,
      version: saved.version,
      action_details: file
        ? `Initial standard registered with document upload (${file.originalname})`
        : 'Initial standard registered',
      created_by_id: user.id,
      created_by_name: user.name || 'User',
      companyId: targetCompanyId,
    });
    await this.historyRepo.save(history);

    return saved;
  }

  async update(
    id: string,
    dto: UpdateStandardDto,
    file: any,
    user: { id?: string; name?: string; companyId?: string },
  ) {
    const standard = await this.findOne(id, user.companyId);

    const isNewFile = !!file;
    if (isNewFile) {
      standard.version += 1;
      standard.document_name = file.originalname;
      standard.file_type = file.mimetype;
      standard.file_path = `/uploads/standards/${file.filename}`;
    }

    if (dto.standard_number !== undefined) {
      standard.standard_number = dto.standard_number.trim();
    }
    if (dto.standard_name !== undefined) {
      standard.standard_name = dto.standard_name.trim();
    }
    if (dto.standard_type !== undefined) {
      standard.standard_type = dto.standard_type.trim();
    }
    if (dto.description !== undefined) {
      standard.description = dto.description.trim();
    }

    standard.updated_by_id = user.id;
    standard.updated_by_name = user.name || 'User';

    const updated = await this.standardRepo.save(standard);

    // Log update in history
    let actionDetails = dto.actionDetails;
    if (!actionDetails) {
      if (isNewFile) {
        actionDetails = `Uploaded new document revision v${updated.version} (${file.originalname})`;
      } else {
        actionDetails = `Updated standard metadata details`;
      }
    }

    const history = this.historyRepo.create({
      standard_id: updated.id,
      standard_number: updated.standard_number,
      standard_name: updated.standard_name,
      standard_type: updated.standard_type,
      document_name: updated.document_name,
      file_type: updated.file_type,
      file_path: updated.file_path,
      version: updated.version,
      action_details: actionDetails,
      created_by_id: user.id,
      created_by_name: user.name || 'User',
      companyId: updated.companyId,
    });
    await this.historyRepo.save(history);

    return updated;
  }

  async remove(id: string, companyId?: string, user?: any, reason?: string) {
    await this.findOne(id, companyId);
    await this.standardRepo.update(id, {
      deleted_at: new Date(),
      deleted_by_id: user?.id,
      deleted_by_name: user?.name || user?.email || 'User',
      deletion_reason: reason || null,
    });
    return { success: true, message: 'Standard moved to Recovery Center' };
  }

  async getHistory(standardId: string, companyId?: string) {
    const where: any = { standard_id: standardId };
    if (companyId) {
      where.companyId = companyId;
    }
    return this.historyRepo.find({
      where,
      order: { version: 'DESC', created_at: 'DESC' },
    });
  }
}
