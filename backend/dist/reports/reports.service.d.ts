import { Instrument } from 'src/instruments/instrument.entity';
import { Repository } from 'typeorm';
import { SettingsService } from '../settings/settings.service';
import { ReportTemplatesService } from '../report-templates/report-templates.service';
export declare class ReportsService {
    private readonly instrumentRepository;
    private readonly settingsService;
    private readonly reportTemplatesService;
    private printer;
    constructor(instrumentRepository: Repository<Instrument>, settingsService: SettingsService, reportTemplatesService: ReportTemplatesService);
    private generatePdfReport;
    generateReport(from: string, to: string, format: string, userid: string, columnsStr?: string, templateId?: string): Promise<Buffer>;
    private generateHtmlReport;
    getReportData(from: string, to: string, userid: string, page?: number, pageSize?: number, filters?: Record<string, string | undefined>): Promise<{
        items: Instrument[];
        total: number;
    }>;
}
