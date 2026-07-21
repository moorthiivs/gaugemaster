import { Instrument } from 'src/instruments/instrument.entity';
import { CalibrationHistory } from 'src/instruments/calibration-history.entity';
import { Repository } from 'typeorm';
export declare class DashboardService {
    private readonly instrumentRepository;
    private readonly calibrationHistoryRepository;
    constructor(instrumentRepository: Repository<Instrument>, calibrationHistoryRepository: Repository<CalibrationHistory>);
    fetchDashboard(userid: string, startDateStr?: string, endDateStr?: string, itemStatus?: string, status?: string, location?: string): Promise<{
        total: number;
        dueThisMonth: number;
        overdue: number;
        calibratedCount: number;
        nextCalibrationDate: Date | null;
        dueDatesByMonth: {
            month: string;
            plan: number;
            actual: number;
        }[];
        dueSoonList: any;
        recentActivity: {
            id: string;
            name: string;
            action: string;
            at: Date;
        }[];
        statusDistribution: {
            name: any;
            value: number;
        }[];
        itemStatusDistribution: {
            name: any;
            value: number;
        }[];
        weeklyCompleted: {
            week: string;
            completed: number;
        }[];
        dailyCompleted: {
            day: string;
            date: string;
            completed: number;
        }[];
    }>;
    fetchDashboardList(userid: string, listType: 'total' | 'due' | 'overdue' | 'calibrated', startDateStr?: string, endDateStr?: string, itemStatus?: string, status?: string, location?: string): Promise<Instrument[]>;
}
