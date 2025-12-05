import { Repository } from 'typeorm';
import { Instrument } from 'src/instruments/instrument.entity';
import { Setting } from 'src/settings/entities/setting.entity';
import { MailerService } from 'src/mail/mailer.service';
import { ReminderFrequncy } from './reminder.entity';
import { JobService } from '@loctax/nest-pg-boss';
import * as PGBoss from 'pg-boss';
export declare class ReminderService {
    private readonly instrumentRepository;
    private readonly settingRepository;
    private readonly remainderRepository;
    private readonly mailerService;
    private readonly reminderJobService;
    private readonly logger;
    constructor(instrumentRepository: Repository<Instrument>, settingRepository: Repository<Setting>, remainderRepository: Repository<ReminderFrequncy>, mailerService: MailerService, reminderJobService: JobService<{
        reminderId: string;
        instrumentId: string;
    }>);
    private convertToDays;
    private getMatchCondition;
    private scheduleReminderJobs;
    saveReminder(data: any): Promise<{
        message: string;
    }>;
    updateReminder(payload: any): Promise<any>;
    deleteReminder(id: string): Promise<{
        message: string;
    }>;
    handleReminderJob(job: PGBoss.Job<{
        reminderId: string;
        instrumentId: string;
    }>): Promise<void>;
    private processSingleReminder;
    fetchrequencyData(query: any): Promise<ReminderFrequncy[]>;
}
