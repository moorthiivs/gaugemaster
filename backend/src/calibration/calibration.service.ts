import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, DataSource } from 'typeorm';
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
import { CalibrationTemplate } from '../calibration-templates/entities/calibration-template.entity';
import { recalculateCalibrationLayoutBlocks } from './utils/formula-engine.util';

@Injectable()
export class CalibrationService implements OnModuleInit {
  private readonly logger = new Logger(CalibrationService.name);

  async onModuleInit() {
    await this.syncInFlightCalibrationInstruments();
  }

  /**
   * One-time / startup synchronization for any in-flight calibrations
   * (e.g. 'Calibration Completed', 'Pending Review', 'Reviewed', 'Pending Approval').
   * Ensures the instrument status is 'Under Calibration', dates are updated if newer,
   * and the hover sub-status is set to 'Review Pending' or 'Approve Pending'.
   */
  async syncInFlightCalibrationInstruments() {
    try {
      this.logger.log('🔄 Checking and syncing in-flight calibration instruments...');
      const inFlightCals = await this.calibrationRepository.find({
        where: [
          { approval_status: 'Calibration Completed' },
          { approval_status: 'Pending Review' },
          { approval_status: 'Reviewed' },
          { approval_status: 'Pending Approval' },
        ],
        order: { created_at: 'DESC' },
        relations: ['instrument'],
      });

      const processedInstrumentIds = new Set<string>();

      for (const cal of inFlightCals) {
        if (!cal.instrument_id || processedInstrumentIds.has(cal.instrument_id)) continue;
        processedInstrumentIds.add(cal.instrument_id);

        const inst = cal.instrument || (await this.instrumentsService.findOne(cal.instrument_id));
        if (!inst) continue;

        const isReviewed = cal.approval_status === 'Reviewed' || cal.approval_status === 'Pending Approval';
        const subStatus = isReviewed ? 'Approve Pending' : 'Review Pending';
        const existingCp = (inst as any)?.custom_parameters || {};

        const existingLastCal = inst.last_calibration_date ? new Date(inst.last_calibration_date) : null;
        const newCalDate = cal.calibration_date ? new Date(cal.calibration_date) : null;

        const isSameCalendarDay = (d1: Date | null, d2: Date | null) => {
          if (!d1 || !d2) return false;
          return (
            d1.getUTCFullYear() === d2.getUTCFullYear() &&
            d1.getUTCMonth() === d2.getUTCMonth() &&
            d1.getUTCDate() === d2.getUTCDate()
          );
        };

        let shouldUpdateDates = true;
        if (existingLastCal && newCalDate) {
          if (isSameCalendarDay(existingLastCal, newCalDate) || newCalDate < existingLastCal) {
            shouldUpdateDates = false;
          }
        }

        const updatePayload: Record<string, any> = {
          status: 'Under Calibration',
          custom_parameters: {
            ...existingCp,
            calibration_sub_status: subStatus,
          },
        };

        if (shouldUpdateDates && newCalDate) {
          let finalDueDate = cal.next_calibration_date;
          if (!finalDueDate && inst.frequency) {
            finalDueDate = this.instrumentsService.calculateDueDateFromFrequency(
              newCalDate,
              inst.frequency,
            );
          }
          updatePayload.last_calibration_date = newCalDate;
          if (finalDueDate) {
            updatePayload.due_date = finalDueDate;
          }
        }

        await this.instrumentsService.update(inst.id, updatePayload as any);
        this.logger.log(`✅ Synced instrument ${inst.name} (${inst.id_code}) to 'Under Calibration' [${subStatus}]`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to sync in-flight instruments: ${err?.message || err}`);
    }
  }

  constructor(
    @InjectRepository(Calibration)
    private readonly calibrationRepository: Repository<Calibration>,
    @InjectRepository(CalibrationDraft)
    private readonly draftRepository: Repository<CalibrationDraft>,
    @InjectRepository(CalibrationAuditLog)
    private readonly auditLogRepository: Repository<CalibrationAuditLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CalibrationTemplate)
    private readonly templateRepository: Repository<CalibrationTemplate>,
    private readonly settingsService: SettingsService,
    private readonly instrumentsService: InstrumentsService,
    private readonly dataSource: DataSource,
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

  /**
   * Calculates the active period key and date range for a given reset frequency.
   */
  getPeriodInfo(
    frequency: 'never' | 'monthly' | 'yearly' | 'financial_year' | 'custom' = 'never',
    customMonths: number = 1,
    refDate: Date = new Date(),
  ): { periodKey: string; dateFrom?: Date; dateTo?: Date } {
    const d = new Date(refDate);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed: 0 = Jan, 11 = Dec

    if (frequency === 'monthly') {
      const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const dateFrom = new Date(year, month, 1, 0, 0, 0, 0);
      const dateTo = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { periodKey, dateFrom, dateTo };
    }

    if (frequency === 'yearly') {
      const periodKey = `${year}`;
      const dateFrom = new Date(year, 0, 1, 0, 0, 0, 0);
      const dateTo = new Date(year, 11, 31, 23, 59, 59, 999);
      return { periodKey, dateFrom, dateTo };
    }

    if (frequency === 'financial_year') {
      let fyStartYear: number;
      let fyEndYear: number;
      if (month >= 3) {
        // April to December
        fyStartYear = year;
        fyEndYear = year + 1;
      } else {
        // January to March
        fyStartYear = year - 1;
        fyEndYear = year;
      }
      const periodKey = `FY${fyStartYear}-${fyEndYear}`;
      const dateFrom = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
      const dateTo = new Date(fyEndYear, 2, 31, 23, 59, 59, 999);
      return { periodKey, dateFrom, dateTo };
    }

    if (frequency === 'custom') {
      const interval = Math.max(1, Number(customMonths) || 1);
      let dateFrom: Date;
      let dateTo: Date;
      let periodKey: string;

      if (interval <= 12) {
        const periodIndex = Math.floor(month / interval);
        const startMonth = periodIndex * interval;
        dateFrom = new Date(year, startMonth, 1, 0, 0, 0, 0);
        dateTo = new Date(year, startMonth + interval, 0, 23, 59, 59, 999);
        periodKey = `${year}-C${interval}M-P${periodIndex + 1}`;
      } else {
        const baseYear = 2026;
        const totalMonthsFromBase = (year - baseYear) * 12 + month;
        const periodIndex = Math.floor(totalMonthsFromBase / interval);
        const startTotalMonths = periodIndex * interval;

        dateFrom = new Date(baseYear, startTotalMonths, 1, 0, 0, 0, 0);
        dateTo = new Date(baseYear, startTotalMonths + interval, 0, 23, 59, 59, 999);

        const sY = dateFrom.getFullYear();
        const sM = String(dateFrom.getMonth() + 1).padStart(2, '0');
        const eY = dateTo.getFullYear();
        const eM = String(dateTo.getMonth() + 1).padStart(2, '0');
        periodKey = `C${interval}M-${sY}${sM}-${eY}${eM}`;
      }
      return { periodKey, dateFrom, dateTo };
    }

    return { periodKey: 'all', dateFrom: undefined, dateTo: undefined };
  }

  private async getMaxCertSequence(
    companyId: string,
    userId: string,
    dateFrom?: Date,
    dateTo?: Date,
    prefix?: string,
    separator?: string,
  ): Promise<number> {
    const userIds = await this.getCompanyUserIds(userId, companyId);
    if (!userIds || userIds.length === 0) return 0;

    const qb = this.calibrationRepository
      .createQueryBuilder('cal')
      .leftJoin('cal.created_by', 'user')
      .where('user.id IN (:...userIds)', { userIds })
      .andWhere('cal.certificate_number IS NOT NULL');

    if (dateFrom && dateTo) {
      qb.andWhere(
        '((cal.calibration_date BETWEEN :dateFrom AND :dateTo) OR (cal.created_at BETWEEN :dateFrom AND :dateTo))',
        { dateFrom, dateTo },
      );
    }

    const calibrations = await qb.select(['cal.certificate_number']).getMany();

    const sep = separator || this.DEFAULT_CERT_SEPARATOR;
    let maxSeq = 0;
    for (const cal of calibrations) {
      if (cal.certificate_number) {
        if (prefix && !cal.certificate_number.startsWith(prefix)) {
          continue;
        }
        const parts = cal.certificate_number.split(sep);
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
    return maxSeq;
  }

  private async getMaxUlrSequence(
    companyId: string,
    userId: string,
    dateFrom?: Date,
    dateTo?: Date,
    prefix?: string,
    separator?: string,
  ): Promise<number> {
    const userIds = await this.getCompanyUserIds(userId, companyId);
    if (!userIds || userIds.length === 0) return 0;

    const qb = this.calibrationRepository
      .createQueryBuilder('cal')
      .leftJoin('cal.created_by', 'user')
      .where('user.id IN (:...userIds)', { userIds })
      .andWhere('cal.ulr_number IS NOT NULL');

    if (dateFrom && dateTo) {
      qb.andWhere(
        '((cal.calibration_date BETWEEN :dateFrom AND :dateTo) OR (cal.created_at BETWEEN :dateFrom AND :dateTo))',
        { dateFrom, dateTo },
      );
    }

    const calibrations = await qb.select(['cal.ulr_number']).getMany();

    const sep = separator || this.DEFAULT_ULR_SEPARATOR;
    let maxSeq = 0;
    for (const cal of calibrations) {
      if (cal.ulr_number) {
        if (prefix && !cal.ulr_number.startsWith(prefix)) {
          continue;
        }
        const parts = cal.ulr_number.split(sep);
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
   * Increments the sequence counter atomically with PostgreSQL advisory locks.
   */
  async generateCertificateNumber(
    userId: string,
    companyId: string,
  ): Promise<string> {
    if (companyId) {
      try {
        await this.calibrationRepository.query(
          `SELECT pg_advisory_lock(hashtext('company_cert_' || $1))`,
          [companyId],
        );
        return await this.computeNextCertificateNumber(userId, companyId);
      } finally {
        try {
          await this.calibrationRepository.query(
            `SELECT pg_advisory_unlock(hashtext('company_cert_' || $1))`,
            [companyId],
          );
        } catch {}
      }
    }
    return this.computeNextCertificateNumber(userId, companyId);
  }

  private async computeNextCertificateNumber(
    userId: string,
    companyId: string,
  ): Promise<string> {
    const settings = await this.settingsService.findOne(userId, companyId);
    const config = settings?.certificateConfig;

    const prefix = config?.certPrefix || this.DEFAULT_CERT_PREFIX;
    const sep = config?.certSeparator || this.DEFAULT_CERT_SEPARATOR;
    const yearFmt = config?.certYearFormat || this.DEFAULT_CERT_YEAR_FORMAT;
    const seqLen = config?.certSeqLength || this.DEFAULT_CERT_SEQ_LENGTH;

    const resetFreq = config?.certResetFrequency || 'never';
    const period = this.getPeriodInfo(resetFreq, config?.certCustomResetMonths, new Date());

    let configSeq = config?.certNextSeq ?? 0;
    let lastResetPeriod = config?.certLastResetPeriod;

    // Check if frequency requires a reset due to new period
    if (resetFreq !== 'never' && lastResetPeriod !== period.periodKey) {
      configSeq = config?.certStartSeq ?? 0;
      lastResetPeriod = period.periodKey;
    }

    const dbMaxSeq = await this.getMaxCertSequence(
      companyId,
      userId,
      period.dateFrom,
      period.dateTo,
      prefix,
      sep,
    );
    const nextSeq = Math.max(configSeq, dbMaxSeq) + 1;

    const year = this.formatYear(yearFmt);
    const seq = String(nextSeq).padStart(seqLen, '0');
    const certNumber = `${prefix}${sep}${year}${sep}${seq}`;

    // Persist the incremented sequence and active period identifier
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
        certResetFrequency: resetFreq,
        certCustomResetMonths: config?.certCustomResetMonths,
        certStartSeq: config?.certStartSeq ?? 0,
        certLastResetPeriod: lastResetPeriod,
        ulrPrefix: config?.ulrPrefix || this.DEFAULT_ULR_PREFIX,
        ulrSeparator: config?.ulrSeparator || this.DEFAULT_ULR_SEPARATOR,
        ulrYearFormat: config?.ulrYearFormat || this.DEFAULT_ULR_YEAR_FORMAT,
        ulrSeqLength: config?.ulrSeqLength || this.DEFAULT_ULR_SEQ_LENGTH,
        ulrNextSeq: config?.ulrNextSeq || 0,
        ulrResetFrequency: config?.ulrResetFrequency || 'never',
        ulrCustomResetMonths: config?.ulrCustomResetMonths,
        ulrStartSeq: config?.ulrStartSeq ?? 0,
        ulrLastResetPeriod: config?.ulrLastResetPeriod,
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
    if (companyId) {
      try {
        await this.calibrationRepository.query(
          `SELECT pg_advisory_lock(hashtext('company_ulr_' || $1))`,
          [companyId],
        );
        return await this.computeNextUlrNumber(userId, companyId);
      } finally {
        try {
          await this.calibrationRepository.query(
            `SELECT pg_advisory_unlock(hashtext('company_ulr_' || $1))`,
            [companyId],
          );
        } catch {}
      }
    }
    return this.computeNextUlrNumber(userId, companyId);
  }

  private async computeNextUlrNumber(
    userId: string,
    companyId: string,
  ): Promise<string> {
    const settings = await this.settingsService.findOne(userId, companyId);
    const config = settings?.certificateConfig;

    const prefix = config?.ulrPrefix || this.DEFAULT_ULR_PREFIX;
    const sep = config?.ulrSeparator || this.DEFAULT_ULR_SEPARATOR;
    const yearFmt = config?.ulrYearFormat || this.DEFAULT_ULR_YEAR_FORMAT;
    const seqLen = config?.ulrSeqLength || this.DEFAULT_ULR_SEQ_LENGTH;

    const resetFreq = config?.ulrResetFrequency || 'never';
    const period = this.getPeriodInfo(resetFreq, config?.ulrCustomResetMonths, new Date());

    let configSeq = config?.ulrNextSeq ?? 0;
    let lastResetPeriod = config?.ulrLastResetPeriod;

    if (resetFreq !== 'never' && lastResetPeriod !== period.periodKey) {
      configSeq = config?.ulrStartSeq ?? 0;
      lastResetPeriod = period.periodKey;
    }

    const dbMaxSeq = await this.getMaxUlrSequence(
      companyId,
      userId,
      period.dateFrom,
      period.dateTo,
      prefix,
      sep,
    );
    const nextSeq = Math.max(configSeq, dbMaxSeq) + 1;

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
        certResetFrequency: config?.certResetFrequency || 'never',
        certCustomResetMonths: config?.certCustomResetMonths,
        certStartSeq: config?.certStartSeq ?? 0,
        certLastResetPeriod: config?.certLastResetPeriod,
        ulrPrefix: prefix,
        ulrSeparator: sep,
        ulrYearFormat: yearFmt,
        ulrSeqLength: seqLen,
        ulrNextSeq: nextSeq,
        ulrResetFrequency: resetFreq,
        ulrCustomResetMonths: config?.ulrCustomResetMonths,
        ulrStartSeq: config?.ulrStartSeq ?? 0,
        ulrLastResetPeriod: lastResetPeriod,
      },
    });

    return ulrNumber;
  }

  /**
   * Preview what the next certificate and ULR numbers will look like
   * without incrementing, accounting for active reset periods.
   */
  async getNextNumbers(
    userId: string,
    companyId: string,
  ): Promise<{
    nextCertNumber: string;
    nextUlrNumber: string;
    currentCertPeriod?: string;
    currentUlrPeriod?: string;
  }> {
    const settings = await this.settingsService.findOne(userId, companyId);
    const config = settings?.certificateConfig;

    // Certificate
    const certResetFreq = config?.certResetFrequency || 'never';
    const certPeriod = this.getPeriodInfo(certResetFreq, config?.certCustomResetMonths, new Date());
    let certConfigSeq = config?.certNextSeq ?? 0;
    if (certResetFreq !== 'never' && config?.certLastResetPeriod !== certPeriod.periodKey) {
      certConfigSeq = config?.certStartSeq ?? 0;
    }

    const certPrefix = config?.certPrefix || this.DEFAULT_CERT_PREFIX;
    const certSep = config?.certSeparator || this.DEFAULT_CERT_SEPARATOR;
    const certYearFmt = config?.certYearFormat || this.DEFAULT_CERT_YEAR_FORMAT;
    const certSeqLen = config?.certSeqLength || this.DEFAULT_CERT_SEQ_LENGTH;
    const dbMaxCertSeq = await this.getMaxCertSequence(
      companyId,
      userId,
      certPeriod.dateFrom,
      certPeriod.dateTo,
      certPrefix,
      certSep,
    );
    const certNextSeq = Math.max(certConfigSeq, dbMaxCertSeq) + 1;
    const certYear = this.formatYear(certYearFmt);
    const nextCertNumber = `${certPrefix}${certSep}${certYear}${certSep}${String(certNextSeq).padStart(certSeqLen, '0')}`;

    // ULR
    const ulrResetFreq = config?.ulrResetFrequency || 'never';
    const ulrPeriod = this.getPeriodInfo(ulrResetFreq, config?.ulrCustomResetMonths, new Date());
    let ulrConfigSeq = config?.ulrNextSeq ?? 0;
    if (ulrResetFreq !== 'never' && config?.ulrLastResetPeriod !== ulrPeriod.periodKey) {
      ulrConfigSeq = config?.ulrStartSeq ?? 0;
    }

    const ulrPrefix = config?.ulrPrefix || this.DEFAULT_ULR_PREFIX;
    const ulrSep = config?.ulrSeparator || this.DEFAULT_ULR_SEPARATOR;
    const ulrYearFmt = config?.ulrYearFormat || this.DEFAULT_ULR_YEAR_FORMAT;
    const ulrSeqLen = config?.ulrSeqLength || this.DEFAULT_ULR_SEQ_LENGTH;
    const dbMaxUlrSeq = await this.getMaxUlrSequence(
      companyId,
      userId,
      ulrPeriod.dateFrom,
      ulrPeriod.dateTo,
      ulrPrefix,
      ulrSep,
    );
    const ulrNextSeq = Math.max(ulrConfigSeq, dbMaxUlrSeq) + 1;
    const ulrYear = this.formatYear(ulrYearFmt);
    const nextUlrNumber = `${ulrPrefix}${ulrSep}${ulrYear}${ulrSep}${String(ulrNextSeq).padStart(ulrSeqLen, '0')}`;

    return {
      nextCertNumber,
      nextUlrNumber,
      currentCertPeriod: certPeriod.periodKey,
      currentUlrPeriod: ulrPeriod.periodKey,
    };
  }

  /**
   * Phase 3: Freezes template metadata snapshot onto the Calibration entity.
   * Ensures approved/historical calibrations and generated certificates are immune
   * to future template mutations, renames, or deletions.
   */
  async freezeTemplateMetadata(calibration: Calibration, templateId?: string): Promise<void> {
    const tplId = templateId || calibration.template_id;
    if (!tplId || tplId === 'none') {
      return;
    }

    try {
      let tpl: CalibrationTemplate | null = null;
      if (this.templateRepository) {
        tpl = await this.templateRepository.findOne({ where: { id: tplId } });
      } else if (this.dataSource) {
        tpl = await this.dataSource.getRepository(CalibrationTemplate).findOne({ where: { id: tplId } });
      }

      if (!tpl) return;

      if (!calibration.template_name && tpl.name) {
        calibration.template_name = tpl.name;
      }
      if (!calibration.doc_no && tpl.doc_no) calibration.doc_no = tpl.doc_no;
      if (!calibration.doc_date && tpl.doc_date) calibration.doc_date = tpl.doc_date;
      if (!calibration.doc_rev && tpl.doc_rev) calibration.doc_rev = tpl.doc_rev;

      if (!calibration.procedure_reference && (tpl.procedure_reference || tpl.procedure_no)) {
        calibration.procedure_reference = tpl.procedure_reference || tpl.procedure_no;
      }
      if (!calibration.procedure_no && tpl.procedure_no) calibration.procedure_no = tpl.procedure_no;
      if (!calibration.procedure_name && tpl.procedure_name) calibration.procedure_name = tpl.procedure_name;
      if (!calibration.procedure_date && tpl.procedure_date) calibration.procedure_date = tpl.procedure_date;
      if (!calibration.procedure_rev && tpl.procedure_rev) calibration.procedure_rev = tpl.procedure_rev;

      if (!calibration.acceptance_criteria_doc_no && tpl.acceptance_criteria_doc_no) {
        calibration.acceptance_criteria_doc_no = tpl.acceptance_criteria_doc_no;
      }
      if (!calibration.acceptance_criteria_date && tpl.acceptance_criteria_date) {
        calibration.acceptance_criteria_date = tpl.acceptance_criteria_date;
      }
      if (!calibration.acceptance_criteria_rev && tpl.acceptance_criteria_rev) {
        calibration.acceptance_criteria_rev = tpl.acceptance_criteria_rev;
      }
      if (!calibration.acceptance_criteria_reference && tpl.acceptance_criteria_reference) {
        calibration.acceptance_criteria_reference = tpl.acceptance_criteria_reference;
      }
      if (!calibration.acceptance_criteria && tpl.acceptance_criteria) {
        calibration.acceptance_criteria = tpl.acceptance_criteria;
      }

      if (!calibration.standard_reference && tpl.standard_reference) {
        calibration.standard_reference = tpl.standard_reference;
      }

      if (calibration.diagram_image === undefined || calibration.diagram_image === null || calibration.diagram_image === '') {
        if (tpl.diagram_image) {
          calibration.diagram_image = tpl.diagram_image;
          calibration.diagram_image_width = tpl.diagram_image_width;
          calibration.diagram_image_height = tpl.diagram_image_height;
          calibration.diagram_image_alignment = tpl.diagram_image_alignment;
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to freeze template metadata for template ${tplId}:`, err);
    }
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

    let computedNextCalDate = dto.next_calibration_date
      ? new Date(dto.next_calibration_date)
      : undefined;

    if (!computedNextCalDate && dto.instrument_id && dto.calibration_date) {
      try {
        const inst = await this.instrumentsService.findOne(dto.instrument_id);
        if (inst) {
          computedNextCalDate = this.instrumentsService.calculateDueDateFromFrequency(
            new Date(dto.calibration_date),
            inst.frequency,
          );
        }
      } catch (err) {
        console.warn(`Could not compute next_calibration_date for instrument ${dto.instrument_id}:`, err);
      }
    }

    return await this.dataSource.transaction(async (manager) => {
      // Auto-resolve signatures if missing or not data:image
      let resolvedCalibratedSig = dto.calibrated_by_signature;
      if (
        (!resolvedCalibratedSig || !resolvedCalibratedSig.startsWith('data:image')) &&
        (dto.calibrated_by || dto.created_by)
      ) {
        try {
          const u = await this.userRepository.findOne({
            where: [
              ...(dto.calibrated_by ? [{ name: dto.calibrated_by }, { id: dto.calibrated_by }] : []),
              ...(dto.created_by ? [{ id: dto.created_by }] : []),
            ],
          });
          if (u?.signature && u.signature.startsWith('data:image')) {
            resolvedCalibratedSig = u.signature;
          }
        } catch (e) {}
      }

      let resolvedReviewedSig = dto.reviewed_by_signature;
      if (
        (!resolvedReviewedSig || !resolvedReviewedSig.startsWith('data:image')) &&
        (dto.reviewed_by || (dto as any).reviewed_by_id)
      ) {
        try {
          const u = await this.userRepository.findOne({
            where: [
              ...((dto as any).reviewed_by_id ? [{ id: (dto as any).reviewed_by_id }] : []),
              ...(dto.reviewed_by ? [{ name: dto.reviewed_by }] : []),
            ],
          });
          if (u?.signature && u.signature.startsWith('data:image')) {
            resolvedReviewedSig = u.signature;
          }
        } catch (e) {}
      }

      let resolvedApprovedSig = approval_status === 'Approved' ? dto.approved_by_signature : null;
      if (
        approval_status === 'Approved' &&
        (!resolvedApprovedSig || !resolvedApprovedSig.startsWith('data:image')) &&
        (dto.approved_by || (dto as any).approved_by_id)
      ) {
        try {
          const u = await this.userRepository.findOne({
            where: [
              ...((dto as any).approved_by_id ? [{ id: (dto as any).approved_by_id }] : []),
              ...(dto.approved_by ? [{ name: dto.approved_by }] : []),
            ],
          });
          if (u?.signature && u.signature.startsWith('data:image')) {
            resolvedApprovedSig = u.signature;
          }
        } catch (e) {}
      }

      // Authoritative Server-side Formula Recalculation & Verdict Gate (Phase 7)
      let calculatedVerdict = dto.calculated_verdict;
      let effectiveLayoutBlocks = dto.layout_blocks;
      if (dto.layout_blocks && Array.isArray(dto.layout_blocks)) {
        try {
          const recalcResult = recalculateCalibrationLayoutBlocks(dto.layout_blocks);
          effectiveLayoutBlocks = recalcResult.layoutBlocks;
          calculatedVerdict = recalcResult.overallVerdict;
        } catch (e) {
          this.logger.warn(`Could not recalculate layout blocks on create: ${e}`);
        }
      }

      // Check for explicit manual verdict override (Phase 6)
      const isOverridden =
        dto.is_verdict_overridden === true ||
        dto.standard_columns_config?.is_verdict_manually_overridden === true;
      const overrideReason =
        dto.verdict_override_reason ||
        dto.standard_columns_config?.verdict_override_reason ||
        undefined;
      const finalVerdict = isOverridden
        ? (dto.verdict || 'PASS')
        : (calculatedVerdict || dto.verdict || 'PASS');

      const calibration = manager.create(Calibration, {
        ...dto,
        layout_blocks: effectiveLayoutBlocks,
        verdict: finalVerdict,
        calculated_verdict: calculatedVerdict,
        is_verdict_overridden: isOverridden,
        verdict_override_reason: overrideReason,
        template_version_id: dto.template_version_id,
        certificate_number,
        ulr_number,
        approval_status,
        calibrated_by_signature: resolvedCalibratedSig || dto.calibrated_by_signature,
        reviewed_by_signature: resolvedReviewedSig || dto.reviewed_by_signature,
        approved_by: approval_status === 'Approved' ? dto.approved_by : undefined,
        approved_by_designation: approval_status === 'Approved' ? dto.approved_by_designation : undefined,
        approved_by_signature: approval_status === 'Approved' ? (resolvedApprovedSig || dto.approved_by_signature) : undefined,
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
        next_calibration_date: computedNextCalDate,
        created_by: dto.created_by ? ({ id: dto.created_by } as any) : undefined,
      });

      await this.freezeTemplateMetadata(calibration);

      const savedCalibration = await manager.save(Calibration, calibration);

      // Update Instrument Master schedule, status, and item-level custom parameters
      if (dto.instrument_id) {
        try {
          const inst = await this.instrumentsService.findOne(dto.instrument_id);
          const existingCp = (inst as any)?.custom_parameters || {};
          const updatedCp: Record<string, any> = { ...existingCp };

          if (dto.diagram_image !== undefined) {
            updatedCp.diagram_image = dto.diagram_image ? dto.diagram_image : null;
          }
          if (dto.diagram_image_width !== undefined) updatedCp.diagram_image_width = dto.diagram_image_width;
          if (dto.diagram_image_height !== undefined) updatedCp.diagram_image_height = dto.diagram_image_height;
          if (dto.diagram_image_alignment !== undefined) updatedCp.diagram_image_alignment = dto.diagram_image_alignment;

          updatedCp.doc_properties = {
            ...(existingCp.doc_properties || {}),
            ...(dto.doc_no !== undefined ? { doc_no: dto.doc_no } : {}),
            ...(dto.doc_date !== undefined ? { doc_date: dto.doc_date } : {}),
            ...(dto.doc_rev !== undefined ? { doc_rev: dto.doc_rev } : {}),
            ...((dto as any).procedure_no !== undefined ? { procedure_no: (dto as any).procedure_no } : {}),
            ...((dto as any).procedure_name !== undefined ? { procedure_name: (dto as any).procedure_name } : {}),
            ...((dto as any).procedure_date !== undefined ? { procedure_date: (dto as any).procedure_date } : {}),
            ...((dto as any).procedure_rev !== undefined ? { procedure_rev: (dto as any).procedure_rev } : {}),
            ...(dto.procedure_reference !== undefined ? { procedure_reference: dto.procedure_reference } : {}),
            ...((dto as any).acceptance_criteria_doc_no !== undefined ? { acceptance_criteria_doc_no: (dto as any).acceptance_criteria_doc_no } : {}),
            ...((dto as any).acceptance_criteria_date !== undefined ? { acceptance_criteria_date: (dto as any).acceptance_criteria_date } : {}),
            ...((dto as any).acceptance_criteria_rev !== undefined ? { acceptance_criteria_rev: (dto as any).acceptance_criteria_rev } : {}),
            ...((dto as any).acceptance_criteria_reference !== undefined ? { acceptance_criteria_reference: (dto as any).acceptance_criteria_reference } : {}),
          };

          if (dto.environmental_conditions) {
            updatedCp.environmental_defaults = {
              ...(existingCp.environmental_defaults || {}),
              ...dto.environmental_conditions,
            };
          }
          if (dto.receipt_condition) {
            updatedCp.receipt_condition = dto.receipt_condition;
          }

          if (approval_status === 'Approved') {
            const cleanCp = { ...updatedCp };
            delete cleanCp.calibration_sub_status;

            await this.instrumentsService.update(dto.instrument_id, {
              last_calibration_date: savedCalibration.calibration_date as any,
              due_date: (savedCalibration.next_calibration_date || computedNextCalDate) as any,
              status: savedCalibration.verdict === 'FAIL' ? 'REJECTED' : 'OK',
              calibration_source: 'In-House',
              cert_no: savedCalibration.certificate_number,
              custom_parameters: cleanCp,
            } as any);
          } else {
            // Calibration completed (Step 1) awaiting review/approval:
            // 1. Mark instrument as 'Under Calibration' with sub-status 'Review Pending'
            updatedCp.calibration_sub_status = 'Review Pending';

            // 2. Validate calibration date vs existing last_calibration_date:
            // If existing last_calibration_date is same calendar day (or newer), skip date update;
            // Otherwise update to latest calibration date and compute new due date based on frequency.
            const existingLastCal = inst.last_calibration_date ? new Date(inst.last_calibration_date) : null;
            const newCalDate = savedCalibration.calibration_date ? new Date(savedCalibration.calibration_date) : null;

            const isSameCalendarDay = (d1: Date | null, d2: Date | null) => {
              if (!d1 || !d2) return false;
              return (
                d1.getUTCFullYear() === d2.getUTCFullYear() &&
                d1.getUTCMonth() === d2.getUTCMonth() &&
                d1.getUTCDate() === d2.getUTCDate()
              );
            };

            let shouldUpdateDates = true;
            if (existingLastCal && newCalDate) {
              if (isSameCalendarDay(existingLastCal, newCalDate)) {
                shouldUpdateDates = false; // same date -> skip
              } else if (newCalDate < existingLastCal) {
                shouldUpdateDates = false; // older date -> skip
              }
            }

            const instUpdatePayload: Record<string, any> = {
              status: 'Under Calibration',
              calibration_source: 'In-House',
              custom_parameters: updatedCp,
            };

            if (shouldUpdateDates && newCalDate) {
              let finalDueDate = savedCalibration.next_calibration_date || computedNextCalDate;
              if (!finalDueDate && inst.frequency) {
                finalDueDate = this.instrumentsService.calculateDueDateFromFrequency(
                  newCalDate,
                  inst.frequency,
                );
              }
              instUpdatePayload.last_calibration_date = newCalDate;
              if (finalDueDate) {
                instUpdatePayload.due_date = finalDueDate;
              }
            }

            await this.instrumentsService.update(dto.instrument_id, instUpdatePayload as any);
          }
        } catch (err) {
          console.warn(`Failed to update instrument ${dto.instrument_id} after calibration`, err);
        }
      }

      // If this calibration is a recalibration/rework of a rejected record, record audit log on the original
      if (dto.recalibration_of_id) {
        try {
          const rejectedOrig = await manager.findOne(Calibration, {
            where: { id: dto.recalibration_of_id },
          });
          if (rejectedOrig) {
            const reauditLog = manager.create(CalibrationAuditLog, {
              calibration_id: rejectedOrig.id,
              edited_by_id: userId,
              edited_by_name: savedCalibration.calibrated_by || 'Calibration Engineer',
              changes_summary: [
                {
                  field: 'recalibration',
                  oldValue: 'Rejected',
                  newValue: `Recalibrated as Cert: ${savedCalibration.certificate_number} (ID: ${savedCalibration.id})`,
                },
              ],
              remarks: `Recalibration / Rework completed under Certificate ${savedCalibration.certificate_number}`,
            });
            await manager.save(CalibrationAuditLog, reauditLog);
          }
        } catch (err) {
          console.warn(`Failed to link recalibration audit log on original ${dto.recalibration_of_id}`, err);
        }
      }

      // Auto-purge any unfinished drafts for this instrument upon successful calibration creation
      if (dto.instrument_id) {
        try {
          await this.deleteDraftsByInstrument(userId, dto.instrument_id);
        } catch (err) {
          console.warn(`Failed to clean up draft for instrument ${dto.instrument_id}`, err);
        }
      }

      return savedCalibration;
    });
  }

  async review(
    id: string,
    reviewer: { id: string; name: string; designation?: string },
    signature?: string,
    remarks?: string,
  ): Promise<Calibration> {
    const calibration = await this.findOne(id);
    if (!calibration) throw new NotFoundException('Calibration record not found');

    const oldStatus = calibration.approval_status;
    calibration.approval_status = 'Reviewed';
    calibration.reviewed_by = reviewer.name;
    calibration.reviewed_by_id = reviewer.id;
    let finalSignature = signature;
    if ((!finalSignature || !finalSignature.startsWith('data:image')) && (reviewer.id || reviewer.name)) {
      try {
        const u = await this.userRepository.findOne({
          where: [
            ...(reviewer.id ? [{ id: reviewer.id }] : []),
            ...(reviewer.name ? [{ name: reviewer.name }] : []),
          ],
        });
        if (u?.signature && u.signature.startsWith('data:image')) {
          finalSignature = u.signature;
        }
      } catch (e) {}
    }
    if (finalSignature) {
      calibration.reviewed_by_signature = finalSignature;
    }
    calibration.reviewed_at = new Date();
    calibration.reviewer_remarks = remarks || undefined;

    const saved = await this.calibrationRepository.save(calibration);

    // Update instrument sub-status to 'Approve Pending' while keeping status as 'Under Calibration'
    if (saved.instrument_id) {
      try {
        const inst = await this.instrumentsService.findOne(saved.instrument_id);
        if (inst) {
          const cp = (inst as any)?.custom_parameters || {};
          await this.instrumentsService.update(inst.id, {
            status: 'Under Calibration',
            calibration_source: 'In-House',
            custom_parameters: {
              ...cp,
              calibration_sub_status: 'Approve Pending',
            },
          } as any);
        }
      } catch (err) {
        console.warn(`Failed to update instrument sub-status on review for ${saved.instrument_id}`, err);
      }
    }

    // Record audit log entry
    const auditLog = this.auditLogRepository.create({
      calibration_id: saved.id,
      edited_by_id: reviewer.id,
      edited_by_name: reviewer.name,
      changes_summary: [{ field: 'approval_status', oldValue: oldStatus, newValue: 'Reviewed' }],
      remarks: remarks ? `Calibration Reviewed & Recommended: ${remarks}` : 'Calibration Record Reviewed and Recommended for Approval',
    });
    await this.auditLogRepository.save(auditLog);

    return saved;
  }

  async approve(
    id: string,
    approver: { id: string; name: string; designation?: string },
    signature?: string,
    remarks?: string,
  ): Promise<Calibration> {
    const calibration = await this.findOne(id);
    if (!calibration) throw new NotFoundException('Calibration record not found');

    const oldStatus = calibration.approval_status;
    calibration.approval_status = 'Approved';
    calibration.approved_by = approver.name;
    calibration.approved_by_id = approver.id;
    let finalSignature = signature;
    if ((!finalSignature || !finalSignature.startsWith('data:image')) && (approver.id || approver.name)) {
      try {
        const u = await this.userRepository.findOne({
          where: [
            ...(approver.id ? [{ id: approver.id }] : []),
            ...(approver.name ? [{ name: approver.name }] : []),
          ],
        });
        if (u?.signature && u.signature.startsWith('data:image')) {
          finalSignature = u.signature;
        }
      } catch (e) {}
    }
    if (finalSignature) {
      calibration.approved_by_signature = finalSignature;
    }
    calibration.approved_at = new Date();
    calibration.approver_remarks = remarks || undefined;
    calibration.certificate_generated = true;

    await this.freezeTemplateMetadata(calibration);

    const saved = await this.calibrationRepository.save(calibration);

    // Update Instrument Master schedule now that it is Approved
    if (calibration.instrument_id) {
      try {
        const inst = await this.instrumentsService.findOne(calibration.instrument_id);
        const cp = { ...((inst as any)?.custom_parameters || {}) };
        delete cp.calibration_sub_status; // clear sub-status since all verification is completed

        let finalDueDate = saved.next_calibration_date;
        if (!finalDueDate && saved.calibration_date) {
          if (inst) {
            finalDueDate = this.instrumentsService.calculateDueDateFromFrequency(
              saved.calibration_date,
              inst.frequency,
            );
          }
        }
        await this.instrumentsService.update(calibration.instrument_id, {
          last_calibration_date: saved.calibration_date as any,
          due_date: finalDueDate as any,
          status: saved.verdict === 'FAIL' ? 'REJECTED' : 'OK',
          calibration_source: 'In-House',
          cert_no: saved.certificate_number,
          certificate_file: saved.certificate_file || undefined,
          custom_parameters: cp,
        } as any);
      } catch (err) {
        console.warn(`Failed to update instrument ${calibration.instrument_id} on approval`, err);
      }
    }

    // Record audit log entry
    const auditLog = this.auditLogRepository.create({
      calibration_id: saved.id,
      edited_by_id: approver.id,
      edited_by_name: approver.name,
      changes_summary: [{ field: 'approval_status', oldValue: oldStatus, newValue: 'Approved' }],
      remarks: remarks ? `Calibration Final Approved: ${remarks}` : 'Calibration Record Final Approved by Approver',
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

    // Rollback or update instrument status upon rejection:
    if (saved.instrument_id) {
      try {
        const inst = await this.instrumentsService.findOne(saved.instrument_id);
        if (inst) {
          const otherCals = await this.calibrationRepository.find({
            where: { instrument_id: saved.instrument_id },
            order: { calibration_date: 'DESC' },
          });
          const approvedCals = otherCals.filter(
            (c) => c.id !== saved.id && c.approval_status === 'Approved',
          );

          const cp = { ...((inst as any)?.custom_parameters || {}) };
          delete cp.calibration_sub_status;

          if (approvedCals.length > 0) {
            const latestApproved = approvedCals[0];
            const now = new Date();
            const dueDate = latestApproved.next_calibration_date
              ? new Date(latestApproved.next_calibration_date)
              : null;
            const isOverdue = dueDate ? dueDate < now : false;

            await this.instrumentsService.update(inst.id, {
              last_calibration_date: latestApproved.calibration_date as any,
              due_date: latestApproved.next_calibration_date as any,
              status: latestApproved.verdict === 'FAIL' ? 'REJECTED' : (isOverdue ? 'Overdue' : 'OK'),
              cert_no: latestApproved.certificate_number || undefined,
              custom_parameters: cp,
            } as any);
          } else {
            // No previous approved calibration - mark instrument as REJECTED so it cannot be used
            await this.instrumentsService.update(inst.id, {
              status: 'REJECTED',
              custom_parameters: cp,
            } as any);
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed to update instrument status on rejection: ${err?.message || err}`);
      }
    }

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
      .leftJoin('cal.instrument', 'instrument')
      .leftJoin('cal.created_by', 'created_by')
      .select([
        'cal.id',
        'cal.certificate_number',
        'cal.ulr_number',
        'cal.calibration_date',
        'cal.calibration_type',
        'cal.verdict',
        'cal.calculated_verdict',
        'cal.is_verdict_overridden',
        'cal.verdict_override_reason',
        'cal.approval_status',
        'cal.calibrated_by',
        'cal.calibrated_by_designation',
        'cal.reviewed_by',
        'cal.reviewed_by_designation',
        'cal.reviewed_at',
        'cal.approved_by',
        'cal.approved_by_designation',
        'cal.approved_at',
        'cal.rejected_by',
        'cal.rejected_at',
        'cal.rejection_reason',
        'cal.created_at',
        'cal.updated_at',
        'cal.certificate_generated',
        'cal.instrument_id',
        'cal.template_id',
        'cal.template_name',
        'cal.is_canvas_template',
        'instrument.id',
        'instrument.name',
        'instrument.id_code',
        'instrument.location',
        'instrument.range',
        'created_by.id',
        'created_by.name',
        'created_by.email',
      ]);

    if (latestOnly === true || latestOnly === 'true') {
      qb.andWhere((qbSub) => {
        const subQuery = qbSub
          .subQuery()
          .select('c.id')
          .from(Calibration, 'c')
          .where('c.instrument_id = cal.instrument_id')
          .orderBy('c.created_at', 'DESC')
          .addOrderBy('c.calibration_date', 'DESC')
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
      if (approvalStatus === 'Pending Review') {
        qb.andWhere("(cal.approval_status = 'Calibration Completed' OR cal.approval_status = 'Pending Review')");
      } else if (approvalStatus === 'Reviewed') {
        qb.andWhere("(cal.approval_status = 'Reviewed' OR cal.approval_status = 'Pending Approval')");
      } else if (approvalStatus === 'Pending Approval') {
        qb.andWhere(
          "(cal.approval_status = 'Calibration Completed' OR cal.approval_status = 'Pending Approval' OR cal.approval_status = 'Pending Review' OR cal.approval_status = 'Reviewed')",
        );
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

    qb.orderBy('cal.created_at', 'DESC')
      .addOrderBy('cal.calibration_date', 'DESC')
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

  async enrichSignatures(calibration: Calibration): Promise<Calibration> {
    if (!calibration) return calibration;

    // 1. Calibrated By Signature
    if (
      (!calibration.calibrated_by_signature || !calibration.calibrated_by_signature.startsWith('data:image')) &&
      (calibration.calibrated_by || (calibration.created_by as any)?.id)
    ) {
      try {
        const u = await this.userRepository.findOne({
          where: [
            ...(calibration.calibrated_by ? [{ name: calibration.calibrated_by }, { id: calibration.calibrated_by }] : []),
            ...((calibration.created_by as any)?.id ? [{ id: (calibration.created_by as any).id }] : []),
          ],
        });
        if (u?.signature && u.signature.startsWith('data:image')) {
          calibration.calibrated_by_signature = u.signature;
        }
      } catch (e) {}
    }

    // 2. Reviewed By Signature
    if (
      (!calibration.reviewed_by_signature || !calibration.reviewed_by_signature.startsWith('data:image')) &&
      (calibration.reviewed_by || calibration.reviewed_by_id)
    ) {
      try {
        const u = await this.userRepository.findOne({
          where: [
            ...(calibration.reviewed_by_id ? [{ id: calibration.reviewed_by_id }] : []),
            ...(calibration.reviewed_by ? [{ name: calibration.reviewed_by }] : []),
          ],
        });
        if (u?.signature && u.signature.startsWith('data:image')) {
          calibration.reviewed_by_signature = u.signature;
        }
      } catch (e) {}
    }

    // 3. Approved By Signature
    const isApproved =
      calibration.approval_status === 'Approved' ||
      Boolean((calibration as any).approved_at);
    if (
      isApproved &&
      (!calibration.approved_by_signature || !calibration.approved_by_signature.startsWith('data:image')) &&
      (calibration.approved_by || calibration.approved_by_id)
    ) {
      try {
        const u = await this.userRepository.findOne({
          where: [
            ...(calibration.approved_by_id ? [{ id: calibration.approved_by_id }] : []),
            ...(calibration.approved_by ? [{ name: calibration.approved_by }] : []),
          ],
        });
        if (u?.signature && u.signature.startsWith('data:image')) {
          calibration.approved_by_signature = u.signature;
        }
      } catch (e) {}
    }

    return calibration;
  }

  async getSignatories(companyId?: string) {
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }
    const users = await this.userRepository.find({
      where,
      relations: ['role'],
      select: ['id', 'name', 'designation', 'signature', 'roleId', 'companyId'],
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      designation: u.designation || u.role?.name || 'Signatory',
      role: u.role?.name || 'User',
      signature: u.signature || null,
    }));
  }

  async findOne(id: string): Promise<Calibration> {
    const calibration = await this.calibrationRepository.findOne({
      where: { id },
      relations: ['instrument', 'created_by', 'company'],
    });
    if (!calibration) {
      throw new NotFoundException(`Calibration with ID ${id} not found`);
    }
    return await this.enrichSignatures(calibration);
  }

  async getLatestByInstrument(instrumentId: string): Promise<Calibration | null> {
    const cal = await this.calibrationRepository.findOne({
      where: { instrument_id: instrumentId },
      order: { created_at: 'DESC', calibration_date: 'DESC' },
    });
    return cal ? await this.enrichSignatures(cal) : null;
  }

  async findByInstrument(instrumentId: string) {
    const cals = await this.calibrationRepository.find({
      where: { instrument_id: instrumentId },
      order: { created_at: 'DESC', calibration_date: 'DESC' },
      relations: ['instrument'],
    });
    for (const cal of cals) {
      await this.enrichSignatures(cal);
    }
    return cals;
  }

  async markCertificateGenerated(id: string, filePath: string) {
    const calibration = await this.findOne(id);
    calibration.certificate_generated = true;
    calibration.certificate_file = filePath;
    const saved = await this.calibrationRepository.save(calibration);

    try {
      await this.instrumentsService.update(calibration.instrument_id, {
        certificate_file: filePath,
        cert_no: calibration.certificate_number,
      } as any);
    } catch (err) {
      console.warn(`Failed to update instrument certificate`, err);
    }

    return saved;
  }

  async getStats(userId: string) {
    const userIds = await this.getCompanyUserIds(userId);
    const targetUserIds = userIds.length > 0 ? userIds : [userId];

    const qb = this.calibrationRepository
      .createQueryBuilder('cal')
      .leftJoin('cal.created_by', 'created_by')
      .where('created_by.id IN (:...targetUserIds)', { targetUserIds });

    const raw = await qb
      .select('COUNT(*)', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE cal.verdict = 'PASS')`, 'passed')
      .addSelect(`COUNT(*) FILTER (WHERE cal.verdict = 'FAIL')`, 'failed')
      .addSelect(
        `COUNT(*) FILTER (WHERE cal.certificate_generated = false OR cal.certificate_generated IS NULL)`,
        'pendingCerts',
      )
      .getRawOne();

    const total = parseInt(raw?.total || '0', 10);
    const passed = parseInt(raw?.passed || '0', 10);
    const failed = parseInt(raw?.failed || '0', 10);
    const pendingCerts = parseInt(raw?.pendingCerts || '0', 10);

    return {
      total,
      passed,
      failed,
      pendingCerts,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
    };
  }

  async getApprovalStats(userId?: string, companyId?: string): Promise<{
    pendingReview: number;
    reviewed: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    const qb = this.calibrationRepository
      .createQueryBuilder('cal')
      .leftJoin('cal.created_by', 'created_by');

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
      return { pendingReview: 0, reviewed: 0, approved: 0, rejected: 0, total: 0 };
    }

    const raw = await qb
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE cal.approval_status = 'Calibration Completed' OR cal.approval_status = 'Pending Review')`,
        'pendingReview',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE cal.approval_status = 'Reviewed' OR cal.approval_status = 'Pending Approval')`,
        'reviewed',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE cal.approval_status = 'Approved')`,
        'approved',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE cal.approval_status = 'Rejected')`,
        'rejected',
      )
      .getRawOne();

    return {
      pendingReview: parseInt(raw?.pendingReview || '0', 10),
      reviewed: parseInt(raw?.reviewed || '0', 10),
      approved: parseInt(raw?.approved || '0', 10),
      rejected: parseInt(raw?.rejected || '0', 10),
      total: parseInt(raw?.total || '0', 10),
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

  async getDraftByInstrument(userId: string, instrumentId: string): Promise<CalibrationDraft | null> {
    if (!instrumentId) return null;
    const userIds = await this.getCompanyUserIds(userId);
    const targetUserIds = userIds.length > 0 ? userIds : [userId];

    const drafts = await this.draftRepository.find({
      where: { user_id: In(targetUserIds) },
      order: { updated_at: 'DESC' },
    });

    return drafts.find((d) => {
      let p = d.data;
      if (typeof p === 'string') {
        try {
          p = JSON.parse(p);
        } catch {}
      }
      const draftInstId = p?.selectedInstrument?.id;
      const draftInstCode = p?.selectedInstrument?.id_code;
      return (
        draftInstId === instrumentId ||
        draftInstCode === instrumentId ||
        (draftInstId && String(draftInstId).toLowerCase() === String(instrumentId).toLowerCase()) ||
        (draftInstCode && String(draftInstCode).toLowerCase() === String(instrumentId).toLowerCase())
      );
    }) || null;
  }

  async deleteDraftsByInstrument(userId: string, instrumentId: string): Promise<void> {
    if (!instrumentId) return;
    const userIds = await this.getCompanyUserIds(userId);
    const targetUserIds = userIds.length > 0 ? userIds : [userId];

    const drafts = await this.draftRepository.find({
      where: { user_id: In(targetUserIds) },
    });

    const matchingDrafts = drafts.filter((d) => {
      let p = d.data;
      if (typeof p === 'string') {
        try {
          p = JSON.parse(p);
        } catch {}
      }
      const draftInstId = p?.selectedInstrument?.id;
      const draftInstCode = p?.selectedInstrument?.id_code;
      return (
        draftInstId === instrumentId ||
        draftInstCode === instrumentId ||
        (draftInstId && String(draftInstId).toLowerCase() === String(instrumentId).toLowerCase()) ||
        (draftInstCode && String(draftInstCode).toLowerCase() === String(instrumentId).toLowerCase())
      );
    });

    if (matchingDrafts.length > 0) {
      await this.draftRepository.delete(matchingDrafts.map((d) => d.id));
    }
  }

  async saveDraft(userId: string, data: any, draftId?: string): Promise<CalibrationDraft> {
    let draft: CalibrationDraft | null = null;

    if (draftId) {
      draft = await this.draftRepository.findOne({ where: { id: draftId } });
    }

    const instrumentId = data?.selectedInstrument?.id || data?.selectedInstrument?.id_code;

    // Deduplicate: if no draftId provided or not found, check if an unfinished draft already exists for this instrument
    if (!draft && instrumentId) {
      draft = await this.getDraftByInstrument(userId, instrumentId);
    }

    if (!draft) {
      draft = this.draftRepository.create({
        user_id: userId,
        data,
      });
    } else {
      draft.data = data;
    }

    const saved = await this.draftRepository.save(draft);

    // Clean up any other duplicate drafts for the same instrument to keep database pristine
    if (instrumentId) {
      try {
        const userIds = await this.getCompanyUserIds(userId);
        const targetUserIds = userIds.length > 0 ? userIds : [userId];
        const allDrafts = await this.draftRepository.find({
          where: { user_id: In(targetUserIds) },
        });
        const olderDupes = allDrafts.filter((d) => {
          if (d.id === saved.id) return false;
          let p = d.data;
          if (typeof p === 'string') {
            try {
              p = JSON.parse(p);
            } catch {}
          }
          const draftInstId = p?.selectedInstrument?.id;
          const draftInstCode = p?.selectedInstrument?.id_code;
          return (
            draftInstId === instrumentId ||
            draftInstCode === instrumentId ||
            (draftInstId && String(draftInstId).toLowerCase() === String(instrumentId).toLowerCase()) ||
            (draftInstCode && String(draftInstCode).toLowerCase() === String(instrumentId).toLowerCase())
          );
        });
        if (olderDupes.length > 0) {
          await this.draftRepository.delete(olderDupes.map((d) => d.id));
        }
      } catch (err) {
        // Non-blocking cleanup
      }
    }

    return saved;
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
    if (dto.is_canvas_template !== undefined) existing.is_canvas_template = dto.is_canvas_template;
    if (dto.layout_blocks !== undefined) {
      if (Array.isArray(dto.layout_blocks)) {
        try {
          const recalcResult = recalculateCalibrationLayoutBlocks(dto.layout_blocks);
          existing.layout_blocks = recalcResult.layoutBlocks;
          existing.calculated_verdict = recalcResult.overallVerdict;
        } catch (e) {
          existing.layout_blocks = dto.layout_blocks;
        }
      } else {
        existing.layout_blocks = dto.layout_blocks;
      }
    }
    if (dto.calculated_verdict !== undefined) existing.calculated_verdict = dto.calculated_verdict;
    if (dto.is_verdict_overridden !== undefined) existing.is_verdict_overridden = dto.is_verdict_overridden;
    if (dto.verdict_override_reason !== undefined) existing.verdict_override_reason = dto.verdict_override_reason;
    if (dto.template_version_id !== undefined) existing.template_version_id = dto.template_version_id;
    if ((dto as any).procedure_reference !== undefined) (existing as any).procedure_reference = (dto as any).procedure_reference;
    if ((dto as any).procedure_no !== undefined) (existing as any).procedure_no = (dto as any).procedure_no;
    if ((dto as any).procedure_name !== undefined) (existing as any).procedure_name = (dto as any).procedure_name;
    if ((dto as any).procedure_date !== undefined) (existing as any).procedure_date = (dto as any).procedure_date;
    if ((dto as any).procedure_rev !== undefined) (existing as any).procedure_rev = (dto as any).procedure_rev;
    if ((dto as any).doc_no !== undefined) (existing as any).doc_no = (dto as any).doc_no;
    if ((dto as any).doc_date !== undefined) (existing as any).doc_date = (dto as any).doc_date;
    if ((dto as any).doc_rev !== undefined) (existing as any).doc_rev = (dto as any).doc_rev;
    if ((dto as any).acceptance_criteria_doc_no !== undefined) (existing as any).acceptance_criteria_doc_no = (dto as any).acceptance_criteria_doc_no;
    if ((dto as any).acceptance_criteria_date !== undefined) (existing as any).acceptance_criteria_date = (dto as any).acceptance_criteria_date;
    if ((dto as any).acceptance_criteria_rev !== undefined) (existing as any).acceptance_criteria_rev = (dto as any).acceptance_criteria_rev;
    if ((dto as any).acceptance_criteria_reference !== undefined) (existing as any).acceptance_criteria_reference = (dto as any).acceptance_criteria_reference;
    if ((dto as any).standard_reference !== undefined) (existing as any).standard_reference = (dto as any).standard_reference;
    if (dto.decimal_places !== undefined) existing.decimal_places = dto.decimal_places;
    if (dto.diagram_image !== undefined) existing.diagram_image = dto.diagram_image ? dto.diagram_image : (null as any);
    if (dto.diagram_image_width !== undefined) existing.diagram_image_width = dto.diagram_image_width;
    if (dto.diagram_image_height !== undefined) existing.diagram_image_height = dto.diagram_image_height;
    if (dto.diagram_image_alignment !== undefined) existing.diagram_image_alignment = dto.diagram_image_alignment;
    if (dto.acceptance_criteria !== undefined) existing.acceptance_criteria = dto.acceptance_criteria;
    if (dto.uncertainty !== undefined) existing.uncertainty = dto.uncertainty;

    const isOverridden =
      dto.is_verdict_overridden === true ||
      existing.is_verdict_overridden === true ||
      dto.standard_columns_config?.is_verdict_manually_overridden === true ||
      existing.standard_columns_config?.is_verdict_manually_overridden === true;

    if (isOverridden) {
      existing.is_verdict_overridden = true;
      if (dto.verdict !== undefined) existing.verdict = dto.verdict;
      if (dto.verdict_override_reason !== undefined) {
        existing.verdict_override_reason = dto.verdict_override_reason;
      } else if (dto.standard_columns_config?.verdict_override_reason) {
        existing.verdict_override_reason = dto.standard_columns_config.verdict_override_reason;
      }
    } else if (existing.calculated_verdict) {
      existing.verdict = existing.calculated_verdict;
    } else if (dto.verdict !== undefined) {
      existing.verdict = dto.verdict;
    }
    if (dto.remarks !== undefined) existing.remarks = dto.remarks;
    if (dto.calibrated_by !== undefined) existing.calibrated_by = dto.calibrated_by;
    if (dto.calibrated_by_designation !== undefined) existing.calibrated_by_designation = dto.calibrated_by_designation;
    if (dto.reviewed_by !== undefined) existing.reviewed_by = dto.reviewed_by;
    if (dto.reviewed_by_designation !== undefined) existing.reviewed_by_designation = dto.reviewed_by_designation;
    if (dto.approved_by !== undefined) existing.approved_by = dto.approved_by;
    if (dto.calibrated_by_signature !== undefined) existing.calibrated_by_signature = dto.calibrated_by_signature;
    if (dto.reviewed_by_signature !== undefined) existing.reviewed_by_signature = dto.reviewed_by_signature;
    if (dto.approved_by_signature !== undefined) existing.approved_by_signature = dto.approved_by_signature;
    await this.enrichSignatures(existing);
    if (dto.next_calibration_date !== undefined) {
      existing.next_calibration_date = dto.next_calibration_date
        ? new Date(dto.next_calibration_date)
        : (undefined as any);
    } else if (!existing.next_calibration_date && existing.calibration_date && existing.instrument_id) {
      try {
        const inst = await this.instrumentsService.findOne(existing.instrument_id);
        if (inst) {
          existing.next_calibration_date = this.instrumentsService.calculateDueDateFromFrequency(
            existing.calibration_date,
            inst.frequency,
          );
        }
      } catch (e) {
        console.warn('Could not compute next_calibration_date on update:', e);
      }
    }

    await this.freezeTemplateMetadata(existing);

    const saved = await this.calibrationRepository.save(existing);

    // Sync Instrument Master schedule, status, and item-level custom parameters
    if (saved.instrument_id) {
      try {
        const inst = await this.instrumentsService.findOne(saved.instrument_id);
        const existingCp = (inst as any)?.custom_parameters || {};
        const updatedCp: Record<string, any> = { ...existingCp };

        if (dto.diagram_image !== undefined) {
          updatedCp.diagram_image = dto.diagram_image ? dto.diagram_image : null;
        }
        if (dto.diagram_image_width !== undefined) updatedCp.diagram_image_width = dto.diagram_image_width;
        if (dto.diagram_image_height !== undefined) updatedCp.diagram_image_height = dto.diagram_image_height;
        if (dto.diagram_image_alignment !== undefined) updatedCp.diagram_image_alignment = dto.diagram_image_alignment;

        if (dto.doc_no !== undefined || dto.doc_date !== undefined || dto.doc_rev !== undefined || (dto as any).procedure_no !== undefined) {
          updatedCp.doc_properties = {
            ...(existingCp.doc_properties || {}),
            ...(dto.doc_no !== undefined ? { doc_no: dto.doc_no } : {}),
            ...(dto.doc_date !== undefined ? { doc_date: dto.doc_date } : {}),
            ...(dto.doc_rev !== undefined ? { doc_rev: dto.doc_rev } : {}),
            ...((dto as any).procedure_no !== undefined ? { procedure_no: (dto as any).procedure_no } : {}),
            ...((dto as any).procedure_name !== undefined ? { procedure_name: (dto as any).procedure_name } : {}),
            ...((dto as any).procedure_date !== undefined ? { procedure_date: (dto as any).procedure_date } : {}),
            ...((dto as any).procedure_rev !== undefined ? { procedure_rev: (dto as any).procedure_rev } : {}),
            ...(dto.procedure_reference !== undefined ? { procedure_reference: dto.procedure_reference } : {}),
            ...((dto as any).acceptance_criteria_doc_no !== undefined ? { acceptance_criteria_doc_no: (dto as any).acceptance_criteria_doc_no } : {}),
            ...((dto as any).acceptance_criteria_date !== undefined ? { acceptance_criteria_date: (dto as any).acceptance_criteria_date } : {}),
            ...((dto as any).acceptance_criteria_rev !== undefined ? { acceptance_criteria_rev: (dto as any).acceptance_criteria_rev } : {}),
            ...((dto as any).acceptance_criteria_reference !== undefined ? { acceptance_criteria_reference: (dto as any).acceptance_criteria_reference } : {}),
          };
        }
        if (dto.environmental_conditions) {
          updatedCp.environmental_defaults = {
            ...(existingCp.environmental_defaults || {}),
            ...dto.environmental_conditions,
          };
        }
        if (dto.receipt_condition) {
          updatedCp.receipt_condition = dto.receipt_condition;
        }

        if (saved.approval_status === 'Approved') {
          await this.instrumentsService.update(saved.instrument_id, {
            last_calibration_date: saved.calibration_date as any,
            due_date: saved.next_calibration_date as any,
            status: saved.verdict === 'FAIL' ? 'REJECTED' : 'OK',
            calibration_source: 'In-House',
            custom_parameters: updatedCp,
          } as any);
        } else {
          await this.instrumentsService.update(saved.instrument_id, {
            calibration_source: 'In-House',
            custom_parameters: updatedCp,
          } as any);
        }
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

  async getResequencePreview(id: string): Promise<{
    canResequence: boolean;
    message?: string;
    targetCalibration: {
      id: string;
      certificate_number: string;
      ulr_number?: string;
      instrumentName?: string;
      idCode?: string;
      targetSeq: number;
    };
    affectedCalibrations: Array<{
      id: string;
      instrumentName?: string;
      idCode?: string;
      calibration_date?: string;
      oldCertificateNumber: string;
      newCertificateNumber: string;
      oldUlrNumber?: string;
      newUlrNumber?: string;
      oldSeq: number;
      newSeq: number;
    }>;
    currentNextSeq: number;
    newNextSeq: number;
  }> {
    const target = await this.calibrationRepository.findOne({
      where: { id },
      relations: ['instrument', 'created_by'],
    });

    if (!target) {
      throw new NotFoundException(`Calibration with ID ${id} not found`);
    }

    const userId = target.created_by?.id || '';
    const companyId = (target as any).companyId || target.created_by?.companyId || '';
    const settings = await this.settingsService.findOne(userId, companyId);
    const config = settings?.certificateConfig;

    if (!target.certificate_number) {
      return {
        canResequence: false,
        message: 'Calibration does not have a certificate number to resequence.',
        targetCalibration: {
          id: target.id,
          certificate_number: '',
          targetSeq: 0,
        },
        affectedCalibrations: [],
        currentNextSeq: config?.certNextSeq || 0,
        newNextSeq: config?.certNextSeq || 0,
      };
    }

    const sep = config?.certSeparator || this.DEFAULT_CERT_SEPARATOR;
    const parts = target.certificate_number.split(sep);
    const lastPart = parts[parts.length - 1];
    const targetSeq = parseInt(lastPart, 10);

    if (isNaN(targetSeq)) {
      return {
        canResequence: false,
        message: 'Certificate number format cannot be sequentially parsed.',
        targetCalibration: {
          id: target.id,
          certificate_number: target.certificate_number,
          targetSeq: 0,
        },
        affectedCalibrations: [],
        currentNextSeq: config?.certNextSeq || 0,
        newNextSeq: config?.certNextSeq || 0,
      };
    }

    const seqLen = lastPart.length || config?.certSeqLength || this.DEFAULT_CERT_SEQ_LENGTH;
    const certPrefix = parts.slice(0, parts.length - 1).join(sep) + sep;

    const userIds = await this.getCompanyUserIds(userId, companyId);

    const qb = this.calibrationRepository
      .createQueryBuilder('cal')
      .leftJoinAndSelect('cal.instrument', 'instrument')
      .leftJoin('cal.created_by', 'user')
      .where('cal.id != :targetId', { targetId: id })
      .andWhere('cal.certificate_number IS NOT NULL');

    if (userIds.length > 0) {
      qb.andWhere('user.id IN (:...userIds)', { userIds });
    }

    const allCalibrations = await qb.getMany();

    const affectedCalibrations: Array<{
      id: string;
      instrumentName?: string;
      idCode?: string;
      calibration_date?: string;
      oldCertificateNumber: string;
      newCertificateNumber: string;
      oldUlrNumber?: string;
      newUlrNumber?: string;
      oldSeq: number;
      newSeq: number;
    }> = [];

    const ulrSep = config?.ulrSeparator || this.DEFAULT_ULR_SEPARATOR;

    for (const cal of allCalibrations) {
      if (!cal.certificate_number || !cal.certificate_number.startsWith(certPrefix)) {
        continue;
      }
      const cParts = cal.certificate_number.split(sep);
      const cSeq = parseInt(cParts[cParts.length - 1], 10);
      if (!isNaN(cSeq) && cSeq > targetSeq) {
        const newSeq = cSeq - 1;
        const newCertNo = `${certPrefix}${String(newSeq).padStart(seqLen, '0')}`;

        let newUlrNo: string | undefined = undefined;
        if (cal.ulr_number) {
          const uParts = cal.ulr_number.split(ulrSep);
          const uSeq = parseInt(uParts[uParts.length - 1], 10);
          if (!isNaN(uSeq) && uSeq > 1) {
            const uPrefix = uParts.slice(0, uParts.length - 1).join(ulrSep) + ulrSep;
            const uLen = uParts[uParts.length - 1].length || config?.ulrSeqLength || this.DEFAULT_ULR_SEQ_LENGTH;
            newUlrNo = `${uPrefix}${String(uSeq - 1).padStart(uLen, '0')}`;
          }
        }

        affectedCalibrations.push({
          id: cal.id,
          instrumentName: cal.instrument?.name,
          idCode: cal.instrument?.id_code,
          calibration_date: cal.calibration_date ? new Date(cal.calibration_date).toISOString() : undefined,
          oldCertificateNumber: cal.certificate_number,
          newCertificateNumber: newCertNo,
          oldUlrNumber: cal.ulr_number,
          newUlrNumber: newUlrNo,
          oldSeq: cSeq,
          newSeq: newSeq,
        });
      }
    }

    affectedCalibrations.sort((a, b) => a.oldSeq - b.oldSeq);

    const currentNextSeq = config?.certNextSeq ?? 0;
    const newNextSeq = currentNextSeq > targetSeq ? currentNextSeq - 1 : currentNextSeq;

    return {
      canResequence: true,
      targetCalibration: {
        id: target.id,
        certificate_number: target.certificate_number,
        ulr_number: target.ulr_number,
        instrumentName: target.instrument?.name,
        idCode: target.instrument?.id_code,
        targetSeq,
      },
      affectedCalibrations,
      currentNextSeq,
      newNextSeq,
    };
  }

  async remove(id: string, resequence: boolean = false): Promise<{ success: boolean; affectedCount: number }> {
    const calibration = await this.calibrationRepository.findOne({
      where: { id },
      relations: ['instrument', 'created_by'],
    });

    if (!calibration) {
      throw new NotFoundException(`Calibration with ID ${id} not found`);
    }

    const userId = calibration.created_by?.id || '';
    const companyId = (calibration as any).companyId || calibration.created_by?.companyId || '';

    let affectedCalibrations: Array<{
      id: string;
      newCertificateNumber: string;
      newUlrNumber?: string;
      oldCertificateNumber: string;
      oldUlrNumber?: string;
    }> = [];
    let shouldUpdateConfig = false;
    let newNextSeq = 0;

    if (resequence && calibration.certificate_number) {
      const preview = await this.getResequencePreview(id);
      if (preview.canResequence && preview.affectedCalibrations.length > 0) {
        affectedCalibrations = preview.affectedCalibrations;
        shouldUpdateConfig = true;
        newNextSeq = preview.newNextSeq;
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (companyId) {
        await queryRunner.query(
          `SELECT pg_advisory_lock(hashtext('company_cert_' || $1))`,
          [companyId],
        );
      }

      // If resequencing was selected, shift subsequent certificates atomically
      if (resequence && affectedCalibrations.length > 0) {
        for (const aff of affectedCalibrations) {
          const updatePayload: Partial<Calibration> = {
            certificate_number: aff.newCertificateNumber,
          };
          if (aff.newUlrNumber) {
            updatePayload.ulr_number = aff.newUlrNumber;
          }
          await queryRunner.manager.update(Calibration, aff.id, updatePayload);

          const audit = queryRunner.manager.create(CalibrationAuditLog, {
            calibration_id: aff.id,
            edited_by_id: userId,
            edited_by_name: 'System (Sequence Shift on Delete)',
            changes_summary: [
              {
                field: 'certificate_number',
                oldValue: aff.oldCertificateNumber,
                newValue: aff.newCertificateNumber,
              },
              ...(aff.newUlrNumber ? [{
                field: 'ulr_number',
                oldValue: aff.oldUlrNumber,
                newValue: aff.newUlrNumber,
              }] : []),
            ],
          });
          await queryRunner.manager.save(CalibrationAuditLog, audit);
        }

        // Adjust settings counter down if appropriate
        if (shouldUpdateConfig && userId && companyId) {
          const settings = await this.settingsService.findOne(userId, companyId);
          if (settings?.certificateConfig) {
            await this.settingsService.create({
              userId,
              companyId,
              certificateConfig: {
                ...settings.certificateConfig,
                certNextSeq: Math.max(0, newNextSeq),
              },
            });
          }
        }
      }

      const instrumentId = calibration.instrument_id || calibration.instrument?.id;
      const calDate = calibration.calibration_date;
      const nextDate = calibration.next_calibration_date;

      await queryRunner.manager.delete(CalibrationAuditLog, { calibration_id: id });
      await queryRunner.manager.remove(Calibration, calibration);

      await queryRunner.commitTransaction();

      // Revert/sync instrument master dates outside the lock
      if (instrumentId) {
        try {
          const latestRemainingCal = await this.calibrationRepository.findOne({
            where: { instrument_id: instrumentId },
            order: { calibration_date: 'DESC' },
          });

          if (latestRemainingCal) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isOverdue = latestRemainingCal.next_calibration_date
              ? new Date(latestRemainingCal.next_calibration_date) <= today
              : false;

            await this.instrumentsService.update(instrumentId, {
              last_calibration_date: latestRemainingCal.calibration_date ? new Date(latestRemainingCal.calibration_date).toISOString() : undefined,
              due_date: latestRemainingCal.next_calibration_date ? new Date(latestRemainingCal.next_calibration_date).toISOString() : undefined,
              status: latestRemainingCal.verdict === 'FAIL' ? 'REJECTED' : (isOverdue ? 'Overdue' : 'OK'),
              calibration_source: 'In-House',
            } as any);
          } else {
            await this.instrumentsService.syncInstrumentAfterCalibrationDeleted(
              instrumentId,
              calDate,
              nextDate,
            );
          }
        } catch (err) {
          console.warn('Failed to update instrument status on calibration remove:', err);
        }
      }

      return { success: true, affectedCount: affectedCalibrations.length };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      if (companyId) {
        try {
          await queryRunner.query(
            `SELECT pg_advisory_unlock(hashtext('company_cert_' || $1))`,
            [companyId],
          );
        } catch {}
      }
      await queryRunner.release();
    }
  }
}
