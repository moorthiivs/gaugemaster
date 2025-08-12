// dashboard.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get(":id")
    async fetch(@Param('id') id: string) {
        return this.dashboardService.fetchDashboard(id);
    }
}
