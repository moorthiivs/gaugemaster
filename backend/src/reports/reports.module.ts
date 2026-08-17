import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Instrument } from 'src/instruments/instrument.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../settings/settings.module';
import { ReportTemplatesModule } from '../report-templates/report-templates.module';

import { User } from 'src/users/user.entity';

import { CalibrationHistory } from 'src/instruments/calibration-history.entity';
import { LocationEmail } from 'src/settings/entities/location-email.entity';
import { Setting } from 'src/settings/entities/setting.entity';
import { MailerModule } from 'src/mail/mailer.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { SummaryReportService } from './summary-report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Instrument, User, CalibrationHistory, LocationEmail, Setting]),
    SettingsModule,
    ReportTemplatesModule,
    MailerModule,
    NotificationsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, SummaryReportService],
  exports: [ReportsService, SummaryReportService],
})
export class ReportsModule { }