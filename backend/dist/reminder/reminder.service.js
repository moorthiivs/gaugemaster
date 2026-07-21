"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ReminderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const instrument_entity_1 = require("../instruments/instrument.entity");
const setting_entity_1 = require("../settings/entities/setting.entity");
const mailer_service_1 = require("../mail/mailer.service");
const reminder_entity_1 = require("./reminder.entity");
const reminder_job_1 = require("./reminder.job");
const nest_pg_boss_1 = require("@loctax/nest-pg-boss");
const PGBoss = __importStar(require("pg-boss"));
const notifications_service_1 = require("../notifications/notifications.service");
let ReminderService = ReminderService_1 = class ReminderService {
    instrumentRepository;
    settingRepository;
    remainderRepository;
    mailerService;
    reminderJobService;
    notificationsService;
    logger = new common_1.Logger(ReminderService_1.name);
    constructor(instrumentRepository, settingRepository, remainderRepository, mailerService, reminderJobService, notificationsService) {
        this.instrumentRepository = instrumentRepository;
        this.settingRepository = settingRepository;
        this.remainderRepository = remainderRepository;
        this.mailerService = mailerService;
        this.reminderJobService = reminderJobService;
        this.notificationsService = notificationsService;
    }
    convertToDays(value, unit) {
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
    getMatchCondition(dueDate, today, offsetDays, when) {
        const d1 = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const d2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const diffDays = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
        if (when === "before")
            return diffDays === offsetDays;
        if (when === "after")
            return diffDays === -offsetDays;
        return false;
    }
    async scheduleReminderJobs(reminder) {
        const isBulk = (reminder.email_mode || 'single') === 'bulk';
        const instruments = await this.instrumentRepository.find({
            where: { created_by: { id: reminder.created_by?.id }, companyId: reminder.companyId },
        });
        const offsetDays = this.convertToDays(reminder.reminder_start, reminder.reminder_start_unit);
        const when = (reminder.when || 'before').toLowerCase();
        const now = new Date();
        const tzOffsetMinutes = parseInt(process.env.TIMEZONE_OFFSET || '330', 10);
        const tzOffsetHours = Math.floor(tzOffsetMinutes / 60);
        const tzOffsetMins = tzOffsetMinutes % 60;
        this.logger.log(`[SCHEDULER START] Mode=${isBulk ? 'BULK' : 'SINGLE'} | ${instruments.length} instruments | Reminder: ${reminder.id}`);
        const jobsToInsert = [];
        if (isBulk) {
            const dueDates = instruments
                .filter((i) => !!i.due_date)
                .map((i) => new Date(i.due_date));
            if (dueDates.length === 0) {
                this.logger.log('[JOB BATCH] No instruments with due_date — skipping bulk schedule.');
                return;
            }
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
            }
            else {
                const scheduledDay = new Date(anchorDate);
                if (when === 'after')
                    scheduledDay.setDate(scheduledDay.getDate() + offsetDays);
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
        }
        else {
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
                }
                else {
                    const scheduledDay = new Date(inst.due_date);
                    if (when === 'after')
                        scheduledDay.setDate(scheduledDay.getDate() + offsetDays);
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
                }
                catch (err) {
                    this.logger.error(`[JOB BATCH] Error inserting chunk: ${err?.message}`);
                }
            }
        }
        else {
            this.logger.log(`[JOB BATCH] No future jobs to schedule.`);
        }
        this.logger.log(`[SCHEDULER END] All instruments processed.`);
    }
    async saveReminder(data) {
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
    async updateReminder(payload) {
        const reminder = await this.remainderRepository.findOne({ where: { id: payload.id } });
        if (!reminder)
            throw new common_1.NotFoundException('Reminder not found');
        const updated = Object.assign(reminder, payload);
        const result = await this.remainderRepository.save(updated);
        try {
            await this.reminderJobService.unschedule().catch(() => null);
        }
        catch (err) {
            this.logger.debug('Unschedule error: ' + err?.message);
        }
        await this.scheduleReminderJobs(result);
        return result;
    }
    async deleteReminder(id) {
        const reminder = await this.remainderRepository.findOne({ where: { id } });
        if (!reminder)
            throw new common_1.NotFoundException('Reminder not found');
        reminder.isactive = false;
        reminder.updated_at = new Date();
        await this.remainderRepository.save(reminder);
        try {
            await this.reminderJobService.unschedule().catch(() => null);
            this.logger.log(`Unschedule called for reminder jobs`);
        }
        catch (err) {
            this.logger.debug('Unschedule error: ' + err?.message);
        }
        return { message: 'Reminder deleted' };
    }
    async handleReminderJob(job) {
        const reminderId = job.data.reminderId;
        this.logger.log(`PgBoss triggered reminder job → id: ${job.id}`);
        await this.processSingleReminder(job.data.reminderId, job.data.instrumentId);
    }
    async processSingleReminder(reminderId, instrumentId) {
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
        let recipients = [];
        if (role.includes('junior'))
            recipients = config.juniorRecipients || [];
        else if (role.includes('senior'))
            recipients = config.seniorRecipients || [];
        else
            recipients = config.supervisorRecipients || [];
        if ((recipients || []).length === 0) {
            this.logger.warn(`No recipients found for role: ${r.recipient_role}`);
            return;
        }
        const priorityLabel = priority === 'high' ? '[HIGH PRIORITY]' : priority === 'normal' ? '[NORMAL]' : '[LOW]';
        if (isBulk || instrumentId === 'ALL') {
            const instruments = await this.instrumentRepository.find({
                where: { created_by: { id: r.created_by.id }, companyId: r.companyId },
            });
            const dueInstruments = instruments.filter((i) => !!i.due_date);
            if (dueInstruments.length === 0) {
                this.logger.warn(`[BULK] No instruments with due_date for reminder ${r.id}`);
                return;
            }
            const tableRows = dueInstruments
                .map((inst, i) => `<tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#ffffff'}">
                            <td style="padding:8px;border:1px solid #ddd;">${i + 1}</td>
                            <td style="padding:8px;border:1px solid #ddd;">${inst.name}</td>
                            <td style="padding:8px;border:1px solid #ddd;">${inst.id_code ?? '-'}</td>
                            <td style="padding:8px;border:1px solid #ddd;">${inst.due_date ? new Date(inst.due_date).toDateString() : '-'}</td>
                        </tr>`)
                .join('');
            const tableHtml = `
                <table style="width:100%;border-collapse:collapse;margin-top:16px;font-family:sans-serif;font-size:14px;">
                    <thead>
                        <tr style="background:#2563eb;color:#fff;">
                            <th style="padding:10px;border:1px solid #ddd;text-align:left;">#</th>
                            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Device Name</th>
                            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Serial Number</th>
                            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Calibration Due Date</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>`;
            const html = `
                <div style="font-family:sans-serif;">
                    <p>${r.mail_template || 'Please find the list of instruments due for calibration.'}</p>
                    ${tableHtml}
                    <br/>
                    <p>Priority: <b>${priority.toUpperCase()}</b></p>
                    <p>Reminder: ${when.toUpperCase()} ${offsetDays} days</p>
                </div>`;
            const subject = `${priorityLabel} Calibration Reminder: ${dueInstruments.length} instrument${dueInstruments.length > 1 ? 's' : ''} due`;
            await this.mailerService.sendMail({ to: recipients, subject, html, userId: r.created_by.id });
            await this.notificationsService.createNotification({
                companyId: r.companyId,
                userId: r.created_by.id,
                type: 'gauge_due',
                title: 'Gauge Due Alert (Bulk)',
                message: `${dueInstruments.length} instrument(s) are due for calibration.`,
            });
            this.logger.log(`[BULK EMAIL SENT] ${dueInstruments.length} instruments → reminder ${r.id}`);
            return;
        }
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
        const html = (r.mail_template || '')
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
        await this.notificationsService.createNotification({
            companyId: r.companyId,
            userId: r.created_by.id,
            type: 'gauge_due',
            title: 'Gauge Due Alert',
            message: `Instrument "${inst.name}" (S/N: ${inst.id_code}) is due for calibration on ${inst.due_date.toDateString()}.`,
        });
        this.logger.log(`[SINGLE EMAIL SENT] ${inst.name} → reminder ${r.id}`);
    }
    async fetchrequencyData(query) {
        return this.remainderRepository.find({
            where: {
                created_by: { id: query.created_by },
                companyId: query.companyId,
                recipient_role: query.recipient_role,
                isactive: true,
            },
        });
    }
};
exports.ReminderService = ReminderService;
__decorate([
    reminder_job_1.ReminderJob.Handle(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReminderService.prototype, "handleReminderJob", null);
exports.ReminderService = ReminderService = ReminderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(instrument_entity_1.Instrument)),
    __param(1, (0, typeorm_1.InjectRepository)(setting_entity_1.Setting)),
    __param(2, (0, typeorm_1.InjectRepository)(reminder_entity_1.ReminderFrequncy)),
    __param(4, reminder_job_1.ReminderJob.Inject()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        mailer_service_1.MailerService,
        nest_pg_boss_1.JobService,
        notifications_service_1.NotificationsService])
], ReminderService);
//# sourceMappingURL=reminder.service.js.map