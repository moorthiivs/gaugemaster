import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalibrationTemplate } from './entities/calibration-template.entity';
import { TemplateAuditLog } from './entities/template-audit-log.entity';
import { CalibrationTemplatesService } from './calibration-templates.service';
import { CalibrationTemplatesController } from './calibration-templates.controller';
import { TemplateAuditLogService } from './services/template-audit-log.service';
import { TemplateExportService } from './services/template-export.service';
import { TemplateImportService } from './services/template-import.service';

@Module({
  imports: [TypeOrmModule.forFeature([CalibrationTemplate, TemplateAuditLog])],
  controllers: [CalibrationTemplatesController],
  providers: [
    CalibrationTemplatesService,
    TemplateAuditLogService,
    TemplateExportService,
    TemplateImportService,
  ],
  exports: [
    CalibrationTemplatesService,
    TemplateAuditLogService,
    TemplateExportService,
    TemplateImportService,
  ],
})
export class CalibrationTemplatesModule {}
