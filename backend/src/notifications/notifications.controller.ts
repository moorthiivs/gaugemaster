import { Controller, Get, Param, Post, Delete, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';

@UseGuards(AuthGuard('jwt'))
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('company/:companyId')
  async getNotifications(@Param('companyId') companyId: string, @Req() req: any) {
    const user = req.user || {};
    const effectiveCompanyId = user.isSuperAdmin ? (companyId || user.companyId) : user.companyId;
    if (!effectiveCompanyId) {
      throw new ForbiddenException('Company context required');
    }
    return this.notificationsService.getNotificationsByCompany(effectiveCompanyId);
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    const user = req.user || {};
    const companyId = user.isSuperAdmin ? undefined : user.companyId;
    return this.notificationsService.markAsRead(id, companyId);
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Req() req: any) {
    const user = req.user || {};
    const companyId = user.isSuperAdmin ? undefined : user.companyId;
    return this.notificationsService.deleteNotification(id, companyId);
  }
}
