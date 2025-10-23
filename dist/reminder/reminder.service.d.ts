import { Repository } from 'typeorm';
import { Instrument } from 'src/instruments/instrument.entity';
import { Setting } from 'src/settings/entities/setting.entity';
import { MailerService } from 'src/mail/mailer.service';
export declare class ReminderService {
    private readonly instrumentRepository;
    private readonly settingRepository;
    private readonly mailerService;
    private readonly logger;
    constructor(instrumentRepository: Repository<Instrument>, settingRepository: Repository<Setting>, mailerService: MailerService);
    handleReminderJob(): Promise<void>;
    private sendReminder;
}
