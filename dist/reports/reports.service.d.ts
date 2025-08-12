import { Instrument } from 'src/instruments/instrument.entity';
import { Repository } from 'typeorm';
export declare class ReportsService {
    private readonly instrumentRepository;
    private printer;
    constructor(instrumentRepository: Repository<Instrument>);
    private generatePdfReport;
    generateReport(from: string, to: string, format: string, userid: string): Promise<Buffer>;
}
