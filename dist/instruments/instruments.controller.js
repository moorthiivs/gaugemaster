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
exports.InstrumentsController = void 0;
const common_1 = require("@nestjs/common");
const instruments_service_1 = require("./instruments.service");
const create_instrument_dto_1 = require("../dto/create-instrument.dto");
const update_instrument_dto_1 = require("../dto/update-instrument.dto");
let InstrumentsController = class InstrumentsController {
    instrumentsService;
    constructor(instrumentsService) {
        this.instrumentsService = instrumentsService;
    }
    async findAll(status, location, frequency, search, page = '1', pageSize = '10', createdBy) {
        const pageNumber = parseInt(page, 10);
        const limit = parseInt(pageSize, 10);
        return this.instrumentsService.findAll({
            status,
            location,
            frequency,
            search,
            page: pageNumber,
            pageSize: limit,
            createdBy
        });
    }
    async findOne(id) {
        return this.instrumentsService.findOne(id);
    }
    create(createInstrumentDto) {
        return this.instrumentsService.create(createInstrumentDto);
    }
    update(id, updateInstrumentDto) {
        return this.instrumentsService.update(id, updateInstrumentDto);
    }
};
exports.InstrumentsController = InstrumentsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('location')),
    __param(2, (0, common_1.Query)('frequency')),
    __param(3, (0, common_1.Query)('search')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('pageSize')),
    __param(6, (0, common_1.Query)('createdBy')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InstrumentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_instrument_dto_1.CreateInstrumentDto]),
    __metadata("design:returntype", void 0)
], InstrumentsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_instrument_dto_1.UpdateInstrumentDto]),
    __metadata("design:returntype", void 0)
], InstrumentsController.prototype, "update", null);
exports.InstrumentsController = InstrumentsController = __decorate([
    (0, common_1.Controller)('api/instruments'),
    __metadata("design:paramtypes", [instruments_service_1.InstrumentsService])
], InstrumentsController);
//# sourceMappingURL=instruments.controller.js.map