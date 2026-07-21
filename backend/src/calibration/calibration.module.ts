import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Calibration } from './calibration.entity';
import { CalibrationDraft } from './calibration-draft.entity';
import { CalibrationService } from './calibration.service';
import { CertificateService } from './certificate.service';
import { CalibrationController } from './calibration.controller';
import { SettingsModule } from '../settings/settings.module';
import { ReportTemplatesModule } from '../report-templates/report-templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Calibration, CalibrationDraft]),
    SettingsModule,
    ReportTemplatesModule,
  ],
  controllers: [CalibrationController],
  providers: [CalibrationService, CertificateService],
  exports: [CalibrationService, CertificateService],
})
export class CalibrationModule {}
