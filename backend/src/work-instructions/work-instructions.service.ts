import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { WorkInstruction } from './work-instruction.entity';
import { WorkInstructionHistory } from './work-instruction-history.entity';
import { CreateWorkInstructionDto } from './dto/create-work-instruction.dto';
import { UpdateWorkInstructionDto } from './dto/update-work-instruction.dto';

@Injectable()
export class WorkInstructionsService {
  constructor(
    @InjectRepository(WorkInstruction)
    private readonly instructionRepo: Repository<WorkInstruction>,
    @InjectRepository(WorkInstructionHistory)
    private readonly historyRepo: Repository<WorkInstructionHistory>,
  ) {}

  async findAll(companyId?: string, search?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (search && search.trim()) {
      where.title = ILike(`%${search.trim()}%`);
    }

    return this.instructionRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, companyId?: string) {
    const where: any = { id };
    if (companyId) {
      where.companyId = companyId;
    }
    const instruction = await this.instructionRepo.findOne({ where });
    if (!instruction) {
      throw new NotFoundException(`Work instruction with ID ${id} not found`);
    }
    return instruction;
  }

  async create(
    dto: CreateWorkInstructionDto,
    file: any,
    user: { id?: string; name?: string; companyId?: string },
  ) {
    const targetCompanyId = dto.companyId || user.companyId;

    const instruction = this.instructionRepo.create({
      title: dto.title,
      description: dto.description,
      companyId: targetCompanyId,
      version: 1,
      created_by_id: user.id,
      created_by_name: user.name || 'User',
      updated_by_id: user.id,
      updated_by_name: user.name || 'User',
      document_name: file ? file.originalname : undefined,
      file_type: file ? file.mimetype : undefined,
      file_path: file ? `/uploads/work-instructions/${file.filename}` : undefined,
    });

    const saved = await this.instructionRepo.save(instruction);

    const history = this.historyRepo.create({
      instruction_id: saved.id,
      title: saved.title,
      document_name: saved.document_name,
      file_type: saved.file_type,
      file_path: saved.file_path,
      version: saved.version,
      action_details: 'Initial work instruction uploaded',
      created_by_id: user.id,
      created_by_name: user.name || 'User',
      companyId: targetCompanyId,
    });
    await this.historyRepo.save(history);

    return saved;
  }

  async update(
    id: string,
    dto: UpdateWorkInstructionDto,
    file: any,
    user: { id?: string; name?: string; companyId?: string },
  ) {
    const instruction = await this.findOne(id, user.companyId);

    const isNewFile = !!file;
    if (isNewFile) {
      instruction.version += 1;
      instruction.document_name = file.originalname;
      instruction.file_type = file.mimetype;
      instruction.file_path = `/uploads/work-instructions/${file.filename}`;
    }

    if (dto.title !== undefined) {
      instruction.title = dto.title;
    }
    if (dto.description !== undefined) {
      instruction.description = dto.description;
    }

    instruction.updated_by_id = user.id;
    instruction.updated_by_name = user.name || 'User';

    const updated = await this.instructionRepo.save(instruction);

    let actionDetails = dto.actionDetails;
    if (!actionDetails) {
      if (isNewFile) {
        actionDetails = `Updated work instruction to version ${updated.version} (${file.originalname})`;
      } else {
        actionDetails = `Updated work instruction details`;
      }
    }

    const history = this.historyRepo.create({
      instruction_id: updated.id,
      title: updated.title,
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
    const instruction = await this.findOne(id, companyId);
    await this.historyRepo.delete({ instruction_id: id });
    await this.instructionRepo.remove(instruction);
    return { success: true, message: 'Work instruction deleted successfully' };
  }

  async getHistory(instructionId: string, companyId?: string) {
    const where: any = { instruction_id: instructionId };
    if (companyId) {
      where.companyId = companyId;
    }
    return this.historyRepo.find({
      where,
      order: { version: 'DESC', created_at: 'DESC' },
    });
  }
}
