import { ReportsService } from './reports.service';
import type { Response } from 'express';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    getReport(from: string, to: string, format: string, userid: string, columns: string, templateId: string, authHeader: string, res: Response): Promise<void>;
    getPreview(from: string, to: string, userid: string, page?: string, pageSize?: string, name?: string, id_code?: string, location?: string, agency?: string, status?: string): Promise<{
        items: import("../instruments/instrument.entity").Instrument[];
        total: number;
    }>;
}
