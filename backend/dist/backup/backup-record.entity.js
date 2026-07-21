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
exports.BackupRecord = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
let BackupRecord = class BackupRecord {
    id = (0, uuid_1.v4)();
    companyId;
    triggeredBy;
    type;
    status;
    fileName;
    fileSizeBytes;
    storageType;
    storagePath;
    errorMessage;
    createdAt;
    completedAt;
};
exports.BackupRecord = BackupRecord;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], BackupRecord.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], BackupRecord.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], BackupRecord.prototype, "triggeredBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], BackupRecord.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], BackupRecord.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], BackupRecord.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', nullable: true }),
    __metadata("design:type", Number)
], BackupRecord.prototype, "fileSizeBytes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'local' }),
    __metadata("design:type", String)
], BackupRecord.prototype, "storageType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], BackupRecord.prototype, "storagePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], BackupRecord.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], BackupRecord.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'timestamptz' }),
    __metadata("design:type", Date)
], BackupRecord.prototype, "completedAt", void 0);
exports.BackupRecord = BackupRecord = __decorate([
    (0, typeorm_1.Entity)('backup_records')
], BackupRecord);
//# sourceMappingURL=backup-record.entity.js.map