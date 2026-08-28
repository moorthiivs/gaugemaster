import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { CalibrationTemplate } from '../entities/calibration-template.entity';
import { TemplatePackageSpec } from './template-export.service';
import { TemplateAuditLogService } from './template-audit-log.service';

export interface ImportPreviewItem {
  name: string;
  instrument_type: string;
  calibration_type: string;
  status: 'NEW' | 'DUPLICATE' | 'INVALID';
  existingId?: string;
  reason?: string;
  spec: TemplatePackageSpec;
}

export interface ImportPreviewResult {
  totalFound: number;
  newCount: number;
  duplicateCount: number;
  invalidCount: number;
  manifest: any;
  items: ImportPreviewItem[];
}

export type DuplicateStrategy = 'SKIP' | 'IMPORT_AS_NEW' | 'REPLACE';

@Injectable()
export class TemplateImportService {
  constructor(
    @InjectRepository(CalibrationTemplate)
    private readonly templateRepository: Repository<CalibrationTemplate>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: TemplateAuditLogService,
  ) {}

  /** Extract & validate ZIP file package without modifying database */
  async validatePackage(fileBuffer: Buffer, targetCompanyId?: string): Promise<ImportPreviewResult> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(fileBuffer);
    } catch (e) {
      throw new BadRequestException('Invalid zip package format.');
    }

    const manifestFile = zip.file('manifest.json');
    let manifest: any = { formatVersion: '1.0' };

    if (manifestFile) {
      const manifestText = await manifestFile.async('string');
      try {
        manifest = JSON.parse(manifestText);
      } catch {
        throw new BadRequestException('Corrupted manifest.json in export package.');
      }
    }

    if (manifest.formatVersion && manifest.formatVersion !== '1.0') {
      throw new BadRequestException(`Unsupported template format version: ${manifest.formatVersion}`);
    }

    const templateFiles = Object.keys(zip.files).filter(
      (path) => !zip.files[path].dir && path.startsWith('templates/') && path.endsWith('.json'),
    );

    // Fallback if files are directly at root
    const jsonFiles = templateFiles.length > 0
      ? templateFiles
      : Object.keys(zip.files).filter((path) => !zip.files[path].dir && path.endsWith('.json') && path !== 'manifest.json');

    if (jsonFiles.length === 0) {
      throw new BadRequestException('No template JSON files found in package.');
    }

    const existingTemplates = await this.templateRepository.find({
      where: targetCompanyId ? { companyId: targetCompanyId } : {},
    });
    const existingNameMap = new Map<string, CalibrationTemplate>();
    existingTemplates.forEach((t) => existingNameMap.set(t.name.trim().toLowerCase(), t));

    const items: ImportPreviewItem[] = [];
    let newCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (const filePath of jsonFiles) {
      const content = await zip.files[filePath].async('string');
      let spec: TemplatePackageSpec;
      try {
        spec = JSON.parse(content);
      } catch {
        invalidCount++;
        items.push({
          name: filePath,
          instrument_type: 'Unknown',
          calibration_type: 'Unknown',
          status: 'INVALID',
          reason: 'JSON Parse Error',
          spec: {} as any,
        });
        continue;
      }

      if (!spec.name || !spec.instrument_type || !spec.calibration_type) {
        invalidCount++;
        items.push({
          name: spec.name || filePath,
          instrument_type: spec.instrument_type || 'Unknown',
          calibration_type: spec.calibration_type || 'Unknown',
          status: 'INVALID',
          reason: 'Missing required metadata fields (name, instrument_type, or calibration_type)',
          spec,
        });
        continue;
      }

      const existing = existingNameMap.get(spec.name.trim().toLowerCase());
      if (existing) {
        duplicateCount++;
        items.push({
          name: spec.name,
          instrument_type: spec.instrument_type,
          calibration_type: spec.calibration_type,
          status: 'DUPLICATE',
          existingId: existing.id,
          spec,
        });
      } else {
        newCount++;
        items.push({
          name: spec.name,
          instrument_type: spec.instrument_type,
          calibration_type: spec.calibration_type,
          status: 'NEW',
          spec,
        });
      }
    }

    return {
      totalFound: items.length,
      newCount,
      duplicateCount,
      invalidCount,
      manifest,
      items,
    };
  }

  /** Execute import transactionally */
  async importTemplates(params: {
    fileBuffer: Buffer;
    duplicateStrategy: DuplicateStrategy;
    targetCompanyId?: string;
    userId?: string;
    userName?: string;
  }): Promise<{ importedCount: number; skippedCount: number; updatedCount: number }> {
    const { fileBuffer, duplicateStrategy, targetCompanyId, userId, userName } = params;
    const preview = await this.validatePackage(fileBuffer, targetCompanyId);

    if (preview.items.length === 0) {
      throw new BadRequestException('No valid templates to import.');
    }

    let importedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of preview.items) {
        if (item.status === 'INVALID') {
          skippedCount++;
          continue;
        }

        const spec = item.spec;

        if (item.status === 'DUPLICATE') {
          if (duplicateStrategy === 'SKIP') {
            skippedCount++;
            continue;
          }

          if (duplicateStrategy === 'REPLACE' && item.existingId) {
            await queryRunner.manager.update(CalibrationTemplate, item.existingId, {
              description: spec.description,
              instrument_type: spec.instrument_type,
              calibration_type: spec.calibration_type,
              default_unit: spec.default_unit,
              default_tolerance: spec.default_tolerance,
              environmental_defaults: spec.environmental_defaults,
              is_canvas_template: spec.is_canvas_template,
              layout_blocks: spec.layout_blocks,
              calibration_points: spec.calibration_points,
              custom_columns: spec.custom_columns,
              standard_columns_config: spec.standard_columns_config,
              column_order: spec.column_order,
              hidden_columns: spec.hidden_columns,
              acceptance_criteria: spec.acceptance_criteria,
              diagram_image: spec.diagram_image,
              diagram_image_width: spec.diagram_image_width,
              diagram_image_height: spec.diagram_image_height,
              diagram_image_alignment: spec.diagram_image_alignment,
              remarks: spec.remarks,
              standard_reference: spec.standard_reference,
              procedure_reference: spec.procedure_reference,
              status_rule_type: spec.status_rule_type,
              status_formula: spec.status_formula,
              decimal_places: spec.decimal_places,
              updatedAt: new Date(),
            });
            updatedCount++;
            continue;
          }

          if (duplicateStrategy === 'IMPORT_AS_NEW') {
            // Rename to avoid exact collision
            spec.name = `${spec.name} (Copy)`;
          }
        }

        const newTemplate = queryRunner.manager.create(CalibrationTemplate, {
          id: uuidv4(),
          name: spec.name,
          description: spec.description,
          instrument_type: spec.instrument_type,
          calibration_type: spec.calibration_type,
          default_unit: spec.default_unit,
          default_tolerance: spec.default_tolerance,
          environmental_defaults: spec.environmental_defaults,
          is_canvas_template: spec.is_canvas_template,
          layout_blocks: spec.layout_blocks,
          calibration_points: spec.calibration_points,
          custom_columns: spec.custom_columns,
          standard_columns_config: spec.standard_columns_config,
          column_order: spec.column_order,
          hidden_columns: spec.hidden_columns,
          acceptance_criteria: spec.acceptance_criteria,
          diagram_image: spec.diagram_image,
          diagram_image_width: spec.diagram_image_width,
          diagram_image_height: spec.diagram_image_height,
          diagram_image_alignment: spec.diagram_image_alignment,
          remarks: spec.remarks,
          standard_reference: spec.standard_reference,
          procedure_reference: spec.procedure_reference,
          status_rule_type: spec.status_rule_type,
          status_formula: spec.status_formula,
          decimal_places: spec.decimal_places,
          companyId: targetCompanyId || null as any,
          userId: userId || null as any,
        });

        await queryRunner.manager.save(CalibrationTemplate, newTemplate);
        importedCount++;
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(`Failed to import templates: ${err.message}`);
    } finally {
      await queryRunner.release();
    }

    await this.auditLogService.logAction({
      action: 'IMPORT',
      destinationCompanyId: targetCompanyId,
      performedByUserId: userId,
      performedByName: userName,
      templateCount: preview.totalFound,
      successCount: importedCount + updatedCount,
      failureCount: skippedCount,
      details: {
        duplicateStrategy,
        importedCount,
        updatedCount,
        skippedCount,
      },
    });

    return { importedCount, skippedCount, updatedCount };
  }
}
