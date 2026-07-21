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
exports.BackupSchedule = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
let BackupSchedule = class BackupSchedule {
    id = (0, uuid_1.v4)();
    companyId;
    enabled;
    frequency;
    timeOfDay;
    dayOfWeek;
    dayOfMonth;
    retentionDays;
    storageType;
    createdAt;
    updatedAt;
};
exports.BackupSchedule = BackupSchedule;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], BackupSchedule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], BackupSchedule.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], BackupSchedule.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], BackupSchedule.prototype, "frequency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: '02:00' }),
    __metadata("design:type", String)
], BackupSchedule.prototype, "timeOfDay", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], BackupSchedule.prototype, "dayOfWeek", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], BackupSchedule.prototype, "dayOfMonth", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 7 }),
    __metadata("design:type", Number)
], BackupSchedule.prototype, "retentionDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'local' }),
    __metadata("design:type", String)
], BackupSchedule.prototype, "storageType", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], BackupSchedule.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], BackupSchedule.prototype, "updatedAt", void 0);
exports.BackupSchedule = BackupSchedule = __decorate([
    (0, typeorm_1.Entity)('backup_schedules')
], BackupSchedule);
//# sourceMappingURL=backup-schedule.entity.js.map