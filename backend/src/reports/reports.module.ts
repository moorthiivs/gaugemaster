import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Instrument } from 'src/instruments/instrument.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../settings/settings.module';
import { ReportTemplatesModule } from '../report-templates/report-templates.module';

import { User } from 'src/users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Instrument, User]),
    SettingsModule,
    ReportTemplatesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule { }