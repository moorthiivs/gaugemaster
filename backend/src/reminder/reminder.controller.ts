import { Body, Controller, Delete, Get, Post, Put, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ReminderService } from './reminder.service';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('api/reminder')
export class ReminderController {
    constructor(private readonly reminderService: ReminderService) { }

    @Get('frequencyData')
    async fetchFrequencyData(@Query() query: any, @Req() req: any) {
        const user = req.user || {};
        const effectiveCompanyId = user.isSuperAdmin ? (query.companyId || user.companyId) : user.companyId;
        const effectiveQuery = {
            ...query,
            companyId: effectiveCompanyId,
        };
        return this.reminderService.fetchrequencyData(effectiveQuery);
    }

    @Post('saveReminder')
    @RequirePermission('settings', 'edit')
    async saveReminder(@Body() data: any, @Req() req: any) {
        const user = req.user || {};
        const effectiveCompanyId = user.isSuperAdmin ? (data.companyId || user.companyId) : user.companyId;
        if (data && Array.isArray(data.items)) {
            data.items.forEach((item: any) => {
                item.companyId = effectiveCompanyId;
                if (!item.created_by) {
                    item.created_by = user.userId || user.id;
                }
            });
        }
        return this.reminderService.saveReminder(data);
    }

    @Delete('deleteReminder')
    @RequirePermission('settings', 'edit')
    async deleteReminder(@Body() body: { id: string }, @Req() req: any) {
        return this.reminderService.deleteReminder(body.id);
    }

    @Put('updateReminder')
    @RequirePermission('settings', 'edit')
    async updateReminder(@Body() payload: any, @Req() req: any) {
        return this.reminderService.updateReminder(payload);
    }
}
