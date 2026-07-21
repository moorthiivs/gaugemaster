import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    getNotifications(companyId: string): Promise<import("./notification.entity").Notification[]>;
    markAsRead(id: string): Promise<{
        success: boolean;
    }>;
    deleteNotification(id: string): Promise<{
        success: boolean;
    }>;
}
