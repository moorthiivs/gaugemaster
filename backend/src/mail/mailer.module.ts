// src/mail/mailer.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerService } from './mailer.service';
import { Setting } from 'src/settings/entities/setting.entity';

import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
    imports: [TypeOrmModule.forFeature([Setting]), NotificationsModule],
    providers: [MailerService],
    exports: [MailerService], 
})
export class MailerModule { }
