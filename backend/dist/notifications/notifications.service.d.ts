import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
export declare class NotificationsService {
    private readonly notificationRepository;
    constructor(notificationRepository: Repository<Notification>);
    createNotification(data: Partial<Notification>): Promise<Notification>;
    getNotificationsByCompany(companyId: string): Promise<Notification[]>;
    markAsRead(id: string): Promise<{
        success: boolean;
    }>;
    deleteNotification(id: string): Promise<{
        success: boolean;
    }>;
}
