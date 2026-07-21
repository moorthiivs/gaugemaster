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
exports.CreateSettingDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class SmtpConfigDto {
    host;
    port;
    user;
    pass;
    secure;
    fromEmail;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'smtp.gmail.com' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SmtpConfigDto.prototype, "host", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 465 }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SmtpConfigDto.prototype, "port", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'user@gmail.com' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SmtpConfigDto.prototype, "user", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'password123' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SmtpConfigDto.prototype, "pass", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SmtpConfigDto.prototype, "secure", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'noreply@company.com' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], SmtpConfigDto.prototype, "fromEmail", void 0);
class CreateSettingDto {
    userId;
    companyId;
    smtpConfig;
    reminderFrequency;
    juniorRecipients;
    seniorRecipients;
    supervisorRecipients;
    themeSettings;
    reportConfig;
    certificateConfig;
}
exports.CreateSettingDto = CreateSettingDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the user who owns this settings', example: 'uuid-of-user' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSettingDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the company this settings belongs to', example: 'uuid-of-company' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSettingDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'SMTP configuration', type: SmtpConfigDto, required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => SmtpConfigDto),
    __metadata("design:type", SmtpConfigDto)
], CreateSettingDto.prototype, "smtpConfig", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Reminder frequency: normal / important / critical', example: 'normal', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSettingDto.prototype, "reminderFrequency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Calibration Junior/Engineer recipients', example: ['junior1@example.com'], required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEmail)({}, { each: true }),
    __metadata("design:type", Array)
], CreateSettingDto.prototype, "juniorRecipients", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Calibration Senior recipients', example: ['senior@example.com'], required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEmail)({}, { each: true }),
    __metadata("design:type", Array)
], CreateSettingDto.prototype, "seniorRecipients", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Supervisor recipients', example: ['supervisor@example.com'], required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEmail)({}, { each: true }),
    __metadata("design:type", Array)
], CreateSettingDto.prototype, "supervisorRecipients", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Theme settings', required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateSettingDto.prototype, "themeSettings", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Report Format settings', required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateSettingDto.prototype, "reportConfig", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Certificate Number & ULR configuration', required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateSettingDto.prototype, "certificateConfig", void 0);
//# sourceMappingURL=create-setting.dto.js.map