import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { InstrumentsService } from './instruments.service';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from '../dto/update-instrument.dto';
import { BulkUpdatePreviewDto, BulkUpdateExecuteDto } from '../dto/bulk-update.dto';
import { GoogleDriveService } from '../backup/google-drive.service';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('api/instruments')
export class InstrumentsController {
    constructor(
        private readonly instrumentsService: InstrumentsService,
        private readonly googleDriveService: GoogleDriveService
    ) { }


    @Get()
    @RequirePermission('instruments', 'view')
    async findAll(
        @Query('status') status?: string,
        @Query('item_status') item_status?: string,
        @Query('location') location?: string,
        @Query('frequency') frequency?: string,
        @Query('calibration_source') calibration_source?: string,
        @Query('module') module?: string,
        @Query('exclude_modules') exclude_modules?: string,
        @Query('search') search?: string,
        @Query('due_date') due_date?: string,
        @Query('due_date_start') due_date_start?: string,
        @Query('due_date_end') due_date_end?: string,
        @Query('last_cal_start') last_cal_start?: string,
        @Query('last_cal_end') last_cal_end?: string,
        @Query('calibrated_in_range_start') calibrated_in_range_start?: string,
        @Query('calibrated_in_range_end') calibrated_in_range_end?: string,
        @Query('is_reference_standard') is_reference_standard?: string,
        @Query('device_type') device_type?: string,
        @Query('page') page: string = '1',
        @Query('pageSize') pageSize: string = '10',
        @Query('createdBy') createdBy?: string,
        @Query('companyId') companyId?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
        @Req() req?: any,
    ) {
        const pageNumber = parseInt(page, 10);
        const limit = parseInt(pageSize, 10);
        const isSuperAdmin = !!req?.user?.isSuperAdmin;
        const effectiveCompanyId = isSuperAdmin ? (companyId || req?.user?.companyId) : req?.user?.companyId;
        const effectiveCreatedBy = isSuperAdmin ? (createdBy || req?.user?.id) : req?.user?.id;

        return this.instrumentsService.findAll({
            status,
            item_status,
            location,
            frequency,
            calibration_source,
            module,
            exclude_modules,
            search,
            due_date,
            due_date_start,
            due_date_end,
            last_cal_start,
            last_cal_end,
            calibrated_in_range_start,
            calibrated_in_range_end,
            is_reference_standard,
            device_type,
            page: pageNumber,
            pageSize: limit,
            createdBy: effectiveCreatedBy,
            companyId: effectiveCompanyId,
            sortBy,
            sortOrder,
        });
    }

    @Get('filters/:createdById')
    @RequirePermission('instruments', 'view')
    async getFilterParams(
        @Param('createdById') createdById: string,
        @Query('companyId') companyId?: string,
        @Req() req?: any,
    ) {
        const isSuperAdmin = !!req?.user?.isSuperAdmin;
        const effectiveCompanyId = isSuperAdmin ? (companyId || req?.user?.companyId) : req?.user?.companyId;
        return this.instrumentsService.findFilterParams(createdById, effectiveCompanyId);
    }


    @Get(':id/history')
    @RequirePermission('instruments', 'view')
    async getHistory(@Param('id') id: string) {
        return this.instrumentsService.getHistory(id);
    }

    @Delete(':id/history/:historyId')
    @RequirePermission('instruments', 'delete')
    async deleteHistory(
        @Param('id') id: string,
        @Param('historyId') historyId: string,
    ) {
        return this.instrumentsService.deleteHistoryRecord(id, historyId);
    }

    @Get(':id')
    @RequirePermission('instruments', 'view')
    async findOne(@Param('id') id: string, @Req() req: any) {
        const inst = await this.instrumentsService.findOne(id);
        const user = req.user || {};
        if (!user.isSuperAdmin && inst.companyId && user.companyId && inst.companyId !== user.companyId) {
            throw new ForbiddenException('Access denied to instrument outside your company');
        }
        return inst;
    }

    @Post()
    @RequirePermission('instruments', 'create')
    create(@Body() createInstrumentDto: CreateInstrumentDto, @Req() req: any) {
        const user = req.user || {};
        if (!user.isSuperAdmin && user.companyId) {
            createInstrumentDto.companyId = user.companyId;
        }
        return this.instrumentsService.create(createInstrumentDto);
    }

