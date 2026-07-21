import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { InstrumentsService } from './instruments.service';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from '../dto/update-instrument.dto';
import { GoogleDriveService } from '../backup/google-drive.service';

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
        @Query('search') search?: string,
        @Query('due_date') due_date?: string,
        @Query('due_date_start') due_date_start?: string,
        @Query('due_date_end') due_date_end?: string,
        @Query('last_cal_start') last_cal_start?: string,
        @Query('last_cal_end') last_cal_end?: string,
        @Query('is_reference_standard') is_reference_standard?: string,
        @Query('page') page: string = '1',
        @Query('pageSize') pageSize: string = '10',
        @Query('createdBy') createdBy?: string
    ) {
        const pageNumber = parseInt(page, 10);
        const limit = parseInt(pageSize, 10);

        return this.instrumentsService.findAll({
            status,
            item_status,
            location,
            frequency,
            search,
            due_date,
            due_date_start,
            due_date_end,
            last_cal_start,
            last_cal_end,
            is_reference_standard,
            page: pageNumber,
            pageSize: limit,
            createdBy
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
    create(@Body() createInstrumentDto: CreateInstrumentDto) {
        return this.instrumentsService.create(createInstrumentDto);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateInstrumentDto: UpdateInstrumentDto
    ) {
        return this.instrumentsService.update(id, updateInstrumentDto);
    }

    @Post(':id/certificate')
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
        
        try {
            const instrument = await this.instrumentsService.findOne(id);
            if (instrument && instrument.companyId) {
                // Try to upload to Google Drive if connected
                const status = await this.googleDriveService.getConnectionStatus(instrument.companyId);
                if (status.connected) {
                    const driveUrl = await this.googleDriveService.uploadCertificate(
                        instrument.companyId,
                        file.path,
                        file.originalname
                    );
                    if (driveUrl) {
                        fileUrl = driveUrl; // use Google Sheets link instead of local file
                    }
                }
            }
        } catch (err) {
            console.error('Failed to upload certificate to Google Drive, falling back to local storage', err);
        }

        await this.instrumentsService.update(id, { certificate_file: fileUrl });
        return { message: "Certificate uploaded successfully", url: fileUrl };
    }

    @Post(':id/google-sheet/convert')
    async convertToGoogleSheet(@Param('id') id: string) {
        const instrument = await this.instrumentsService.findOne(id);
        if (!instrument || !instrument.companyId) {
            throw new Error("Instrument or Company not found");
        }

        const status = await this.googleDriveService.getConnectionStatus(instrument.companyId);
        if (!status.connected) {
            throw new Error("Google Drive is not connected in Settings. Please connect it first.");
        }

        const localUrl = instrument.certificate_file;
        if (!localUrl || !localUrl.match(/\.(xlsx|xls)$/i)) {
            throw new Error("Certificate is not a local Excel file.");
        }

        const path = require('path');
        const fs = require('fs');
        
        // Remove leading slash and resolve path
        const localPath = path.join(process.cwd(), localUrl.replace(/^\//, ''));
        if (!fs.existsSync(localPath)) {
            throw new Error("Local certificate file not found.");
        }

        const fileName = path.basename(localPath);
        
        // Upload to Drive
        const driveUrl = await this.googleDriveService.uploadCertificate(instrument.companyId, localPath, fileName);
        
        if (!driveUrl) {
            throw new Error("Failed to get Google Drive URL.");
        }

        // Update instrument
        await this.instrumentsService.update(id, { certificate_file: driveUrl });

        return { success: true, url: driveUrl };
    }

    @Post('bulk-upload')
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
    ) {
        const y = parseInt(year, 10) || new Date().getFullYear();
        const m = parseInt(month, 10) || new Date().getMonth() + 1;
        return this.instrumentsService.getCalendarDue(userId, y, m);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.instrumentsService.remove(id);
    }

    @Post('bulk-delete')
    async bulkRemove(@Body('ids') ids: string[]) {
        return this.instrumentsService.bulkRemove(ids);
    }

}
