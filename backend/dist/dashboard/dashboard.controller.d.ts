import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    fetch(id: string, startDate?: string, endDate?: string, itemStatus?: string, status?: string, location?: string): Promise<{
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
    fetchList(id: string, listType: 'total' | 'due' | 'overdue' | 'calibrated', startDate?: string, endDate?: string, itemStatus?: string, status?: string, location?: string): Promise<import("../instruments/instrument.entity").Instrument[]>;
}
