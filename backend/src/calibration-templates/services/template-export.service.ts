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
  is_canvas_template?: boolean;
  layout_blocks?: any[];
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
  diagram_image?: string;
  diagram_image_width?: number;
  diagram_image_height?: number;
  diagram_image_alignment?: 'center' | 'left' | 'right';
}

interface TemplatePackageManifest {
  version: string;
  exportedAt: string;
  templateCount: number;
  generator: string;
  templates: any[];
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
  }): Promise<{ filename: string; zipBuffer: Buffer; count: number }> {
    const { templateIds, companyId, userId, userName } = params;
    const query = this.templateRepository.createQueryBuilder('t');

    if (templateIds && templateIds.length > 0) {
      query.andWhere('t.id IN (:...ids)', { ids: templateIds });
    }

    if (companyId) {
      query.andWhere('(t.companyId = :companyId OR t.companyId IS NULL)', {
        companyId,
      });
    }

    const templates = await query.orderBy('t.name', 'ASC').getMany();

    if (templates.length === 0) {
      throw new BadRequestException('No templates found matching the export criteria');
    }

    const zip = new JSZip();
    const manifest: TemplatePackageManifest = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      templateCount: templates.length,
      generator: 'GaugeMaster Calibration System v2.0',
      templates: [],
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
        is_canvas_template: tpl.is_canvas_template,
        layout_blocks: tpl.layout_blocks,
        calibration_points: tpl.calibration_points,
        custom_columns: tpl.custom_columns,
        standard_columns_config: tpl.standard_columns_config,
        column_order: tpl.column_order,
        hidden_columns: tpl.hidden_columns,
        acceptance_criteria: tpl.acceptance_criteria,
        diagram_image: tpl.diagram_image,
        diagram_image_width: tpl.diagram_image_width,
        diagram_image_height: tpl.diagram_image_height,
        diagram_image_alignment: tpl.diagram_image_alignment,
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
