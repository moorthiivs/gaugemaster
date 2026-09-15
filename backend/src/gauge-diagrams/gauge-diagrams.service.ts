import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { GaugeDiagram } from './gauge-diagram.entity';
import { GaugeDiagramHistory } from './gauge-diagram-history.entity';
import { CreateGaugeDiagramDto } from './dto/create-gauge-diagram.dto';
import { UpdateGaugeDiagramDto } from './dto/update-gauge-diagram.dto';

@Injectable()
export class GaugeDiagramsService {
  constructor(
    @InjectRepository(GaugeDiagram)
    private readonly diagramRepo: Repository<GaugeDiagram>,
    @InjectRepository(GaugeDiagramHistory)
    private readonly historyRepo: Repository<GaugeDiagramHistory>,
  ) {}

  async findAll(companyId?: string, search?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (search && search.trim()) {
      where.gauge_name = ILike(`%${search.trim()}%`);
    }

    return this.diagramRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, companyId?: string) {
    const where: any = { id };
    if (companyId) {
      where.companyId = companyId;
    }
    const diagram = await this.diagramRepo.findOne({ where });
    if (!diagram) {
      throw new NotFoundException(`Gauge diagram with ID ${id} not found`);
    }
    return diagram;
  }

  async create(
    dto: CreateGaugeDiagramDto,
    file: any,
    user: { id?: string; name?: string; companyId?: string },
  ) {
    const targetCompanyId = dto.companyId || user.companyId;

    const diagram = this.diagramRepo.create({
      gauge_name: dto.gauge_name,
      description: dto.description,
      companyId: targetCompanyId,
      version: 1,
      created_by_id: user.id,
      created_by_name: user.name || 'User',
      updated_by_id: user.id,
      updated_by_name: user.name || 'User',
      document_name: file ? file.originalname : undefined,
      file_type: file ? file.mimetype : undefined,
      file_path: file ? `/uploads/gauge-diagrams/${file.filename}` : undefined,
    });

    const saved = await this.diagramRepo.save(diagram);

    // Initial history record
    const history = this.historyRepo.create({
      diagram_id: saved.id,
      gauge_name: saved.gauge_name,
      document_name: saved.document_name,
      file_type: saved.file_type,
      file_path: saved.file_path,
      version: saved.version,
      action_details: 'Initial gauge diagram uploaded',
      created_by_id: user.id,
      created_by_name: user.name || 'User',
      companyId: targetCompanyId,
    });
    await this.historyRepo.save(history);

    return saved;
  }

  async update(
    id: string,
    dto: UpdateGaugeDiagramDto,
    file: any,
    user: { id?: string; name?: string; companyId?: string },
  ) {
    const diagram = await this.findOne(id, user.companyId);

    const isNewFile = !!file;
    if (isNewFile) {
      diagram.version += 1;
      diagram.document_name = file.originalname;
      diagram.file_type = file.mimetype;
      diagram.file_path = `/uploads/gauge-diagrams/${file.filename}`;
    }

    if (dto.gauge_name !== undefined) {
      diagram.gauge_name = dto.gauge_name;
    }
    if (dto.description !== undefined) {
      diagram.description = dto.description;
    }

    diagram.updated_by_id = user.id;
    diagram.updated_by_name = user.name || 'User';

    const updated = await this.diagramRepo.save(diagram);

    let actionDetails = dto.actionDetails;
    if (!actionDetails) {
      if (isNewFile) {
        actionDetails = `Updated diagram document to version ${updated.version} (${file.originalname})`;
      } else {
        actionDetails = `Updated gauge diagram details`;
      }
    }

    const history = this.historyRepo.create({
      diagram_id: updated.id,
      gauge_name: updated.gauge_name,
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
    const diagram = await this.findOne(id, companyId);
    await this.historyRepo.delete({ diagram_id: id });
    await this.diagramRepo.remove(diagram);
    return { success: true, message: 'Gauge diagram deleted successfully' };
  }

  async getHistory(diagramId: string, companyId?: string) {
    const where: any = { diagram_id: diagramId };
    if (companyId) {
      where.companyId = companyId;
    }
    return this.historyRepo.find({
      where,
      order: { version: 'DESC', created_at: 'DESC' },
    });
  }
}
