"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalibrationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const calibration_entity_1 = require("./calibration.entity");
const calibration_draft_entity_1 = require("./calibration-draft.entity");
const settings_service_1 = require("../settings/settings.service");
let CalibrationService = class CalibrationService {
    calibrationRepository;
    draftRepository;
    settingsService;
    constructor(calibrationRepository, draftRepository, settingsService) {
        this.calibrationRepository = calibrationRepository;
        this.draftRepository = draftRepository;
        this.settingsService = settingsService;
    }
    DEFAULT_CERT_PREFIX = 'CAL/CERT';
    DEFAULT_CERT_SEPARATOR = '/';
    DEFAULT_CERT_YEAR_FORMAT = 'YYYY';
    DEFAULT_CERT_SEQ_LENGTH = 5;
    DEFAULT_ULR_PREFIX = 'ULR';
    DEFAULT_ULR_SEPARATOR = '/';
    DEFAULT_ULR_YEAR_FORMAT = 'YYYY';
    DEFAULT_ULR_SEQ_LENGTH = 5;
    formatYear(format) {
        const year = new Date().getFullYear();
        return format === 'YY' ? String(year).slice(-2) : String(year);
    }
    async generateCertificateNumber(userId, companyId) {
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
    async generateUlrNumber(userId, companyId) {
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
    async getNextNumbers(userId, companyId) {
        const settings = await this.settingsService.findOne(userId, companyId);
        const config = settings?.certificateConfig;
        const certPrefix = config?.certPrefix || this.DEFAULT_CERT_PREFIX;
        const certSep = config?.certSeparator || this.DEFAULT_CERT_SEPARATOR;
        const certYearFmt = config?.certYearFormat || this.DEFAULT_CERT_YEAR_FORMAT;
        const certSeqLen = config?.certSeqLength || this.DEFAULT_CERT_SEQ_LENGTH;
        const certNextSeq = (config?.certNextSeq || 0) + 1;
        const certYear = this.formatYear(certYearFmt);
        const nextCertNumber = `${certPrefix}${certSep}${certYear}${certSep}${String(certNextSeq).padStart(certSeqLen, '0')}`;
        const ulrPrefix = config?.ulrPrefix || this.DEFAULT_ULR_PREFIX;
        const ulrSep = config?.ulrSeparator || this.DEFAULT_ULR_SEPARATOR;
        const ulrYearFmt = config?.ulrYearFormat || this.DEFAULT_ULR_YEAR_FORMAT;
        const ulrSeqLen = config?.ulrSeqLength || this.DEFAULT_ULR_SEQ_LENGTH;
        const ulrNextSeq = (config?.ulrNextSeq || 0) + 1;
        const ulrYear = this.formatYear(ulrYearFmt);
        const nextUlrNumber = `${ulrPrefix}${ulrSep}${ulrYear}${ulrSep}${String(ulrNextSeq).padStart(ulrSeqLen, '0')}`;
        return { nextCertNumber, nextUlrNumber };
    }
    async create(dto) {
        const userId = dto.created_by || '';
        const companyId = dto.companyId || '';
        const certificate_number = await this.generateCertificateNumber(userId, companyId);
        let ulr_number = undefined;
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
            created_by: dto.created_by ? { id: dto.created_by } : undefined,
        });
        return this.calibrationRepository.save(calibration);
    }
    async findAll(filters) {
        const { userId, companyId, instrumentId, calibrationType, verdict, dateFrom, dateTo, page = 1, pageSize = 10, } = filters;
        const where = {};
        if (userId)
            where.created_by = { id: userId };
        if (companyId)
            where.companyId = companyId;
        if (instrumentId)
            where.instrument_id = instrumentId;
        if (calibrationType)
            where.calibration_type = calibrationType;
        if (verdict)
            where.verdict = verdict;
        if (dateFrom && dateTo) {
            where.calibration_date = (0, typeorm_2.Between)(new Date(dateFrom), new Date(dateTo));
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
    async findOne(id) {
        const calibration = await this.calibrationRepository.findOne({
            where: { id },
            relations: ['instrument', 'created_by', 'company'],
        });
        if (!calibration) {
            throw new common_1.NotFoundException(`Calibration with ID ${id} not found`);
        }
        return calibration;
    }
    async getLatestByInstrument(instrumentId) {
        return this.calibrationRepository.findOne({
            where: { instrument_id: instrumentId },
            order: { calibration_date: 'DESC' },
        });
    }
    async findByInstrument(instrumentId) {
        return this.calibrationRepository.find({
            where: { instrument_id: instrumentId },
            order: { calibration_date: 'DESC' },
            relations: ['instrument'],
        });
    }
    async markCertificateGenerated(id, filePath) {
        const calibration = await this.findOne(id);
        calibration.certificate_generated = true;
        calibration.certificate_file = filePath;
        return this.calibrationRepository.save(calibration);
    }
    async getStats(userId) {
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
    async getAllDrafts(userId) {
        return this.draftRepository.find({
            where: { user_id: userId },
            order: { updated_at: 'DESC' },
        });
    }
    async getDraft(id) {
        return this.draftRepository.findOne({
            where: { id },
        });
    }
    async saveDraft(userId, data, draftId) {
        let draft = null;
        if (draftId) {
            draft = await this.draftRepository.findOne({ where: { id: draftId } });
        }
        if (!draft) {
            draft = this.draftRepository.create({
                user_id: userId,
                data,
            });
        }
        else {
            draft.data = data;
        }
        return this.draftRepository.save(draft);
    }
    async deleteDraft(id) {
        await this.draftRepository.delete({ id });
    }
};
exports.CalibrationService = CalibrationService;
exports.CalibrationService = CalibrationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(calibration_entity_1.Calibration)),
    __param(1, (0, typeorm_1.InjectRepository)(calibration_draft_entity_1.CalibrationDraft)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        settings_service_1.SettingsService])
], CalibrationService);
//# sourceMappingURL=calibration.service.js.map