import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { SuperAdminGuard } from '../auth/super-admin.guard';

@ApiTags('api/audit-logs')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
@Controller('api/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('company/:companyId')
  @ApiOperation({ summary: 'Get audit logs for a specific company (Super Admin only)' })
  async getCompanyLogs(
    @Param('companyId') companyId: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('resourceType') resourceType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    return this.auditLogsService.findByCompany(companyId, {
      limit: limit ? parseInt(limit, 10) : 200,
      action,
      status,
      resourceType,
      dateFrom,
      dateTo,
      search,
    });
  }
}