    @Patch(':id')
    @Put(':id')
    @RequirePermission('instruments', 'edit')
    async update(
        @Param('id') id: string,
        @Body() updateInstrumentDto: UpdateInstrumentDto,
        @Req() req: any,
    ) {
        const inst = await this.instrumentsService.findOne(id);
        const user = req.user || {};
        if (!user.isSuperAdmin && inst.companyId && user.companyId && inst.companyId !== user.companyId) {
            throw new ForbiddenException('Cannot modify instrument outside your company');
        }
        return this.instrumentsService.update(id, updateInstrumentDto);
    }

    @Post(':id/certificate')
    @RequirePermission('instruments', 'edit')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/certificates',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
            }
        }),
        fileFilter: (req, file, cb) => {
            if (file.mimetype.match(/\/(jpg|jpeg|png|gif|pdf|csv|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/) || file.originalname.match(/\.(xls|xlsx|csv)$/)) {
                cb(null, true);
            } else {
                cb(new Error('Unsupported file format'), false);
            }
        }
    }))
    async uploadCertificate(@Param('id') id: string, @UploadedFile() file: any, @Req() req: any) {
        const inst = await this.instrumentsService.findOne(id);
        const user = req.user || {};
        if (!user.isSuperAdmin && inst.companyId && user.companyId && inst.companyId !== user.companyId) {
            throw new ForbiddenException('Cannot upload certificate for instrument outside your company');
        }
        let fileUrl = `/uploads/certificates/${file.filename}`;
        
        await this.instrumentsService.update(id, { 
            certificate_file: fileUrl,
        });
        return { message: "Certificate uploaded successfully", url: fileUrl };
    }

    // Google Sheets integration removed based on user request

    @Post('backfill-sino')
    @RequirePermission('settings', 'edit')
    async backfillSino() {
        return this.instrumentsService.backfillSino();
    }

    @Post('bulk-upload')
    @RequirePermission('instruments', 'create')
    async bulkUpload(
        @Body() dto: CreateInstrumentDto | CreateInstrumentDto[],
        @Req() req: any,
    ) {
        const dataArray = Array.isArray(dto) ? dto : [dto];
        const user = req.user || {};
        if (!user.isSuperAdmin && user.companyId) {
            for (const item of dataArray) {
                item.companyId = user.companyId;
            }
        }
        return this.instrumentsService.bulkUpload(dataArray);
    }

    @Post('bulk-update-preview')
    @RequirePermission('instruments', 'edit')
    async bulkUpdatePreview(
        @Body() dto: BulkUpdatePreviewDto,
        @Req() req: any,
    ) {
        return this.instrumentsService.bulkUpdatePreview(dto, req?.user);
    }

    @Post('bulk-update')
    @RequirePermission('instruments', 'edit')
    async bulkUpdate(
        @Body() dto: BulkUpdateExecuteDto,
        @Req() req: any,
    ) {
        return this.instrumentsService.bulkUpdateExecute(dto, req?.user);
    }


    @Post('send-calibration-agency')
    async sendCalibagency(@Body() data: any) {
        return this.instrumentsService.sendCalibagency(data);
    }


    @Get('calendar-due/:userId')
    @RequirePermission('calibration_schedule', 'view')
    async getCalendarDue(
        @Param('userId') userId: string,
        @Query('year') year: string,
        @Query('month') month: string,
        @Query('is_reference_standard') isReferenceStandard?: string,
        @Query('item_status') itemStatus?: string,
        @Query('location') location?: string,
        @Query('companyId') companyId?: string,
        @Req() req?: any,
    ) {
        const isSuperAdmin = !!req?.user?.isSuperAdmin;
        const effectiveCompanyId = isSuperAdmin ? (companyId || req?.user?.companyId) : req?.user?.companyId;
        const y = parseInt(year, 10) || new Date().getFullYear();
        const m = parseInt(month, 10) || new Date().getMonth() + 1;
        return this.instrumentsService.getCalendarDue(userId, y, m, {
            isReferenceStandard,
            itemStatus,
            location,
            companyId: effectiveCompanyId,
        });
    }

    @Delete(':id')
    @RequirePermission('instruments', 'delete')
    async remove(
        @Param('id') id: string,
        @Req() req: any,
        @Query('reason') queryReason?: string,
        @Body('reason') bodyReason?: string,
    ) {
        const reason = bodyReason || queryReason;
        return this.instrumentsService.remove(id, req.user, reason);
    }

    @Post('bulk-delete')
    @RequirePermission('instruments', 'delete')
    async bulkRemove(
        @Req() req: any,
        @Body('ids') ids: string[],
        @Body('reason') reason?: string,
    ) {
        return this.instrumentsService.bulkRemove(ids, req.user, reason);
    }

}
