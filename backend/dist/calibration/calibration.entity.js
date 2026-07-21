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
exports.Calibration = void 0;
const company_entity_1 = require("../company/entities/company.entity");
const instrument_entity_1 = require("../instruments/instrument.entity");
const user_entity_1 = require("../users/user.entity");
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
let Calibration = class Calibration {
    id = (0, uuid_1.v4)();
    instrument;
    instrument_id;
    calibration_date;
    calibration_type;
    reference_standard_name;
    reference_standard_id;
    reference_standard_traceable_to;
    reference_standard_validity;
    reference_standard_range;
    reference_standard_least_count;
    reference_standards;
    environmental_conditions;
    calibration_points;
    uncertainty;
    verdict;
    remarks;
    calibrated_by;
    calibrated_by_designation;
    reviewed_by;
    reviewed_by_designation;
    approved_by;
    approved_by_designation;
    certificate_number;
    ulr_number;
    ulr_enabled;
    certificate_generated;
    certificate_file;
    next_calibration_date;
    company;
    companyId;
    created_by;
    created_at;
    updated_at;
};
exports.Calibration = Calibration;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], Calibration.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => instrument_entity_1.Instrument, { eager: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'instrument_id' }),
    __metadata("design:type", instrument_entity_1.Instrument)
], Calibration.prototype, "instrument", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "instrument_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], Calibration.prototype, "calibration_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "calibration_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "reference_standard_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "reference_standard_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "reference_standard_traceable_to", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Calibration.prototype, "reference_standard_validity", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "reference_standard_range", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "reference_standard_least_count", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], Calibration.prototype, "reference_standards", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Calibration.prototype, "environmental_conditions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], Calibration.prototype, "calibration_points", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "uncertainty", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "verdict", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "calibrated_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "calibrated_by_designation", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "reviewed_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "reviewed_by_designation", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "approved_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "approved_by_designation", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "certificate_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "ulr_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Calibration.prototype, "ulr_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Calibration.prototype, "certificate_generated", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "certificate_file", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Calibration.prototype, "next_calibration_date", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => company_entity_1.Company, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'companyId' }),
    __metadata("design:type", company_entity_1.Company)
], Calibration.prototype, "company", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Calibration.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'created_by' }),
    __metadata("design:type", user_entity_1.User)
], Calibration.prototype, "created_by", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Calibration.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Calibration.prototype, "updated_at", void 0);
exports.Calibration = Calibration = __decorate([
    (0, typeorm_1.Entity)('calibrations')
], Calibration);
//# sourceMappingURL=calibration.entity.js.map