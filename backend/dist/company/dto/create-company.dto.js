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
exports.CreateCompanyDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateCompanyDto {
    companyName;
    companySize;
    industry;
    registeredUserId;
    registeredEmail;
    role;
}
exports.CreateCompanyDto = CreateCompanyDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The name of the company',
        example: 'Acme Industries',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "companyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Company size (e.g., 0-10 employees, 11-50 employees)',
        example: '0-10 employees',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "companySize", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Industry type (e.g., Manufacturing, Healthcare)',
        example: 'Manufacturing',
        required: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "industry", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID of the user registering this company',
        example: 'uuid-of-user',
    }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "registeredUserId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Email of the user registering this company',
        example: 'admin@acme.com',
    }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "registeredEmail", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Role of the registered user in the company',
        example: 'Admin',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCompanyDto.prototype, "role", void 0);
//# sourceMappingURL=create-company.dto.js.map