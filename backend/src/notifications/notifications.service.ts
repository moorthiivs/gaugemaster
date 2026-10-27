import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async createNotification(data: Partial<Notification>) {
    const notification = this.notificationRepository.create(data);
    return await this.notificationRepository.save(notification);
  }

  async getNotificationsByCompany(companyId: string) {
    if (!companyId) return [];
    return await this.notificationRepository.find({
      where: { companyId },
      order: { created_at: 'DESC' },
      take: 50, // limit to 50 recent notifications
    });
  }

  async markAsRead(id: string, companyId?: string) {
    const where: any = { id };
    if (companyId) where.companyId = companyId;
    await this.notificationRepository.update(where, { is_read: true });
    return { success: true };
  }

  async deleteNotification(id: string, companyId?: string) {
    const where: any = { id };
    if (companyId) where.companyId = companyId;
    await this.notificationRepository.delete(where);
    return { success: true };
  }
}
