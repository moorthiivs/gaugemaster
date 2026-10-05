import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { CalibrationService } from './calibration.service';
import { CertificateService } from './certificate.service';
import { CreateCalibrationDto } from './dto/create-calibration.dto';
import * as fs from 'fs';
import * as path from 'path';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('api/calibrations')
export class CalibrationController {
  constructor(
    private readonly calibrationService: CalibrationService,
    private readonly certificateService: CertificateService,
  ) {}

  @Post()
  @RequirePermission('calibrations', 'create')
  async create(@Body() dto: CreateCalibrationDto) {
    return this.calibrationService.create(dto);
  }

  @Get('signatories')
  @RequirePermission('calibrations', 'view')
  async getSignatories(@Req() req: any, @Query('companyId') queryCompanyId?: string) {
    const isSuperAdmin = !!req?.user?.isSuperAdmin;
    const effectiveCompanyId = isSuperAdmin ? (queryCompanyId || req?.user?.companyId) : req?.user?.companyId;
    return this.calibrationService.getSignatories(effectiveCompanyId);
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
  @RequirePermission('calibrations', 'view')
  async findAll(
    @Req() req: any,
    @Query('userId') userId?: string,
    @Query('companyId') companyId?: string,
    @Query('instrumentId') instrumentId?: string,
    @Query('calibrationType') calibrationType?: string,
    @Query('verdict') verdict?: string,
    @Query('pendingCertsOnly') pendingCertsOnly?: string,
    @Query('approvalStatus') approvalStatus?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('latestOnly') latestOnly?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
  ) {
    const isSuperAdmin = !!req?.user?.isSuperAdmin;
    const effectiveCompanyId = isSuperAdmin ? (companyId || req?.user?.companyId) : req?.user?.companyId;
    const effectiveUserId = isSuperAdmin ? (userId || req?.user?.userId || req?.user?.id) : (req?.user?.userId || req?.user?.id);

    return this.calibrationService.findAll({
      userId: effectiveUserId,
      companyId: effectiveCompanyId,
      instrumentId,
      calibrationType,
      verdict,
      pendingCertsOnly,
      approvalStatus,
      dateFrom,
      dateTo,
      search,
      latestOnly,
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
    });
  }

  @Post(':id/review')
  @RequirePermission('calibration_approvals', 'edit')
  async review(
    @Param('id') id: string,
    @Body()
    body: {
      reviewerId?: string;
      reviewerName?: string;
      reviewerDesignation?: string;
      signature?: string;
      remarks?: string;
    },
    @Req() req: any,
  ) {
    const reviewerId = body.reviewerId || req?.user?.userId || req?.user?.id;
    const reviewerName = body.reviewerName || req?.user?.name || 'Reviewer';
    const reviewerDesignation = body.reviewerDesignation || 'Calibration Reviewer';

    return this.calibrationService.review(
      id,
      { id: reviewerId, name: reviewerName, designation: reviewerDesignation },
      body.signature,
      body.remarks,
    );
  }

  @Post(':id/approve')
  @RequirePermission('calibration_approvals', 'edit')
  async approve(
    @Param('id') id: string,
    @Body()
    body: {
      approverId?: string;
      reviewerId?: string;
      approverName?: string;
      reviewerName?: string;
      approverDesignation?: string;
      reviewerDesignation?: string;
      signature?: string;
      remarks?: string;
      approverRemarks?: string;
    },
    @Req() req: any,
  ) {
    const approverId = body.approverId || body.reviewerId || req?.user?.userId || req?.user?.id;
    const approverName = body.approverName || body.reviewerName || req?.user?.name || 'Approver';
    const approverDesignation = body.approverDesignation || body.reviewerDesignation || 'Quality Manager / Approver';
    const remarks = body.approverRemarks || body.remarks;

    return this.calibrationService.approve(
      id,
      { id: approverId, name: approverName, designation: approverDesignation },
      body.signature,
      remarks,
    );
  }

  @Post(':id/reject')
  @RequirePermission('calibration_approvals', 'edit')
  async reject(
    @Param('id') id: string,
    @Body()
    body: {
      reviewerId?: string;
      userId?: string;
      reviewerName?: string;
      userName?: string;
      rejectionReason: string;
    },
    @Req() req: any,
  ) {
    const userId = body.reviewerId || body.userId || req?.user?.userId || req?.user?.id;
    const userName = body.reviewerName || body.userName || req?.user?.name || 'Reviewer / Approver';

    return this.calibrationService.reject(
      id,
      { id: userId, name: userName },
      body.rejectionReason,
    );
  }

  @Get('stats/:userId')
  @RequirePermission('calibrations', 'view')
  async getStats(@Param('userId') userId: string) {
    return this.calibrationService.getStats(userId);
  }

  @Get('next-numbers/:userId')
  @RequirePermission('calibrations', 'create')
  async getNextNumbers(
    @Param('userId') userId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.calibrationService.getNextNumbers(userId, companyId);
  }

  @Get('instrument/:instrumentId')
  @RequirePermission('calibrations', 'view')
  async findByInstrument(@Param('instrumentId') instrumentId: string) {
    return this.calibrationService.findByInstrument(instrumentId);
  }

  @Get(':id')
  @RequirePermission('calibrations', 'view')
  async findOne(@Param('id') id: string) {
    return this.calibrationService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('calibrations', 'edit')
  async update(
    @Param('id') id: string,
    @Body() body: { dto: any; editedByUserId?: string; editedByName?: string },
  ) {
    const dto = body.dto || body;
    return this.calibrationService.update(
      id,
      dto,
      body.editedByUserId,
      body.editedByName,
    );
  }

  @Get(':id/audit-logs')
  @RequirePermission('calibrations', 'view')
  async getAuditLogs(@Param('id') id: string) {
    return this.calibrationService.getAuditLogs(id);
  }

  @Get(':id/resequence-preview')
  @RequirePermission('calibrations', 'delete')
  async getResequencePreview(@Param('id') id: string) {
    return this.calibrationService.getResequencePreview(id);
  }

  @Delete(':id')
  @RequirePermission('calibrations', 'delete')
  async remove(
    @Param('id') id: string,
    @Query('resequence') resequence?: string,
  ) {
    const shouldResequence = resequence === 'true' || resequence === '1';
    return this.calibrationService.remove(id, shouldResequence);
  }

  /**
   * Generate and download a calibration certificate PDF.
   * ULR gate: if calibration.ulr_enabled is false and no ulr_number, return 403.
   */
  @Post(':id/certificate')
  @RequirePermission('calibrations', 'view')
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
  @RequirePermission('calibrations', 'view')
  async downloadCertificate(
    @Param('id') id: string,
    @Query('templateId') templateId?: string,
    @Res() res?: any,
  ) {
    const calibration = await this.calibrationService.findOne(id);
    if (!calibration) {
      return res.status(404).json({ error: 'Calibration not found.' });
    }

    const userId = calibration.created_by?.id;
    const pdfBuffer = await this.certificateService.generateCertificate(
      calibration,
      userId,
      templateId,
    );

    const uploadsDir = path.join(process.cwd(), 'uploads', 'certificates');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const certNumSafe = (calibration.certificate_number || 'CERT').replace(/[\/\\]/g, '-');
    const fileName = `Certificate-${certNumSafe}.pdf`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    const fileUrl = `/uploads/certificates/${fileName}`;
    await this.calibrationService.markCertificateGenerated(id, fileUrl);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }
}
