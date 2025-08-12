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
exports.InstrumentsService = void 0;
const common_1 = require("@nestjs/common");
const instrument_entity_1 = require("./instrument.entity");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let InstrumentsService = class InstrumentsService {
    instrumentRepository;
    constructor(instrumentRepository) {
        this.instrumentRepository = instrumentRepository;
    }
    async findOne(id) {
        const instrument = await this.instrumentRepository.findOne({
            where: { id },
        });
        if (!instrument) {
            throw new common_1.NotFoundException(`Instrument with ID ${id} not found`);
        }
        return instrument;
    }
    async findAll(filters) {
        const { status, location, frequency, search, page, pageSize, createdBy } = filters;
        const where = {};
        if (status && status !== 'All')
            where.status = status;
        if (location && location !== 'All')
            where.location = location;
        if (frequency && frequency !== 'All')
            where.frequency = frequency;
        if (createdBy)
            where.created_by = { id: createdBy };
        if (search) {
            where.name = (0, typeorm_2.Like)(`%${search}%`);
        }
        const [data, total] = await this.instrumentRepository.findAndCount({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            order: { created_at: 'DESC' },
        });
        return {
            data,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
    async create(instrumentDto) {
        try {
            const existingInstrument = await this.instrumentRepository.findOne({
                where: {
                    id_code: instrumentDto.id_code,
                    created_by: { id: instrumentDto.created_by },
                },
                relations: ['created_by'],
            });
            if (existingInstrument) {
                throw new common_1.ConflictException(`Instrument '${instrumentDto.id_code}' already exists for this user.`);
            }
            const newInstrument = this.instrumentRepository.create({
                ...instrumentDto,
                created_by: { id: instrumentDto.created_by },
                updated_by: undefined,
                last_calibration_date: new Date(instrumentDto.last_calibration_date),
                due_date: new Date(instrumentDto.due_date),
            });
            return await this.instrumentRepository.save(newInstrument);
        }
        catch (error) {
            console.log(error);
            if (error instanceof common_1.ConflictException)
                throw error;
            throw new common_1.InternalServerErrorException('An unexpected error occurred.');
        }
    }
    async update(id, updateInstrumentDto) {
        try {
            const instrument = await this.instrumentRepository.findOne({ where: { id } });
            if (!instrument) {
                throw new common_1.NotFoundException(`Instrument with ID ${id} not found`);
            }
            const payload = { ...updateInstrumentDto };
            if (payload.created_by) {
                payload.created_by = { id: payload.created_by };
            }
            if (payload.updated_by) {
                payload.updated_by = { id: payload.updated_by };
            }
            const updatedInstrument = this.instrumentRepository.merge(instrument, payload);
            return await this.instrumentRepository.save(updatedInstrument);
        }
        catch (error) {
            console.error('Error updating instrument:', error);
            throw error;
        }
    }
    isUniqueConstraintError(error) {
        if (!error)
            return false;
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)
            return true;
        if (error.code === '23505')
            return true;
        if (error.code === 'SQLITE_CONSTRAINT' || error.code === 'SQLITE_CONSTRAINT_UNIQUE')
            return true;
        if (error.number === 2627 || error.number === 2601)
            return true;
        if (typeof error.message === 'string') {
            const msg = error.message.toLowerCase();
            if (msg.includes('duplicate') || msg.includes('unique constraint'))
                return true;
        }
        return false;
    }
};
exports.InstrumentsService = InstrumentsService;
exports.InstrumentsService = InstrumentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(instrument_entity_1.Instrument)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], InstrumentsService);
//# sourceMappingURL=instruments.service.js.map