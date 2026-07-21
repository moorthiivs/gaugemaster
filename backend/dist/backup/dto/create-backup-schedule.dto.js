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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBackupScheduleDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateBackupScheduleDto {
    companyId;
    enabled;
    frequency;
    timeOfDay;
    dayOfWeek;
    dayOfMonth;
    retentionDays;
    storageType;
}
exports.CreateBackupScheduleDto = CreateBackupScheduleDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBackupScheduleDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateBackupScheduleDto.prototype, "enabled", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['daily', 'weekly', 'monthly'] }),
    (0, class_validator_1.IsIn)(['daily', 'weekly', 'monthly']),
    __metadata("design:type", String)
], CreateBackupScheduleDto.prototype, "frequency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: '02:00', description: 'Time in HH:mm 24h format' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBackupScheduleDto.prototype, "timeOfDay", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '0=Sun..6=Sat, required for weekly' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(6),
    __metadata("design:type", Number)
], CreateBackupScheduleDto.prototype, "dayOfWeek", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '1..28, required for monthly' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(28),
    __metadata("design:type", Number)
], CreateBackupScheduleDto.prototype, "dayOfMonth", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 7, description: 'Auto-delete backups older than N days' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(365),
    __metadata("design:type", Number)
], CreateBackupScheduleDto.prototype, "retentionDays", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'local', enum: ['local', 'google_drive'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['local', 'google_drive']),
    __metadata("design:type", String)
], CreateBackupScheduleDto.prototype, "storageType", void 0);
//# sourceMappingURL=create-backup-schedule.dto.js.map