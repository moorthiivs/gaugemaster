"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstrumentsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const instruments_service_1 = require("./instruments.service");
const create_instrument_dto_1 = require("../dto/create-instrument.dto");
const update_instrument_dto_1 = require("../dto/update-instrument.dto");
const google_drive_service_1 = require("../backup/google-drive.service");
let InstrumentsController = class InstrumentsController {
    instrumentsService;
    googleDriveService;
    constructor(instrumentsService, googleDriveService) {
        this.instrumentsService = instrumentsService;
        this.googleDriveService = googleDriveService;
    }
    async findAll(status, item_status, location, frequency, search, due_date, due_date_start, due_date_end, last_cal_start, last_cal_end, is_reference_standard, page = '1', pageSize = '10', createdBy) {
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
    async getFilterParams(createdById) {
        return this.instrumentsService.findFilterParams(createdById);
    }
    async getHistory(id) {
        return this.instrumentsService.getHistory(id);
    }
    async findOne(id) {
        return this.instrumentsService.findOne(id);
    }
    create(createInstrumentDto) {
        return this.instrumentsService.create(createInstrumentDto);
    }
    update(id, updateInstrumentDto) {
        return this.instrumentsService.update(id, updateInstrumentDto);
    }
    async uploadCertificate(id, file) {
        let fileUrl = `/uploads/certificates/${file.filename}`;
        try {
            const instrument = await this.instrumentsService.findOne(id);
            if (instrument && instrument.companyId) {
                const status = await this.googleDriveService.getConnectionStatus(instrument.companyId);
                if (status.connected) {
                    const driveUrl = await this.googleDriveService.uploadCertificate(instrument.companyId, file.path, file.originalname);
                    if (driveUrl) {
                        fileUrl = driveUrl;
                    }
                }
            }
        }
        catch (err) {
            console.error('Failed to upload certificate to Google Drive, falling back to local storage', err);
        }
        await this.instrumentsService.update(id, { certificate_file: fileUrl });
        return { message: "Certificate uploaded successfully", url: fileUrl };
    }
    async convertToGoogleSheet(id) {
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
        const localPath = path.join(process.cwd(), localUrl.replace(/^\//, ''));
        if (!fs.existsSync(localPath)) {
            throw new Error("Local certificate file not found.");
        }
        const fileName = path.basename(localPath);
        const driveUrl = await this.googleDriveService.uploadCertificate(instrument.companyId, localPath, fileName);
        if (!driveUrl) {
            throw new Error("Failed to get Google Drive URL.");
        }
        await this.instrumentsService.update(id, { certificate_file: driveUrl });
        return { success: true, url: driveUrl };
    }
    async bulkUpload(dto) {
        const dataArray = Array.isArray(dto) ? dto : [dto];
        return this.instrumentsService.bulkUpload(dataArray);
    }
    async sendCalibagency(data) {
        return this.instrumentsService.sendCalibagency(data);
    }
    async getCalendarDue(userId, year, month) {
        const y = parseInt(year, 10) || new Date().getFullYear();
        const m = parseInt(month, 10) || new Date().getMonth() + 1;
        return this.instrumentsService.getCalendarDue(userId, y, m);
    }
    async remove(id) {
        return this.instrumentsService.remove(id);
    }
    async bulkRemove(ids) {
        return this.instrumentsService.bulkRemove(ids);
    }
};
exports.InstrumentsController = InstrumentsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('item_status')),
    __param(2, (0, common_1.Query)('location')),
    __param(3, (0, common_1.Query)('frequency')),
    __param(4, (0, common_1.Query)('search')),
    __param(5, (0, common_1.Query)('due_date')),
    __param(6, (0, common_1.Query)('due_date_start')),
    __param(7, (0, common_1.Query)('due_date_end')),
    __param(8, (0, common_1.Query)('last_cal_start')),
    __param(9, (0, common_1.Query)('last_cal_end')),
    __param(10, (0, common_1.Query)('is_reference_standard')),
    __param(11, (0, common_1.Query)('page')),
    __param(12, (0, common_1.Query)('pageSize')),
    __param(13, (0, common_1.Query)('createdBy')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('filters/:createdById'),
    __param(0, (0, common_1.Param)('createdById')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "getFilterParams", null);
__decorate([
    (0, common_1.Get)(':id/history'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_instrument_dto_1.CreateInstrumentDto]),
    __metadata("design:returntype", void 0)
], InstrumentsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_instrument_dto_1.UpdateInstrumentDto]),
    __metadata("design:returntype", void 0)
], InstrumentsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/certificate'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: './uploads/certificates',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, file.fieldname + '-' + uniqueSuffix + (0, path_1.extname)(file.originalname));
            }
        }),
        fileFilter: (req, file, cb) => {
            if (file.mimetype.match(/\/(jpg|jpeg|png|gif|pdf|csv|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/) || file.originalname.match(/\.(xls|xlsx|csv)$/)) {
                cb(null, true);
            }
            else {
                cb(new Error('Unsupported file format'), false);
            }
        }
    })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "uploadCertificate", null);
__decorate([
    (0, common_1.Post)(':id/google-sheet/convert'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "convertToGoogleSheet", null);
__decorate([
    (0, common_1.Post)('bulk-upload'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "bulkUpload", null);
__decorate([
    (0, common_1.Post)('send-calibration-agency'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "sendCalibagency", null);
__decorate([
    (0, common_1.Get)('calendar-due/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)('year')),
    __param(2, (0, common_1.Query)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "getCalendarDue", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('bulk-delete'),
    __param(0, (0, common_1.Body)('ids')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "bulkRemove", null);
exports.InstrumentsController = InstrumentsController = __decorate([
    (0, common_1.Controller)('api/instruments'),
    __metadata("design:paramtypes", [instruments_service_1.InstrumentsService,
        google_drive_service_1.GoogleDriveService])
], InstrumentsController);
//# sourceMappingURL=instruments.controller.js.map