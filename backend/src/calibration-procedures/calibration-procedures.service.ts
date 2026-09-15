import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CalibrationProcedure } from './calibration-procedure.entity';
import { CalibrationProcedureHistory } from './calibration-procedure-history.entity';
import { CreateCalibrationProcedureDto } from './dto/create-calibration-procedure.dto';
import { UpdateCalibrationProcedureDto } from './dto/update-calibration-procedure.dto';

@Injectable()
export class CalibrationProceduresService {
  constructor(
    @InjectRepository(CalibrationProcedure)
    private readonly procedureRepo: Repository<CalibrationProcedure>,
    @InjectRepository(CalibrationProcedureHistory)
    private readonly historyRepo: Repository<CalibrationProcedureHistory>,
  ) {}

  async findAll(companyId?: string, search?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (search && search.trim()) {
      where.process = ILike(`%${search.trim()}%`);
    }

    return this.procedureRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, companyId?: string) {
    const where: any = { id };
    if (companyId) {
      where.companyId = companyId;
    }
    const procedure = await this.procedureRepo.findOne({ where });
    if (!procedure) {
      throw new NotFoundException(`Calibration procedure with ID ${id} not found`);
    }
    return procedure;
  }

  async create(
    dto: CreateCalibrationProcedureDto,
    file: any,
    user: { id?: string; name?: string; companyId?: string },
  ) {
    const targetCompanyId = dto.companyId || user.companyId;

    const procedure = this.procedureRepo.create({
      process: dto.process,
      description: dto.description,
      companyId: targetCompanyId,
      version: 1,
      created_by_id: user.id,
      created_by_name: user.name || 'User',
      updated_by_id: user.id,
      updated_by_name: user.name || 'User',
      document_name: file ? file.originalname : undefined,
      file_type: file ? file.mimetype : undefined,
      file_path: file ? `/uploads/calibration-procedures/${file.filename}` : undefined,
    });

    const saved = await this.procedureRepo.save(procedure);

    // Save initial history
    const history = this.historyRepo.create({
      procedure_id: saved.id,
      process: saved.process,
      document_name: saved.document_name,
      file_type: saved.file_type,
      file_path: saved.file_path,
      version: saved.version,
      action_details: 'Initial version created with document upload',
      created_by_id: user.id,
      created_by_name: user.name || 'User',
      companyId: targetCompanyId,
    });
    await this.historyRepo.save(history);

    return saved;
  }

  async update(
    id: string,
    dto: UpdateCalibrationProcedureDto,
    file: any,
    user: { id?: string; name?: string; companyId?: string },
  ) {
    const procedure = await this.findOne(id, user.companyId);

    const isNewFile = !!file;
    if (isNewFile) {
      procedure.version += 1;
      procedure.document_name = file.originalname;
      procedure.file_type = file.mimetype;
      procedure.file_path = `/uploads/calibration-procedures/${file.filename}`;
    }

    if (dto.process !== undefined) {
      procedure.process = dto.process;
    }
    if (dto.description !== undefined) {
      procedure.description = dto.description;
    }

    procedure.updated_by_id = user.id;
    procedure.updated_by_name = user.name || 'User';

    const updated = await this.procedureRepo.save(procedure);

    // Log update in history
    let actionDetails = dto.actionDetails;
    if (!actionDetails) {
      if (isNewFile) {
        actionDetails = `Updated document to version ${updated.version} (${file.originalname})`;
      } else {
        actionDetails = `Updated procedure details`;
      }
    }

    const history = this.historyRepo.create({
      procedure_id: updated.id,
      process: updated.process,
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

  async remove(id: string, companyId?: string) {
    const procedure = await this.findOne(id, companyId);
    // Delete associated history
    await this.historyRepo.delete({ procedure_id: id });
    await this.procedureRepo.remove(procedure);
    return { success: true, message: 'Calibration procedure deleted successfully' };
  }

  async getHistory(procedureId: string, companyId?: string) {
    const where: any = { procedure_id: procedureId };
    if (companyId) {
      where.companyId = companyId;
    }
    return this.historyRepo.find({
      where,
      order: { version: 'DESC', created_at: 'DESC' },
    });
  }
}
