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
var MailerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailerService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const setting_entity_1 = require("../settings/entities/setting.entity");
const notifications_service_1 = require("../notifications/notifications.service");
let MailerService = MailerService_1 = class MailerService {
    mailConfigRepository;
    notificationsService;
    logger = new common_1.Logger(MailerService_1.name);
    constructor(mailConfigRepository, notificationsService) {
        this.mailConfigRepository = mailConfigRepository;
        this.notificationsService = notificationsService;
    }
    async getMailConfig(userId) {
        const config = await this.mailConfigRepository.findOne({ where: { userId } });
        if (!config) {
            this.logger.warn(`⚠️ No SMTP configuration found for user ${userId}`);
            return null;
        }
        return config;
    }
    async sendMail({ to, subject, html, userId, }) {
        try {
            const smtpSetting = await this.getMailConfig(userId);
            if (!smtpSetting?.smtpConfig) {
                throw new common_1.BadRequestException(`No SMTP configuration found for user ${userId}. Please update SMTP settings in Settings > Mail Configuration.`);
            }
            const smtp = smtpSetting.smtpConfig;
            console.log(smtp, "smtp");
            const isSecure = Number(smtp.smtpPort) === 465 || smtp.encryption === 'ssl';
            const transporter = nodemailer.createTransport({
                host: smtp.smtpServer,
                port: Number(smtp.smtpPort) || 587,
                secure: isSecure,
                auth: {
                    user: smtp.username,
                    pass: smtp.password,
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            await transporter.sendMail({
                from: smtp.username,
                to,
                subject,
                html,
            });
            this.logger.log(`📧 Mail sent to ${to.join(', ')} (user ${userId})`);
            await this.notificationsService.createNotification({
                companyId: smtpSetting.companyId,
                userId: userId,
                type: 'mail_success',
                title: 'Mail Sent Successfully',
                message: `Subject: ${subject} sent to ${to.length} recipient(s).`
            });
        }
        catch (err) {
            let errorMessage = err.message;
            if (err.code === 'EAUTH') {
                errorMessage = 'Invalid email username or password. Please check your SMTP credentials.';
            }
            this.logger.error(`❌ Error sending email: ${errorMessage}`);
            const smtpSetting = await this.mailConfigRepository.findOne({ where: { userId } });
            if (smtpSetting) {
                await this.notificationsService.createNotification({
                    companyId: smtpSetting.companyId,
                    userId: userId,
                    type: 'mail_error',
                    title: 'Mail Sending Failed',
                    message: `Failed to send mail: ${errorMessage}`
                });
            }
        }
    }
    async sendCalibrationAgency(params) {
        const smtpSetting = await this.getMailConfig(params.userId);
        if (!smtpSetting?.smtpConfig) {
            throw new common_1.BadRequestException(`No SMTP configuration found for user ${params.userId}. Please update SMTP settings in Settings > Mail Configuration.`);
        }
        const smtp = smtpSetting.smtpConfig;
        const isSecure = Number(smtp.smtpPort) === 465 || smtp.encryption === 'ssl';
        const transporter = nodemailer.createTransport({
            host: smtp.smtpServer,
            port: Number(smtp.smtpPort) || 587,
            secure: isSecure,
            auth: {
                user: smtp.username,
                pass: smtp.password,
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        const selectedColumns = params.columns || ['name', 'id_code', 'location', 'last_calibration_date', 'due_date', 'frequency', 'status'];
        const columnLabels = {
            sino: 'S.No',
            name: 'Name',
            id_code: 'ID Code',
            location: 'Location',
            last_calibration_date: 'Last Calibration Date',
            due_date: 'Due Date',
            frequency: 'Frequency',
            status: 'Status',
            item_status: 'Item Status',
            range: 'Range',
            serial_no: 'Serial No',
            least_count: 'Least Count',
            make: 'Make',
            item_type: 'Item Type',
            part_no: 'Part No',
            part_name: 'Part Name',
            calibration_source: 'Calibration Source',
            customer: 'Customer',
            sector: 'Sector',
            criticality_level: 'Criticality Level',
            cert_no: 'Cert. No.',
            remarks: 'Remarks',
            gauge_issue_date: 'Gauge Issue Date',
            gauges_received_by: 'Gauges Received By',
            gauges_issued_by: 'Gauges Issued By',
            calibration_procedure: 'Calibration Procedure',
            traceable: 'Traceable'
        };
        const thList = selectedColumns.map(col => `<th style="padding: 8px; border: 1px solid #ddd; text-align: left; background-color: #f2f2f2;">${columnLabels[col] || col}</th>`).join('');
        const trList = params.instruments.map((item) => {
            const tdList = selectedColumns.map(col => {
                let val = item[col];
                if (!val && col === 'name')
                    val = item.instrumentName;
                if (!val)
                    val = '-';
                if (col === 'last_calibration_date' || col === 'due_date' || col === 'gauge_issue_date') {
                    if (val !== '-' && val) {
                        const d = new Date(val);
                        if (!isNaN(d.getTime())) {
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const year = d.getFullYear();
                            val = `${day}-${month}-${year}`;
                        }
                        else {
                            val = '-';
                        }
                    }
                    else {
                        val = '-';
                    }
                }
                return `<td style="padding: 8px; border: 1px solid #ddd;">${val}</td>`;
            }).join('');
            return `<tr>${tdList}</tr>`;
        }).join('');
        const tableHtml = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr>${thList}</tr>
                </thead>
                <tbody>
                    ${trList}
                </tbody>
            </table>
        `;
        const html = `
  <h3>Calibration Request</h3>

  <p><strong>Description:</strong> ${params.description}</p>

  <h4>Selected Instruments:</h4>
  ${tableHtml}

  <p>Thank You.</p>
`;
        const subject = "Calibration Agency Request";
        try {
            await transporter.sendMail({
                from: smtp.username,
                to: params.to,
                subject,
                html,
            });
            await this.notificationsService.createNotification({
                companyId: smtpSetting.companyId,
                userId: params.userId,
                type: 'mail_success',
                title: 'Calibration Request Sent',
                message: `Sent to ${params.to} for ${params.instruments.length} instrument(s).`
            });
            return { message: "Email sent successfully" };
        }
        catch (err) {
            let errorMessage = err.message;
            if (err.code === 'EAUTH') {
                errorMessage = 'Invalid email username or password. Please check your SMTP credentials.';
            }
            await this.notificationsService.createNotification({
                companyId: smtpSetting.companyId,
                userId: params.userId,
                type: 'mail_error',
                title: 'Calibration Request Failed',
                message: `Failed to send mail: ${errorMessage}`
            });
            throw new common_1.BadRequestException(errorMessage);
        }
    }
    async sendTestMail(userId, targetEmail) {
        try {
            const smtpSetting = await this.getMailConfig(userId);
            if (!smtpSetting?.smtpConfig) {
                throw new common_1.BadRequestException(`No SMTP configuration found for user ${userId}. Please update SMTP settings in Settings > Mail Configuration.`);
            }
            const smtp = smtpSetting.smtpConfig;
            const isSecure = Number(smtp.smtpPort) === 465 || smtp.encryption === 'ssl';
            const transporter = nodemailer.createTransport({
                host: smtp.smtpServer,
                port: Number(smtp.smtpPort) || 587,
                secure: isSecure,
                auth: {
                    user: smtp.username,
                    pass: smtp.password,
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            const subject = "Gaugemaster - SMTP Test Email";
            const html = `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                    <h2 style="color: #2563eb;">Test Email Successful!</h2>
                    <p>Hello,</p>
                    <p>This is a test email from your Gaugemaster application. If you are reading this, it means your SMTP configuration is working correctly.</p>
                    <p style="font-size: 0.875rem; color: #666; margin-top: 20px;">
                        Sent on: ${new Date().toLocaleString()}
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 0.75rem; color: #999;">
                        This is an automated message. Please do not reply.
                    </p>
                </div>
            `;
            const info = await transporter.sendMail({
                from: smtp.username,
                to: targetEmail,
                subject,
                html,
            });
            this.logger.log(`Test email sent to ${targetEmail}: ${info.messageId}`);
            return { message: `Test email sent successfully to ${targetEmail}` };
        }
        catch (error) {
            let errorMessage = error.message;
            if (error.code === 'EAUTH') {
                errorMessage = 'Invalid email username or password. Please check your SMTP credentials.';
            }
            this.logger.error(`Test email failed: ${errorMessage}`);
            throw new common_1.BadRequestException(errorMessage);
        }
    }
};
exports.MailerService = MailerService;
exports.MailerService = MailerService = MailerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(setting_entity_1.Setting)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        notifications_service_1.NotificationsService])
], MailerService);
//# sourceMappingURL=mailer.service.js.map