"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstrumentsModule = void 0;
const common_1 = require("@nestjs/common");
const instruments_service_1 = require("./instruments.service");
const instruments_controller_1 = require("./instruments.controller");
const instrument_entity_1 = require("./instrument.entity");
const calibration_history_entity_1 = require("./calibration-history.entity");
const typeorm_1 = require("@nestjs/typeorm");
const mailer_module_1 = require("../mail/mailer.module");
const validation_module_1 = require("../validation/validation.module");
const backup_module_1 = require("../backup/backup.module");
let InstrumentsModule = class InstrumentsModule {
};
exports.InstrumentsModule = InstrumentsModule;
exports.InstrumentsModule = InstrumentsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([instrument_entity_1.Instrument, calibration_history_entity_1.CalibrationHistory]), mailer_module_1.MailerModule, validation_module_1.ValidationModule, backup_module_1.BackupModule],
        controllers: [instruments_controller_1.InstrumentsController],
        providers: [instruments_service_1.InstrumentsService],
        exports: [instruments_service_1.InstrumentsService],
    })
], InstrumentsModule);
//# sourceMappingURL=instruments.module.js.map