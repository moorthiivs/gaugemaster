import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    fetch(id: string): Promise<{
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
