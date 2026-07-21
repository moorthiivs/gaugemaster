import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Instrument } from 'src/instruments/instrument.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../settings/settings.module';
import { ReportTemplatesModule } from '../report-templates/report-templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Instrument]),
    SettingsModule,
    ReportTemplatesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule { }