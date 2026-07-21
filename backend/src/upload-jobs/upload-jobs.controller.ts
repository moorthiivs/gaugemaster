import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { UploadJobsService } from './upload-jobs.service';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';

@Controller('api/upload-jobs')
export class UploadJobsController {
  constructor(private readonly uploadJobsService: UploadJobsService) {}

  @Post('start')
  async startBackgroundUpload(
    @Query('companyId') companyId: string,
    @Body() body: { fileName: string; instruments: CreateInstrumentDto[]; userId: string },
  ) {
    return await this.uploadJobsService.startBackgroundUpload(
      companyId,
      body.fileName,
      body.instruments,
      body.userId,
    );
  }

  @Get('status/:id')
  async getJobStatus(@Param('id') id: string) {
    return await this.uploadJobsService.getJob(id);
  }

  @Get('company/:companyId')
  async getCompanyJobs(@Param('companyId') companyId: string) {
    return await this.uploadJobsService.getJobsByCompany(companyId);
  }

  @Post('cancel/:id')
  async cancelJob(@Param('id') id: string) {
    return await this.uploadJobsService.cancelJob(id);
  }
}
