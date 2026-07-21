import { Repository } from 'typeorm';
import { Setting } from 'src/settings/entities/setting.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
export declare class MailerService {
    private readonly mailConfigRepository;
    private readonly notificationsService;
    private readonly logger;
    constructor(mailConfigRepository: Repository<Setting>, notificationsService: NotificationsService);
    getMailConfig(userId: string): Promise<Setting | null>;
    sendMail({ to, subject, html, userId, }: {
        to: string[];
        subject: string;
        html: string;
        userId: string;
    }): Promise<void>;
    sendCalibrationAgency(params: any): Promise<{
        message: string;
    }>;
    sendTestMail(userId: string, targetEmail: string): Promise<{
        message: string;
    }>;
}
