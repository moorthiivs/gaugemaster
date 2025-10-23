"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const date_fns_1 = require("date-fns");
const instrument_entity_1 = require("../instruments/instrument.entity");
const setting_entity_1 = require("../settings/entities/setting.entity");
const mailer_service_1 = require("../mail/mailer.service");
let ReminderService = ReminderService_1 = class ReminderService {
    instrumentRepository;
    settingRepository;
    mailerService;
    logger = new common_1.Logger(ReminderService_1.name);
    constructor(instrumentRepository, settingRepository, mailerService) {
        this.instrumentRepository = instrumentRepository;
        this.settingRepository = settingRepository;
        this.mailerService = mailerService;
    }
    async handleReminderJob() {
        this.logger.log('🔔 Running daily reminder cron job...');
        const today = new Date();
        const instruments = await this.instrumentRepository.find({
            relations: ['created_by'],
        });
        for (const instrument of instruments) {
            const daysDiff = (0, date_fns_1.differenceInDays)(instrument.due_date, today);
            if (daysDiff === 2) {
                await this.sendReminder('junior', instrument);
            }
            else if (daysDiff === 0) {
                await this.sendReminder('senior', instrument);
            }
            else if (daysDiff === -7) {
                await this.sendReminder('supervisor', instrument);
            }
        }
        this.logger.log('✅ Reminder job completed');
    }
    async sendReminder(role, instrument) {
        try {
            const config = await this.settingRepository.findOne({
                where: { userId: instrument.created_by?.id },
            });
            if (!config) {
                this.logger.warn(`⚠️ No mail config found for user ${instrument.created_by?.id}`);
                return;
            }
            const recipients = role === 'junior'
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
            this.logger.log(`📧 ${role} reminder sent for ${instrument.name} to ${recipients.join(', ')}`);
        }
        catch (err) {
            this.logger.error(`❌ Failed to send ${role} reminder for ${instrument.name}:`, err);
        }
    }
};
exports.ReminderService = ReminderService;
__decorate([
    (0, schedule_1.Cron)('38 20 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReminderService.prototype, "handleReminderJob", null);
exports.ReminderService = ReminderService = ReminderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(instrument_entity_1.Instrument)),
    __param(1, (0, typeorm_1.InjectRepository)(setting_entity_1.Setting)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        mailer_service_1.MailerService])
], ReminderService);
//# sourceMappingURL=reminder.service.js.map