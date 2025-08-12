import { Controller, Get, Query, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import type { Response } from 'express';

@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get()
  async getReport(
    @Query('from') from: string,  
    @Query('to') to: string,
    @Query('format') format: string,
    @Query('userid') userid: string,

    @Res() res: Response,
  ) {
    // Validate params here as needed

    const reportBuffer = await this.reportsService.generateReport(from, to, format, userid);

    // Set response headers based on format
    const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv';
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename=report_${from}_${to}.${format}`,
    });

    res.send(reportBuffer);
  }
}
