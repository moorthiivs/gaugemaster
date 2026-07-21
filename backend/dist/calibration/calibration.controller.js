"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalibrationController = void 0;
const common_1 = require("@nestjs/common");
const calibration_service_1 = require("./calibration.service");
const certificate_service_1 = require("./certificate.service");
const create_calibration_dto_1 = require("./dto/create-calibration.dto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let CalibrationController = class CalibrationController {
    calibrationService;
    certificateService;
    constructor(calibrationService, certificateService) {
        this.calibrationService = calibrationService;
        this.certificateService = certificateService;
    }
    async create(dto) {
        return this.calibrationService.create(dto);
    }
    async getLatest(instrumentId) {
        return this.calibrationService.getLatestByInstrument(instrumentId);
    }
    async getAllDrafts(userId) {
        return this.calibrationService.getAllDrafts(userId);
    }
    async getDraft(id) {
        return this.calibrationService.getDraft(id);
    }
    async saveDraft(body) {
        return this.calibrationService.saveDraft(body.userId, body.data, body.draftId);
    }
    async deleteDraft(id) {
        return this.calibrationService.deleteDraft(id);
    }
    async findAll(userId, companyId, instrumentId, calibrationType, verdict, dateFrom, dateTo, page = '1', pageSize = '10') {
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
    async getStats(userId) {
        return this.calibrationService.getStats(userId);
    }
    async getNextNumbers(userId, companyId) {
        return this.calibrationService.getNextNumbers(userId, companyId);
    }
    async findByInstrument(instrumentId) {
        return this.calibrationService.findByInstrument(instrumentId);
    }
    async findOne(id) {
        return this.calibrationService.findOne(id);
    }
    async generateCertificate(id, templateId, res) {
        const calibration = await this.calibrationService.findOne(id);
        const userId = calibration.created_by?.id;
        const pdfBuffer = await this.certificateService.generateCertificate(calibration, userId, templateId);
        const uploadsDir = path.join(process.cwd(), 'uploads', 'certificates');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const fileName = `cert-${calibration.certificate_number.replace(/\//g, '-')}-${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, pdfBuffer);
        const fileUrl = `/uploads/certificates/${fileName}`;
        await this.calibrationService.markCertificateGenerated(id, fileUrl);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': pdfBuffer.length.toString(),
        });
        res.end(pdfBuffer);
    }
    async downloadCertificate(id, res) {
        const calibration = await this.calibrationService.findOne(id);
        if (!calibration.certificate_file) {
            return res
                .status(404)
                .json({ error: 'Certificate has not been generated yet.' });
        }
        const filePath = path.join(process.cwd(), calibration.certificate_file.replace(/^\//, ''));
        if (!fs.existsSync(filePath)) {
            return res
                .status(404)
                .json({ error: 'Certificate file not found on server.' });
        }
        res.download(filePath);
    }
};
exports.CalibrationController = CalibrationController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_calibration_dto_1.CreateCalibrationDto]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('latest/:instrumentId'),
    __param(0, (0, common_1.Param)('instrumentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "getLatest", null);
__decorate([
    (0, common_1.Get)('drafts/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "getAllDrafts", null);
__decorate([
    (0, common_1.Get)('draft/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "getDraft", null);
__decorate([
    (0, common_1.Post)('draft'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "saveDraft", null);
__decorate([
    (0, common_1.Delete)('draft/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "deleteDraft", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('userId')),
    __param(1, (0, common_1.Query)('companyId')),
    __param(2, (0, common_1.Query)('instrumentId')),
    __param(3, (0, common_1.Query)('calibrationType')),
    __param(4, (0, common_1.Query)('verdict')),
    __param(5, (0, common_1.Query)('dateFrom')),
    __param(6, (0, common_1.Query)('dateTo')),
    __param(7, (0, common_1.Query)('page')),
    __param(8, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('next-numbers/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "getNextNumbers", null);
__decorate([
    (0, common_1.Get)('instrument/:instrumentId'),
    __param(0, (0, common_1.Param)('instrumentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "findByInstrument", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/certificate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('templateId')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "generateCertificate", null);
__decorate([
    (0, common_1.Get)(':id/certificate/download'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CalibrationController.prototype, "downloadCertificate", null);
exports.CalibrationController = CalibrationController = __decorate([
    (0, common_1.Controller)('api/calibrations'),
    __metadata("design:paramtypes", [calibration_service_1.CalibrationService,
        certificate_service_1.CertificateService])
], CalibrationController);
//# sourceMappingURL=calibration.controller.js.map