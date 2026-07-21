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
exports.UploadJobsController = void 0;
const common_1 = require("@nestjs/common");
const upload_jobs_service_1 = require("./upload-jobs.service");
let UploadJobsController = class UploadJobsController {
    uploadJobsService;
    constructor(uploadJobsService) {
        this.uploadJobsService = uploadJobsService;
    }
    async startBackgroundUpload(companyId, body) {
        return await this.uploadJobsService.startBackgroundUpload(companyId, body.fileName, body.instruments, body.userId);
    }
    async getJobStatus(id) {
        return await this.uploadJobsService.getJob(id);
    }
    async getCompanyJobs(companyId) {
        return await this.uploadJobsService.getJobsByCompany(companyId);
    }
    async cancelJob(id) {
        return await this.uploadJobsService.cancelJob(id);
    }
};
exports.UploadJobsController = UploadJobsController;
__decorate([
    (0, common_1.Post)('start'),
    __param(0, (0, common_1.Query)('companyId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UploadJobsController.prototype, "startBackgroundUpload", null);
__decorate([
    (0, common_1.Get)('status/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UploadJobsController.prototype, "getJobStatus", null);
__decorate([
    (0, common_1.Get)('company/:companyId'),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UploadJobsController.prototype, "getCompanyJobs", null);
__decorate([
    (0, common_1.Post)('cancel/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UploadJobsController.prototype, "cancelJob", null);
exports.UploadJobsController = UploadJobsController = __decorate([
    (0, common_1.Controller)('api/upload-jobs'),
    __metadata("design:paramtypes", [upload_jobs_service_1.UploadJobsService])
], UploadJobsController);
//# sourceMappingURL=upload-jobs.controller.js.map