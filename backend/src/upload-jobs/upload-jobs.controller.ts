import { Controller, Get, Post, Body, Query, Param, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { UploadJobsService } from './upload-jobs.service';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('api/upload-jobs')
export class UploadJobsController {
  constructor(private readonly uploadJobsService: UploadJobsService) {}

  @Post('start')
  @RequirePermission('instruments', 'create')
  async startBackgroundUpload(
    @Query('companyId') queryCompanyId: string,
    @Body() body: { fileName: string; instruments: CreateInstrumentDto[]; userId?: string },
    @Req() req: any,
  ) {
    const user = req.user || {};
    const companyId = user.isSuperAdmin ? (queryCompanyId || user.companyId) : user.companyId;
    const userId = user.userId || user.id || body.userId;
    if (!companyId) {
      throw new ForbiddenException('Company ID is required to start upload job');
    }
    if (body.instruments && Array.isArray(body.instruments)) {
      body.instruments.forEach((inst) => {
        inst.companyId = companyId;
      });
    }
    return await this.uploadJobsService.startBackgroundUpload(
      companyId,
      body.fileName,
      body.instruments,
      userId,
    );
  }

  @Get('status/:id')
  async getJobStatus(@Param('id') id: string) {
    return await this.uploadJobsService.getJob(id);
  }

  @Get('company/:companyId')
  async getCompanyJobs(@Param('companyId') queryCompanyId: string, @Req() req: any) {
    const user = req.user || {};
    const companyId = user.isSuperAdmin ? (queryCompanyId || user.companyId) : user.companyId;
    if (!companyId) {
      throw new ForbiddenException('Company context required');
    }
    return await this.uploadJobsService.getJobsByCompany(companyId);
  }

  @Post('cancel/:id')
  @RequirePermission('instruments', 'edit')
  async cancelJob(@Param('id') id: string) {
    return await this.uploadJobsService.cancelJob(id);
  }
}
