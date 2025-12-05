import { Instrument } from './instrument.entity';
import { Repository } from 'typeorm';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from 'src/dto/update-instrument.dto';
import { MailerService } from 'src/mail/mailer.service';
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
    private readonly mailerService;
    constructor(instrumentRepository: Repository<Instrument>, mailerService: MailerService);
    findFilterParams(createdById: string): Promise<{
        status: string[];
        frequency: string[];
        location: string[];
    }>;
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
    bulkUpload(instruments: CreateInstrumentDto[]): Promise<{
        successCount: number;
        failedCount: number;
        saved: CreateInstrumentDto[];
        rejected: any[];
    } | undefined>;
    sendCalibagency(data: any): Promise<void>;
    autoupdateinstrumentStatus(): Promise<void>;
}
export {};
