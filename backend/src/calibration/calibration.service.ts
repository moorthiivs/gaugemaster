import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Calibration } from './calibration.entity';
import { CalibrationDraft } from './calibration-draft.entity';
import { CalibrationAuditLog } from './calibration-audit-log.entity';
import { CreateCalibrationDto } from './dto/create-calibration.dto';
import { SettingsService } from '../settings/settings.service';
import { InstrumentsService } from '../instruments/instruments.service';

/**
 * Handles calibration CRUD, auto-generates certificate and ULR numbers
 * based on the company's certificate configuration in Settings.
 */
import { User } from 'src/users/user.entity';

@Injectable()
export class CalibrationService {
  constructor(
    @InjectRepository(Calibration)
    private readonly calibrationRepository: Repository<Calibration>,
    @InjectRepository(CalibrationDraft)
    private readonly draftRepository: Repository<CalibrationDraft>,
    @InjectRepository(CalibrationAuditLog)
    private readonly auditLogRepository: Repository<CalibrationAuditLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly settingsService: SettingsService,
    private readonly instrumentsService: InstrumentsService,
  ) {}

  private async getCompanyUserIds(userId?: string, companyId?: string): Promise<string[]> {
    if (companyId) {
      const companyUsers = await this.userRepository.find({
        where: { companyId },
        select: ['id'],
      });
      if (companyUsers.length > 0) {
        return companyUsers.map((u) => u.id);
      }
    }
    if (!userId) return [];
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user && user.companyId) {
      const companyUsers = await this.userRepository.find({
        where: { companyId: user.companyId },
        select: ['id'],
      });
      return companyUsers.map((u) => u.id);
    }
    return [userId];
  }

  // ── Defaults ─────────────────────────────────────────────────
  private readonly DEFAULT_CERT_PREFIX = 'CAL/CERT';
  private readonly DEFAULT_CERT_SEPARATOR = '/';
  private readonly DEFAULT_CERT_YEAR_FORMAT = 'YYYY';
  private readonly DEFAULT_CERT_SEQ_LENGTH = 5;

  private readonly DEFAULT_ULR_PREFIX = 'ULR';
  private readonly DEFAULT_ULR_SEPARATOR = '/';
  private readonly DEFAULT_ULR_YEAR_FORMAT = 'YYYY';
  private readonly DEFAULT_ULR_SEQ_LENGTH = 5;

  // ── Number Generation Helpers ────────────────────────────────

  private formatYear(format: string): string {
    const year = new Date().getFullYear();
    return format === 'YY' ? String(year).slice(-2) : String(year);
  }

  private async getMaxCertSequence(companyId: string, userId: string): Promise<number> {
    const userIds = await this.getCompanyUserIds(userId, companyId);
    const calibrations = await this.calibrationRepository.find({
      where: userIds.length > 0 ? userIds.map((id) => ({ created_by: { id } })) : [],
      select: ['certificate_number'],
    });

    let maxSeq = 0;
    for (const cal of calibrations) {
      if (cal.certificate_number) {
        const parts = cal.certificate_number.split('/');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
    return maxSeq;
  }

  private async getMaxUlrSequence(companyId: string, userId: string): Promise<number> {
    const userIds = await this.getCompanyUserIds(userId, companyId);
    const calibrations = await this.calibrationRepository.find({
      where: userIds.length > 0 ? userIds.map((id) => ({ created_by: { id } })) : [],
      select: ['ulr_number'],
    });

    let maxSeq = 0;
    for (const cal of calibrations) {
      if (cal.ulr_number) {
        const parts = cal.ulr_number.split('/');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
    return maxSeq;
  }

  /**
   * Generates the next certificate number based on company settings.
   * Increments the sequence counter atomically.
   */
  async generateCertificateNumber(
    userId: string,
    companyId: string,
  ): Promise<string> {
    const settings = await this.settingsService.findOne(userId, companyId);
    const config = settings?.certificateConfig;

    const prefix = config?.certPrefix || this.DEFAULT_CERT_PREFIX;
    const sep = config?.certSeparator || this.DEFAULT_CERT_SEPARATOR;
    const yearFmt = config?.certYearFormat || this.DEFAULT_CERT_YEAR_FORMAT;
    const seqLen = config?.certSeqLength || this.DEFAULT_CERT_SEQ_LENGTH;

    const dbMaxSeq = await this.getMaxCertSequence(companyId, userId);
    const configSeq = config?.certNextSeq || 0;
    const nextSeq = Math.max(configSeq, dbMaxSeq) + 1;

    const year = this.formatYear(yearFmt);
    const seq = String(nextSeq).padStart(seqLen, '0');
    const certNumber = `${prefix}${sep}${year}${sep}${seq}`;

    // Persist the incremented sequence
    await this.settingsService.create({
      userId,
      companyId,
      certificateConfig: {
        ...(config || {}),
        certPrefix: prefix,
        certSeparator: sep,
        certYearFormat: yearFmt,
        certSeqLength: seqLen,
        certNextSeq: nextSeq,
        ulrPrefix: config?.ulrPrefix || this.DEFAULT_ULR_PREFIX,
        ulrSeparator: config?.ulrSeparator || this.DEFAULT_ULR_SEPARATOR,
        ulrYearFormat: config?.ulrYearFormat || this.DEFAULT_ULR_YEAR_FORMAT,
        ulrSeqLength: config?.ulrSeqLength || this.DEFAULT_ULR_SEQ_LENGTH,
        ulrNextSeq: config?.ulrNextSeq || 0,
      },
    });

    return certNumber;
  }

  /**
   * Generates the next ULR number based on company settings.
   * Only called when ULR is enabled.
   */
  async generateUlrNumber(
    userId: string,
    companyId: string,
  ): Promise<string> {
    const settings = await this.settingsService.findOne(userId, companyId);
    const config = settings?.certificateConfig;

    const prefix = config?.ulrPrefix || this.DEFAULT_ULR_PREFIX;
    const sep = config?.ulrSeparator || this.DEFAULT_ULR_SEPARATOR;
    const yearFmt = config?.ulrYearFormat || this.DEFAULT_ULR_YEAR_FORMAT;
    const seqLen = config?.ulrSeqLength || this.DEFAULT_ULR_SEQ_LENGTH;

    const dbMaxSeq = await this.getMaxUlrSequence(companyId, userId);
    const dbMaxCertSeq = await this.getMaxCertSequence(companyId, userId);
    const configSeq = config?.ulrNextSeq || 0;
    const nextSeq = Math.max(configSeq, dbMaxSeq, dbMaxCertSeq) + 1;

    const year = this.formatYear(yearFmt);
    const seq = String(nextSeq).padStart(seqLen, '0');
    const ulrNumber = `${prefix}${sep}${year}${sep}${seq}`;

    // Persist the incremented sequence
    await this.settingsService.create({
      userId,
      companyId,
      certificateConfig: {
        ...(config || {}),
        certPrefix: config?.certPrefix || this.DEFAULT_CERT_PREFIX,
        certSeparator: config?.certSeparator || this.DEFAULT_CERT_SEPARATOR,
        certYearFormat: config?.certYearFormat || this.DEFAULT_CERT_YEAR_FORMAT,
        certSeqLength: config?.certSeqLength || this.DEFAULT_CERT_SEQ_LENGTH,
        certNextSeq: config?.certNextSeq || 0,
        ulrPrefix: prefix,
        ulrSeparator: sep,
        ulrYearFormat: yearFmt,
        ulrSeqLength: seqLen,
        ulrNextSeq: nextSeq,
      },
    });

    return ulrNumber;
  }

  /**
   * Preview what the next certificate and ULR numbers will look like
   * without incrementing.
   */
  async getNextNumbers(
    userId: string,
    companyId: string,
  ): Promise<{ nextCertNumber: string; nextUlrNumber: string }> {
    const settings = await this.settingsService.findOne(userId, companyId);
    const config = settings?.certificateConfig;

    const dbMaxCertSeq = await this.getMaxCertSequence(companyId, userId);
    const dbMaxUlrSeq = await this.getMaxUlrSequence(companyId, userId);

    // Certificate
    const certPrefix = config?.certPrefix || this.DEFAULT_CERT_PREFIX;
    const certSep = config?.certSeparator || this.DEFAULT_CERT_SEPARATOR;
    const certYearFmt = config?.certYearFormat || this.DEFAULT_CERT_YEAR_FORMAT;
    const certSeqLen = config?.certSeqLength || this.DEFAULT_CERT_SEQ_LENGTH;
    const certNextSeq = Math.max(config?.certNextSeq || 0, dbMaxCertSeq) + 1;
    const certYear = this.formatYear(certYearFmt);
    const nextCertNumber = `${certPrefix}${certSep}${certYear}${certSep}${String(certNextSeq).padStart(certSeqLen, '0')}`;

    // ULR
    const ulrPrefix = config?.ulrPrefix || this.DEFAULT_ULR_PREFIX;
    const ulrSep = config?.ulrSeparator || this.DEFAULT_ULR_SEPARATOR;
    const ulrYearFmt = config?.ulrYearFormat || this.DEFAULT_ULR_YEAR_FORMAT;
    const ulrSeqLen = config?.ulrSeqLength || this.DEFAULT_ULR_SEQ_LENGTH;
    const ulrNextSeq = Math.max(config?.ulrNextSeq || 0, dbMaxUlrSeq, dbMaxCertSeq) + 1;
    const ulrYear = this.formatYear(ulrYearFmt);
    const nextUlrNumber = `${ulrPrefix}${ulrSep}${ulrYear}${ulrSep}${String(ulrNextSeq).padStart(ulrSeqLen, '0')}`;

    return { nextCertNumber, nextUlrNumber };
  }

  // ── CRUD ─────────────────────────────────────────────────────

  async create(dto: CreateCalibrationDto): Promise<Calibration> {
    const userId = dto.created_by || '';
    const companyId = dto.companyId || '';

    // Auto-generate certificate number (always)
    const certificate_number = await this.generateCertificateNumber(
      userId,
      companyId,
    );

    // Generate ULR only if enabled
    let ulr_number: string | undefined = undefined;
    if (dto.ulr_enabled) {
      ulr_number = await this.generateUlrNumber(userId, companyId);
    }

    const approval_status = dto.approval_status || 'Calibration Completed';

    const calibration = this.calibrationRepository.create({
      ...dto,
      certificate_number,
      ulr_number,
      approval_status,
      certificate_generated: approval_status === 'Approved',
      calibration_date: new Date(dto.calibration_date),
      certificate_issue_date: dto.certificate_issue_date
        ? new Date(dto.certificate_issue_date)
        : dto.calibration_date
          ? new Date(dto.calibration_date)
          : new Date(),
      reference_standard_validity: dto.reference_standard_validity
        ? new Date(dto.reference_standard_validity)
        : undefined,
      next_calibration_date: dto.next_calibration_date
        ? new Date(dto.next_calibration_date)
        : undefined,
      created_by: dto.created_by ? ({ id: dto.created_by } as any) : undefined,
    });

    const savedCalibration = await this.calibrationRepository.save(calibration);

    // Update Instrument Master schedule & status
    if (dto.instrument_id) {
      try {
        await this.instrumentsService.update(dto.instrument_id, {
          last_calibration_date: savedCalibration.calibration_date as any,
          due_date: savedCalibration.next_calibration_date as any,
          status: savedCalibration.verdict === 'FAIL' ? 'REJECTED' : 'OK',
          calibration_source: 'In-House',
        } as any);
      } catch (err) {
        console.warn(`Failed to update instrument ${dto.instrument_id} after calibration`, err);
      }
    }

    return savedCalibration;
  }

  async approve(
    id: string,
    reviewer: { id: string; name: string; designation?: string },
    signature?: string,
  ): Promise<Calibration> {
    const calibration = await this.findOne(id);
    if (!calibration) throw new NotFoundException('Calibration record not found');

    const oldStatus = calibration.approval_status;
    calibration.approval_status = 'Approved';
    calibration.approved_by = reviewer.name;
    calibration.approved_by_designation = reviewer.designation || 'Quality Manager';
    if (signature) {
      calibration.approved_by_signature = signature;
    }
    calibration.approved_at = new Date();
    calibration.certificate_generated = true;

    const saved = await this.calibrationRepository.save(calibration);

    // Update Instrument Master schedule now that it is Approved
    if (calibration.instrument_id) {
      try {
        await this.instrumentsService.update(calibration.instrument_id, {
          last_calibration_date: saved.calibration_date as any,
          due_date: saved.next_calibration_date as any,
          status: saved.verdict === 'FAIL' ? 'REJECTED' : 'OK',
          calibration_source: 'In-House',
        } as any);
      } catch (err) {
        console.warn(`Failed to update instrument ${calibration.instrument_id} on approval`, err);
      }
    }

    // Record audit log entry
    const auditLog = this.auditLogRepository.create({
      calibration_id: saved.id,
      edited_by_id: reviewer.id,
      edited_by_name: reviewer.name,
      changes_summary: [{ field: 'approval_status', oldValue: oldStatus, newValue: 'Approved' }],
      remarks: 'Calibration Record Approved by Reviewer',
    });
    await this.auditLogRepository.save(auditLog);

    return saved;
  }

  async reject(
    id: string,
    reviewer: { id: string; name: string },
    rejectionReason: string,
  ): Promise<Calibration> {
    const calibration = await this.findOne(id);
    if (!calibration) throw new NotFoundException('Calibration record not found');

    const oldStatus = calibration.approval_status;
    calibration.approval_status = 'Rejected';
    calibration.rejected_by = reviewer.name;
    calibration.rejected_at = new Date();
    calibration.rejection_reason = rejectionReason;
    calibration.certificate_generated = false;

    const saved = await this.calibrationRepository.save(calibration);

    // Record audit log entry
    const auditLog = this.auditLogRepository.create({
      calibration_id: saved.id,
      edited_by_id: reviewer.id,
      edited_by_name: reviewer.name,
      changes_summary: [{ field: 'approval_status', oldValue: oldStatus, newValue: 'Rejected' }],
      remarks: `Calibration Rejected. Reason: ${rejectionReason}`,
    });
    await this.auditLogRepository.save(auditLog);

    return saved;
  }

  async findAll(filters: {
    userId?: string;
    companyId?: string;
    instrumentId?: string;
    calibrationType?: string;
    verdict?: string;
    pendingCertsOnly?: boolean | string;
    approvalStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    latestOnly?: boolean | string;
    page?: number;
    pageSize?: number;
  }) {
    const {
      userId,
      companyId,
      instrumentId,
      calibrationType,
      verdict,
      pendingCertsOnly,
      approvalStatus,
      dateFrom,
      dateTo,
      search,
      latestOnly,
      page = 1,
      pageSize = 10,
    } = filters;

    const qb = this.calibrationRepository
      .createQueryBuilder('cal')
      .leftJoinAndSelect('cal.instrument', 'instrument')
      .leftJoinAndSelect('cal.created_by', 'created_by');

    if (latestOnly === true || latestOnly === 'true') {
      qb.andWhere((qbSub) => {
        const subQuery = qbSub
          .subQuery()
          .select('c.id')
          .from(Calibration, 'c')
          .where('c.instrument_id = cal.instrument_id')
          .orderBy('c.calibration_date', 'DESC')
          .addOrderBy('c.created_at', 'DESC')
          .limit(1)
          .getQuery();
        return `(cal.instrument_id IS NULL OR cal.id = ${subQuery})`;
      });
    }

    const userIds = await this.getCompanyUserIds(userId, companyId);
    if (userIds.length > 0) {
      if (companyId) {
        qb.andWhere('(created_by.id IN (:...userIds) OR cal.companyId = :companyId)', { userIds, companyId });
      } else {
        qb.andWhere('created_by.id IN (:...userIds)', { userIds });
      }
    } else if (companyId) {
      qb.andWhere('cal.companyId = :companyId', { companyId });
    } else {
      // Fallback when neither userId nor companyId is supplied: prevent cross-tenant data leak
      qb.andWhere('1 = 0');
    }
    if (instrumentId) qb.andWhere('cal.instrument_id = :instrumentId', { instrumentId });
    if (calibrationType) qb.andWhere('cal.calibration_type = :calibrationType', { calibrationType });
    if (verdict) qb.andWhere('cal.verdict = :verdict', { verdict });
    if (filters.pendingCertsOnly === true || (filters as any).pendingCertsOnly === 'true') {
      qb.andWhere('(cal.certificate_generated = false OR cal.certificate_generated IS NULL)');
    }
    if (approvalStatus) {
      if (approvalStatus === 'Pending Approval') {
        qb.andWhere("(cal.approval_status = 'Calibration Completed' OR cal.approval_status = 'Pending Approval')");
      } else {
        qb.andWhere('cal.approval_status = :approvalStatus', { approvalStatus });
      }
    }
    if (dateFrom && dateTo) {
      qb.andWhere('cal.calibration_date BETWEEN :dateFrom AND :dateTo', { dateFrom, dateTo });
    }

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(cal.certificate_number) LIKE :s OR LOWER(cal.ulr_number) LIKE :s OR LOWER(instrument.name) LIKE :s OR LOWER(instrument.id_code) LIKE :s)',
        { s },
      );
    }

    qb.orderBy('cal.calibration_date', 'DESC')
      .addOrderBy('cal.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string): Promise<Calibration> {
    const calibration = await this.calibrationRepository.findOne({
      where: { id },
      relations: ['instrument', 'created_by', 'company'],
    });
    if (!calibration) {
      throw new NotFoundException(`Calibration with ID ${id} not found`);
    }
    return calibration;
  }

  async getLatestByInstrument(instrumentId: string): Promise<Calibration | null> {
    return this.calibrationRepository.findOne({
      where: { instrument_id: instrumentId },
      order: { calibration_date: 'DESC' },
    });
  }

  async findByInstrument(instrumentId: string) {
    return this.calibrationRepository.find({
      where: { instrument_id: instrumentId },
      order: { calibration_date: 'DESC' },
      relations: ['instrument'],
    });
  }

  async markCertificateGenerated(id: string, filePath: string) {
    const calibration = await this.findOne(id);
    calibration.certificate_generated = true;
    calibration.certificate_file = filePath;
    const saved = await this.calibrationRepository.save(calibration);

    try {
      await this.instrumentsService.update(calibration.instrument_id, {
        certificate_file: filePath,
      } as any);
    } catch (err) {
      console.warn(`Failed to update instrument certificate`, err);
    }

    return saved;
  }

  async getStats(userId: string) {
    const userIds = await this.getCompanyUserIds(userId);
    const targetUserIds = userIds.length > 0 ? userIds : [userId];

    const total = await this.calibrationRepository.count({
      where: { created_by: { id: In(targetUserIds) } },
    });
    const passed = await this.calibrationRepository.count({
      where: { created_by: { id: In(targetUserIds) }, verdict: 'PASS' },
    });
    const failed = await this.calibrationRepository.count({
      where: { created_by: { id: In(targetUserIds) }, verdict: 'FAIL' },
    });
    const pendingCerts = await this.calibrationRepository.count({
      where: { created_by: { id: In(targetUserIds) }, certificate_generated: false },
    });

    return {
      total,
      passed,
      failed,
      pendingCerts,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
    };
  }

  // ── Drafts ───────────────────────────────────────────────────

  async getAllDrafts(userId: string): Promise<CalibrationDraft[]> {
    const userIds = await this.getCompanyUserIds(userId);
    const targetUserIds = userIds.length > 0 ? userIds : [userId];
    return this.draftRepository.find({
      where: { user_id: In(targetUserIds) },
      order: { updated_at: 'DESC' },
    });
  }

  async getDraft(id: string): Promise<CalibrationDraft | null> {
    return this.draftRepository.findOne({
      where: { id },
    });
  }

  async saveDraft(userId: string, data: any, draftId?: string): Promise<CalibrationDraft> {
    let draft: CalibrationDraft | null = null;
    
    if (draftId) {
      draft = await this.draftRepository.findOne({ where: { id: draftId } });
    }

    if (!draft) {
      draft = this.draftRepository.create({
        user_id: userId,
        data,
      });
    } else {
      draft.data = data;
    }

    return this.draftRepository.save(draft);
  }

  async deleteDraft(id: string): Promise<void> {
    await this.draftRepository.delete({ id });
  }

  // ── Update & Audit Log ───────────────────────────────────────

  async update(
    id: string,
    dto: Partial<CreateCalibrationDto>,
    editedByUserId?: string,
    editedByName?: string,
  ): Promise<Calibration> {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException(`Calibration with ID ${id} not found`);
    }

    // Track changes for audit log
    const changesSummary: { field: string; oldValue: any; newValue: any }[] = [];

    const keysToTrack: (keyof CreateCalibrationDto)[] = [
      'calibration_date',
      'calibration_type',
      'reference_standard_name',
      'reference_standard_id',
      'environmental_conditions',
      'calibration_points',
      'uncertainty',
      'verdict',
      'remarks',
      'calibrated_by',
      'reviewed_by',
      'approved_by',
      'next_calibration_date',
    ];

    for (const key of keysToTrack) {
      if (dto[key] !== undefined) {
        const oldVal = (existing as any)[key];
        const newVal = dto[key];

        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changesSummary.push({
            field: key,
            oldValue: oldVal,
            newValue: newVal,
          });
        }
      }
    }

    if (dto.calibration_date) existing.calibration_date = new Date(dto.calibration_date);
    if (dto.calibration_type !== undefined) existing.calibration_type = dto.calibration_type;
    
    // Generate ULR if newly enabled
    if (dto.ulr_enabled && !existing.ulr_number) {
      existing.ulr_number = await this.generateUlrNumber(
        existing.created_by?.id || '',
        existing.company?.id || ''
      );
    }

    if (dto.reference_standard_name !== undefined) existing.reference_standard_name = dto.reference_standard_name;
    if (dto.reference_standard_id !== undefined) existing.reference_standard_id = dto.reference_standard_id;
    if (dto.reference_standard_traceable_to !== undefined) existing.reference_standard_traceable_to = dto.reference_standard_traceable_to;
    if (dto.reference_standard_validity !== undefined) {
      existing.reference_standard_validity = dto.reference_standard_validity
        ? new Date(dto.reference_standard_validity)
        : (undefined as any);
    }
    if (dto.reference_standard_range !== undefined) existing.reference_standard_range = dto.reference_standard_range;
    if (dto.reference_standard_least_count !== undefined) existing.reference_standard_least_count = dto.reference_standard_least_count;
    if (dto.reference_standards !== undefined) existing.reference_standards = dto.reference_standards;
    if (dto.environmental_conditions !== undefined) existing.environmental_conditions = dto.environmental_conditions;
    if (dto.calibration_points !== undefined) existing.calibration_points = dto.calibration_points;
    if (dto.custom_columns !== undefined) existing.custom_columns = dto.custom_columns;
    if (dto.standard_columns_config !== undefined) existing.standard_columns_config = dto.standard_columns_config;
    if (dto.column_order !== undefined) existing.column_order = dto.column_order;
    if (dto.hidden_columns !== undefined) existing.hidden_columns = dto.hidden_columns;
    if (dto.template_id !== undefined) existing.template_id = dto.template_id;
    if (dto.template_name !== undefined) existing.template_name = dto.template_name;
    if ((dto as any).procedure_reference !== undefined) (existing as any).procedure_reference = (dto as any).procedure_reference;
    if ((dto as any).standard_reference !== undefined) (existing as any).standard_reference = (dto as any).standard_reference;
    if (dto.decimal_places !== undefined) existing.decimal_places = dto.decimal_places;
    if (dto.acceptance_criteria !== undefined) existing.acceptance_criteria = dto.acceptance_criteria;
    if (dto.uncertainty !== undefined) existing.uncertainty = dto.uncertainty;
    if (dto.verdict !== undefined) existing.verdict = dto.verdict;
    if (dto.remarks !== undefined) existing.remarks = dto.remarks;
    if (dto.calibrated_by !== undefined) existing.calibrated_by = dto.calibrated_by;
    if (dto.calibrated_by_designation !== undefined) existing.calibrated_by_designation = dto.calibrated_by_designation;
    if (dto.reviewed_by !== undefined) existing.reviewed_by = dto.reviewed_by;
    if (dto.reviewed_by_designation !== undefined) existing.reviewed_by_designation = dto.reviewed_by_designation;
    if (dto.approved_by !== undefined) existing.approved_by = dto.approved_by;
    if (dto.approved_by_designation !== undefined) existing.approved_by_designation = dto.approved_by_designation;
    if (dto.next_calibration_date !== undefined) {
      existing.next_calibration_date = dto.next_calibration_date
        ? new Date(dto.next_calibration_date)
        : (undefined as any);
    }

    const saved = await this.calibrationRepository.save(existing);

    // Sync Instrument Master schedule & status
    if (saved.instrument_id) {
      try {
        await this.instrumentsService.update(saved.instrument_id, {
          last_calibration_date: saved.calibration_date as any,
          due_date: saved.next_calibration_date as any,
          status: saved.verdict === 'FAIL' ? 'REJECTED' : 'OK',
          calibration_source: 'In-House',
        } as any);
      } catch (err) {
        console.warn(`Failed to update instrument ${saved.instrument_id} on calibration update`, err);
      }
    }

    // Record audit log entry if changes were made
    if (changesSummary.length > 0) {
      const log = this.auditLogRepository.create({
        calibration_id: saved.id,
        edited_by_id: editedByUserId,
        edited_by_name: editedByName || 'User',
        changes_summary: changesSummary,
      });
      await this.auditLogRepository.save(log);
    }

    return saved;
  }

  async getAuditLogs(calibrationId: string): Promise<CalibrationAuditLog[]> {
    return this.auditLogRepository.find({
      where: { calibration_id: calibrationId },
      relations: ['edited_by'],
      order: { edited_at: 'DESC' },
    });
  }

  async remove(id: string): Promise<void> {
    const calibration = await this.findOne(id);
    if (calibration) {
      const instrumentId = calibration.instrument?.id;
      await this.auditLogRepository.delete({ calibration_id: id });
      await this.calibrationRepository.remove(calibration);

      if (instrumentId) {
        const latestCal = await this.calibrationRepository.findOne({
          where: { instrument: { id: instrumentId } },
          order: { calibration_date: 'DESC' },
        });

        if (latestCal) {
          await this.instrumentsService.update(instrumentId, {
            last_calibration_date: latestCal.calibration_date ? new Date(latestCal.calibration_date).toISOString() : undefined,
            due_date: latestCal.next_calibration_date ? new Date(latestCal.next_calibration_date).toISOString() : undefined,
          } as any);
        }
      }
    }
  }
}
