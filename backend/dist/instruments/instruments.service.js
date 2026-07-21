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
const calibration_history_entity_1 = require("./calibration-history.entity");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const schedule_1 = require("@nestjs/schedule");
const common_2 = require("@nestjs/common");
const validation_service_1 = require("../validation/validation.service");
const mailer_service_1 = require("../mail/mailer.service");
let InstrumentsService = class InstrumentsService {
    instrumentRepository;
    calibrationHistoryRepository;
    mailerService;
    validationService;
    constructor(instrumentRepository, calibrationHistoryRepository, mailerService, validationService) {
        this.instrumentRepository = instrumentRepository;
        this.calibrationHistoryRepository = calibrationHistoryRepository;
        this.mailerService = mailerService;
        this.validationService = validationService;
    }
    async findFilterParams(createdById) {
        const instruments = await this.instrumentRepository.find({
            where: { created_by: { id: createdById } },
            select: ['status', 'frequency', 'location'],
        });
        const unique = (arr) => {
            const seen = new Set();
            return arr.filter(Boolean).filter(item => {
                const normalized = item.trim().toLowerCase();
                if (seen.has(normalized))
                    return false;
                seen.add(normalized);
                return true;
            }).map(item => item.trim());
        };
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
        const { status, item_status, location, frequency, search, due_date, due_date_start, due_date_end, last_cal_start, last_cal_end, is_reference_standard, page, pageSize, createdBy } = filters;
        const baseWhere = {};
        if (status && status !== 'All') {
            const normalizedStatus = status.toLowerCase().replace(/\s+/g, '');
            if (normalizedStatus === 'overdue') {
                baseWhere.due_date = (0, typeorm_2.LessThan)(new Date());
            }
            else {
                baseWhere.status = (0, typeorm_2.ILike)(status);
            }
        }
        if (item_status && item_status !== 'All')
            baseWhere.item_status = (0, typeorm_2.ILike)(item_status);
        if (location && location !== 'All')
            baseWhere.location = (0, typeorm_2.ILike)(location);
        if (frequency && frequency !== 'All')
            baseWhere.frequency = (0, typeorm_2.ILike)(frequency);
        if (createdBy)
            baseWhere.created_by = { id: createdBy };
        if (due_date) {
            const start = new Date(`${due_date}T00:00:00.000Z`);
            const end = new Date(`${due_date}T23:59:59.999Z`);
            baseWhere.due_date = (0, typeorm_2.Between)(start, end);
        }
        else if (due_date_start && due_date_end) {
            baseWhere.due_date = (0, typeorm_2.Between)(new Date(due_date_start), new Date(`${due_date_end}T23:59:59.999Z`));
        }
        else if (due_date_start) {
            baseWhere.due_date = (0, typeorm_2.Between)(new Date(due_date_start), new Date("2100-01-01"));
        }
        else if (due_date_end) {
            baseWhere.due_date = (0, typeorm_2.Between)(new Date("1970-01-01"), new Date(`${due_date_end}T23:59:59.999Z`));
        }
        if (last_cal_start && last_cal_end) {
            baseWhere.last_calibration_date = (0, typeorm_2.Between)(new Date(last_cal_start), new Date(`${last_cal_end}T23:59:59.999Z`));
        }
        else if (last_cal_start) {
            baseWhere.last_calibration_date = (0, typeorm_2.Between)(new Date(last_cal_start), new Date("2100-01-01"));
        }
        else if (last_cal_end) {
            baseWhere.last_calibration_date = (0, typeorm_2.Between)(new Date("1970-01-01"), new Date(`${last_cal_end}T23:59:59.999Z`));
        }
        if (is_reference_standard === 'true') {
            baseWhere.is_reference_standard = true;
        }
        else if (is_reference_standard === 'false') {
            baseWhere.is_reference_standard = false;
        }
        let finalWhere = baseWhere;
        if (search) {
            const searchPattern = (0, typeorm_2.ILike)(`%${search}%`);
            finalWhere = [
                { ...baseWhere, name: searchPattern },
                { ...baseWhere, id_code: searchPattern },
                { ...baseWhere, make: searchPattern },
                { ...baseWhere, location: searchPattern },
                { ...baseWhere, serial_no: searchPattern },
                { ...baseWhere, range: searchPattern },
                { ...baseWhere, part_no: searchPattern },
                { ...baseWhere, part_name: searchPattern },
                { ...baseWhere, item_type: searchPattern },
                { ...baseWhere, sino: searchPattern },
                { ...baseWhere, frequency: searchPattern },
                { ...baseWhere, agency: searchPattern },
                { ...baseWhere, least_count: searchPattern },
                { ...baseWhere, notes: searchPattern },
                { ...baseWhere, remarks: searchPattern },
                { ...baseWhere, status: searchPattern },
                { ...baseWhere, item_status: searchPattern },
                { ...baseWhere, module: searchPattern },
                { ...baseWhere, calibration_source: searchPattern },
                { ...baseWhere, gauges_received_by: searchPattern },
                { ...baseWhere, gauges_issued_by: searchPattern },
                { ...baseWhere, calibration_procedure: searchPattern },
                { ...baseWhere, traceable: searchPattern },
                { ...baseWhere, customer: searchPattern },
                { ...baseWhere, sector: searchPattern },
                { ...baseWhere, criticality_level: searchPattern },
                { ...baseWhere, cert_no: searchPattern },
            ];
        }
        const [data, total] = await this.instrumentRepository.findAndCount({
            where: finalWhere,
            skip: (page - 1) * pageSize,
            take: pageSize,
            order: { due_date: 'ASC' },
        });
        return {
            data,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
    parseDateSafe(dateString) {
        if (!dateString)
            return undefined;
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? undefined : d;
    }
    async create(instrumentDto, skipUniqueCheck = false) {
        try {
            await this.validationService.validateData(instrumentDto.companyId, instrumentDto);
            if (!skipUniqueCheck) {
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
                last_calibration_date: this.parseDateSafe(instrumentDto.last_calibration_date),
                due_date: this.parseDateSafe(instrumentDto.due_date),
                gauge_issue_date: this.parseDateSafe(instrumentDto.gauge_issue_date),
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
            const merged = { ...instrument, ...updateInstrumentDto };
            const companyId = instrument.companyId || updateInstrumentDto.companyId;
            if (companyId) {
                await this.validationService.validateData(companyId, merged);
            }
            const updatedInstrument = this.instrumentRepository.merge(instrument, payload);
            const savedInstrument = await this.instrumentRepository.save(updatedInstrument);
            if (updateInstrumentDto.last_calibration_date || updateInstrumentDto.due_date) {
                const history = this.calibrationHistoryRepository.create({
                    instrument: { id: savedInstrument.id },
                    last_calibration_date: savedInstrument.last_calibration_date,
                    due_date: savedInstrument.due_date,
                    certificate_file: savedInstrument.certificate_file,
                });
                await this.calibrationHistoryRepository.save(history);
            }
            else if (updateInstrumentDto.certificate_file) {
                const latestHistory = await this.calibrationHistoryRepository.findOne({
                    where: { instrument: { id: savedInstrument.id } },
                    order: { created_at: 'DESC' },
                });
                if (latestHistory) {
                    latestHistory.certificate_file = updateInstrumentDto.certificate_file;
                    await this.calibrationHistoryRepository.save(latestHistory);
                }
            }
            return savedInstrument;
        }
        catch (error) {
            console.error('Error updating instrument:', error);
            throw error;
        }
    }
    async getHistory(instrumentId) {
        return this.calibrationHistoryRepository.find({
            where: { instrument: { id: instrumentId } },
            order: { created_at: 'DESC' },
        });
    }
    async bulkUpload(instruments) {
        try {
            const saved = [];
            const rejected = [];
            const companyId = instruments[0]?.companyId;
            const rules = companyId ? await this.validationService.getRules(companyId) : [];
            const sinoRule = rules.find(r => r.fieldName === 'sino');
            const idCodeRule = rules.find(r => r.fieldName === 'id_code');
            for (const instrument of instruments) {
                try {
                    const checkSino = sinoRule ? sinoRule.isUnique : false;
                    if (checkSino && instrument.sino) {
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
                    }
                    const checkIdCode = idCodeRule ? idCodeRule.isUnique : true;
                    if (checkIdCode) {
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
                    }
                    await this.create(instrument, true);
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
                    due_date: (0, typeorm_2.LessThanOrEqual)(today),
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
    async getCalendarDue(userId, year, month) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        const instruments = await this.instrumentRepository.find({
            where: {
                due_date: (0, typeorm_2.Between)(startDate, endDate),
                created_by: { id: userId },
            },
            select: ['id', 'name', 'id_code', 'due_date', 'status', 'location', 'agency'],
            order: { due_date: 'ASC' },
        });
        const grouped = {};
        for (const inst of instruments) {
            const day = new Date(inst.due_date).getDate();
            if (!grouped[day]) {
                grouped[day] = { count: 0, instruments: [] };
            }
            grouped[day].count++;
            grouped[day].instruments.push({
                id: inst.id,
                name: inst.name,
                id_code: inst.id_code,
                due_date: inst.due_date,
                status: inst.status,
                location: inst.location,
                agency: inst.agency,
            });
        }
        return {
            year,
            month,
            totalCount: instruments.length,
            days: grouped,
        };
    }
    async remove(id) {
        const instrument = await this.instrumentRepository.findOne({ where: { id } });
        if (!instrument) {
            throw new Error('Instrument not found');
        }
        return this.instrumentRepository.remove(instrument);
    }
    async bulkRemove(ids) {
        if (!ids || ids.length === 0)
            return { deletedCount: 0 };
        const result = await this.instrumentRepository.delete(ids);
        return { deletedCount: result.affected || 0 };
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
    __param(1, (0, typeorm_1.InjectRepository)(calibration_history_entity_1.CalibrationHistory)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        mailer_service_1.MailerService,
        validation_service_1.ValidationService])
], InstrumentsService);
//# sourceMappingURL=instruments.service.js.map