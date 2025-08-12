import { Instrument } from './instrument.entity';
import { Repository } from 'typeorm';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from 'src/dto/update-instrument.dto';
interface InstrumentFilters {
    status?: string;
    location?: string;
    frequency?: string;
    search?: string;
    page: number;
    pageSize: number;
    createdBy?: string;
}
export declare class InstrumentsService {
    private readonly instrumentRepository;
    constructor(instrumentRepository: Repository<Instrument>);
    findOne(id: string): Promise<Instrument>;
    findAll(filters: InstrumentFilters): Promise<{
        data: Instrument[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }>;
    create(instrumentDto: CreateInstrumentDto): Promise<Instrument>;
    update(id: string, updateInstrumentDto: UpdateInstrumentDto): Promise<Instrument>;
    private isUniqueConstraintError;
}
export {};
