import {
    Injectable,
    ConflictException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { Instrument } from './instrument.entity';
import { CalibrationHistory } from './calibration-history.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Like, Between, LessThan, LessThanOrEqual, Repository } from 'typeorm';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from 'src/dto/update-instrument.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';
import { ValidationService } from 'src/validation/validation.service';
import { MailerService } from 'src/mail/mailer.service';

interface InstrumentFilters {
    status?: string;
    item_status?: string;
    location?: string;
    frequency?: string;
    search?: string;
    due_date?: string;
    due_date_start?: string;
    due_date_end?: string;
    last_cal_start?: string;
    last_cal_end?: string;
    is_reference_standard?: string;
    page: number;
    pageSize: number;
    createdBy?: string
}

@Injectable()
export class InstrumentsService {
    constructor(
        @InjectRepository(Instrument)
        private readonly instrumentRepository: Repository<Instrument>,
        @InjectRepository(CalibrationHistory)
        private readonly calibrationHistoryRepository: Repository<CalibrationHistory>,
        private readonly mailerService: MailerService,
        private readonly validationService: ValidationService,
    ) { }


    async findFilterParams(createdById: string) {
        const instruments = await this.instrumentRepository.find({
            where: { created_by: { id: createdById } },
            select: ['status', 'frequency', 'location'],
        });

        const unique = (arr: string[]) => {
            const seen = new Set<string>();
            return arr.filter(Boolean).filter(item => {
                const normalized = item.trim().toLowerCase();
                if (seen.has(normalized)) return false;
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


    async findOne(id: string): Promise<Instrument> {
        const instrument = await this.instrumentRepository.findOne({
            where: { id },
        });
        if (!instrument) {
            throw new NotFoundException(`Instrument with ID ${id} not found`);
        }
        return instrument;
    }

    async findAll(filters: InstrumentFilters) {
        const { status, item_status, location, frequency, search, due_date, due_date_start, due_date_end, last_cal_start, last_cal_end, is_reference_standard, page, pageSize, createdBy } = filters;

        const baseWhere: any = {};

        if (status && status !== 'All') {
            const normalizedStatus = status.toLowerCase().replace(/\s+/g, '');
            if (normalizedStatus === 'overdue') {
                baseWhere.due_date = LessThan(new Date());
            } else {
                baseWhere.status = ILike(status);
            }
        }
        if (item_status && item_status !== 'All') baseWhere.item_status = ILike(item_status);
        if (location && location !== 'All') baseWhere.location = ILike(location);
        if (frequency && frequency !== 'All') baseWhere.frequency = ILike(frequency);
        if (createdBy) baseWhere.created_by = { id: createdBy };
        
        if (due_date) {
            const start = new Date(`${due_date}T00:00:00.000Z`);
            const end = new Date(`${due_date}T23:59:59.999Z`);
            baseWhere.due_date = Between(start, end);
        } else if (due_date_start && due_date_end) {
            baseWhere.due_date = Between(new Date(due_date_start), new Date(`${due_date_end}T23:59:59.999Z`));
        } else if (due_date_start) {
            baseWhere.due_date = Between(new Date(due_date_start), new Date("2100-01-01"));
        } else if (due_date_end) {
            baseWhere.due_date = Between(new Date("1970-01-01"), new Date(`${due_date_end}T23:59:59.999Z`));
        }

        if (last_cal_start && last_cal_end) {
            baseWhere.last_calibration_date = Between(new Date(last_cal_start), new Date(`${last_cal_end}T23:59:59.999Z`));
        } else if (last_cal_start) {
            baseWhere.last_calibration_date = Between(new Date(last_cal_start), new Date("2100-01-01"));
        } else if (last_cal_end) {
            baseWhere.last_calibration_date = Between(new Date("1970-01-01"), new Date(`${last_cal_end}T23:59:59.999Z`));
        }

        if (is_reference_standard === 'true') {
            baseWhere.is_reference_standard = true;
        } else if (is_reference_standard === 'false') {
            baseWhere.is_reference_standard = false;
        }

        let finalWhere: any = baseWhere;
        // Search in multiple columns (OR condition) while keeping base conditions (AND condition)
        if (search) {
            const searchPattern = ILike(`%${search}%`);
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


    private parseDateSafe(dateString: any): Date | undefined {
        if (!dateString) return undefined;
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? undefined : d;
    }

    async create(instrumentDto: CreateInstrumentDto, skipUniqueCheck = false) {
        try {
            // Configurable Validation
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
                    throw new ConflictException(
                        `Instrument '${instrumentDto.id_code}' already exists for this user.`,
                    );
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

                    // Keep length format (001 → 3 digits)
                    const next = lastNum + 1;
                    sinoStr = String(next).padStart(last.length, "0");
                } else {
                    // Default start
                    sinoStr = "001"; // or "001" if you prefer
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
        } catch (error) {
            console.log(error);
            if (error instanceof ConflictException) throw error;
            throw new InternalServerErrorException('An unexpected error occurred.');
        }
    }


    async update(id: string, updateInstrumentDto: UpdateInstrumentDto) {
        try {
            const instrument = await this.instrumentRepository.findOne({ where: { id } });

            if (!instrument) {
                throw new NotFoundException(`Instrument with ID ${id} not found`);
            }

            const payload: any = { ...updateInstrumentDto };

            if (payload.created_by) {
                payload.created_by = { id: payload.created_by };
            }
            if (payload.updated_by) {
                payload.updated_by = { id: payload.updated_by };
            }

            // Configurable Validation
            const merged = { ...instrument, ...updateInstrumentDto };
            const companyId = instrument.companyId || updateInstrumentDto.companyId;
            if (companyId) {
                await this.validationService.validateData(companyId, merged);
            }

            const updatedInstrument = this.instrumentRepository.merge(instrument, payload);
            const savedInstrument = await this.instrumentRepository.save(updatedInstrument);

            // History logic
            if (updateInstrumentDto.last_calibration_date || updateInstrumentDto.due_date) {
                const history = this.calibrationHistoryRepository.create({
                    instrument: { id: savedInstrument.id },
                    last_calibration_date: savedInstrument.last_calibration_date,
                    due_date: savedInstrument.due_date,
                    certificate_file: savedInstrument.certificate_file,
                });
                await this.calibrationHistoryRepository.save(history);
            } else if (updateInstrumentDto.certificate_file) {
                // If only certificate is uploaded, update the latest history entry
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
        } catch (error) {
            console.error('Error updating instrument:', error);
            throw error;
        }
    }

    async getHistory(instrumentId: string) {
        return this.calibrationHistoryRepository.find({
            where: { instrument: { id: instrumentId } },
            order: { created_at: 'DESC' },
        });
    }


    async bulkUpload(instruments: CreateInstrumentDto[]) {
        try {
            const saved: CreateInstrumentDto[] = [];
            const rejected: any[] = [];

            // Fetch validation rules for the company to check uniqueness settings
            const companyId = instruments[0]?.companyId;
            const rules = companyId ? await this.validationService.getRules(companyId) : [];
            const sinoRule = rules.find(r => r.fieldName === 'sino');
            const idCodeRule = rules.find(r => r.fieldName === 'id_code');

            for (const instrument of instruments) {
                try {
                    // Only check SINO uniqueness if explicitly enabled or if no rule exists (default legacy behavior)
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

                    // Only check ID Code uniqueness if explicitly enabled or if no rule exists (default legacy behavior)
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
                } catch (err) {
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
        } catch (error) {
            console.log(error);
        }

    }


    async sendCalibagency(data: any) {
        await this.mailerService.sendCalibrationAgency(data);
    }

    //@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    @Cron('27 12 * * *')
    async autoupdateinstrumentStatus() {
        const logger = new Logger('InstrumentsService');

        try {
            logger.log('🕒 Running auto-overdue status update job...');

            const today = new Date();

            const overdueInstruments = await this.instrumentRepository.find({
                where: {
                    due_date: LessThanOrEqual(today),
                },
            });


            if (!overdueInstruments.length) {
                logger.log('✅ No overdue instruments found.');
                return;
            }

            // 🔹 Update each to status = 'Overdue'
            for (const instrument of overdueInstruments) {
                instrument.status = 'Overdue';
                await this.instrumentRepository.save(instrument);
                logger.log(`⚠️ Instrument ${instrument.name} (${instrument.id_code}) marked as Overdue.`);
            }

            logger.log(`✅ ${overdueInstruments.length} instruments updated to 'Overdue'`);
        } catch (error) {
            console.error('❌ Error in autoupdateinstrumentStatus cron:', error);
        }
    }


    async getCalendarDue(userId: string, year: number, month: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const instruments = await this.instrumentRepository.find({
            where: {
                due_date: Between(startDate, endDate),
                created_by: { id: userId },
            },
            select: ['id', 'name', 'id_code', 'due_date', 'status', 'location', 'agency'],
            order: { due_date: 'ASC' },
        });

        const grouped: Record<number, { count: number; instruments: any[] }> = {};

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

    async remove(id: string) {
        const instrument = await this.instrumentRepository.findOne({ where: { id } });
        if (!instrument) {
            throw new Error('Instrument not found');
        }
        return this.instrumentRepository.remove(instrument);
    }

    async bulkRemove(ids: string[]) {
        if (!ids || ids.length === 0) return { deletedCount: 0 };
        const result = await this.instrumentRepository.delete(ids);
        return { deletedCount: result.affected || 0 };
    }
}
