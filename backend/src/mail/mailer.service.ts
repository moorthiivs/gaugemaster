import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from 'src/settings/entities/setting.entity';

import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class MailerService {
    private readonly logger = new Logger(MailerService.name);

    constructor(
        @InjectRepository(Setting)
        private readonly mailConfigRepository: Repository<Setting>,
        private readonly notificationsService: NotificationsService,
    ) { }

    /**
     * Fetch mail configuration for a specific user
     */
    async getMailConfig(userId: string) {
        const config = await this.mailConfigRepository.findOne({ where: { userId } });

        if (!config) {
            this.logger.warn(`⚠️ No SMTP configuration found for user ${userId}`);
            return null;
        }

        return config;
    }

    /**
     * Send email to list of recipients
     */
    async sendMail({
        to,
        subject,
        html,
        userId,
    }: {
        to: string[];
        subject: string;
        html: string;
        userId: string;
    }) {
        try {
            // 1️⃣ Get user-specific mail config
            const smtpSetting = await this.getMailConfig(userId);

            if (!smtpSetting?.smtpConfig) {
                throw new BadRequestException(`No SMTP configuration found for user ${userId}. Please update SMTP settings in Settings > Mail Configuration.`);
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


            // 3️⃣ Send email
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
        } catch (err) {
            let errorMessage = err.message;
            if (err.code === 'EAUTH') {
                errorMessage = 'Invalid email username or password. Please check your SMTP credentials.';
            }
            this.logger.error(`❌ Error sending email: ${errorMessage}`);
            
            // Try to get companyId if available
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



    async sendCalibrationAgency(params: any) {
        const smtpSetting = await this.getMailConfig(params.userId);

        if (!smtpSetting?.smtpConfig) {
            throw new BadRequestException(`No SMTP configuration found for user ${params.userId}. Please update SMTP settings in Settings > Mail Configuration.`);
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
        
        const columnLabels: Record<string, string> = {
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

        const trList = params.instruments.map((item: any) => {
            const tdList = selectedColumns.map(col => {
                let val = item[col];
                if (!val && col === 'name') val = item.instrumentName;
                if (!val) val = '-';
                
                if (col === 'last_calibration_date' || col === 'due_date' || col === 'gauge_issue_date') {
                    if (val !== '-' && val) {
                        const d = new Date(val);
                        if (!isNaN(d.getTime())) {
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const year = d.getFullYear();
                            val = `${day}-${month}-${year}`;
                        } else {
                            val = '-';
                        }
                    } else {
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

        // Generate HTML body
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
        } catch (err) {
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
            throw new BadRequestException(errorMessage);
        }
    }

    /**
     * Send a test email to verify SMTP configuration
     */
    async sendTestMail(userId: string, targetEmail: string) {
        try {
            const smtpSetting = await this.getMailConfig(userId);

            if (!smtpSetting?.smtpConfig) {
                throw new BadRequestException(`No SMTP configuration found for user ${userId}. Please update SMTP settings in Settings > Mail Configuration.`);
            }

            const smtp = smtpSetting.smtpConfig;
            
            // secure: true for port 465, false for other ports
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
            
        } catch (error) {
            let errorMessage = error.message;
            if (error.code === 'EAUTH') {
                errorMessage = 'Invalid email username or password. Please check your SMTP credentials.';
            }
            this.logger.error(`Test email failed: ${errorMessage}`);
            throw new BadRequestException(errorMessage); 
        }
    }

}
