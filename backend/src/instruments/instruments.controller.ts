import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { InstrumentsService } from './instruments.service';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from '../dto/update-instrument.dto';
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
    ) {
        const pageNumber = parseInt(page, 10);
        const limit = parseInt(pageSize, 10);

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
            createdBy,
            companyId,
            sortBy,
            sortOrder,
        });
    }

    @Get('filters/:createdById')
    async getFilterParams(@Param('createdById') createdById: string) {
        return this.instrumentsService.findFilterParams(createdById);
    }


    @Get(':id/history')
    async getHistory(@Param('id') id: string) {
        return this.instrumentsService.getHistory(id);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.instrumentsService.findOne(id);
    }

    @Post()
    @RequirePermission('instruments', 'create')
    create(@Body() createInstrumentDto: CreateInstrumentDto) {
        return this.instrumentsService.create(createInstrumentDto);
    }

    @Patch(':id')
    @RequirePermission('instruments', 'edit')
    update(
        @Param('id') id: string,
        @Body() updateInstrumentDto: UpdateInstrumentDto
    ) {
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
    async uploadCertificate(@Param('id') id: string, @UploadedFile() file: any) {
        let fileUrl = `/uploads/certificates/${file.filename}`;
        
        await this.instrumentsService.update(id, { 
            certificate_file: fileUrl,
            calibration_source: 'External' 
        });
        return { message: "Certificate uploaded successfully", url: fileUrl };
    }

    // Google Sheets integration removed based on user request

    @Post('backfill-sino')
    async backfillSino() {
        return this.instrumentsService.backfillSino();
    }

    @Post('bulk-upload')
    @RequirePermission('instruments', 'create')
    async bulkUpload(@Body() dto: CreateInstrumentDto | CreateInstrumentDto[]) {
        const dataArray = Array.isArray(dto) ? dto : [dto];
        return this.instrumentsService.bulkUpload(dataArray);
    }


    @Post('send-calibration-agency')
    async sendCalibagency(@Body() data: any) {
        return this.instrumentsService.sendCalibagency(data);
    }


    @Get('calendar-due/:userId')
    async getCalendarDue(
        @Param('userId') userId: string,
        @Query('year') year: string,
        @Query('month') month: string,
        @Query('is_reference_standard') isReferenceStandard?: string,
        @Query('item_status') itemStatus?: string,
        @Query('location') location?: string,
    ) {
        const y = parseInt(year, 10) || new Date().getFullYear();
        const m = parseInt(month, 10) || new Date().getMonth() + 1;
        return this.instrumentsService.getCalendarDue(userId, y, m, {
            isReferenceStandard,
            itemStatus,
            location,
        });
    }

    @Delete(':id')
    @RequirePermission('instruments', 'delete')
    async remove(@Param('id') id: string) {
        return this.instrumentsService.remove(id);
    }

    @Post('bulk-delete')
    @RequirePermission('instruments', 'delete')
    async bulkRemove(@Body('ids') ids: string[]) {
        return this.instrumentsService.bulkRemove(ids);
    }

}
