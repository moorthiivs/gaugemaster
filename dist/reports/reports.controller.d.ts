import { ReportsService } from './reports.service';
import type { Response } from 'express';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    getReport(from: string, to: string, format: string, userid: string, res: Response): Promise<void>;
}
