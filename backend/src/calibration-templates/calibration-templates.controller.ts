import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CalibrationTemplatesService } from './calibration-templates.service';
import { CreateCalibrationTemplateDto } from './dto/create-calibration-template.dto';
import { UpdateCalibrationTemplateDto } from './dto/update-calibration-template.dto';
import { TemplateExportService } from './services/template-export.service';
import { TemplateImportService } from './services/template-import.service';
import { TemplateAuditLogService } from './services/template-audit-log.service';

@Controller('api/calibration-templates')
export class CalibrationTemplatesController {
  constructor(
    private readonly templatesService: CalibrationTemplatesService,
    private readonly exportService: TemplateExportService,
    private readonly importService: TemplateImportService,
    private readonly auditLogService: TemplateAuditLogService,
  ) {}

  @Post()
  async create(@Body() dto: CreateCalibrationTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('companyId') companyId?: string,
    @Query('calibrationType') calibrationType?: string,
  ) {
    return this.templatesService.findAll({ userId, companyId, calibrationType });
  }

  @Post('export')
  async exportTemplates(
    @Body() body: { templateIds?: string[]; companyId?: string; userId?: string; userName?: string },
    @Res() res: Response,
  ) {
    const { zipBuffer, filename, count } = await this.exportService.exportTemplates(body);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': zipBuffer.length.toString(),
      'X-Template-Count': count.toString(),
    });

    return res.status(200).send(zipBuffer);
  }

  @Post('import/validate')
  @UseInterceptors(FileInterceptor('file'))
  async validateImport(
    @UploadedFile() file?: any,
    @Body('fileBase64') fileBase64?: string,
    @Body('companyId') companyId?: string,
  ) {
    let buffer: Buffer;
    if (file) {
      buffer = file.buffer;
    } else if (fileBase64) {
      const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new BadRequestException('No template package file uploaded.');
    }

    return this.importService.validatePackage(buffer, companyId);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importTemplates(
    @UploadedFile() file?: any,
    @Body('fileBase64') fileBase64?: string,
    @Body('duplicateStrategy') duplicateStrategy: any = 'SKIP',
    @Body('companyId') companyId?: string,
    @Body('userId') userId?: string,
    @Body('userName') userName?: string,
  ) {
    let buffer: Buffer;
    if (file) {
      buffer = file.buffer;
    } else if (fileBase64) {
      const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new BadRequestException('No template package file uploaded.');
    }

    return this.importService.importTemplates({
      fileBuffer: buffer,
      duplicateStrategy,
      targetCompanyId: companyId,
      userId,
      userName,
    });
  }

  @Get('audit-logs')
  async getAuditLogs(@Query('companyId') companyId?: string) {
    return this.auditLogService.findAll(companyId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCalibrationTemplateDto,
  ) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.templatesService.remove(id);
    return { message: 'Template deleted successfully' };
  }
}
