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


import { NotificationsService } from 'src/notifications/notifications.service';

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
        
        private readonly notificationsService: NotificationsService,

    ) { }

    private convertToDays(value: number, unit: string): number {
        switch (unit.toLowerCase()) {
            case "day":
            case "days": return value;
            case "week":
            case "weeks": return value * 7;
            case "month":
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
        const isBulk = (reminder.email_mode || 'single') === 'bulk';

        const instruments = await this.instrumentRepository.find({
            where: { created_by: { id: reminder.created_by?.id }, companyId: reminder.companyId },
        });

        const offsetDays = this.convertToDays(reminder.reminder_start, reminder.reminder_start_unit);
        const when = (reminder.when || 'before').toLowerCase();
        const now = new Date();

        // Dynamically get the timezone offset in minutes from environment, defaulting to 330 (IST)
        const tzOffsetMinutes = parseInt(process.env.TIMEZONE_OFFSET || '330', 10);
        const tzOffsetHours = Math.floor(tzOffsetMinutes / 60);
        const tzOffsetMins = tzOffsetMinutes % 60;

        this.logger.log(
            `[SCHEDULER START] Mode=${isBulk ? 'BULK' : 'SINGLE'} | ${instruments.length} instruments | Reminder: ${reminder.id}`,
        );

        const jobsToInsert: any[] = [];

        if (isBulk) {
            // ── BULK MODE: one job per time-slot (instrumentId sentinel = 'ALL') ──────────
            // We use a representative due-date (earliest instrument) to anchor the schedule.
            // The handler will fetch all instruments at execution time.
            const dueDates = instruments
                .filter((i) => !!i.due_date)
                .map((i) => new Date(i.due_date));

            if (dueDates.length === 0) {
                this.logger.log('[JOB BATCH] No instruments with due_date — skipping bulk schedule.');
                return;
            }

            // For "before" mode we base schedule on the EARLIEST due date so reminders cover every instrument
            const anchorDate = when === 'after'
                ? new Date(Math.max(...dueDates.map((d) => d.getTime())))
                : new Date(Math.min(...dueDates.map((d) => d.getTime())));

            if (when === 'before' && offsetDays > 0) {
                const maxMails = reminder.no_of_mails && reminder.no_of_mails > 0 ? reminder.no_of_mails : offsetDays;
                const limit = Math.max(1, offsetDays - maxMails + 1);

                for (let daysBefore = offsetDays; daysBefore >= limit; daysBefore--) {
                    const scheduledDay = new Date(anchorDate);
                    scheduledDay.setDate(anchorDate.getDate() - daysBefore);

                    for (const mt of reminder.mail_times || []) {
                        const timeString = mt.time;
                        const [hours, minutes] = timeString.split(':').map(Number);
                        const scheduledTime = new Date(scheduledDay);
                        scheduledTime.setUTCHours(hours - tzOffsetHours, minutes - tzOffsetMins, 0, 0);

                        if (scheduledTime > now) {
                            const dateKey = scheduledDay.toISOString().substring(0, 10);
                            const timeKey = timeString.replace(':', '');
                            const key = `${reminder.id}_ALL_${dateKey}_${timeKey}`;
                            jobsToInsert.push({
                                data: { reminderId: reminder.id, instrumentId: 'ALL' },
                                startAfter: scheduledTime,
                                singletonKey: key,
                            });
                        }
                    }
                }
            } else {
                const scheduledDay = new Date(anchorDate);
                if (when === 'after') scheduledDay.setDate(scheduledDay.getDate() + offsetDays);

                for (const mt of reminder.mail_times || []) {
                    const timeString = mt.time;
                    const [hours, minutes] = timeString.split(':').map(Number);
                    const scheduledTime = new Date(scheduledDay);
                    scheduledTime.setUTCHours(hours - tzOffsetHours, minutes - tzOffsetMins, 0, 0);

                    if (scheduledTime > now) {
                        const key = `${reminder.id}_ALL_${timeString.replace(':', '')}`;
                        jobsToInsert.push({
                            data: { reminderId: reminder.id, instrumentId: 'ALL' },
                            startAfter: scheduledTime,
                            singletonKey: key,
                        });
                    }
                }
            }

        } else {
            // ── SINGLE MODE: one job per instrument per time-slot (original behavior) ───
            for (const inst of instruments) {
                if (!inst.due_date) {
                    this.logger.debug(`[SKIPPED] Instrument ${inst.name} (${inst.id}) has no due_date.`);
                    continue;
                }

                if (when === 'before' && offsetDays > 0) {
                    const maxMails = reminder.no_of_mails && reminder.no_of_mails > 0 ? reminder.no_of_mails : offsetDays;
                    const limit = Math.max(1, offsetDays - maxMails + 1);

                    for (let daysBefore = offsetDays; daysBefore >= limit; daysBefore--) {
                        const scheduledDay = new Date(inst.due_date);
                        scheduledDay.setDate(inst.due_date.getDate() - daysBefore);

                        for (const mt of reminder.mail_times || []) {
                            const timeString = mt.time;
                            const [hours, minutes] = timeString.split(':').map(Number);
                            const scheduledTime = new Date(scheduledDay);
                            scheduledTime.setUTCHours(hours - tzOffsetHours, minutes - tzOffsetMins, 0, 0);

                            if (scheduledTime > now) {
                                const dateKey = scheduledDay.toISOString().substring(0, 10);
                                const timeKey = timeString.replace(':', '');
                                const key = `${reminder.id}_${inst.id}_${dateKey}_${timeKey}`;
                                jobsToInsert.push({
                                    data: { reminderId: reminder.id, instrumentId: inst.id },
                                    startAfter: scheduledTime,
                                    singletonKey: key,
                                });
                            }
                        }
                    }
                } else {
                    const scheduledDay = new Date(inst.due_date);
                    if (when === 'after') scheduledDay.setDate(scheduledDay.getDate() + offsetDays);

                    for (const mt of reminder.mail_times || []) {
                        const timeString = mt.time;
                        const [hours, minutes] = timeString.split(':').map(Number);
                        const scheduledTime = new Date(scheduledDay);
                        scheduledTime.setUTCHours(hours - tzOffsetHours, minutes - tzOffsetMins, 0, 0);

                        if (scheduledTime > now) {
                            const key = `${reminder.id}_${inst.id}_${timeString.replace(':', '')}`;
                            jobsToInsert.push({
                                data: { reminderId: reminder.id, instrumentId: inst.id },
                                startAfter: scheduledTime,
                                singletonKey: key,
                            });
                        }
                    }
                }
            }
        }

        if (jobsToInsert.length > 0) {
            const chunkSize = 1000;
            for (let i = 0; i < jobsToInsert.length; i += chunkSize) {
                const chunk = jobsToInsert.slice(i, i + chunkSize);
                try {
                    await this.reminderJobService.insert(chunk, {});
                    this.logger.log(`[JOB BATCH] Inserted ${chunk.length} reminder jobs. Chunk ${i / chunkSize + 1}`);
                } catch (err) {
                    this.logger.error(`[JOB BATCH] Error inserting chunk: ${err?.message}`);
                }
            }
        } else {
            this.logger.log(`[JOB BATCH] No future jobs to schedule.`);
        }

        this.logger.log(`[SCHEDULER END] All instruments processed.`);
    }


    /**
     * Filters recipient entries by instrument location.
     * Recipient entry can be:
     * 1. A plain email string: "user@example.com" -> Treated as Global (matches all locations).
     * 2. An object: { email: "user@example.com", location?: "Plant 1" }
     *    - If location is empty, null, undefined, "ALL", or "GLOBAL", matches all locations.
     *    - If location matches targetLocation (case-insensitive trimmed), matches.
     *    - Otherwise filtered out.
     */
    private filterRecipientsByLocation(rawRecipients: any[], targetLocation?: string): string[] {
        if (!Array.isArray(rawRecipients) || rawRecipients.length === 0) return [];
        const normalizedTarget = (targetLocation || '').toLowerCase().trim();

        const matchingEmails = new Set<string>();

        for (const item of rawRecipients) {
            if (!item) continue;
            if (typeof item === 'string') {
                const email = item.trim();
                if (email) matchingEmails.add(email);
                continue;
            }

            if (typeof item === 'object' && item.email) {
                const email = String(item.email).trim();
                if (!email) continue;

                const loc = (item.location || '').toLowerCase().trim();
                const isGlobal = !loc || loc === 'all' || loc === 'global' || loc === 'all locations';

                if (isGlobal || (normalizedTarget && loc === normalizedTarget)) {
                    matchingEmails.add(email);
                }
            }
        }

        return Array.from(matchingEmails);
    }

    /**
     * Builds customized HTML table for bulk calibration reminder emails.
     */
    private buildBulkInstrumentsTableHtml(instruments: Instrument[], customColumns?: string[]): string {
        const AVAILABLE_COLUMNS: Record<string, { label: string; getValue: (inst: Instrument, idx: number) => string }> = {
            sino: { label: '#', getValue: (inst, idx) => String(idx + 1) },
            name: { label: 'Device / Gauge Name', getValue: (inst) => inst.name || '-' },
            id_code: { label: 'Gauge ID / Serial No', getValue: (inst) => inst.id_code || inst.serial_no || '-' },
            location: { label: 'Location', getValue: (inst) => inst.location || '-' },
            module: { label: 'Department / Module', getValue: (inst) => inst.module || '-' },
            due_date: { label: 'Due Date', getValue: (inst) => inst.due_date ? new Date(inst.due_date).toDateString() : '-' },
            last_calibration_date: { label: 'Last Cal. Date', getValue: (inst) => inst.last_calibration_date ? new Date(inst.last_calibration_date).toDateString() : '-' },
            frequency: { label: 'Frequency', getValue: (inst) => inst.frequency || '-' },
            make: { label: 'Make / Model', getValue: (inst) => inst.make || '-' },
            range: { label: 'Range / Size', getValue: (inst) => inst.range || '-' },
            least_count: { label: 'Least Count', getValue: (inst) => inst.least_count || '-' },
            item_status: { label: 'Status', getValue: (inst) => inst.item_status || inst.status || '-' },
            calibration_source: { label: 'Cal. Source', getValue: (inst) => inst.calibration_source || '-' },
        };

        const activeColumnKeys = Array.isArray(customColumns) && customColumns.length > 0
            ? customColumns.filter(k => AVAILABLE_COLUMNS[k])
            : ['sino', 'name', 'id_code', 'location', 'due_date'];

        const activeCols = activeColumnKeys.map(k => ({ key: k, ...AVAILABLE_COLUMNS[k] }));

        const headerCells = activeCols
            .map(c => `<th style="padding:10px;border:1px solid #ddd;text-align:left;">${c.label}</th>`)
            .join('');

        const tableRows = instruments.map((inst, i) => {
            const rowBg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
            const cells = activeCols
                .map(c => `<td style="padding:8px;border:1px solid #ddd;">${c.getValue(inst, i)}</td>`)
                .join('');
            return `<tr style="background:${rowBg}">${cells}</tr>`;
        }).join('');

        return `
            <table style="width:100%;border-collapse:collapse;margin-top:16px;font-family:sans-serif;font-size:14px;">
                <thead>
                    <tr style="background:#2563eb;color:#fff;">
                        ${headerCells}
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>`;
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
                email_mode: item.email_mode || 'single',
                bulk_columns: item.bulk_columns || ['sino', 'name', 'id_code', 'location', 'due_date'],
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
    // Worker handler: executes when PgBoss fires the job
    // ------------------------
    @ReminderJob.Handle()
    async handleReminderJob(job: PGBoss.Job<{ reminderId: string, instrumentId: string }>) {
        const reminderId = job.data.reminderId;
        this.logger.log(`PgBoss triggered reminder job → id: ${job.id}`);

        await this.processSingleReminder(job.data.reminderId, job.data.instrumentId);
    }

    // Core logic: handles both single-instrument and bulk (grouped) email modes
    private async processSingleReminder(reminderId: string, instrumentId: string) {
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
        const isBulk = (r.email_mode || 'single') === 'bulk';

        const config = await this.settingRepository.findOne({ where: { userId: r.created_by.id } });
        if (!config) {
            this.logger.warn(`Missing mail config for: ${r.created_by.id}`);
            return;
        }

        let rawRecipients: any[] = [];
        if (role.includes('junior')) rawRecipients = config.juniorRecipients || [];
        else if (role.includes('senior')) rawRecipients = config.seniorRecipients || [];
        else rawRecipients = config.supervisorRecipients || [];

        if ((rawRecipients || []).length === 0) {
            this.logger.warn(`No recipients configured for role: ${r.recipient_role}`);
            return;
        }

        const priorityLabel =
            priority === 'high' ? '[HIGH PRIORITY]' : priority === 'normal' ? '[NORMAL]' : '[LOW]';

        // ── BULK MODE ──────────────────────────────────────────────────────────────────
        if (isBulk || instrumentId === 'ALL') {
            const instruments = await this.instrumentRepository.find({
                where: { created_by: { id: r.created_by.id }, companyId: r.companyId },
            });

            const dueInstruments = instruments.filter((i) => {
                const s = (i.status || '').toLowerCase().trim();
                return !!i.due_date && s !== 'sent for calibration';
            });

            if (dueInstruments.length === 0) {
                this.logger.warn(`[BULK] No instruments with due_date (or all sent for calibration) for reminder ${r.id}`);
                return;
            }

            // Categorize recipients into global vs location-specific
            const globalRecipients = new Set<string>();
            const locationRecipientsMap = new Map<string, Set<string>>();

            for (const item of rawRecipients) {
                if (!item) continue;
                if (typeof item === 'string') {
                    if (item.trim()) globalRecipients.add(item.trim());
                    continue;
                }
                if (typeof item === 'object' && item.email) {
                    const email = String(item.email).trim();
                    if (!email) continue;
                    const loc = (item.location || '').trim();
                    const isGlobal = !loc || loc.toLowerCase() === 'all' || loc.toLowerCase() === 'global' || loc.toLowerCase() === 'all locations';
                    if (isGlobal) {
                        globalRecipients.add(email);
                    } else {
                        const locKey = loc.toLowerCase();
                        if (!locationRecipientsMap.has(locKey)) {
                            locationRecipientsMap.set(locKey, new Set<string>());
                        }
                        locationRecipientsMap.get(locKey)!.add(email);
                    }
                }
            }

            const bulkCols = r.bulk_columns || config.defaultBulkReminderColumns || ['sino', 'name', 'id_code', 'location', 'due_date'];

            // 1. Send to Global Recipients (all due instruments across all locations)
            if (globalRecipients.size > 0) {
                const globalRecipList = Array.from(globalRecipients);
                const tableHtml = this.buildBulkInstrumentsTableHtml(dueInstruments, bulkCols);
                const html = `
                    <div style="font-family:sans-serif;">
                        <p>${r.mail_template || 'Please find the list of instruments due for calibration.'}</p>
                        ${tableHtml}
                        <br/>
                        <p>Priority: <b>${priority.toUpperCase()}</b></p>
                        <p>Reminder: ${when.toUpperCase()} ${offsetDays} days</p>
                    </div>`;
                const subject = `${priorityLabel} Calibration Reminder: ${dueInstruments.length} instrument${dueInstruments.length > 1 ? 's' : ''} due`;

                await this.mailerService.sendMail({ to: globalRecipList, subject, html, userId: r.created_by.id });
                this.logger.log(`[BULK EMAIL SENT - GLOBAL] ${dueInstruments.length} instruments → ${globalRecipList.join(', ')}`);
            }

            // 2. Send to Location-Specific Recipients (filtered strictly by recipient location)
            for (const [locKey, emailsSet] of locationRecipientsMap.entries()) {
                const locEmails = Array.from(emailsSet);
                const locInstruments = dueInstruments.filter(
                    i => (i.location || '').toLowerCase().trim() === locKey
                );

                if (locInstruments.length > 0 && locEmails.length > 0) {
                    const tableHtml = this.buildBulkInstrumentsTableHtml(locInstruments, bulkCols);
                    const html = `
                        <div style="font-family:sans-serif;">
                            <p>${r.mail_template || 'Please find the list of instruments due for calibration.'}</p>
                            ${tableHtml}
                            <br/>
                            <p>Priority: <b>${priority.toUpperCase()}</b></p>
                            <p>Reminder: ${when.toUpperCase()} ${offsetDays} days</p>
                        </div>`;
                    const subject = `${priorityLabel} Calibration Reminder [Location: ${locInstruments[0]?.location || locKey}]: ${locInstruments.length} instrument${locInstruments.length > 1 ? 's' : ''} due`;

                    await this.mailerService.sendMail({ to: locEmails, subject, html, userId: r.created_by.id });
                    this.logger.log(`[BULK EMAIL SENT - LOCATION: ${locKey}] ${locInstruments.length} instruments → ${locEmails.join(', ')}`);
                }
            }

            await this.notificationsService.createNotification({
                companyId: r.companyId,
                userId: r.created_by.id,
                type: 'gauge_due',
                title: 'Gauge Due Alert (Bulk)',
                message: `${dueInstruments.length} instrument(s) are due for calibration.`,
            });

            return;
        }

        // ── SINGLE MODE ────────────────────────────────────────────────────────────────
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

        if ((inst.status || '').toLowerCase().trim() === 'sent for calibration') {
            this.logger.log(`[SKIPPED REMINDER] Instrument ${inst.id_code} is "Sent for Calibration" — reminders paused.`);
            return;
        }

        // Location-based recipient matching:
        const recipients = this.filterRecipientsByLocation(rawRecipients, inst.location);
        if (recipients.length === 0) {
            this.logger.warn(`[SKIPPED REMINDER] No matching recipients for role "${r.recipient_role}" at location "${inst.location || 'N/A'}" (Gauge: ${inst.name} / ${inst.id_code})`);
            return;
        }

        const html =
            (r.mail_template || '')
                .replace('{{device_name}}', inst.name || '')
                .replace('{{serial_number}}', inst.id_code || inst.serial_no || '')
                .replace('{{calibration_date}}', inst.due_date ? inst.due_date.toDateString() : '') +
            `<br/><br/>Location: <b>${inst.location || 'N/A'}</b>` +
            `<br/>Priority: <b>${priority.toUpperCase()}</b>` +
            `<br/>Reminder: ${when.toUpperCase()} ${offsetDays} days`;

        await this.mailerService.sendMail({
            to: recipients,
            subject: `${priorityLabel} Reminder: ${inst.name}`,
            html,
            userId: r.created_by.id,
        });

        await this.notificationsService.createNotification({
            companyId: r.companyId,
            userId: r.created_by.id,
            type: 'gauge_due',
            title: 'Gauge Due Alert',
            message: `Instrument "${inst.name}" (S/N: ${inst.id_code}) is due for calibration on ${inst.due_date ? inst.due_date.toDateString() : 'N/A'}.`,
        });

        this.logger.log(`[SINGLE EMAIL SENT] ${inst.name} → ${recipients.join(', ')}`);
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