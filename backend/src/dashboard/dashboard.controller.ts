// dashboard.controller.ts
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { DashboardService } from './dashboard.service';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('api/dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get(":id")
    async fetch(
        @Param('id') id: string,
        @Req() req: any,
        @Query('companyId') queryCompanyId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('itemStatus') itemStatus?: string,
        @Query('status') status?: string,
        @Query('location') location?: string,
        @Query('isReferenceStandard') isReferenceStandard?: string
    ) {
        const user = req.user || {};
        const effectiveCompanyId = user.isSuperAdmin ? (queryCompanyId || user.companyId) : user.companyId;
        const effectiveUserId = user.isSuperAdmin ? id : (user.userId || user.id || id);
        return this.dashboardService.fetchDashboard(effectiveUserId, effectiveCompanyId, startDate, endDate, itemStatus, status, location, isReferenceStandard);
    }

    @Get(":id/list")
    async fetchList(
        @Param('id') id: string,
        @Req() req: any,
        @Query('listType') listType: 'total' | 'due' | 'overdue' | 'calibrated',
        @Query('companyId') queryCompanyId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('itemStatus') itemStatus?: string,
        @Query('status') status?: string,
        @Query('location') location?: string
    ) {
        const user = req.user || {};
        const effectiveCompanyId = user.isSuperAdmin ? (queryCompanyId || user.companyId) : user.companyId;
        const effectiveUserId = user.isSuperAdmin ? id : (user.userId || user.id || id);
        return this.dashboardService.fetchDashboardList(effectiveUserId, listType, effectiveCompanyId, startDate, endDate, itemStatus, status, location);
    }
}
