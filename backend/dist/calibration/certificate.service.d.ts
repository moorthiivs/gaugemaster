import { Calibration } from './calibration.entity';
import { SettingsService } from '../settings/settings.service';
import { ReportTemplatesService } from '../report-templates/report-templates.service';
export declare class CertificateService {
    private readonly settingsService;
    private readonly reportTemplatesService;
    private printer;
    constructor(settingsService: SettingsService, reportTemplatesService: ReportTemplatesService);
    generateCertificate(calibration: Calibration, userId?: string, templateId?: string): Promise<Buffer>;
}
