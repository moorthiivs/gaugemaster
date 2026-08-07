import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import JSZip from 'jszip';
import { CalibrationTemplate } from '../entities/calibration-template.entity';
import { TemplateAuditLogService } from './template-audit-log.service';

export interface TemplatePackageSpec {
  name: string;
  description?: string;
  instrument_type: string;
  calibration_type: string;
  default_unit?: string;
  default_tolerance?: number;
  environmental_defaults?: any;
  calibration_points?: any[];
  custom_columns?: any[];
  standard_columns_config?: Record<string, any>;
  column_order?: string[];
  hidden_columns?: string[];
  acceptance_criteria?: any;
  remarks?: string;
  standard_reference?: string;
  procedure_reference?: string;
  status_rule_type?: string;
  status_formula?: string;
  decimal_places?: number;
}

@Injectable()
export class TemplateExportService {
  constructor(
    @InjectRepository(CalibrationTemplate)
    private readonly templateRepository: Repository<CalibrationTemplate>,
    private readonly auditLogService: TemplateAuditLogService,
  ) {}

  async exportTemplates(params: {
    templateIds?: string[];
    companyId?: string;
    userId?: string;
    userName?: string;
  }): Promise<{ zipBuffer: Buffer; filename: string; count: number }> {
    const { templateIds, companyId, userId, userName } = params;

    let templates: CalibrationTemplate[] = [];

    if (templateIds && templateIds.length > 0) {
      templates = await this.templateRepository.find({
        where: { id: In(templateIds) },
      });
    } else if (companyId) {
      templates = await this.templateRepository.find({
        where: [
          { companyId },
          { companyId: null as any },
        ],
      });
    } else {
      templates = await this.templateRepository.find();
    }

    if (!templates || templates.length === 0) {
      throw new BadRequestException('No templates found to export.');
    }

    const zip = new JSZip();
    const manifest = {
      formatVersion: '1.0',
      templateBuilderVersion: '1.0',
      exportedAt: new Date().toISOString(),
      templateCount: templates.length,
      sourceCompanyId: companyId || 'GLOBAL',
      exportedBy: userName || userId || 'Admin',
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    const templatesFolder = zip.folder('templates');

    templates.forEach((tpl, idx) => {
      const spec: TemplatePackageSpec = {
        name: tpl.name,
        description: tpl.description,
        instrument_type: tpl.instrument_type,
        calibration_type: tpl.calibration_type,
        default_unit: tpl.default_unit,
        default_tolerance: tpl.default_tolerance,
        environmental_defaults: tpl.environmental_defaults,
        calibration_points: tpl.calibration_points,
        custom_columns: tpl.custom_columns,
        standard_columns_config: tpl.standard_columns_config,
        column_order: tpl.column_order,
        hidden_columns: tpl.hidden_columns,
        acceptance_criteria: tpl.acceptance_criteria,
        remarks: tpl.remarks,
        standard_reference: tpl.standard_reference,
        procedure_reference: tpl.procedure_reference,
        status_rule_type: tpl.status_rule_type,
        status_formula: tpl.status_formula,
        decimal_places: tpl.decimal_places,
      };

      const fileIndex = String(idx + 1).padStart(3, '0');
      const safeName = tpl.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      templatesFolder?.file(`template-${fileIndex}-${safeName}.json`, JSON.stringify(spec, null, 2));
    });

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    await this.auditLogService.logAction({
      action: 'EXPORT',
      sourceCompanyId: companyId,
      performedByUserId: userId,
      performedByName: userName,
      templateCount: templates.length,
      successCount: templates.length,
      failureCount: 0,
      details: { templateNames: templates.map((t) => t.name) },
    });

    const filename = `calibration-templates-export-${new Date().toISOString().slice(0, 10)}.zip`;

    return { zipBuffer, filename, count: templates.length };
  }
}
