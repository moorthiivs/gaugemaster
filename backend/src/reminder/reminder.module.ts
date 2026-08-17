import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';
import { Instrument } from 'src/instruments/instrument.entity';
import { Setting } from 'src/settings/entities/setting.entity';

import { MailerModule } from 'src/mail/mailer.module';
import { ReminderFrequncy } from './reminder.entity';
import { ReminderJob } from './reminder.job';


import { NotificationsModule } from 'src/notifications/notifications.module';

import { LocationEmail } from 'src/settings/entities/location-email.entity';
import { StatusNotificationService } from './status-notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReminderFrequncy, Instrument, Setting, LocationEmail]),
    MailerModule,
    NotificationsModule
  ],
  controllers: [ReminderController],
  providers: [
    ReminderService,
    StatusNotificationService,
    ReminderJob.ServiceProvider,
  ],
  exports: [ReminderService, StatusNotificationService],
})
export class ReminderModule { }
