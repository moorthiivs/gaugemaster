"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const backup_controller_1 = require("./backup.controller");
const backup_service_1 = require("./backup.service");
const google_drive_service_1 = require("./google-drive.service");
const backup_record_entity_1 = require("./backup-record.entity");
const backup_schedule_entity_1 = require("./backup-schedule.entity");
const drive_token_entity_1 = require("./drive-token.entity");
let BackupModule = class BackupModule {
};
exports.BackupModule = BackupModule;
exports.BackupModule = BackupModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            typeorm_1.TypeOrmModule.forFeature([backup_record_entity_1.BackupRecord, backup_schedule_entity_1.BackupSchedule, drive_token_entity_1.DriveToken]),
        ],
        controllers: [backup_controller_1.BackupController],
        providers: [backup_service_1.BackupService, google_drive_service_1.GoogleDriveService],
        exports: [backup_service_1.BackupService, google_drive_service_1.GoogleDriveService],
    })
], BackupModule);
//# sourceMappingURL=backup.module.js.map