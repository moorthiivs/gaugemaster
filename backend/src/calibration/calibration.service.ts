import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Calibration } from './calibration.entity';
import { CalibrationDraft } from './calibration-draft.entity';
import { CreateCalibrationDto } from './dto/create-calibration.dto';
import { SettingsService } from '../settings/settings.service';

/**
 * Handles calibration CRUD, auto-generates certificate and ULR numbers
 * based on the company's certificate configuration in Settings.
 */
@Injectable()
export class CalibrationService {
  constructor(
    @InjectRepository(Calibration)
    private readonly calibrationRepository: Repository<Calibration>,
    @InjectRepository(CalibrationDraft)
    private readonly draftRepository: Repository<CalibrationDraft>,
    private readonly settingsService: SettingsService,
  ) {}

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
    const nextSeq = (config?.certNextSeq || 0) + 1;

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
    const nextSeq = (config?.ulrNextSeq || 0) + 1;

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

    // Certificate
    const certPrefix = config?.certPrefix || this.DEFAULT_CERT_PREFIX;
    const certSep = config?.certSeparator || this.DEFAULT_CERT_SEPARATOR;
    const certYearFmt = config?.certYearFormat || this.DEFAULT_CERT_YEAR_FORMAT;
    const certSeqLen = config?.certSeqLength || this.DEFAULT_CERT_SEQ_LENGTH;
    const certNextSeq = (config?.certNextSeq || 0) + 1;
    const certYear = this.formatYear(certYearFmt);
    const nextCertNumber = `${certPrefix}${certSep}${certYear}${certSep}${String(certNextSeq).padStart(certSeqLen, '0')}`;

    // ULR
    const ulrPrefix = config?.ulrPrefix || this.DEFAULT_ULR_PREFIX;
    const ulrSep = config?.ulrSeparator || this.DEFAULT_ULR_SEPARATOR;
    const ulrYearFmt = config?.ulrYearFormat || this.DEFAULT_ULR_YEAR_FORMAT;
    const ulrSeqLen = config?.ulrSeqLength || this.DEFAULT_ULR_SEQ_LENGTH;
    const ulrNextSeq = (config?.ulrNextSeq || 0) + 1;
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

    const calibration = this.calibrationRepository.create({
      ...dto,
      certificate_number,
      ulr_number,
      calibration_date: new Date(dto.calibration_date),
      reference_standard_validity: dto.reference_standard_validity
        ? new Date(dto.reference_standard_validity)
        : undefined,
      next_calibration_date: dto.next_calibration_date
        ? new Date(dto.next_calibration_date)
        : undefined,
      created_by: dto.created_by ? { id: dto.created_by } as any : undefined,
    });

    return this.calibrationRepository.save(calibration);
  }

  async findAll(filters: {
    userId?: string;
    companyId?: string;
    instrumentId?: string;
    calibrationType?: string;
    verdict?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  }) {
    const {
      userId,
      companyId,
      instrumentId,
      calibrationType,
      verdict,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 10,
    } = filters;

    const where: any = {};
    if (userId) where.created_by = { id: userId };
    if (companyId) where.companyId = companyId;
    if (instrumentId) where.instrument_id = instrumentId;
    if (calibrationType) where.calibration_type = calibrationType;
    if (verdict) where.verdict = verdict;
    if (dateFrom && dateTo) {
      where.calibration_date = Between(new Date(dateFrom), new Date(dateTo));
    }

    const [data, total] = await this.calibrationRepository.findAndCount({
      where,
      relations: ['instrument', 'created_by'],
      order: { calibration_date: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

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
    return this.calibrationRepository.save(calibration);
  }

  async getStats(userId: string) {
    const total = await this.calibrationRepository.count({
      where: { created_by: { id: userId } },
    });
    const passed = await this.calibrationRepository.count({
      where: { created_by: { id: userId }, verdict: 'PASS' },
    });
    const failed = await this.calibrationRepository.count({
      where: { created_by: { id: userId }, verdict: 'FAIL' },
    });
    const pendingCerts = await this.calibrationRepository.count({
      where: { created_by: { id: userId }, certificate_generated: false },
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
    return this.draftRepository.find({
      where: { user_id: userId },
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
}
