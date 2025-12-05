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
let ReminderService = ReminderService_1 = class ReminderService {
    instrumentRepository;
    settingRepository;
    remainderRepository;
    mailerService;
    reminderJobService;
    logger = new common_1.Logger(ReminderService_1.name);
    constructor(instrumentRepository, settingRepository, remainderRepository, mailerService, reminderJobService) {
        this.instrumentRepository = instrumentRepository;
        this.settingRepository = settingRepository;
        this.remainderRepository = remainderRepository;
        this.mailerService = mailerService;
        this.reminderJobService = reminderJobService;
    }
    convertToDays(value, unit) {
        switch (unit.toLowerCase()) {
            case "days": return value;
            case "weeks": return value * 7;
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
        const instruments = await this.instrumentRepository.find({
            where: { created_by: { id: reminder.created_by?.id }, companyId: reminder.companyId },
        });
        const offsetDays = this.convertToDays(reminder.reminder_start, reminder.reminder_start_unit);
        const when = (reminder.when || 'before').toLowerCase();
        const now = new Date();
        this.logger.log(`[SCHEDULER START] Processing ${instruments.length} instruments for Reminder ID: ${reminder.id}`);
        for (const inst of instruments) {
            if (when === 'before' && offsetDays > 0) {
                for (let daysBefore = offsetDays; daysBefore >= 1; daysBefore--) {
                    const scheduledDay = new Date(inst.due_date);
                    scheduledDay.setDate(inst.due_date.getDate() - daysBefore);
                    for (const mt of reminder.mail_times || []) {
                        const timeString = mt.time;
                        const [hours, minutes] = timeString.split(':').map(Number);
                        const scheduledTime = new Date(scheduledDay);
                        scheduledTime.setHours(hours, minutes, 0, 0);
                        this.logger.log(`[CALCULATION] Instrument: ${inst.name}. Processing mail_time: ${timeString}. Target Day: ${scheduledDay.toDateString()}. Recurrence: Daily, ${daysBefore} days before.`);
                        if (scheduledTime > now) {
                            const dateKey = scheduledDay.toISOString().substring(0, 10);
                            const timeKey = timeString.replace(':', '');
                            const key = `${reminder.id}_${inst.id}_${dateKey}_${timeKey}`;
                            await this.reminderJobService.sendOnce({ reminderId: reminder.id, instrumentId: inst.id }, { startAfter: scheduledTime }, key);
                            this.logger.log(`[JOB SENT] Scheduled DAILY reminder for ${inst.name} at ${scheduledTime.toTimeString()} (Key: ${key})`);
                        }
                        else {
                            this.logger.debug(`[SKIPPED] Past job for ${inst.name} on ${scheduledTime.toDateString()} at ${timeString}`);
                        }
                    }
                }
            }
            else {
                const scheduledDay = new Date(inst.due_date);
                if (when === 'after') {
                    scheduledDay.setDate(scheduledDay.getDate() + offsetDays);
                }
                for (const mt of reminder.mail_times || []) {
                    const timeString = mt.time;
                    const [hours, minutes] = timeString.split(':').map(Number);
                    const scheduledTime = new Date(scheduledDay);
                    scheduledTime.setHours(hours, minutes, 0, 0);
                    this.logger.log(`[CALCULATION] Instrument: ${inst.name}. Processing mail_time: ${timeString}. Target Time: ${scheduledTime.toTimeString()}. Recurrence: Single-Day.`);
                    if (scheduledTime > now) {
                        const key = `${reminder.id}_${inst.id}_${timeString.replace(':', '')}`;
                        await this.reminderJobService.sendOnce({ reminderId: reminder.id, instrumentId: inst.id }, { startAfter: scheduledTime }, key);
                        this.logger.log(`[JOB SENT] Scheduled SINGLE-DAY reminder for ${inst.name} at ${scheduledTime.toTimeString()} (Key: ${key})`);
                    }
                    else {
                        this.logger.debug(`[SKIPPED] Past job for ${inst.name} on ${scheduledTime.toDateString()} at ${timeString}`);
                    }
                }
            }
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
        this.logger.log(`EMAIL SENT → ${inst.name} for reminder ${r.id}`);
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
        nest_pg_boss_1.JobService])
], ReminderService);
//# sourceMappingURL=reminder.service.js.map