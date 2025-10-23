import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';
import { Instrument } from 'src/instruments/instrument.entity';
import { Setting } from 'src/settings/entities/setting.entity';

import { MailerModule } from 'src/mail/mailer.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([Instrument, Setting]),
    MailerModule,
  ],
  controllers: [ReminderController],
  providers: [ReminderService],
})
export class ReminderModule { }
