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
exports.ValidationRule = void 0;
const typeorm_1 = require("typeorm");
let ValidationRule = class ValidationRule {
    id;
    companyId;
    fieldName;
    displayName;
    isRequired;
    isUnique;
    isStrictDate;
    validationType;
    created_at;
    updated_at;
};
exports.ValidationRule = ValidationRule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ValidationRule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], ValidationRule.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ValidationRule.prototype, "fieldName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ValidationRule.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ValidationRule.prototype, "isRequired", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ValidationRule.prototype, "isUnique", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ValidationRule.prototype, "isStrictDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'text' }),
    __metadata("design:type", String)
], ValidationRule.prototype, "validationType", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ValidationRule.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ValidationRule.prototype, "updated_at", void 0);
exports.ValidationRule = ValidationRule = __decorate([
    (0, typeorm_1.Entity)('validation_rules')
], ValidationRule);
//# sourceMappingURL=validation-rule.entity.js.map