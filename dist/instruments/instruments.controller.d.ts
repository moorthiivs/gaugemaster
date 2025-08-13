import { InstrumentsService } from './instruments.service';
import { CreateInstrumentDto } from '../dto/create-instrument.dto';
import { UpdateInstrumentDto } from '../dto/update-instrument.dto';
export declare class InstrumentsController {
    private readonly instrumentsService;
    constructor(instrumentsService: InstrumentsService);
    findAll(status?: string, location?: string, frequency?: string, search?: string, page?: string, pageSize?: string, createdBy?: string): Promise<{
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
    findOne(id: string): Promise<import("./instrument.entity").Instrument>;
    create(createInstrumentDto: CreateInstrumentDto): Promise<import("./instrument.entity").Instrument>;
    update(id: string, updateInstrumentDto: UpdateInstrumentDto): Promise<import("./instrument.entity").Instrument>;
}
