import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from 'src/settings/entities/setting.entity';

@Injectable()
export class MailerService {
    private readonly logger = new Logger(MailerService.name);

    constructor(
        @InjectRepository(Setting)
        private readonly mailConfigRepository: Repository<Setting>,
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
                throw new Error(`No SMTP configuration found for user ${userId}`);
            }

            const smtp = smtpSetting.smtpConfig;

            console.log(smtp, "smtp");

            // 2️⃣ Create transporter based on stored encryption
            const transporter = nodemailer.createTransport({
                host: smtp.smtpServer,
                port: Number(smtp.smtpPort) || 587,
                secure: smtp.encryption === 'ssl',
                auth: {
                    user: smtp.username,
                    pass: smtp.password,
                },
            });


            // 3️⃣ Send email
            await transporter.sendMail({
                from: smtp.username,
                to,
                subject,
                html,
            });

            this.logger.log(`📧 Mail sent to ${to.join(', ')} (user ${userId})`);
        } catch (err) {
            this.logger.error(`❌ Error sending email: ${err.message}`);
        }
    }
}
