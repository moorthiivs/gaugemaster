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
exports.Setting = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
let Setting = class Setting {
    id = (0, uuid_1.v4)();
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
};
exports.Setting = Setting;
__decorate([
    (0, typeorm_1.PrimaryColumn)("uuid"),
    __metadata("design:type", String)
], Setting.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid" }),
    __metadata("design:type", String)
], Setting.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid" }),
    __metadata("design:type", String)
], Setting.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Setting.prototype, "smtpConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50, default: "normal", nullable: true }),
    __metadata("design:type", String)
], Setting.prototype, "reminderFrequency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", default: () => "'[]'", nullable: true }),
    __metadata("design:type", Array)
], Setting.prototype, "juniorRecipients", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", default: () => "'[]'", nullable: true }),
    __metadata("design:type", Array)
], Setting.prototype, "seniorRecipients", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", default: () => "'[]'", nullable: true }),
    __metadata("design:type", Array)
], Setting.prototype, "supervisorRecipients", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Setting.prototype, "themeSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Setting.prototype, "reportConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Setting.prototype, "certificateConfig", void 0);
exports.Setting = Setting = __decorate([
    (0, typeorm_1.Entity)({ name: "settings" })
], Setting);
//# sourceMappingURL=setting.entity.js.map