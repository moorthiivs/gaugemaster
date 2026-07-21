import { Repository } from 'typeorm';
import { Calibration } from './calibration.entity';
import { CalibrationDraft } from './calibration-draft.entity';
import { CreateCalibrationDto } from './dto/create-calibration.dto';
import { SettingsService } from '../settings/settings.service';
export declare class CalibrationService {
    private readonly calibrationRepository;
    private readonly draftRepository;
    private readonly settingsService;
    constructor(calibrationRepository: Repository<Calibration>, draftRepository: Repository<CalibrationDraft>, settingsService: SettingsService);
    private readonly DEFAULT_CERT_PREFIX;
    private readonly DEFAULT_CERT_SEPARATOR;
    private readonly DEFAULT_CERT_YEAR_FORMAT;
    private readonly DEFAULT_CERT_SEQ_LENGTH;
    private readonly DEFAULT_ULR_PREFIX;
    private readonly DEFAULT_ULR_SEPARATOR;
    private readonly DEFAULT_ULR_YEAR_FORMAT;
    private readonly DEFAULT_ULR_SEQ_LENGTH;
    private formatYear;
    generateCertificateNumber(userId: string, companyId: string): Promise<string>;
    generateUlrNumber(userId: string, companyId: string): Promise<string>;
    getNextNumbers(userId: string, companyId: string): Promise<{
        nextCertNumber: string;
        nextUlrNumber: string;
    }>;
    create(dto: CreateCalibrationDto): Promise<Calibration>;
    findAll(filters: {
        userId?: string;
        companyId?: string;
        instrumentId?: string;
        calibrationType?: string;
        verdict?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        pageSize?: number;
    }): Promise<{
        data: Calibration[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }>;
    findOne(id: string): Promise<Calibration>;
    getLatestByInstrument(instrumentId: string): Promise<Calibration | null>;
    findByInstrument(instrumentId: string): Promise<Calibration[]>;
    markCertificateGenerated(id: string, filePath: string): Promise<Calibration>;
    getStats(userId: string): Promise<{
        total: number;
        passed: number;
        failed: number;
        pendingCerts: number;
        passRate: number;
    }>;
    getAllDrafts(userId: string): Promise<CalibrationDraft[]>;
    getDraft(id: string): Promise<CalibrationDraft | null>;
    saveDraft(userId: string, data: any, draftId?: string): Promise<CalibrationDraft>;
    deleteDraft(id: string): Promise<void>;
}
