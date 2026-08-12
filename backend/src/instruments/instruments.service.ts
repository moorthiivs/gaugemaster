import {
    Injectable,
    ConflictException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { Instrument } from './instrument.entity';
import { CalibrationHistory } from './calibration-history.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Like, Between, LessThan, LessThanOrEqual, MoreThan, Repository, In, Raw } from 'typeorm';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from 'src/dto/update-instrument.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';
import { User } from 'src/users/user.entity';
import { ValidationService } from 'src/validation/validation.service';
import { MailerService } from 'src/mail/mailer.service';

interface InstrumentFilters {
    status?: string;
    item_status?: string;
    location?: string;
    frequency?: string;
    calibration_source?: string;
    module?: string;
    exclude_modules?: string;
    search?: string;
    due_date?: string;
    due_date_start?: string;
    due_date_end?: string;
    last_cal_start?: string;
    last_cal_end?: string;
    calibrated_in_range_start?: string;
    calibrated_in_range_end?: string;
    is_reference_standard?: string;
    page: number;
    pageSize: number;
    createdBy?: string;
    companyId?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class InstrumentsService {
    constructor(
        @InjectRepository(Instrument)
        private readonly instrumentRepository: Repository<Instrument>,
        @InjectRepository(CalibrationHistory)
        private readonly calibrationHistoryRepository: Repository<CalibrationHistory>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly mailerService: MailerService,
        private readonly validationService: ValidationService,
    ) { }

    private async getCompanyUserIds(userId?: string): Promise<string[]> {
        if (!userId) return [];
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user && user.companyId) {
            const companyUsers = await this.userRepository.find({
                where: { companyId: user.companyId },
                select: ['id'],
            });
            return companyUsers.map(u => u.id);
        }
        return [userId];
    }

    /**
     * Generates the next sequential S.No for a given company.
     * Finds the current maximum sino and returns max + 1.
     */
    private async generateNextSino(companyId: string): Promise<number> {
        const result = await this.instrumentRepository
            .createQueryBuilder('instrument')
            .select('MAX(instrument.sino)', 'maxSino')
            .where('instrument."companyId" = :companyId', { companyId })
            .andWhere('instrument.sino IS NOT NULL')
            .getRawOne();

        const maxSino = result?.maxSino ? Number(result.maxSino) : 0;
        return maxSino + 1;
    }

    async findFilterParams(createdById: string) {
        const userIds = await this.getCompanyUserIds(createdById);
        const instruments = await this.instrumentRepository.find({
            where: userIds.length > 0 ? { created_by: { id: In(userIds) } } : {},
            select: ['status', 'item_status', 'frequency', 'location', 'calibration_source'],
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
            item_status: unique(instruments.map(i => i.item_status || 'Active')),
            frequency: unique(instruments.map(i => i.frequency)),
            location: unique(instruments.map(i => i.location)),
            calibration_source: unique(instruments.map(i => i.calibration_source)),
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
        const { status, item_status, location, frequency, calibration_source, module, exclude_modules, search, due_date, due_date_start, due_date_end, last_cal_start, last_cal_end, calibrated_in_range_start, calibrated_in_range_end, is_reference_standard, page, pageSize, createdBy, companyId, sortBy, sortOrder } = filters;

        // If calibrated_in_range filter is active, use QueryBuilder with subquery on calibration_history
        if (calibrated_in_range_start && calibrated_in_range_end) {
            return this.findAllCalibratedInRange(filters);
        }

        const baseWhere: any = {};

        if (status && status !== 'All') {
            const normalizedStatus = status.toLowerCase().replace(/\s+/g, '');
            if (normalizedStatus === 'overdue') {
                baseWhere.due_date = LessThan(new Date());
            } else if (normalizedStatus === 'duesoon') {
                const now = new Date();
                const dueSoonEnd = new Date(now);
                dueSoonEnd.setDate(now.getDate() + 30);
                baseWhere.due_date = Between(now, dueSoonEnd);
            } else {
                baseWhere.status = ILike(status);
            }
        }
        if (item_status && item_status !== 'All') baseWhere.item_status = ILike(item_status);
        if (location && location !== 'All') baseWhere.location = ILike(location);
        if (frequency && frequency !== 'All') baseWhere.frequency = ILike(frequency);
        if (calibration_source && calibration_source !== 'All') baseWhere.calibration_source = ILike(calibration_source);
        if (module && module !== 'All') {
            if (module.toLowerCase() === 'unassigned') {
                baseWhere.module = Raw(alias => `${alias} IS NULL OR TRIM(${alias}) = ''`);
            } else if (module.toLowerCase() === 'others' && exclude_modules) {
                const topModules = exclude_modules.split(',').map(m => m.trim().toLowerCase());
                const unassignedInTop = topModules.includes('unassigned');
                const namedTop = topModules.filter(m => m !== 'unassigned');

                if (namedTop.length > 0) {
                    baseWhere.module = Raw(
                        alias => {
                            let sql = `LOWER(TRIM(${alias})) NOT IN (${namedTop.map((_, i) => `:topMod${i}`).join(',')})`;
                            if (!unassignedInTop) {
                                sql += ` AND ${alias} IS NOT NULL AND TRIM(${alias}) != ''`;
                            } else {
                                sql += ` AND ${alias} IS NOT NULL AND TRIM(${alias}) != ''`;
                            }
                            return sql;
                        },
                        namedTop.reduce((acc, name, i) => ({ ...acc, [`topMod${i}`]: name }), {})
                    );
                } else {
                    baseWhere.module = Raw(alias => `${alias} IS NOT NULL AND TRIM(${alias}) != ''`);
                }
            } else {
                baseWhere.module = Raw(alias => `TRIM(${alias}) ILIKE :mod`, { mod: module.trim() });
            }
        }
        if (companyId) {
            baseWhere.companyId = companyId;
        } else if (createdBy) {
            const userIds = await this.getCompanyUserIds(createdBy);
            if (userIds.length > 0) {
                baseWhere.created_by = { id: In(userIds) };
            }
        }
        
        if (due_date) {
            const parts = due_date.split('-').map(Number);
            if (parts.length === 3) {
                const tzOffsetMinutes = parseInt(process.env.TIMEZONE_OFFSET || '330', 10);
                const start = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
                const end = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
                baseWhere.due_date = Between(start, end);
            } else {
                const start = new Date(`${due_date}T00:00:00.000Z`);
                const end = new Date(`${due_date}T23:59:59.999Z`);
                baseWhere.due_date = Between(start, end);
            }
        } else if (due_date_start && due_date_end) {
            const sParts = due_date_start.split('-').map(Number);
            const eParts = due_date_end.split('-').map(Number);
            if (sParts.length === 3 && eParts.length === 3) {
                const tzOffsetMinutes = parseInt(process.env.TIMEZONE_OFFSET || '330', 10);
                const startRange = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
                const endRange = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
                baseWhere.due_date = Between(startRange, endRange);
            } else {
                baseWhere.due_date = Between(new Date(due_date_start), new Date(`${due_date_end}T23:59:59.999Z`));
            }
        } else if (due_date_start) {
            baseWhere.due_date = Between(new Date(due_date_start), new Date("2100-01-01"));
        } else if (due_date_end) {
            baseWhere.due_date = Between(new Date("1970-01-01"), new Date(`${due_date_end}T23:59:59.999Z`));
        }

        if (last_cal_start && last_cal_end) {
            const sParts = last_cal_start.split('-').map(Number);
            const eParts = last_cal_end.split('-').map(Number);
            if (sParts.length === 3 && eParts.length === 3) {
                const tzOffsetMinutes = parseInt(process.env.TIMEZONE_OFFSET || '330', 10);
                const startRange = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
                const endRange = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
                baseWhere.last_calibration_date = Between(startRange, endRange);
            } else {
                baseWhere.last_calibration_date = Between(new Date(last_cal_start), new Date(`${last_cal_end}T23:59:59.999Z`));
            }
        } else if (last_cal_start) {
            baseWhere.last_calibration_date = Between(new Date(last_cal_start), new Date("2100-01-01"));
        } else if (last_cal_end) {
            baseWhere.last_calibration_date = Between(new Date("1970-01-01"), new Date(`${last_cal_end}T23:59:59.999Z`));
        }

        if (is_reference_standard === 'true') {
            baseWhere.is_reference_standard = true;
        } else if (is_reference_standard === 'false') {
            baseWhere.is_reference_standard = Raw(alias => `${alias} = false OR ${alias} IS NULL`);
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

        // Determine sort order
        let orderOption: any = { sino: sortOrder || 'ASC' };
        if (sortBy && sortBy !== 'sino') {
            orderOption = { [sortBy]: sortOrder || 'ASC' };
        }

        const [data, total] = await this.instrumentRepository.findAndCount({
            where: finalWhere,
            skip: (page - 1) * pageSize,
            take: pageSize,
            order: orderOption,
        });

        return {
            data,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    /**
     * Finds instruments that have at least one calibration_history entry
     * with created_at in the given date range. This matches the dashboard's
     * countHistoryCalibrations() logic exactly.
     */
    private async findAllCalibratedInRange(filters: InstrumentFilters) {
        const { item_status, location, frequency, calibration_source, search, is_reference_standard, calibrated_in_range_start, calibrated_in_range_end, page, pageSize, createdBy } = filters;

        const tzOffsetMinutes = parseInt(process.env.TIMEZONE_OFFSET || '330', 10);
        const sParts = calibrated_in_range_start!.split('-').map(Number);
        const eParts = calibrated_in_range_end!.split('-').map(Number);
        const startRange = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
        const endRange = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);

        // Step 1: Get distinct instrument IDs from calibration_history 
        // (matches dashboard's countHistoryCalibrations logic exactly)
        const userIds = await this.getCompanyUserIds(createdBy);
        const historyQuery = this.calibrationHistoryRepository.createQueryBuilder('history')
            .innerJoin('history.instrument', 'instrument')
            .select('DISTINCT instrument.id', 'id')
            .where('instrument.created_by IN (:...userIds)', { userIds: userIds.length > 0 ? userIds : [createdBy] })
            .andWhere('history.created_at BETWEEN :startRange AND :endRange', { startRange, endRange });

        if (item_status && item_status !== 'All') {
            historyQuery.andWhere('instrument.item_status ILIKE :item_status', { item_status });
        }
        if (location && location !== 'All') {
            historyQuery.andWhere('instrument.location ILIKE :location', { location });
        }

        const instrumentIds = await historyQuery.getRawMany();
        const ids = instrumentIds.map(r => r.id);

        if (ids.length === 0) {
            return {
                data: [],
                total: 0,
                page,
                pageSize,
                totalPages: 0,
            };
        }

        // Step 2: Fetch full instrument records for those IDs with pagination
        const query = this.instrumentRepository.createQueryBuilder('instrument')
            .where('instrument.id IN (:...ids)', { ids });

        if (frequency && frequency !== 'All') {
            query.andWhere('instrument.frequency ILIKE :frequency', { frequency });
        }
        if (calibration_source && calibration_source !== 'All') {
            query.andWhere('instrument.calibration_source ILIKE :calibration_source', { calibration_source });
        }
        if (is_reference_standard === 'true') {
            query.andWhere('instrument.is_reference_standard = :isRef', { isRef: true });
        } else if (is_reference_standard === 'false') {
            query.andWhere('(instrument.is_reference_standard = :isRef OR instrument.is_reference_standard IS NULL)', { isRef: false });
        }
        if (search) {
            query.andWhere(
                '(instrument.name ILIKE :search OR instrument.id_code ILIKE :search OR instrument.make ILIKE :search OR instrument.serial_no ILIKE :search)',
                { search: `%${search}%` }
            );
        }

        if (filters.sortBy && filters.sortBy !== 'sino') {
            query.orderBy(`instrument.${filters.sortBy}`, filters.sortOrder || 'ASC');
        } else {
            query.orderBy('instrument.sino', filters.sortOrder || 'ASC');
        }

        const total = await query.getCount();
        const data = await query
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getMany();

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

            // Always auto-generate S.No — ignore any user-provided value
            const sinoValue = await this.generateNextSino(instrumentDto.companyId);

            let autoStatus = instrumentDto.status;
            const parsedDueDate = this.parseDateSafe(instrumentDto.due_date);
            if (parsedDueDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Reset time to accurately compare dates
                if (parsedDueDate <= today) {
                    autoStatus = 'Overdue';
                } else if (!autoStatus) {
                    autoStatus = 'OK';
                }
            } else if (!autoStatus) {
                autoStatus = 'OK';
            }

            const newInstrument = this.instrumentRepository.create({
                ...instrumentDto,
                sino: sinoValue,
                status: autoStatus,
                created_by: { id: instrumentDto.created_by },
                updated_by: undefined,
                last_calibration_date: this.parseDateSafe(instrumentDto.last_calibration_date),
                due_date: parsedDueDate,
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

            // Automatically update status based on new due_date if not REJECTED
            const finalDueDate = payload.due_date !== undefined ? payload.due_date : instrument.due_date;
            if (finalDueDate && payload.status !== 'REJECTED') {
                const parsedDueDate = this.parseDateSafe(finalDueDate);
                if (parsedDueDate) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (parsedDueDate <= today) {
                        payload.status = 'Overdue';
                    } else if ((instrument.status === 'Overdue' || instrument.status === 'REJECTED') && (!payload.status || payload.status === 'Overdue' || payload.status === 'REJECTED')) {
                        // If it was overdue/rejected but now date is extended into the future and verdict passed, reset to OK
                        payload.status = 'OK';
                    }
                }
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
                    calibration_source: savedInstrument.calibration_source,
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
                    if (updateInstrumentDto.calibration_source) {
                        latestHistory.calibration_source = updateInstrumentDto.calibration_source;
                    }
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
            const idCodeRule = rules.find(r => r.fieldName === 'id_code');

            for (const instrument of instruments) {
                try {
                    // S.No is auto-generated in create(), no need to check uniqueness

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
            today.setHours(0, 0, 0, 0); // Normalize to start of day

            const overdueInstruments = await this.instrumentRepository.find({
                where: {
                    due_date: LessThan(today),
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


    async getCalendarDue(
        userId: string,
        year: number,
        month: number,
        options?: {
            isReferenceStandard?: string;
            itemStatus?: string;
            location?: string;
        },
    ) {
        const userIds = await this.getCompanyUserIds(userId);
        const targetUserIds = userIds.length > 0 ? userIds : [userId];

        const whereCondition: any = {
            created_by: { id: In(targetUserIds) },
        };

        if (options?.itemStatus && options.itemStatus !== 'All') {
            whereCondition.item_status = ILike(options.itemStatus);
        }
        if (options?.location && options.location !== 'All') {
            whereCondition.location = ILike(options.location);
        }
        if (options?.isReferenceStandard === 'true') {
            whereCondition.is_reference_standard = true;
        } else if (options?.isReferenceStandard === 'false') {
            whereCondition.is_reference_standard = Raw(
                (alias) => `${alias} = false OR ${alias} IS NULL`,
            );
        }

        const instruments = await this.instrumentRepository.find({
            where: whereCondition,
            select: [
                'id',
                'name',
                'id_code',
                'due_date',
                'last_calibration_date',
                'frequency',
                'status',
                'location',
                'agency',
                'item_status',
                'is_reference_standard',
            ],
            order: { due_date: 'ASC' },
        });

        const parseFreqMonths = (freq?: string): number => {
            if (!freq) return 12;
            const normalized = freq.trim().toLowerCase();
            const match = normalized.match(/(\d+)/);
            if (!match) return 12;
            let val = parseInt(match[1], 10);
            if (normalized.includes("year")) {
                val *= 12;
            }
            return val > 0 ? val : 12;
        };

        const tzOffsetMinutes = parseInt(process.env.TIMEZONE_OFFSET || '330', 10);
        const grouped: Record<number, { count: number; instruments: any[] }> = {};
        let totalCount = 0;

        const targetYear = Number(year);
        const targetMonth = Number(month); // 1-12

        for (const inst of instruments) {
            const freqMonths = parseFreqMonths(inst.frequency);

            // 1. Completed calibration on last_calibration_date
            if (inst.last_calibration_date) {
                const calDate = new Date(inst.last_calibration_date);
                if (!isNaN(calDate.getTime())) {
                    const localCalDate = new Date(calDate.getTime() + tzOffsetMinutes * 60 * 1000);
                    const calYr = localCalDate.getUTCFullYear();
                    const calMo = localCalDate.getUTCMonth() + 1;
                    const calDay = localCalDate.getUTCDate();

                    if (calYr === targetYear && calMo === targetMonth) {
                        if (!grouped[calDay]) {
                            grouped[calDay] = { count: 0, instruments: [] };
                        }
                        const exists = grouped[calDay].instruments.some(i => i.id === inst.id && i.eventType === 'completed');
                        if (!exists) {
                            grouped[calDay].count++;
                            grouped[calDay].instruments.push({
                                id: inst.id,
                                name: inst.name,
                                id_code: inst.id_code,
                                due_date: inst.due_date ? new Date(inst.due_date).toISOString() : localCalDate.toISOString(),
                                last_calibration_date: localCalDate.toISOString(),
                                status: inst.status || 'OK',
                                location: inst.location,
                                agency: inst.agency,
                                frequency: inst.frequency || `${freqMonths} month(s)`,
                                eventType: 'completed',
                            });
                            totalCount++;
                        }
                    }
                }
            }

            // 2. Next due calibration on due_date (or projected due date if due_date is missing)
            let rawDueDate: any = inst.due_date;
            if (!rawDueDate && inst.last_calibration_date) {
                const lastDate = new Date(inst.last_calibration_date);
                if (!isNaN(lastDate.getTime())) {
                    lastDate.setMonth(lastDate.getMonth() + freqMonths);
                    rawDueDate = lastDate;
                }
            }

            if (!rawDueDate) continue;

            const utcDate = new Date(rawDueDate);
            if (isNaN(utcDate.getTime())) continue;

            // Adjust UTC date to user's local timezone
            const localDate = new Date(utcDate.getTime() + tzOffsetMinutes * 60 * 1000);
            const baseYear = localDate.getUTCFullYear();
            const baseMonth = localDate.getUTCMonth() + 1; // 1-12
            const baseDay = localDate.getUTCDate();

            // Difference in months between target month/year and base due date month/year
            const totalMonthsDiff = (targetYear - baseYear) * 12 + (targetMonth - baseMonth);

            // Check if target month is due date or a future recurring cycle step
            // Only project future cycles if the base due date is NOT in the past as Overdue
            const isOverdueStatus = inst.status && (inst.status.toLowerCase().includes('over') || inst.status === 'OVER DUE');
            const isPastBaseDate = totalMonthsDiff > 0;

            if (totalMonthsDiff >= 0 && (!isPastBaseDate || !isOverdueStatus)) {
                if (totalMonthsDiff % freqMonths === 0) {
                    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
                    const scheduledDay = Math.min(baseDay, daysInTargetMonth);
                    const scheduledDateISO = new Date(Date.UTC(targetYear, targetMonth - 1, scheduledDay)).toISOString();

                    if (!grouped[scheduledDay]) {
                        grouped[scheduledDay] = { count: 0, instruments: [] };
                    }

                    // Prevent duplicate entries of the same instrument on the same day for due event
                    const exists = grouped[scheduledDay].instruments.some(i => i.id === inst.id && i.eventType === 'due');
                    if (!exists) {
                        grouped[scheduledDay].count++;
                        grouped[scheduledDay].instruments.push({
                            id: inst.id,
                            name: inst.name,
                            id_code: inst.id_code,
                            due_date: scheduledDateISO,
                            last_calibration_date: inst.last_calibration_date ? new Date(inst.last_calibration_date).toISOString() : null,
                            status: inst.status,
                            location: inst.location,
                            agency: inst.agency,
                            frequency: inst.frequency || `${freqMonths} month(s)`,
                            eventType: 'due',
                        });
                        totalCount++;
                    }
                }
            }
        }

        return {
            year: targetYear,
            month: targetMonth,
            totalCount,
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

    /**
     * Backfill S.No for all existing instruments.
     * Uses a fast SQL UPDATE with ROW_NUMBER() to assign 1, 2, 3... per company.
     */
    async backfillSino() {
        const logger = new Logger('InstrumentsService');
        logger.log('🔄 Starting S.No backfill for all instruments...');

        // Get all distinct company IDs
        const companies = await this.instrumentRepository
            .createQueryBuilder('instrument')
            .select('DISTINCT instrument."companyId"', 'companyId')
            .where('instrument."companyId" IS NOT NULL')
            .getRawMany();

        let totalUpdated = 0;

        for (const { companyId } of companies) {
            // Use a single fast SQL UPDATE with ROW_NUMBER() window function
            const result = await this.instrumentRepository.query(
                `UPDATE instruments SET sino = sub.row_num::integer
                 FROM (
                   SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
                   FROM instruments
                   WHERE "companyId" = $1
                 ) sub
                 WHERE instruments.id = sub.id`,
                [companyId]
            );

            const updatedCount = result?.[1] || 0;
            totalUpdated += updatedCount;
            logger.log(`✅ Company ${companyId}: assigned sequential S.No to ${updatedCount} instruments`);
        }

        logger.log(`🎉 Backfill complete. ${totalUpdated} instruments updated.`);
        return {
            message: `Backfill complete. ${totalUpdated} instruments updated across ${companies.length} companies.`,
            totalUpdated,
            companiesProcessed: companies.length,
        };
    }
}
