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


            const newInstrument = this.instrumentRepository.create({
                ...instrumentDto,
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



    private isUniqueConstraintError(error: any): boolean {
        if (!error) return false;

        // MySQL / MariaDB
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) return true;

        // Postgres
        if (error.code === '23505') return true;

        // SQLite
        if (error.code === 'SQLITE_CONSTRAINT' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') return true;

        // MSSQL
        if (error.number === 2627 || error.number === 2601) return true;

        // Generic check in error message
        if (typeof error.message === 'string') {
            const msg = error.message.toLowerCase();
            if (msg.includes('duplicate') || msg.includes('unique constraint')) return true;
        }

        return false;
    }
}
