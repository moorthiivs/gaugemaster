import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Calibration } from './calibration.entity';
import { CalibrationDraft } from './calibration-draft.entity';
import { CalibrationAuditLog } from './calibration-audit-log.entity';
import { CalibrationService } from './calibration.service';
import { CertificateService } from './certificate.service';
import { CalibrationController } from './calibration.controller';
import { SettingsModule } from '../settings/settings.module';
import { ReportTemplatesModule } from '../report-templates/report-templates.module';
import { InstrumentsModule } from '../instruments/instruments.module';

import { User } from 'src/users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Calibration, CalibrationDraft, CalibrationAuditLog, User]),
    SettingsModule,
    ReportTemplatesModule,
    InstrumentsModule,
  ],
  controllers: [CalibrationController],
  providers: [CalibrationService, CertificateService],
  exports: [CalibrationService, CertificateService],
})
export class CalibrationModule {}
