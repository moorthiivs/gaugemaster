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
exports.CalibrationHistory = void 0;
const typeorm_1 = require("typeorm");
const instrument_entity_1 = require("./instrument.entity");
const uuid_1 = require("uuid");
let CalibrationHistory = class CalibrationHistory {
    id = (0, uuid_1.v4)();
    instrument;
    last_calibration_date;
    due_date;
    certificate_file;
    created_at;
};
exports.CalibrationHistory = CalibrationHistory;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], CalibrationHistory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => instrument_entity_1.Instrument, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'instrument_id' }),
    __metadata("design:type", instrument_entity_1.Instrument)
], CalibrationHistory.prototype, "instrument", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], CalibrationHistory.prototype, "last_calibration_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], CalibrationHistory.prototype, "due_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], CalibrationHistory.prototype, "certificate_file", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], CalibrationHistory.prototype, "created_at", void 0);
exports.CalibrationHistory = CalibrationHistory = __decorate([
    (0, typeorm_1.Entity)('calibration_history')
], CalibrationHistory);
//# sourceMappingURL=calibration-history.entity.js.map