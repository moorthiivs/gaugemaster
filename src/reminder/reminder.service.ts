import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { differenceInDays } from 'date-fns';
import { Instrument } from 'src/instruments/instrument.entity';
import { Setting } from 'src/settings/entities/setting.entity';
import { MailerService } from 'src/mail/mailer.service';

@Injectable()
export class ReminderService {
    private readonly logger = new Logger(ReminderService.name);

    constructor(
        @InjectRepository(Instrument)
        private readonly instrumentRepository: Repository<Instrument>,

        @InjectRepository(Setting)
        private readonly settingRepository: Repository<Setting>,

        private readonly mailerService: MailerService,
    ) { }

    /** Runs every day at 8 AM */
    // @Cron(CronExpression.EVERY_DAY_AT_8AM)

    @Cron('38 20 * * *') // runs every day at 8:35 PM 
    //@Cron('*/1 * * * *')
    async handleReminderJob() {
        this.logger.log('🔔 Running daily reminder cron job...');

        const today = new Date();

        const instruments = await this.instrumentRepository.find({
            relations: ['created_by'],
        });



        for (const instrument of instruments) {
            const daysDiff = differenceInDays(instrument.due_date, today);


            if (daysDiff === 2) {
                await this.sendReminder('junior', instrument);
            } else if (daysDiff === 0) {
                await this.sendReminder('senior', instrument);
            } else if (daysDiff === -7) {
                await this.sendReminder('supervisor', instrument);
            }
        }

        this.logger.log('✅ Reminder job completed');
    }

    private async sendReminder(
        role: 'junior' | 'senior' | 'supervisor',
        instrument: Instrument,
    ) {
        try {
            const config = await this.settingRepository.findOne({
                where: { userId: instrument.created_by?.id },
            });


            if (!config) {
                this.logger.warn(`⚠️ No mail config found for user ${instrument.created_by?.id}`);
                return;
            }

            const recipients =
                role === 'junior'
                    ? config.juniorRecipients
                    : role === 'senior'
                        ? config.seniorRecipients
                        : config.supervisorRecipients;

            if (!recipients?.length) {
                this.logger.warn(`⚠️ No ${role} recipients found for user ${instrument.created_by?.id}`);
                return;
            }

            const subject = `Calibration Reminder: ${instrument.name}`;
            const html = `
        <h3>Reminder for Calibration</h3>
        <p><b>Instrument:</b> ${instrument.name}</p>
        <p><b>ID Code:</b> ${instrument.id_code}</p>
        <p><b>Due Date:</b> ${instrument.due_date.toDateString()}</p>
        <p>This is a <b>${role}</b> level reminder.</p>
      `;

            if (!instrument.created_by?.id) {
                this.logger.warn(`⚠️ Instrument ${instrument.name} has no created_by user — skipping email`);
                return;
            }

            await this.mailerService.sendMail({
                to: recipients,
                subject,
                html,
                userId: instrument.created_by.id,
            });

            this.logger.log(
                `📧 ${role} reminder sent for ${instrument.name} to ${recipients.join(', ')}`,
            );
        } catch (err) {
            this.logger.error(`❌ Failed to send ${role} reminder for ${instrument.name}:`, err);
        }
    }
}
