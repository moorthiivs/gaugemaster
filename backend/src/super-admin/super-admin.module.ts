import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { Company } from '../company/entities/company.entity';
import { User } from '../users/user.entity';
import { Instrument } from '../instruments/instrument.entity';
import { Calibration } from '../calibration/calibration.entity';
import { CalibrationHistory } from '../instruments/calibration-history.entity';
import { CalibrationAuditLog } from '../calibration/calibration-audit-log.entity';
import { CalibrationDraft } from '../calibration/calibration-draft.entity';
import { CalibrationTemplate } from '../calibration-templates/entities/calibration-template.entity';
import { TemplateAuditLog } from '../calibration-templates/entities/template-audit-log.entity';
import { Role } from '../roles/role.entity';
import { Setting } from '../settings/entities/setting.entity';
import { Notification } from '../notifications/notification.entity';
import { ReminderFrequncy } from '../reminder/reminder.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      User,
      Instrument,
      Calibration,
      CalibrationHistory,
      CalibrationAuditLog,
      CalibrationDraft,
      CalibrationTemplate,
      TemplateAuditLog,
      Role,
      Setting,
      Notification,
      ReminderFrequncy,
    ]),
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
