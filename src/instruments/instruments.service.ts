import {
    Injectable,
    ConflictException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { Instrument } from './instrument.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Like, Repository } from 'typeorm';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from 'src/dto/update-instrument.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThanOrEqual } from 'typeorm';
import { Logger } from '@nestjs/common';
import { MailerService } from 'src/mail/mailer.service';
interface InstrumentFilters {
    status?: string;
    location?: string;
    frequency?: string;
    search?: string;
    page: number;
    pageSize: number;
    createdBy?: string
}

@Injectable()
export class InstrumentsService {
    constructor(
        @InjectRepository(Instrument)
        private readonly instrumentRepository: Repository<Instrument>,
        private readonly mailerService: MailerService,
    ) { }


    async findFilterParams(createdById: string) {
        const instruments = await this.instrumentRepository.find({
            where: { created_by: { id: createdById } },
            select: ['status', 'frequency', 'location'],
        });

        if (!instruments.length) {
            throw new NotFoundException(`No instruments found for created_by ID ${createdById}`);
        }

        const unique = (arr: string[]) => [...new Set(arr.filter(Boolean))];

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
        const { status, location, frequency, search, page, pageSize, createdBy } = filters;

        const where: any = {};

        if (status && status !== 'All') where.status = ILike(status);
        if (location && location !== 'All') where.location = ILike(location);
        if (frequency && frequency !== 'All') where.frequency = ILike(frequency);
        if (createdBy) where.created_by = { id: createdBy };
        // Search in multiple columns
        if (search) {
            where.name = ILike(`%${search}%`);
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


    async create(instrumentDto: CreateInstrumentDto) {
        try {
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
                last_calibration_date: new Date(instrumentDto.last_calibration_date),
                due_date: new Date(instrumentDto.due_date),
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

            const updatedInstrument = this.instrumentRepository.merge(instrument, payload);
            return await this.instrumentRepository.save(updatedInstrument);
        } catch (error) {
            console.error('Error updating instrument:', error);
            throw error;
        }
    }


    async bulkUpload(instruments: CreateInstrumentDto[]) {
        try {
            const saved: CreateInstrumentDto[] = [];
            const rejected: any[] = [];

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

}
