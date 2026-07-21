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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const settings_service_1 = require("./settings.service");
const create_setting_dto_1 = require("./dto/create-setting.dto");
const swagger_1 = require("@nestjs/swagger");
const mailer_service_1 = require("../mail/mailer.service");
let SettingsController = class SettingsController {
    settingsService;
    mailerService;
    constructor(settingsService, mailerService) {
        this.settingsService = settingsService;
        this.mailerService = mailerService;
    }
    saveSettings(createSettingDto) {
        return this.settingsService.create(createSettingDto);
    }
    getSettings(userId, companyId) {
        return this.settingsService.findOne(userId, companyId);
    }
    create(createSettingDto, authHeader) {
        if (!createSettingDto.userId || createSettingDto.userId === 'undefined') {
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                    createSettingDto.userId = payload.sub;
                    createSettingDto.companyId = createSettingDto.companyId || payload.companyId;
                }
                catch (e) {
                    console.error("Failed to decode token", e);
                }
            }
        }
        console.log("RECEIVED SETTINGS PAYLOAD: ", createSettingDto);
        return this.settingsService.create(createSettingDto);
    }
    fetchMailConfig(userId, companyId) {
        return this.settingsService.findOne(userId, companyId);
    }
    sendTestEmail(userId, targetEmail) {
        return this.mailerService.sendTestMail(userId, targetEmail);
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_setting_dto_1.CreateSettingDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "saveSettings", null);
__decorate([
    (0, common_1.Get)(':userId/:companyId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Post)("mailconfig"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_setting_dto_1.CreateSettingDto, String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('fetchmailconfig'),
    __param(0, (0, common_1.Query)('userId')),
    __param(1, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "fetchMailConfig", null);
__decorate([
    (0, common_1.Post)('test-email'),
    __param(0, (0, common_1.Body)('userId')),
    __param(1, (0, common_1.Body)('targetEmail')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "sendTestEmail", null);
exports.SettingsController = SettingsController = __decorate([
    (0, swagger_1.ApiTags)('api/settings'),
    (0, common_1.Controller)('api/settings'),
    __metadata("design:paramtypes", [settings_service_1.SettingsService,
        mailer_service_1.MailerService])
], SettingsController);
//# sourceMappingURL=settings.controller.js.map