import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Not } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { Calibration } from '../calibration/calibration.entity';
import { Instrument } from '../instruments/instrument.entity';
import { CalibrationTemplate } from '../calibration-templates/entities/calibration-template.entity';
import { CalibrationProcedure } from '../calibration-procedures/calibration-procedure.entity';
import { WorkInstruction } from '../work-instructions/work-instruction.entity';
import { GaugeDiagram } from '../gauge-diagrams/gauge-diagram.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { InstrumentsService } from '../instruments/instruments.service';
import { RecoveryQueryDto } from './dto/recovery-query.dto';

export interface RecoveryItemDto {
  id: string;
  module:
    | 'instruments'
    | 'calibrations'
    | 'templates'
    | 'calibration_procedures'
    | 'work_instructions'
    | 'gauge_diagrams';
  moduleLabel: string;
  recordName: string;
  identifier: string;
  recordDetails: Record<string, any>;
  deletedAt: Date;
  deletedById?: string;
  deletedByName?: string;
  deletionReason?: string | null;
  deletedWithParentId?: string;
  canRestore: boolean;
  conflictWarning?: string;
}

@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    @InjectRepository(Calibration)
    private readonly calibrationRepo: Repository<Calibration>,
    @InjectRepository(Instrument)
    private readonly instrumentRepo: Repository<Instrument>,
    @InjectRepository(CalibrationTemplate)
    private readonly templateRepo: Repository<CalibrationTemplate>,
    @InjectRepository(CalibrationProcedure)
    private readonly procedureRepo: Repository<CalibrationProcedure>,
    @InjectRepository(WorkInstruction)
    private readonly instructionRepo: Repository<WorkInstruction>,
    @InjectRepository(GaugeDiagram)
    private readonly diagramRepo: Repository<GaugeDiagram>,
    private readonly auditLogsService: AuditLogsService,
    private readonly instrumentsService: InstrumentsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Retrieves aggregated statistics of soft-deleted records per module
   */
  async getStats(companyId?: string): Promise<{
    total: number;
    instruments: number;
    calibrations: number;
    templates: number;
    calibration_procedures: number;
    work_instructions: number;
    gauge_diagrams: number;
  }> {
    const whereCompany = (qb: any, alias: string) => {
      if (companyId) {
        qb.andWhere(`(${alias}."companyId" = :companyId OR ${alias}."companyId" IS NULL)`, { companyId });
      }
    };

    const instQb = this.instrumentRepo.createQueryBuilder('i').withDeleted().where('i.deleted_at IS NOT NULL');
    whereCompany(instQb, 'i');
    const instruments = await instQb.getCount();

    const calQb = this.calibrationRepo.createQueryBuilder('c').withDeleted().where('c.deleted_at IS NOT NULL');
    whereCompany(calQb, 'c');
    const calibrations = await calQb.getCount();

    const tplQb = this.templateRepo.createQueryBuilder('t').withDeleted().where('t.deleted_at IS NOT NULL');
    whereCompany(tplQb, 't');
    const templates = await tplQb.getCount();

    const procQb = this.procedureRepo.createQueryBuilder('p').withDeleted().where('p.deleted_at IS NOT NULL');
    whereCompany(procQb, 'p');
    const calibration_procedures = await procQb.getCount();

    const wiQb = this.instructionRepo.createQueryBuilder('w').withDeleted().where('w.deleted_at IS NOT NULL');
    whereCompany(wiQb, 'w');
    const work_instructions = await wiQb.getCount();

    const diagQb = this.diagramRepo.createQueryBuilder('d').withDeleted().where('d.deleted_at IS NOT NULL');
    whereCompany(diagQb, 'd');
    const gauge_diagrams = await diagQb.getCount();

    const total =
      instruments +
      calibrations +
      templates +
      calibration_procedures +
      work_instructions +
      gauge_diagrams;

    return {
      total,
      instruments,
      calibrations,
      templates,
      calibration_procedures,
      work_instructions,
      gauge_diagrams,
    };
  }

  /**
   * Retrieves paginated, filtered, searchable soft-deleted records across all 6 modules
   */
  async getDeletedItems(companyId: string | undefined, query: RecoveryQueryDto): Promise<{
    items: RecoveryItemDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const moduleFilter = query.module?.toLowerCase() || 'all';
    const search = query.search?.trim()?.toLowerCase();
    const deletedBy = query.deletedBy?.trim()?.toLowerCase();
    const startDate = query.startDate ? new Date(query.startDate) : null;
    const endDate = query.endDate ? new Date(query.endDate) : null;
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);

    const allItems: RecoveryItemDto[] = [];

    // 1. Instruments
    if (moduleFilter === 'all' || moduleFilter === 'instruments') {
      const qb = this.instrumentRepo
        .createQueryBuilder('inst')
        .withDeleted()
        .where('inst.deleted_at IS NOT NULL');
      if (companyId) {
        qb.andWhere('(inst."companyId" = :companyId OR inst."companyId" IS NULL)', { companyId });
      }
      if (startDate) qb.andWhere('inst.deleted_at >= :startDate', { startDate });
      if (endDate) qb.andWhere('inst.deleted_at <= :endDate', { endDate });
      if (deletedBy) {
        qb.andWhere('(LOWER(inst.deleted_by_name) LIKE :dBy OR inst.deleted_by_id = :dById)', {
          dBy: `%${deletedBy}%`,
          dById: deletedBy,
        });
      }
      if (search) {
        qb.andWhere('(LOWER(inst.name) LIKE :s OR LOWER(inst.id_code) LIKE :s OR LOWER(inst.make) LIKE :s)', {
          s: `%${search}%`,
        });
      }

      const rows = await qb.orderBy('inst.deleted_at', 'DESC').getMany();
      for (const inst of rows) {
        allItems.push({
          id: inst.id,
          module: 'instruments',
          moduleLabel: 'Instrument Master',
          recordName: inst.name || 'Unnamed Instrument',
          identifier: inst.id_code || inst.id,
          recordDetails: {
            id_code: inst.id_code,
            make: inst.make,
            range: inst.range,
            location: inst.location,
            item_status: inst.item_status || inst.status,
            serial_no: inst.serial_no,
          },
          deletedAt: inst.deleted_at!,
          deletedById: inst.deleted_by_id,
          deletedByName: inst.deleted_by_name,
          deletionReason: inst.deletion_reason,
          canRestore: true,
        });
      }
    }

    // 2. Calibrations
    if (moduleFilter === 'all' || moduleFilter === 'calibrations') {
      const qb = this.calibrationRepo
        .createQueryBuilder('cal')
        .withDeleted()
        .leftJoinAndSelect('cal.instrument', 'inst')
        .where('cal.deleted_at IS NOT NULL');
      if (companyId) {
        qb.andWhere('(cal."companyId" = :companyId OR cal."companyId" IS NULL)', { companyId });
      }
      if (startDate) qb.andWhere('cal.deleted_at >= :startDate', { startDate });
      if (endDate) qb.andWhere('cal.deleted_at <= :endDate', { endDate });
      if (deletedBy) {
        qb.andWhere('(LOWER(cal.deleted_by_name) LIKE :dBy OR cal.deleted_by_id = :dById)', {
          dBy: `%${deletedBy}%`,
          dById: deletedBy,
        });
      }
      if (search) {
        qb.andWhere(
          '(LOWER(cal.certificate_number) LIKE :s OR LOWER(cal.ulr_number) LIKE :s OR LOWER(inst.name) LIKE :s OR LOWER(inst.id_code) LIKE :s)',
          { s: `%${search}%` },
        );
      }

      const rows = await qb.orderBy('cal.deleted_at', 'DESC').getMany();
      for (const cal of rows) {
        const parentInst = cal.instrument;
        const isParentDeleted = parentInst?.deleted_at != null;

        allItems.push({
          id: cal.id,
          module: 'calibrations',
          moduleLabel: 'Calibration Record',
          recordName: `Certificate ${cal.certificate_number || cal.id}`,
          identifier: cal.certificate_number || cal.id,
          recordDetails: {
            certificate_number: cal.certificate_number,
            ulr_number: cal.ulr_number,
            verdict: cal.verdict,
            calibration_date: cal.calibration_date,
            instrument_name: parentInst?.name,
            instrument_id_code: parentInst?.id_code,
            instrument_deleted: isParentDeleted,
          },
          deletedAt: cal.deleted_at!,
          deletedById: cal.deleted_by_id,
          deletedByName: cal.deleted_by_name,
          deletionReason: cal.deletion_reason,
          deletedWithParentId: cal.deleted_with_parent_id,
          canRestore: !isParentDeleted,
          conflictWarning: isParentDeleted
            ? `Parent instrument (${parentInst?.id_code || parentInst?.name}) is in Recovery Center. Restore instrument first.`
            : undefined,
        });
      }
    }

    // 3. Calibration Templates
    if (moduleFilter === 'all' || moduleFilter === 'templates') {
      const qb = this.templateRepo
        .createQueryBuilder('tpl')
        .withDeleted()
        .where('tpl.deleted_at IS NOT NULL');
      if (companyId) {
        qb.andWhere('(tpl."companyId" = :companyId OR tpl."companyId" IS NULL)', { companyId });
      }
      if (startDate) qb.andWhere('tpl.deleted_at >= :startDate', { startDate });
      if (endDate) qb.andWhere('tpl.deleted_at <= :endDate', { endDate });
      if (deletedBy) {
        qb.andWhere('(LOWER(tpl.deleted_by_name) LIKE :dBy OR tpl.deleted_by_id = :dById)', {
          dBy: `%${deletedBy}%`,
          dById: deletedBy,
        });
      }
      if (search) {
        qb.andWhere(
          '(LOWER(tpl.name) LIKE :s OR LOWER(tpl.instrument_type) LIKE :s OR LOWER(tpl.calibration_type) LIKE :s)',
          { s: `%${search}%` },
        );
      }

      const rows = await qb.orderBy('tpl.deleted_at', 'DESC').getMany();
      for (const tpl of rows) {
        allItems.push({
          id: tpl.id,
          module: 'templates',
          moduleLabel: 'Calibration Template',
          recordName: tpl.name || 'Unnamed Template',
          identifier: tpl.name,
          recordDetails: {
            name: tpl.name,
            instrument_type: tpl.instrument_type,
            calibration_type: tpl.calibration_type,
            version: tpl.version || 1,
            is_canvas_template: tpl.is_canvas_template,
          },
          deletedAt: tpl.deleted_at!,
          deletedById: tpl.deleted_by_id,
          deletedByName: tpl.deleted_by_name,
          deletionReason: tpl.deletion_reason,
          canRestore: true,
        });
      }
    }

    // 4. Calibration Procedures
    if (moduleFilter === 'all' || moduleFilter === 'calibration_procedures') {
      const qb = this.procedureRepo
        .createQueryBuilder('proc')
        .withDeleted()
        .where('proc.deleted_at IS NOT NULL');
      if (companyId) {
        qb.andWhere('(proc."companyId" = :companyId OR proc."companyId" IS NULL)', { companyId });
      }
      if (startDate) qb.andWhere('proc.deleted_at >= :startDate', { startDate });
      if (endDate) qb.andWhere('proc.deleted_at <= :endDate', { endDate });
      if (deletedBy) {
        qb.andWhere('(LOWER(proc.deleted_by_name) LIKE :dBy OR proc.deleted_by_id = :dById)', {
          dBy: `%${deletedBy}%`,
          dById: deletedBy,
        });
      }
      if (search) {
        qb.andWhere('(LOWER(proc.process) LIKE :s OR LOWER(proc.document_name) LIKE :s)', {
          s: `%${search}%`,
        });
      }

      const rows = await qb.orderBy('proc.deleted_at', 'DESC').getMany();
      for (const proc of rows) {
        allItems.push({
          id: proc.id,
          module: 'calibration_procedures',
          moduleLabel: 'Calibration Procedure',
          recordName: proc.process || proc.document_name || 'Procedure',
          identifier: proc.document_name || proc.process,
          recordDetails: {
            process: proc.process,
            document_name: proc.document_name,
            version: proc.version,
            file_type: proc.file_type,
            file_path: proc.file_path,
          },
          deletedAt: proc.deleted_at!,
          deletedById: proc.deleted_by_id,
          deletedByName: proc.deleted_by_name,
          deletionReason: proc.deletion_reason,
          canRestore: true,
        });
      }
    }

    // 5. Work Instructions
    if (moduleFilter === 'all' || moduleFilter === 'work_instructions') {
      const qb = this.instructionRepo
        .createQueryBuilder('wi')
        .withDeleted()
        .where('wi.deleted_at IS NOT NULL');
      if (companyId) {
        qb.andWhere('(wi."companyId" = :companyId OR wi."companyId" IS NULL)', { companyId });
      }
      if (startDate) qb.andWhere('wi.deleted_at >= :startDate', { startDate });
      if (endDate) qb.andWhere('wi.deleted_at <= :endDate', { endDate });
      if (deletedBy) {
        qb.andWhere('(LOWER(wi.deleted_by_name) LIKE :dBy OR wi.deleted_by_id = :dById)', {
          dBy: `%${deletedBy}%`,
          dById: deletedBy,
        });
      }
      if (search) {
        qb.andWhere(
          '(LOWER(wi.title) LIKE :s OR LOWER(wi.document_name) LIKE :s OR LOWER(wi.id_code) LIKE :s)',
          { s: `%${search}%` },
        );
      }

      const rows = await qb.orderBy('wi.deleted_at', 'DESC').getMany();
      for (const wi of rows) {
        allItems.push({
          id: wi.id,
          module: 'work_instructions',
          moduleLabel: 'Work Instruction',
          recordName: wi.title || wi.document_name || 'Work Instruction',
          identifier: wi.id_code || wi.document_name || wi.title,
          recordDetails: {
            title: wi.title,
            document_name: wi.document_name,
            id_code: wi.id_code,
            part_name: wi.part_name,
            version: wi.version,
            file_path: wi.file_path,
          },
          deletedAt: wi.deleted_at!,
          deletedById: wi.deleted_by_id,
          deletedByName: wi.deleted_by_name,
          deletionReason: wi.deletion_reason,
          canRestore: true,
        });
      }
    }

    // 6. Gauge Diagrams
    if (moduleFilter === 'all' || moduleFilter === 'gauge_diagrams') {
      const qb = this.diagramRepo
        .createQueryBuilder('gd')
        .withDeleted()
        .where('gd.deleted_at IS NOT NULL');
      if (companyId) {
        qb.andWhere('(gd."companyId" = :companyId OR gd."companyId" IS NULL)', { companyId });
      }
      if (startDate) qb.andWhere('gd.deleted_at >= :startDate', { startDate });
      if (endDate) qb.andWhere('gd.deleted_at <= :endDate', { endDate });
      if (deletedBy) {
        qb.andWhere('(LOWER(gd.deleted_by_name) LIKE :dBy OR gd.deleted_by_id = :dById)', {
          dBy: `%${deletedBy}%`,
          dById: deletedBy,
        });
      }
      if (search) {
        qb.andWhere(
          '(LOWER(gd.gauge_name) LIKE :s OR LOWER(gd.document_name) LIKE :s OR LOWER(gd.id_code) LIKE :s)',
          { s: `%${search}%` },
        );
      }

      const rows = await qb.orderBy('gd.deleted_at', 'DESC').getMany();
      for (const gd of rows) {
        allItems.push({
          id: gd.id,
          module: 'gauge_diagrams',
          moduleLabel: 'Gauge Diagram',
          recordName: gd.gauge_name || gd.document_name || 'Diagram',
          identifier: gd.id_code || gd.document_name || gd.gauge_name,
          recordDetails: {
            gauge_name: gd.gauge_name,
            document_name: gd.document_name,
            id_code: gd.id_code,
            part_name: gd.part_name,
            version: gd.version,
            file_path: gd.file_path,
          },
          deletedAt: gd.deleted_at!,
          deletedById: gd.deleted_by_id,
          deletedByName: gd.deleted_by_name,
          deletionReason: gd.deletion_reason,
          canRestore: true,
        });
      }
    }

    // Sort descending by deletedAt
    allItems.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    const total = allItems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedItems = allItems.slice((page - 1) * limit, page * limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieves single soft-deleted record details and runs conflict analysis
   */
  async getDeletedItemDetail(
    module: string,
    id: string,
    companyId?: string,
  ): Promise<{
    item: RecoveryItemDto;
    conflicts: string[];
    canRestore: boolean;
  }> {
    const conflicts: string[] = [];
    let item: RecoveryItemDto | null = null;

    switch (module.toLowerCase()) {
      case 'instruments': {
        const inst = await this.instrumentRepo.findOne({
          where: { id },
          withDeleted: true,
        });
        if (!inst || !inst.deleted_at) throw new NotFoundException('Deleted instrument not found');

        // Check if an active instrument with the same id_code exists in the company
        if (inst.id_code) {
          const activeConflict = await this.instrumentRepo.findOne({
            where: {
              id_code: inst.id_code,
              companyId: inst.companyId || companyId,
            },
          });
          if (activeConflict && activeConflict.id !== inst.id) {
            conflicts.push(`An active instrument with ID Code "${inst.id_code}" already exists.`);
          }
        }

        // Count dependent child calibrations that will be restored along with the instrument
        const childCalibrations = await this.calibrationRepo.count({
          where: {
            instrument_id: inst.id,
            deleted_with_parent_id: inst.id,
          },
          withDeleted: true,
        });

        item = {
          id: inst.id,
          module: 'instruments',
          moduleLabel: 'Instrument Master',
          recordName: inst.name || 'Unnamed Instrument',
          identifier: inst.id_code || inst.id,
          recordDetails: {
            ...inst,
            restorableChildCalibrationsCount: childCalibrations,
          },
          deletedAt: inst.deleted_at,
          deletedById: inst.deleted_by_id,
          deletedByName: inst.deleted_by_name,
          deletionReason: inst.deletion_reason,
          canRestore: conflicts.length === 0,
          conflictWarning: conflicts.length > 0 ? conflicts.join(' ') : undefined,
        };
        break;
      }

      case 'calibrations': {
        const cal = await this.calibrationRepo.findOne({
          where: { id },
          withDeleted: true,
          relations: ['instrument'],
        });
        if (!cal || !cal.deleted_at) throw new NotFoundException('Deleted calibration not found');

        const parentInst = cal.instrument;
        if (!parentInst) {
          conflicts.push('Parent instrument associated with this calibration no longer exists.');
        } else if (parentInst.deleted_at != null) {
          conflicts.push(
            `Parent instrument "${parentInst.id_code || parentInst.name}" is currently in the Recovery Center. You must restore the instrument first.`,
          );
        }

        item = {
          id: cal.id,
          module: 'calibrations',
          moduleLabel: 'Calibration Record',
          recordName: `Certificate ${cal.certificate_number || cal.id}`,
          identifier: cal.certificate_number || cal.id,
          recordDetails: {
            ...cal,
            parent_instrument_name: parentInst?.name,
            parent_instrument_id_code: parentInst?.id_code,
            parent_instrument_status: parentInst?.deleted_at ? 'DELETED' : 'ACTIVE',
          },
          deletedAt: cal.deleted_at,
          deletedById: cal.deleted_by_id,
          deletedByName: cal.deleted_by_name,
          deletionReason: cal.deletion_reason,
          deletedWithParentId: cal.deleted_with_parent_id,
          canRestore: conflicts.length === 0,
          conflictWarning: conflicts.length > 0 ? conflicts.join(' ') : undefined,
        };
        break;
      }

      case 'templates': {
        const tpl = await this.templateRepo.findOne({
          where: { id },
          withDeleted: true,
        });
        if (!tpl || !tpl.deleted_at) throw new NotFoundException('Deleted template not found');

        // Check if an active template with the same name exists
        const activeNameConflict = await this.templateRepo.findOne({
          where: {
            name: tpl.name,
            companyId: tpl.companyId || companyId,
          },
        });
        if (activeNameConflict && activeNameConflict.id !== tpl.id) {
          conflicts.push(`An active template with the name "${tpl.name}" already exists.`);
        }

        item = {
          id: tpl.id,
          module: 'templates',
          moduleLabel: 'Calibration Template',
          recordName: tpl.name,
          identifier: tpl.name,
          recordDetails: tpl,
          deletedAt: tpl.deleted_at,
          deletedById: tpl.deleted_by_id,
          deletedByName: tpl.deleted_by_name,
          deletionReason: tpl.deletion_reason,
          canRestore: conflicts.length === 0,
          conflictWarning: conflicts.length > 0 ? conflicts.join(' ') : undefined,
        };
        break;
      }

      case 'calibration_procedures': {
        const proc = await this.procedureRepo.findOne({
          where: { id },
          withDeleted: true,
        });
        if (!proc || !proc.deleted_at) throw new NotFoundException('Deleted procedure not found');

        if (proc.file_path && !fs.existsSync(path.resolve(process.cwd(), proc.file_path.replace(/^\//, '')))) {
          conflicts.push('Underlying procedure file could not be verified in server storage.');
        }

        item = {
          id: proc.id,
          module: 'calibration_procedures',
          moduleLabel: 'Calibration Procedure',
          recordName: proc.process || proc.document_name,
          identifier: proc.document_name || proc.process,
          recordDetails: proc,
          deletedAt: proc.deleted_at,
          deletedById: proc.deleted_by_id,
          deletedByName: proc.deleted_by_name,
          deletionReason: proc.deletion_reason,
          canRestore: conflicts.length === 0,
          conflictWarning: conflicts.length > 0 ? conflicts.join(' ') : undefined,
        };
        break;
      }

      case 'work_instructions': {
        const wi = await this.instructionRepo.findOne({
          where: { id },
          withDeleted: true,
        });
        if (!wi || !wi.deleted_at) throw new NotFoundException('Deleted work instruction not found');

        if (wi.file_path && !fs.existsSync(path.resolve(process.cwd(), wi.file_path.replace(/^\//, '')))) {
          conflicts.push('Underlying work instruction file could not be verified in server storage.');
        }

        item = {
          id: wi.id,
          module: 'work_instructions',
          moduleLabel: 'Work Instruction',
          recordName: wi.title || wi.document_name,
          identifier: wi.id_code || wi.document_name,
          recordDetails: wi,
          deletedAt: wi.deleted_at,
          deletedById: wi.deleted_by_id,
          deletedByName: wi.deleted_by_name,
          deletionReason: wi.deletion_reason,
          canRestore: conflicts.length === 0,
          conflictWarning: conflicts.length > 0 ? conflicts.join(' ') : undefined,
        };
        break;
      }

      case 'gauge_diagrams': {
        const gd = await this.diagramRepo.findOne({
          where: { id },
          withDeleted: true,
        });
        if (!gd || !gd.deleted_at) throw new NotFoundException('Deleted gauge diagram not found');

        if (gd.file_path && !fs.existsSync(path.resolve(process.cwd(), gd.file_path.replace(/^\//, '')))) {
          conflicts.push('Underlying gauge diagram file could not be verified in server storage.');
        }

        item = {
          id: gd.id,
          module: 'gauge_diagrams',
          moduleLabel: 'Gauge Diagram',
          recordName: gd.gauge_name || gd.document_name,
          identifier: gd.id_code || gd.document_name,
          recordDetails: gd,
          deletedAt: gd.deleted_at,
          deletedById: gd.deleted_by_id,
          deletedByName: gd.deleted_by_name,
          deletionReason: gd.deletion_reason,
          canRestore: conflicts.length === 0,
          conflictWarning: conflicts.length > 0 ? conflicts.join(' ') : undefined,
        };
        break;
      }

      default:
        throw new BadRequestException(`Unsupported module: ${module}`);
    }

    if (!item) {
      throw new NotFoundException(`Deleted item of module ${module} with ID ${id} not found.`);
    }

    return {
      item,
      conflicts,
      canRestore: conflicts.length === 0,
    };
  }

  /**
   * Atomic Restoration of a soft-deleted record with parent-child coordination & conflict checks
   */
  async restoreRecord(
    module: string,
    id: string,
    user: any,
  ): Promise<{
    success: boolean;
    message: string;
    restoredId: string;
    affectedChildCount?: number;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const companyId = user?.companyId;
      const userId = user?.id || user?.userId;
      const userName = user?.name || user?.email || 'User';

      let affectedChildCount = 0;

      switch (module.toLowerCase()) {
        case 'instruments': {
          const inst = await queryRunner.manager.findOne(Instrument, {
            where: { id },
            withDeleted: true,
          });
          if (!inst || !inst.deleted_at) {
            throw new NotFoundException('Deleted instrument not found in Recovery Center.');
          }

          // Check unique id_code conflict
          if (inst.id_code) {
            const conflict = await queryRunner.manager.findOne(Instrument, {
              where: {
                id_code: inst.id_code,
                companyId: inst.companyId || companyId,
              },
            });
            if (conflict && conflict.id !== inst.id) {
              throw new BadRequestException(
                `Cannot restore instrument: Active instrument with ID Code "${inst.id_code}" already exists.`,
              );
            }
          }

          // Restore instrument
          await queryRunner.manager.update(Instrument, id, {
            deleted_at: null as any,
            deleted_by_id: null as any,
            deleted_by_name: null as any,
            deletion_reason: null as any,
          });

          // Restore ONLY child calibrations that were deleted as part of this parent's deletion
          const childCals = await queryRunner.manager.find(Calibration, {
            where: {
              instrument_id: id,
              deleted_with_parent_id: id,
            },
            withDeleted: true,
          });

          if (childCals.length > 0) {
            for (const c of childCals) {
              await queryRunner.manager.update(Calibration, c.id, {
                deleted_at: null as any,
                deleted_by_id: null as any,
                deleted_by_name: null as any,
                deletion_reason: null as any,
                deleted_with_parent_id: null as any,
              });
            }
            affectedChildCount = childCals.length;
          }

          // Write audit log
          await this.auditLogsService.createLog({
            userId,
            companyId: inst.companyId || companyId,
            action: 'INSTRUMENT_RESTORE',
            resource: `/api/recovery/instruments/${id}/restore`,
            resourceType: 'Instrument',
            description: `Restored instrument "${inst.name}" (${inst.id_code || inst.id}) from Recovery Center.`,
            details: {
              instrumentId: inst.id,
              restoredCalibrationsCount: affectedChildCount,
              restoredBy: userName,
            },
          });

          await queryRunner.commitTransaction();

          return {
            success: true,
            message: `Instrument "${inst.name}" restored successfully.${
              affectedChildCount > 0 ? ` Restored ${affectedChildCount} associated calibration records.` : ''
            }`,
            restoredId: inst.id,
            affectedChildCount,
          };
        }

        case 'calibrations': {
          const cal = await queryRunner.manager.findOne(Calibration, {
            where: { id },
            withDeleted: true,
            relations: ['instrument'],
          });
          if (!cal || !cal.deleted_at) {
            throw new NotFoundException('Deleted calibration not found in Recovery Center.');
          }

          const parentInst = cal.instrument;
          if (!parentInst) {
            throw new BadRequestException(
              'Cannot restore calibration: Associated parent instrument no longer exists.',
            );
          }
          if (parentInst.deleted_at != null) {
            throw new BadRequestException(
              `Cannot restore calibration: Parent instrument "${parentInst.id_code || parentInst.name}" is currently deleted. Please restore the parent instrument first.`,
            );
          }

          // Restore calibration
          await queryRunner.manager.update(Calibration, id, {
            deleted_at: null as any,
            deleted_by_id: null as any,
            deleted_by_name: null as any,
            deletion_reason: null as any,
            deleted_with_parent_id: null as any,
          });

          // Write audit log
          await this.auditLogsService.createLog({
            userId,
            companyId: cal.companyId || companyId,
            action: 'CALIBRATION_RESTORE',
            resource: `/api/recovery/calibrations/${id}/restore`,
            resourceType: 'Calibration',
            description: `Restored calibration certificate "${cal.certificate_number}" for instrument "${parentInst.id_code}".`,
            details: {
              calibrationId: cal.id,
              certificateNumber: cal.certificate_number,
              instrumentId: parentInst.id,
              restoredBy: userName,
            },
          });

          await queryRunner.commitTransaction();

          // Sync parent instrument dates outside the lock
          try {
            const latestCal = await this.calibrationRepo.findOne({
              where: { instrument_id: parentInst.id },
              order: { calibration_date: 'DESC' },
            });

            if (latestCal) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isOverdue = latestCal.next_calibration_date
                ? new Date(latestCal.next_calibration_date) <= today
                : false;

              await this.instrumentsService.update(parentInst.id, {
                last_calibration_date: latestCal.calibration_date
                  ? new Date(latestCal.calibration_date).toISOString()
                  : undefined,
                due_date: latestCal.next_calibration_date
                  ? new Date(latestCal.next_calibration_date).toISOString()
                  : undefined,
                status: latestCal.verdict === 'FAIL' ? 'REJECTED' : isOverdue ? 'Overdue' : 'OK',
                calibration_source: 'In-House',
                cert_no: latestCal.certificate_number,
              } as any);
            }
          } catch (e) {
            this.logger.warn(`Could not sync instrument dates on calibration restore: ${e}`);
          }

          return {
            success: true,
            message: `Calibration certificate "${cal.certificate_number}" restored successfully.`,
            restoredId: cal.id,
          };
        }

        case 'templates': {
          const tpl = await queryRunner.manager.findOne(CalibrationTemplate, {
            where: { id },
            withDeleted: true,
          });
          if (!tpl || !tpl.deleted_at) {
            throw new NotFoundException('Deleted template not found in Recovery Center.');
          }

          // Check active name conflict
          const conflict = await queryRunner.manager.findOne(CalibrationTemplate, {
            where: {
              name: tpl.name,
              companyId: tpl.companyId || companyId,
            },
          });
          if (conflict && conflict.id !== tpl.id) {
            throw new BadRequestException(
              `Cannot restore template: Active template with name "${tpl.name}" already exists.`,
            );
          }

          await queryRunner.manager.update(CalibrationTemplate, id, {
            deleted_at: null as any,
            deleted_by_id: null as any,
            deleted_by_name: null as any,
            deletion_reason: null as any,
          });

          await this.auditLogsService.createLog({
            userId,
            companyId: tpl.companyId || companyId,
            action: 'TEMPLATE_RESTORE',
            resource: `/api/recovery/templates/${id}/restore`,
            resourceType: 'CalibrationTemplate',
            description: `Restored calibration template "${tpl.name}".`,
            details: { templateId: tpl.id, restoredBy: userName },
          });

          await queryRunner.commitTransaction();

          return {
            success: true,
            message: `Calibration template "${tpl.name}" restored successfully.`,
            restoredId: tpl.id,
          };
        }

        case 'calibration_procedures': {
          const proc = await queryRunner.manager.findOne(CalibrationProcedure, {
            where: { id },
            withDeleted: true,
          });
          if (!proc || !proc.deleted_at) {
            throw new NotFoundException('Deleted procedure not found in Recovery Center.');
          }

          await queryRunner.manager.update(CalibrationProcedure, id, {
            deleted_at: null as any,
            deleted_by_id: null as any,
            deleted_by_name: null as any,
            deletion_reason: null as any,
          });

          await this.auditLogsService.createLog({
            userId,
            companyId: proc.companyId || companyId,
            action: 'PROCEDURE_RESTORE',
            resource: `/api/recovery/calibration_procedures/${id}/restore`,
            resourceType: 'CalibrationProcedure',
            description: `Restored calibration procedure "${proc.process || proc.document_name}".`,
            details: { procedureId: proc.id, restoredBy: userName },
          });

          await queryRunner.commitTransaction();

          return {
            success: true,
            message: `Calibration procedure "${proc.process || proc.document_name}" restored successfully.`,
            restoredId: proc.id,
          };
        }

        case 'work_instructions': {
          const wi = await queryRunner.manager.findOne(WorkInstruction, {
            where: { id },
            withDeleted: true,
          });
          if (!wi || !wi.deleted_at) {
            throw new NotFoundException('Deleted work instruction not found in Recovery Center.');
          }

          await queryRunner.manager.update(WorkInstruction, id, {
            deleted_at: null as any,
            deleted_by_id: null as any,
            deleted_by_name: null as any,
            deletion_reason: null as any,
          });

          await this.auditLogsService.createLog({
            userId,
            companyId: wi.companyId || companyId,
            action: 'WORK_INSTRUCTION_RESTORE',
            resource: `/api/recovery/work_instructions/${id}/restore`,
            resourceType: 'WorkInstruction',
            description: `Restored work instruction "${wi.title || wi.document_name}".`,
            details: { instructionId: wi.id, restoredBy: userName },
          });

          await queryRunner.commitTransaction();

          return {
            success: true,
            message: `Work instruction "${wi.title || wi.document_name}" restored successfully.`,
            restoredId: wi.id,
          };
        }

        case 'gauge_diagrams': {
          const gd = await queryRunner.manager.findOne(GaugeDiagram, {
            where: { id },
            withDeleted: true,
          });
          if (!gd || !gd.deleted_at) {
            throw new NotFoundException('Deleted gauge diagram not found in Recovery Center.');
          }

          await queryRunner.manager.update(GaugeDiagram, id, {
            deleted_at: null as any,
            deleted_by_id: null as any,
            deleted_by_name: null as any,
            deletion_reason: null as any,
          });

          await this.auditLogsService.createLog({
            userId,
            companyId: gd.companyId || companyId,
            action: 'GAUGE_DIAGRAM_RESTORE',
            resource: `/api/recovery/gauge_diagrams/${id}/restore`,
            resourceType: 'GaugeDiagram',
            description: `Restored gauge diagram "${gd.gauge_name || gd.document_name}".`,
            details: { diagramId: gd.id, restoredBy: userName },
          });

          await queryRunner.commitTransaction();

          return {
            success: true,
            message: `Gauge diagram "${gd.gauge_name || gd.document_name}" restored successfully.`,
            restoredId: gd.id,
          };
        }

        default:
          throw new BadRequestException(`Unsupported module: ${module}`);
      }
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Bulk restore multiple records
   */
  async bulkRestore(
    items: Array<{ id: string; module: string }>,
    user: any,
  ): Promise<{
    restoredCount: number;
    failedCount: number;
    errors: Array<{ id: string; module: string; message: string }>;
  }> {
    let restoredCount = 0;
    let failedCount = 0;
    const errors: Array<{ id: string; module: string; message: string }> = [];

    for (const item of items) {
      try {
        await this.restoreRecord(item.module, item.id, user);
        restoredCount++;
      } catch (err: any) {
        failedCount++;
        errors.push({
          id: item.id,
          module: item.module,
          message: err?.message || 'Failed to restore',
        });
      }
    }

    return {
      restoredCount,
      failedCount,
      errors,
    };
  }
}
