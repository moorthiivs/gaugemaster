import { Instrument } from './instrument.entity';
import { CalibrationHistory } from './calibration-history.entity';
import { Repository } from 'typeorm';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from 'src/dto/update-instrument.dto';
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
    createdBy?: string;
}
export declare class InstrumentsService {
    private readonly instrumentRepository;
    private readonly calibrationHistoryRepository;
    private readonly mailerService;
    private readonly validationService;
    constructor(instrumentRepository: Repository<Instrument>, calibrationHistoryRepository: Repository<CalibrationHistory>, mailerService: MailerService, validationService: ValidationService);
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
    private parseDateSafe;
    create(instrumentDto: CreateInstrumentDto, skipUniqueCheck?: boolean): Promise<Instrument>;
    update(id: string, updateInstrumentDto: UpdateInstrumentDto): Promise<Instrument>;
    getHistory(instrumentId: string): Promise<CalibrationHistory[]>;
    bulkUpload(instruments: CreateInstrumentDto[]): Promise<{
        successCount: number;
        failedCount: number;
        saved: CreateInstrumentDto[];
        rejected: any[];
    } | undefined>;
    sendCalibagency(data: any): Promise<void>;
    autoupdateinstrumentStatus(): Promise<void>;
    getCalendarDue(userId: string, year: number, month: number): Promise<{
        year: number;
        month: number;
        totalCount: number;
        days: Record<number, {
            count: number;
            instruments: any[];
        }>;
    }>;
    remove(id: string): Promise<Instrument>;
    bulkRemove(ids: string[]): Promise<{
        deletedCount: number;
    }>;
}
export {};
