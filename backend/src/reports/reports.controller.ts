import { Controller, Get, Query, Res, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ReportsService } from './reports.service';
import type { Response } from 'express';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get()
  @RequirePermission('reports', 'view')
  async getReport(
    @Query('from') from: string,  
    @Query('to') to: string,
    @Query('format') format: string,
    @Query('userid') userid: string,
    @Query('columns') columns: string,
    @Query('templateId') templateId: string,
    @Query('status') status: string,
    @Query('item_status') item_status: string,
    @Query('location') location: string,
    @Query('companyId') queryCompanyId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const isSuperAdmin = !!req.user?.isSuperAdmin;
    const finalUserId = isSuperAdmin ? (userid || req.user?.userId || req.user?.id) : (req.user?.userId || req.user?.id);
    const finalCompanyId = isSuperAdmin ? (queryCompanyId || req.user?.companyId) : req.user?.companyId;
    console.log("Report Generation Request Query:", { from, to, format, finalUserId, columns, templateId, status, item_status, location, finalCompanyId });

    const reportBuffer = await this.reportsService.generateReport(from, to, format, finalUserId, columns, templateId, status, location, finalCompanyId, item_status);

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
  @RequirePermission('reports', 'view')
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
    @Query('item_status') item_status?: string,
    @Query('companyId') queryCompanyId?: string,
    @Req() req?: any,
  ) {
    const isSuperAdmin = !!req?.user?.isSuperAdmin;
    const finalUserId = isSuperAdmin ? (userid || req?.user?.userId || req?.user?.id) : (req?.user?.userId || req?.user?.id);
    const finalCompanyId = isSuperAdmin ? (queryCompanyId || req?.user?.companyId) : req?.user?.companyId;

    const p = parseInt(page, 10) || 1;
    const ps = parseInt(pageSize, 10) || 10;
    
    const filters = { name, id_code, location, agency, status, item_status };
    
    return this.reportsService.getReportData(from, to, finalUserId, p, ps, filters, finalCompanyId);
  }
}
