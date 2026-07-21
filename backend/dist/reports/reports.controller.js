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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const reports_service_1 = require("./reports.service");
let ReportsController = class ReportsController {
    reportsService;
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    async getReport(from, to, format, userid, columns, templateId, authHeader, res) {
        let finalUserId = userid;
        if (!finalUserId || finalUserId === 'undefined') {
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                    finalUserId = payload.sub;
                }
                catch (e) {
                    console.error("Failed to decode token", e);
                }
            }
        }
        console.log("PDF Generation Request Query:", { from, to, format, userid, columns, templateId, finalUserId });
        const reportBuffer = await this.reportsService.generateReport(from, to, format, finalUserId, columns, templateId);
        const mimeType = format === 'html' ? 'text/html' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        if (format !== 'html') {
            res.set({
                'Content-Type': mimeType,
                'Content-Disposition': `attachment; filename=report_${from}_${to}.${format}`,
            });
        }
        else {
            res.set({ 'Content-Type': mimeType });
        }
        res.send(reportBuffer);
    }
    async getPreview(from, to, userid, page = '1', pageSize = '10', name, id_code, location, agency, status) {
        const p = parseInt(page, 10) || 1;
        const ps = parseInt(pageSize, 10) || 10;
        const filters = { name, id_code, location, agency, status };
        return this.reportsService.getReportData(from, to, userid, p, ps, filters);
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('format')),
    __param(3, (0, common_1.Query)('userid')),
    __param(4, (0, common_1.Query)('columns')),
    __param(5, (0, common_1.Query)('templateId')),
    __param(6, (0, common_1.Headers)('authorization')),
    __param(7, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getReport", null);
__decorate([
    (0, common_1.Get)('preview'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('userid')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __param(5, (0, common_1.Query)('name')),
    __param(6, (0, common_1.Query)('id_code')),
    __param(7, (0, common_1.Query)('location')),
    __param(8, (0, common_1.Query)('agency')),
    __param(9, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getPreview", null);
exports.ReportsController = ReportsController = __decorate([
    (0, common_1.Controller)('api/reports'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map