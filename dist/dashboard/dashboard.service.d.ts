import { Instrument } from 'src/instruments/instrument.entity';
import { Repository } from 'typeorm';
export declare class DashboardService {
    private readonly instrumentRepository;
    constructor(instrumentRepository: Repository<Instrument>);
    fetchDashboard(userid: string): Promise<{
        total: number;
        dueThisMonth: number;
        overdue: number;
        nextCalibrationDate: Date | null;
        dueDatesByMonth: {
            month: string;
            count: number;
        }[];
        dueSoonList: {
            id: string;
            name: string;
            dueDate: Date;
        }[];
        recentActivity: {
            id: string;
            name: string;
            action: string;
            at: Date;
        }[];
    }>;
}
