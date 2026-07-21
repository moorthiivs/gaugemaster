import { InstrumentsService } from './instruments.service';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from '../dto/update-instrument.dto';
import { GoogleDriveService } from '../backup/google-drive.service';
export declare class InstrumentsController {
    private readonly instrumentsService;
    private readonly googleDriveService;
    constructor(instrumentsService: InstrumentsService, googleDriveService: GoogleDriveService);
    findAll(status?: string, item_status?: string, location?: string, frequency?: string, search?: string, due_date?: string, due_date_start?: string, due_date_end?: string, last_cal_start?: string, last_cal_end?: string, is_reference_standard?: string, page?: string, pageSize?: string, createdBy?: string): Promise<{
        data: import("./instrument.entity").Instrument[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }>;
    getFilterParams(createdById: string): Promise<{
        status: string[];
        frequency: string[];
        location: string[];
    }>;
    getHistory(id: string): Promise<import("./calibration-history.entity").CalibrationHistory[]>;
    findOne(id: string): Promise<import("./instrument.entity").Instrument>;
    create(createInstrumentDto: CreateInstrumentDto): Promise<import("./instrument.entity").Instrument>;
    update(id: string, updateInstrumentDto: UpdateInstrumentDto): Promise<import("./instrument.entity").Instrument>;
    uploadCertificate(id: string, file: any): Promise<{
        message: string;
        url: string;
    }>;
    convertToGoogleSheet(id: string): Promise<{
        success: boolean;
        url: string;
    }>;
    bulkUpload(dto: CreateInstrumentDto | CreateInstrumentDto[]): Promise<{
        successCount: number;
        failedCount: number;
        saved: CreateInstrumentDto[];
        rejected: any[];
    } | undefined>;
    sendCalibagency(data: any): Promise<void>;
    getCalendarDue(userId: string, year: string, month: string): Promise<{
        year: number;
        month: number;
        totalCount: number;
        days: Record<number, {
            count: number;
            instruments: any[];
        }>;
    }>;
    remove(id: string): Promise<import("./instrument.entity").Instrument>;
    bulkRemove(ids: string[]): Promise<{
        deletedCount: number;
    }>;
}
