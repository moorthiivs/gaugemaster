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
exports.ValidationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const validation_rule_entity_1 = require("./validation-rule.entity");
let ValidationService = class ValidationService {
    ruleRepository;
    constructor(ruleRepository) {
        this.ruleRepository = ruleRepository;
    }
    async getRules(companyId) {
        const existingRules = await this.ruleRepository.find({
            where: { companyId },
            order: { fieldName: 'ASC' },
        });
        const defaultFields = [
            { fieldName: "name", displayName: "Instrument Name", isRequired: true, isUnique: false, validationType: "text" },
            { fieldName: "id_code", displayName: "ID Code / IMTE", isRequired: true, isUnique: true, validationType: "text" },
            { fieldName: "location", displayName: "Location", isRequired: false, isUnique: false, validationType: "text" },
            { fieldName: "frequency", displayName: "Calibration Frequency", isRequired: false, isUnique: false, validationType: "text" },
            { fieldName: "last_calibration_date", displayName: "Last Calibration Date", isRequired: true, isUnique: false, validationType: "date" },
            { fieldName: "due_date", displayName: "Due Date", isRequired: true, isUnique: false, validationType: "date" },
            { fieldName: "agency", displayName: "Calibration Agency", isRequired: false, isUnique: false, validationType: "text" },
            { fieldName: "range", displayName: "Range", isRequired: false, isUnique: false, validationType: "text" },
            { fieldName: "serial_no", displayName: "Serial No", isRequired: false, isUnique: false, validationType: "text" },
            { fieldName: "least_count", displayName: "Least Count", isRequired: false, isUnique: false, validationType: "text" },
            { fieldName: "make", displayName: "Make", isRequired: false, isUnique: false, validationType: "text" },
            { fieldName: "remarks", displayName: "Remarks", isRequired: false, isUnique: false, validationType: "text" },
        ];
        if (existingRules.length === 0) {
            const savedRules = [];
            for (const def of defaultFields) {
                const saved = await this.ruleRepository.save({ ...def, companyId });
                savedRules.push(saved);
            }
            return savedRules.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
        }
        let updated = false;
        for (const def of defaultFields) {
            if (!existingRules.some(r => r.fieldName === def.fieldName)) {
                const saved = await this.ruleRepository.save({ ...def, companyId });
                existingRules.push(saved);
                updated = true;
            }
        }
        if (updated) {
            return existingRules.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
        }
        return existingRules;
    }
    async updateRules(companyId, rules) {
        for (const rule of rules) {
            if (rule.id) {
                await this.ruleRepository.update(rule.id, rule);
            }
            else {
                const existing = await this.ruleRepository.findOne({
                    where: { companyId, fieldName: rule.fieldName }
                });
                if (existing) {
                    await this.ruleRepository.update(existing.id, rule);
                }
                else {
                    await this.ruleRepository.save({ ...rule, companyId });
                }
            }
        }
        return this.getRules(companyId);
    }
    async validateData(companyId, data) {
        const rules = await this.getRules(companyId);
        const errors = [];
        for (const rule of rules) {
            const value = data[rule.fieldName];
            if (rule.isRequired && (value === undefined || value === null || value === '')) {
                errors.push(`${rule.displayName} is required`);
            }
            if (value) {
                if (rule.validationType === 'date') {
                    const isInvalid = value instanceof Date ? isNaN(value.getTime()) : isNaN(Date.parse(value));
                    if (isInvalid) {
                        errors.push(`${rule.displayName} must be a valid date`);
                    }
                }
                if (rule.validationType === 'number' && isNaN(Number(value))) {
                    errors.push(`${rule.displayName} must be a valid number`);
                }
            }
        }
        if (errors.length > 0) {
            throw new common_1.BadRequestException(errors.join(', '));
        }
    }
};
exports.ValidationService = ValidationService;
exports.ValidationService = ValidationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(validation_rule_entity_1.ValidationRule)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ValidationService);
//# sourceMappingURL=validation.service.js.map