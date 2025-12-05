import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instrument } from 'src/instruments/instrument.entity';
import { Setting } from 'src/settings/entities/setting.entity';
import { MailerService } from 'src/mail/mailer.service';
import { ReminderFrequncy } from './reminder.entity';

import { ReminderJob } from './reminder.job';
import { JobService } from '@loctax/nest-pg-boss';
import * as PGBoss from 'pg-boss';


@Injectable()
export class ReminderService {
    private readonly logger = new Logger(ReminderService.name);

    constructor(
        @InjectRepository(Instrument)
        private readonly instrumentRepository: Repository<Instrument>,

        @InjectRepository(Setting)
        private readonly settingRepository: Repository<Setting>,

        @InjectRepository(ReminderFrequncy)
        private readonly remainderRepository: Repository<ReminderFrequncy>,

        private readonly mailerService: MailerService,

        @ReminderJob.Inject()
        private readonly reminderJobService: JobService<{ reminderId: string, instrumentId: string }>,

    ) { }

    private convertToDays(value: number, unit: string): number {
        switch (unit.toLowerCase()) {
            case "days": return value;
            case "weeks": return value * 7;
            case "months": return value * 30;
            default: return value;
        }
    }

    private getMatchCondition(dueDate: Date, today: Date, offsetDays: number, when: string): boolean {
        // ... (Not used in job handler, keeping for reference)
        const d1 = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const d2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

        const diffDays = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));

        if (when === "before") return diffDays === offsetDays;
        if (when === "after") return diffDays === -offsetDays;

        return false;
    }

    // Core scheduling helper - MODIFIED FOR DAILY RECURRENCE
    // --------------------------------------------------------
    // src/reminder/reminder.service.ts

    // Core scheduling helper - MODIFIED FOR DAILY RECURRENCE & DETAILED LOGGING
    // --------------------------------------------------------
    private async scheduleReminderJobs(reminder: ReminderFrequncy) {
        const instruments = await this.instrumentRepository.find({
            where: { created_by: { id: reminder.created_by?.id }, companyId: reminder.companyId },
        });

        const offsetDays = this.convertToDays(reminder.reminder_start, reminder.reminder_start_unit);
        const when = (reminder.when || 'before').toLowerCase();
        const now = new Date();

        this.logger.log(`[SCHEDULER START] Processing ${instruments.length} instruments for Reminder ID: ${reminder.id}`);

        for (const inst of instruments) {

            // Logic for DAILY RECURRENCE: when="before" and reminder_start > 0
            if (when === 'before' && offsetDays > 0) {

                // Loop from the maximum offset (e.g., 18 days before) down to 1 day before.
                for (let daysBefore = offsetDays; daysBefore >= 1; daysBefore--) {
                    const scheduledDay = new Date(inst.due_date);
                    scheduledDay.setDate(inst.due_date.getDate() - daysBefore); // Calculate day of reminder

                    for (const mt of reminder.mail_times || []) {
                        const timeString = mt.time;
                        const [hours, minutes] = timeString.split(':').map(Number);

                        const scheduledTime = new Date(scheduledDay);
                        scheduledTime.setHours(hours, minutes, 0, 0); // Set specific time of day

                        // NEW LOGGER: Log the exact calculation moment for this mail_time
                        this.logger.log(`[CALCULATION] Instrument: ${inst.name}. Processing mail_time: ${timeString}. Target Day: ${scheduledDay.toDateString()}. Recurrence: Daily, ${daysBefore} days before.`);

                        // IMPORTANT: Only schedule if the time is in the future
                        if (scheduledTime > now) {
                            // The key must include the date to create a unique job for each day
                            const dateKey = scheduledDay.toISOString().substring(0, 10); // YYYY-MM-DD
                            const timeKey = timeString.replace(':', '');
                            const key = `${reminder.id}_${inst.id}_${dateKey}_${timeKey}`;

                            await this.reminderJobService.sendOnce(
                                { reminderId: reminder.id, instrumentId: inst.id },
                                { startAfter: scheduledTime } as PGBoss.SendOptions,
                                key
                            );

                            this.logger.log(`[JOB SENT] Scheduled DAILY reminder for ${inst.name} at ${scheduledTime.toTimeString()} (Key: ${key})`);
                        } else {
                            this.logger.debug(`[SKIPPED] Past job for ${inst.name} on ${scheduledTime.toDateString()} at ${timeString}`);
                        }
                    }
                }

            } else {
                // Logic for SINGLE-DAY SCHEDULING: when="after" OR when="before" with offsetDays=0 (unlikely)

                const scheduledDay = new Date(inst.due_date);
                if (when === 'after') {
                    scheduledDay.setDate(scheduledDay.getDate() + offsetDays);
                }
                // If when='before' and offsetDays is 0, scheduledDay = due_date

                for (const mt of reminder.mail_times || []) {
                    const timeString = mt.time;
                    const [hours, minutes] = timeString.split(':').map(Number);

                    const scheduledTime = new Date(scheduledDay);
                    scheduledTime.setHours(hours, minutes, 0, 0);

                    // NEW LOGGER: Log the exact calculation moment for this mail_time
                    this.logger.log(`[CALCULATION] Instrument: ${inst.name}. Processing mail_time: ${timeString}. Target Time: ${scheduledTime.toTimeString()}. Recurrence: Single-Day.`);

                    if (scheduledTime > now) {
                        const key = `${reminder.id}_${inst.id}_${timeString.replace(':', '')}`;

                        await this.reminderJobService.sendOnce(
                            { reminderId: reminder.id, instrumentId: inst.id },
                            { startAfter: scheduledTime } as PGBoss.SendOptions,
                            key
                        );
                        this.logger.log(`[JOB SENT] Scheduled SINGLE-DAY reminder for ${inst.name} at ${scheduledTime.toTimeString()} (Key: ${key})`);
                    } else {
                        this.logger.debug(`[SKIPPED] Past job for ${inst.name} on ${scheduledTime.toDateString()} at ${timeString}`);
                    }
                }
            }
        }
        this.logger.log(`[SCHEDULER END] All instruments processed.`);
    }


    async saveReminder(data: any) {
        for (const item of data.items) {
            const saveData = {
                no_of_mails: item.no_of_mails,
                when: item.when,
                reminder_start: item.reminder_start,
                reminder_start_unit: item.reminder_start_unit,
                reminder_field: item.reminder_field,
                mail_template: item.mail_template,
                created_by: item.created_by,
                companyId: item.companyId,
                mail_times: item.mail_times,
                priority: item.priority,
                recipient_role: item.recipient_role,
                reminder_date: item.reminder_date || new Date(),
                isactive: true
            };

            const entity = this.remainderRepository.create(saveData);
            const saved = await this.remainderRepository.save(entity);

            await this.scheduleReminderJobs(saved);


        }

        return { message: "Reminder saved successfully" };
    }


    async updateReminder(payload: any) {
        const reminder = await this.remainderRepository.findOne({ where: { id: payload.id } });
        if (!reminder) throw new NotFoundException('Reminder not found');

        const updated = Object.assign(reminder, payload);
        const result = await this.remainderRepository.save(updated);

        // Unschedule previous jobs
        try {
            await this.reminderJobService.unschedule().catch(() => null);
        } catch (err) {
            this.logger.debug('Unschedule error: ' + err?.message);
        }

        // Reschedule with updated data
        await this.scheduleReminderJobs(result);


        return result;
    }

    // Delete reminder
    async deleteReminder(id: string) {
        const reminder = await this.remainderRepository.findOne({ where: { id } });
        if (!reminder) throw new NotFoundException('Reminder not found');

        reminder.isactive = false;
        reminder.updated_at = new Date();
        await this.remainderRepository.save(reminder);


        try {
            await this.reminderJobService.unschedule().catch(() => null);
            this.logger.log(`Unschedule called for reminder jobs`);
        } catch (err) {
            this.logger.debug('Unschedule error: ' + err?.message);
        }

        return { message: 'Reminder deleted' };
    }


    // ------------------------
    // Worker handler: executes when PgBoss fires the job (UNTOUCHED)
    // ------------------------
    @ReminderJob.Handle()
    async handleReminderJob(job: PGBoss.Job<{ reminderId: string, instrumentId: string }>) {
        const reminderId = job.data.reminderId;
        this.logger.log(`PgBoss triggered reminder job → id: ${job.id}`);

        await this.processSingleReminder(job.data.reminderId, job.data.instrumentId);
    }

    // Core logic extracted from original Cron — runs for a single reminder id (UNTOUCHED)
    private async processSingleReminder(reminderId: string, instrumentId: string) {

        this.logger.log(`EMAIL SENT`);
        const today = new Date();
        const r = await this.remainderRepository.findOne({
            where: { id: reminderId, isactive: true },
            relations: ['created_by', 'company'],
        });

        if (!r) {
            this.logger.warn(`Reminder ${reminderId} not found or inactive`);
            return;
        }

        if (!r.created_by) {
            this.logger.warn(`Reminder skipped — created_by missing: ${r.id}`);
            return;
        }

        const when = (r.when || 'before').toLowerCase();
        const offsetDays = this.convertToDays(r.reminder_start, r.reminder_start_unit);
        const role = (r.recipient_role || '').toLowerCase();
        const priority = r.priority || 'normal';

        // OPTIMIZATION: Fetch ONLY the specific instrument related to the job payload.
        const inst = await this.instrumentRepository.findOne({
            where: {
                id: instrumentId,
                created_by: { id: r.created_by.id },
                companyId: r.companyId,
            },
        });

        if (!inst) {
            this.logger.warn(`Instrument ${instrumentId} not found or belongs to a different company.`);
            return;
        }

        const config = await this.settingRepository.findOne({ where: { userId: r.created_by.id } });
        if (!config) {
            this.logger.warn(`Missing mail config for: ${r.created_by.id}`);
            return;
        }

        let recipients: string[] = [];
        if (role.includes('junior')) recipients = config.juniorRecipients || [];
        else if (role.includes('senior')) recipients = config.seniorRecipients || [];
        else recipients = config.supervisorRecipients || [];

        if ((recipients || []).length === 0) {
            this.logger.warn(`No recipients found for role: ${r.recipient_role}`);
            return;
        }

        const priorityLabel =
            priority === 'high' ? '[HIGH PRIORITY]' : priority === 'normal' ? '[NORMAL]' : '[LOW]';

        const html =
            (r.mail_template || '')
                .replace('{{device_name}}', inst.name)
                .replace('{{serial_number}}', inst.id_code)
                .replace('{{calibration_date}}', inst.due_date.toDateString()) +
            `<br/><br/>Priority: <b>${priority.toUpperCase()}</b>` +
            `<br/>Reminder: ${when.toUpperCase()} ${offsetDays} days`;

        await this.mailerService.sendMail({
            to: recipients,
            subject: `${priorityLabel} Reminder: ${inst.name}`,
            html,
            userId: r.created_by.id,
        });

        this.logger.log(`EMAIL SENT → ${inst.name} for reminder ${r.id}`);
    }

    // Helper for listing reminders (unchanged)
    async fetchrequencyData(query: any) {
        return this.remainderRepository.find({
            where: {
                created_by: { id: query.created_by },
                companyId: query.companyId,
                recipient_role: query.recipient_role,
                isactive: true,
            },
        });
    }

}