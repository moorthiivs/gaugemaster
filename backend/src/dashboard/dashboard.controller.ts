// dashboard.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get(":id")
    async fetch(
        @Param('id') id: string,
        @Query('companyId') companyId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('itemStatus') itemStatus?: string,
        @Query('status') status?: string,
        @Query('location') location?: string,
        @Query('isReferenceStandard') isReferenceStandard?: string
    ) {
        return this.dashboardService.fetchDashboard(id, companyId, startDate, endDate, itemStatus, status, location, isReferenceStandard);
    }

    @Get(":id/list")
    async fetchList(
        @Param('id') id: string,
        @Query('listType') listType: 'total' | 'due' | 'overdue' | 'calibrated',
        @Query('companyId') companyId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('itemStatus') itemStatus?: string,
        @Query('status') status?: string,
        @Query('location') location?: string
    ) {
        return this.dashboardService.fetchDashboardList(id, listType, companyId, startDate, endDate, itemStatus, status, location);
    }
}
