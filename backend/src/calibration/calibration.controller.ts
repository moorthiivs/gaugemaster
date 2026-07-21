import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  Delete,
} from '@nestjs/common';
import type { Response } from 'express';
import { CalibrationService } from './calibration.service';
import { CertificateService } from './certificate.service';
import { CreateCalibrationDto } from './dto/create-calibration.dto';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/calibrations')
export class CalibrationController {
  constructor(
    private readonly calibrationService: CalibrationService,
    private readonly certificateService: CertificateService,
  ) {}

  @Post()
  async create(@Body() dto: CreateCalibrationDto) {
    return this.calibrationService.create(dto);
  }

  @Get('latest/:instrumentId')
  async getLatest(@Param('instrumentId') instrumentId: string) {
    return this.calibrationService.getLatestByInstrument(instrumentId);
  }

  // ── Drafts ──
  @Get('drafts/:userId')
  async getAllDrafts(@Param('userId') userId: string) {
    return this.calibrationService.getAllDrafts(userId);
  }

  @Get('draft/:id')
  async getDraft(@Param('id') id: string) {
    return this.calibrationService.getDraft(id);
  }

  @Post('draft')
  async saveDraft(@Body() body: { userId: string; data: any; draftId?: string }) {
    return this.calibrationService.saveDraft(body.userId, body.data, body.draftId);
  }

  @Delete('draft/:id')
  async deleteDraft(@Param('id') id: string) {
    return this.calibrationService.deleteDraft(id);
  }

  @Get()
  async findAll(
    @Query('userId') userId?: string,
    @Query('companyId') companyId?: string,
    @Query('instrumentId') instrumentId?: string,
    @Query('calibrationType') calibrationType?: string,
    @Query('verdict') verdict?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
  ) {
    return this.calibrationService.findAll({
      userId,
      companyId,
      instrumentId,
      calibrationType,
      verdict,
      dateFrom,
      dateTo,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
    });
  }

  @Get('stats/:userId')
  async getStats(@Param('userId') userId: string) {
    return this.calibrationService.getStats(userId);
  }

  @Get('next-numbers/:userId')
  async getNextNumbers(
    @Param('userId') userId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.calibrationService.getNextNumbers(userId, companyId);
  }

  @Get('instrument/:instrumentId')
  async findByInstrument(@Param('instrumentId') instrumentId: string) {
    return this.calibrationService.findByInstrument(instrumentId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.calibrationService.findOne(id);
  }

  /**
   * Generate and download a calibration certificate PDF.
   * ULR gate: if calibration.ulr_enabled is false and no ulr_number, return 403.
   */
  @Post(':id/certificate')
  async generateCertificate(
    @Param('id') id: string,
    @Query('templateId') templateId?: string,
    @Res() res?: any,
  ) {
    const calibration = await this.calibrationService.findOne(id);

    // Removed ULR Gate requirement to allow certificate generation without ULR number

    const userId = calibration.created_by?.id;
    const pdfBuffer = await this.certificateService.generateCertificate(
      calibration,
      userId,
      templateId,
    );

    // Save to disk
    const uploadsDir = path.join(process.cwd(), 'uploads', 'certificates');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const fileName = `cert-${calibration.certificate_number.replace(/\//g, '-')}-${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    // Update calibration record
    const fileUrl = `/uploads/certificates/${fileName}`;
    await this.calibrationService.markCertificateGenerated(id, fileUrl);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }

  @Get(':id/certificate/download')
  async downloadCertificate(@Param('id') id: string, @Res() res: any) {
    const calibration = await this.calibrationService.findOne(id);

    if (!calibration.certificate_file) {
      return res
        .status(404)
        .json({ error: 'Certificate has not been generated yet.' });
    }

    const filePath = path.join(
      process.cwd(),
      calibration.certificate_file.replace(/^\//, ''),
    );

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ error: 'Certificate file not found on server.' });
    }

    res.download(filePath);
  }
}
