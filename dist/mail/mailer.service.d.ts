import { Repository } from 'typeorm';
import { Setting } from 'src/settings/entities/setting.entity';
export declare class MailerService {
    private readonly mailConfigRepository;
    private readonly logger;
    constructor(mailConfigRepository: Repository<Setting>);
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
}
