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
const schedule_1 = require("@nestjs/schedule");
const typeorm_3 = require("typeorm");
const common_2 = require("@nestjs/common");
const mailer_service_1 = require("../mail/mailer.service");
let InstrumentsService = class InstrumentsService {
    instrumentRepository;
    mailerService;
    constructor(instrumentRepository, mailerService) {
        this.instrumentRepository = instrumentRepository;
        this.mailerService = mailerService;
    }
    async findFilterParams(createdById) {
        const instruments = await this.instrumentRepository.find({
            where: { created_by: { id: createdById } },
            select: ['status', 'frequency', 'location'],
        });
        if (!instruments.length) {
            throw new common_1.NotFoundException(`No instruments found for created_by ID ${createdById}`);
        }
        const unique = (arr) => [...new Set(arr.filter(Boolean))];
        return {
            status: unique(instruments.map(i => i.status)),
            frequency: unique(instruments.map(i => i.frequency)),
            location: unique(instruments.map(i => i.location)),
        };
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
            where.status = (0, typeorm_2.ILike)(status);
        if (location && location !== 'All')
            where.location = (0, typeorm_2.ILike)(location);
        if (frequency && frequency !== 'All')
            where.frequency = (0, typeorm_2.ILike)(frequency);
        if (createdBy)
            where.created_by = { id: createdBy };
        if (search) {
            where.name = (0, typeorm_2.ILike)(`%${search}%`);
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
            let sinoStr = instrumentDto.sino ? String(instrumentDto.sino) : undefined;
            if (!sinoStr) {
                const lastInstrument = await this.instrumentRepository.findOne({
                    where: {
                        created_by: { id: instrumentDto.created_by },
                        companyId: instrumentDto.companyId,
                    },
                    order: { sino: 'ASC' },
                });
                if (lastInstrument?.sino) {
                    const last = String(lastInstrument.sino);
                    const lastNum = parseInt(last, 10);
                    const next = lastNum + 1;
                    sinoStr = String(next).padStart(last.length, "0");
                }
                else {
                    sinoStr = "001";
                }
            }
            const newInstrument = this.instrumentRepository.create({
                ...instrumentDto,
                sino: sinoStr,
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
    async bulkUpload(instruments) {
        try {
            const saved = [];
            const rejected = [];
            for (const instrument of instruments) {
                try {
                    const existingSino = await this.instrumentRepository.findOne({
                        where: {
                            sino: instrument.sino,
                            companyId: instrument.companyId,
                            created_by: { id: instrument.created_by },
                        },
                    });
                    if (existingSino) {
                        rejected.push({
                            ...instrument,
                            error: `SINO '${instrument.sino}' already exists`,
                        });
                        continue;
                    }
                    const existingCode = await this.instrumentRepository.findOne({
                        where: {
                            id_code: instrument.id_code,
                            created_by: { id: instrument.created_by },
                        },
                    });
                    if (existingCode) {
                        rejected.push({
                            ...instrument,
                            error: `ID Code '${instrument.id_code}' already exists`,
                        });
                        continue;
                    }
                    await this.create(instrument);
                    saved.push(instrument);
                }
                catch (err) {
                    rejected.push({
                        ...instrument,
                        error: err?.message || 'Unknown error',
                    });
                }
            }
            return {
                successCount: saved.length,
                failedCount: rejected.length,
                saved,
                rejected,
            };
        }
        catch (error) {
            console.log(error);
        }
    }
    async sendCalibagency(data) {
        await this.mailerService.sendCalibrationAgency(data);
    }
    async autoupdateinstrumentStatus() {
        const logger = new common_2.Logger('InstrumentsService');
        try {
            logger.log('🕒 Running auto-overdue status update job...');
            const today = new Date();
            const overdueInstruments = await this.instrumentRepository.find({
                where: {
                    due_date: (0, typeorm_3.LessThanOrEqual)(today),
                },
            });
            if (!overdueInstruments.length) {
                logger.log('✅ No overdue instruments found.');
                return;
            }
            for (const instrument of overdueInstruments) {
                instrument.status = 'Overdue';
                await this.instrumentRepository.save(instrument);
                logger.log(`⚠️ Instrument ${instrument.name} (${instrument.id_code}) marked as Overdue.`);
            }
            logger.log(`✅ ${overdueInstruments.length} instruments updated to 'Overdue'`);
        }
        catch (error) {
            console.error('❌ Error in autoupdateinstrumentStatus cron:', error);
        }
    }
};
exports.InstrumentsService = InstrumentsService;
__decorate([
    (0, schedule_1.Cron)('27 12 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InstrumentsService.prototype, "autoupdateinstrumentStatus", null);
exports.InstrumentsService = InstrumentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(instrument_entity_1.Instrument)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        mailer_service_1.MailerService])
], InstrumentsService);
//# sourceMappingURL=instruments.service.js.map