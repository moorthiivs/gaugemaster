import { CalibrationService } from './calibration.service';
import { CertificateService } from './certificate.service';
import { CreateCalibrationDto } from './dto/create-calibration.dto';
export declare class CalibrationController {
    private readonly calibrationService;
    private readonly certificateService;
    constructor(calibrationService: CalibrationService, certificateService: CertificateService);
    create(dto: CreateCalibrationDto): Promise<import("./calibration.entity").Calibration>;
    getLatest(instrumentId: string): Promise<import("./calibration.entity").Calibration | null>;
    getAllDrafts(userId: string): Promise<import("./calibration-draft.entity").CalibrationDraft[]>;
    getDraft(id: string): Promise<import("./calibration-draft.entity").CalibrationDraft | null>;
    saveDraft(body: {
        userId: string;
        data: any;
        draftId?: string;
    }): Promise<import("./calibration-draft.entity").CalibrationDraft>;
    deleteDraft(id: string): Promise<void>;
    findAll(userId?: string, companyId?: string, instrumentId?: string, calibrationType?: string, verdict?: string, dateFrom?: string, dateTo?: string, page?: string, pageSize?: string): Promise<{
        data: import("./calibration.entity").Calibration[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }>;
    getStats(userId: string): Promise<{
        total: number;
        passed: number;
        failed: number;
        pendingCerts: number;
        passRate: number;
    }>;
    getNextNumbers(userId: string, companyId: string): Promise<{
        nextCertNumber: string;
        nextUlrNumber: string;
    }>;
    findByInstrument(instrumentId: string): Promise<import("./calibration.entity").Calibration[]>;
    findOne(id: string): Promise<import("./calibration.entity").Calibration>;
    generateCertificate(id: string, templateId?: string, res?: any): Promise<void>;
    downloadCertificate(id: string, res: any): Promise<any>;
}
