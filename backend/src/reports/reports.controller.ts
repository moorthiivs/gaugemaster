import { Controller, Get, Query, Res, Headers } from '@nestjs/common';
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
    @Query('columns') columns: string,
    @Query('templateId') templateId: string,
    @Headers('authorization') authHeader: string,
    @Res() res: Response,
  ) {
    let finalUserId = userid;
    if (!finalUserId || finalUserId === 'undefined') {
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                finalUserId = payload.sub;
            } catch (e) {
                console.error("Failed to decode token", e);
            }
        }
    }
    console.log("PDF Generation Request Query:", { from, to, format, userid, columns, templateId, finalUserId });
    // Validate params here as needed

    const reportBuffer = await this.reportsService.generateReport(from, to, format, finalUserId, columns, templateId);

    // Set response headers based on format
    const mimeType = format === 'html' ? 'text/html' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (format !== 'html') {
        res.set({
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename=report_${from}_${to}.${format}`,
        });
    } else {
        res.set({ 'Content-Type': mimeType });
    }

    res.send(reportBuffer);
  }

  @Get('preview')
  async getPreview(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('userid') userid: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Query('name') name?: string,
    @Query('id_code') id_code?: string,
    @Query('location') location?: string,
    @Query('agency') agency?: string,
    @Query('status') status?: string,
  ) {
    const p = parseInt(page, 10) || 1;
    const ps = parseInt(pageSize, 10) || 10;
    
    const filters = { name, id_code, location, agency, status };
    
    return this.reportsService.getReportData(from, to, userid, p, ps, filters);
  }
}
