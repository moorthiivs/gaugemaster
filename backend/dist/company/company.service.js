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
exports.CompanyService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const company_entity_1 = require("./entities/company.entity");
const users_service_1 = require("../users/users.service");
let CompanyService = class CompanyService {
    usersService;
    companyRepository;
    constructor(usersService, companyRepository) {
        this.usersService = usersService;
        this.companyRepository = companyRepository;
    }
    async create(createCompanyDto) {
        const company = this.companyRepository.create(createCompanyDto);
        const savedCompany = await this.companyRepository.save(company);
        if (savedCompany.registeredUserId) {
            await this.usersService.updateCompany(savedCompany.id, savedCompany.registeredUserId);
        }
        return savedCompany;
    }
};
exports.CompanyService = CompanyService;
exports.CompanyService = CompanyService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(company_entity_1.Company)),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        typeorm_2.Repository])
], CompanyService);
//# sourceMappingURL=company.service.js.map