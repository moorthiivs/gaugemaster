"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadJobsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const upload_job_entity_1 = require("./upload-job.entity");
const upload_jobs_service_1 = require("./upload-jobs.service");
const upload_jobs_controller_1 = require("./upload-jobs.controller");
const instruments_module_1 = require("../instruments/instruments.module");
let UploadJobsModule = class UploadJobsModule {
};
exports.UploadJobsModule = UploadJobsModule;
exports.UploadJobsModule = UploadJobsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([upload_job_entity_1.UploadJob]), instruments_module_1.InstrumentsModule],
        controllers: [upload_jobs_controller_1.UploadJobsController],
        providers: [upload_jobs_service_1.UploadJobsService],
        exports: [upload_jobs_service_1.UploadJobsService],
    })
], UploadJobsModule);
//# sourceMappingURL=upload-jobs.module.js.map