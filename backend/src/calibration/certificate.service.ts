import { Injectable, Logger } from '@nestjs/common';
import { Calibration, CalibrationPoint } from './calibration.entity';
import PdfPrinter from 'pdfmake';
import { SettingsService } from '../settings/settings.service';
import { ReportTemplatesService } from '../report-templates/report-templates.service';
// ── Parse header/footer HTML for pdfmake ─────────────────
const htmlToPdfmake = require('html-to-pdfmake');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');
import {
  removeWhiteBackground,
  normalizeDiagramImage,
  resolvePdfDiagram,
  ResolvedPdfDiagram,
} from './utils/png-encoder.util';
import { getCoveredCells } from './utils/table-span.util';
import { getPdfFonts } from '../lib/pdf-fonts';

const fonts = getPdfFonts();

/**
 * Generates professional calibration certificate PDFs using pdfmake.
 * Reuses the existing report template system for company branding (header/footer).
 */
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { CalibrationTemplate } from '../calibration-templates/entities/calibration-template.entity';
import { DEFAULT_APPROVAL_SEAL_BASE64 } from '../assets/default-seal';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  private get printer(): PdfPrinter {
    return new PdfPrinter(getPdfFonts());
  }

  constructor(
    private readonly settingsService: SettingsService,
    private readonly reportTemplatesService: ReportTemplatesService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(CalibrationTemplate)
    private readonly calibrationTemplateRepo: Repository<CalibrationTemplate>,
  ) {}

  /**
   * Generate a calibration certificate PDF from a Calibration record.
   * Returns a Buffer containing the PDF data.
   */
  async generateCertificate(
    calibration: Calibration,
    userId?: string,
    templateId?: string,
  ): Promise<Buffer> {
    let calibratedSig = calibration.calibrated_by_signature;
    if ((!calibratedSig || !calibratedSig.startsWith('data:image')) && calibration.calibrated_by) {
      try {
        const u = await this.userRepository.findOne({
          where: { name: calibration.calibrated_by },
        });
        if (u && u.signature && u.signature.startsWith('data:image')) {
          calibratedSig = u.signature;
        }
      } catch (e) {}
    }

    let reviewedSig = calibration.reviewed_by_signature;
    const reviewedName = calibration.reviewed_by;
    if ((!reviewedSig || !reviewedSig.startsWith('data:image')) && reviewedName) {
      try {
        const u = await this.userRepository.findOne({
          where: { name: reviewedName },
        });
        if (u && u.signature && u.signature.startsWith('data:image')) {
          reviewedSig = u.signature;
        }
      } catch (e) {}
    }

    let approvedSig = calibration.approved_by_signature;
    const approvedName = calibration.approved_by;
    if ((!approvedSig || !approvedSig.startsWith('data:image')) && approvedName) {
      try {
        const u = await this.userRepository.findOne({
          where: { name: approvedName },
        });
        if (u && u.signature && u.signature.startsWith('data:image')) {
          approvedSig = u.signature;
        }
      } catch (e) {}
    }
    const inst = calibration.instrument;
    const points = calibration.calibration_points || [];
    const numPoints = points.length;
    let totalPages = numPoints <= 21 ? 1 : 1 + Math.ceil((numPoints - 21) / 35);
    let sheetNoText = `1 of ${totalPages}`;
    const env = calibration.environmental_conditions || {
      temperature: '-',
      humidity: '-',
    };
    const isGauge =
      (inst?.device_type || '').toLowerCase().includes('gauge') ||
      ((inst as any)?.item_type || '').toLowerCase().includes('gauge') ||
      (calibration.calibration_type || '').toLowerCase().includes('gauge');
    const rangeLabel = isGauge ? 'Specification' : 'Range';

    // ── Resolve company header/footer ────────────────────────
    let headerText = '';
    let footerText = '';

    const hasTemplateId =
      templateId &&
      templateId !== 'undefined' &&
      templateId !== 'null' &&
      templateId !== 'default' &&
      templateId !== '';

    if (hasTemplateId) {
      const template = await this.reportTemplatesService.findOne(templateId);
      if (template) {
        headerText = template.headerText || '';
        footerText = template.footerText || '';
      }
    } else if (userId) {
      const userSettings = await this.settingsService.findOneByUserId(userId);
      headerText = userSettings?.reportConfig?.headerText || '';
      footerText = userSettings?.reportConfig?.footerText || '';
    }

    // ── Fetch latest Calibration Template from database if linked ──
    let latestTemplate: CalibrationTemplate | null = null;
    const tplId = calibration.template_id || templateId;
    if (tplId && tplId !== 'none' && tplId !== 'default' && tplId !== 'undefined' && tplId !== 'null') {
      try {
        latestTemplate = await this.calibrationTemplateRepo.findOne({ where: { id: tplId } });
      } catch (e) {}
    }
    if (!latestTemplate && (calibration.template_name || (calibration as any).instrument?.item_type || (calibration as any).instrument?.name)) {
      try {
        const candidates = [
          calibration.template_name,
          (calibration as any).instrument?.item_type,
          (calibration as any).instrument?.name,
        ].filter(Boolean);
        for (const c of candidates) {
          const found = await this.calibrationTemplateRepo.findOne({ where: { name: c } });
          if (found) {
            latestTemplate = found;
            break;
          }
        }
      } catch (e) {}
    }

    const certConfig = userId
      ? (await this.settingsService.findOneByUserId(userId))?.certificateConfig
      : null;
    const headerCompanyName =
      certConfig?.headerCompanyName || 'Company Name';
    const headerCompanySubtitle =
      certConfig?.headerCompanySubtitle || '(CALIBRATION LABORATORY)';
    const docNo =
      calibration.doc_no ||
      (calibration as any).docNo ||
      latestTemplate?.doc_no ||
      (latestTemplate as any)?.docNo ||
      (calibration as any).template?.doc_no ||
      (calibration as any).template?.docNo;
    const docDate =
      calibration.doc_date ||
      (calibration as any).docDate ||
      latestTemplate?.doc_date ||
      (latestTemplate as any)?.docDate ||
      (calibration as any).template?.doc_date;
    const docRev =
      calibration.doc_rev ||
      (calibration as any).docRev ||
      latestTemplate?.doc_rev ||
      (latestTemplate as any)?.docRev ||
      (calibration as any).template?.doc_rev;

    const procedureNo =
      calibration.procedure_no ||
      (calibration as any).procedureNo ||
      latestTemplate?.procedure_no ||
      (latestTemplate as any)?.procedureNo ||
      calibration.procedure_reference ||
      (calibration as any).procedureReference ||
      latestTemplate?.procedure_reference;
    const procedureName =
      calibration.procedure_name ||
      (calibration as any).procedureName ||
      latestTemplate?.procedure_name ||
      (latestTemplate as any)?.procedureName;
    const procedureDate =
      calibration.procedure_date ||
      (calibration as any).procedureDate ||
      latestTemplate?.procedure_date ||
      (latestTemplate as any)?.procedureDate;
    const procedureRev =
      calibration.procedure_rev ||
      (calibration as any).procedureRev ||
      latestTemplate?.procedure_rev ||
      (latestTemplate as any)?.procedureRev;

    const acceptanceCriteriaDocNo =
      calibration.acceptance_criteria_doc_no ||
      (calibration as any).acceptanceCriteriaDocNo ||
      latestTemplate?.acceptance_criteria_doc_no ||
      (latestTemplate as any)?.acceptanceCriteriaDocNo;
    const acceptanceCriteriaDate =
      calibration.acceptance_criteria_date ||
      (calibration as any).acceptanceCriteriaDate ||
      latestTemplate?.acceptance_criteria_date ||
      (latestTemplate as any)?.acceptanceCriteriaDate;
    const acceptanceCriteriaRev =
      calibration.acceptance_criteria_rev ||
      (calibration as any).acceptanceCriteriaRev ||
      latestTemplate?.acceptance_criteria_rev ||
      (latestTemplate as any)?.acceptanceCriteriaRev;
    const acceptanceCriteriaReference =
      calibration.acceptance_criteria_reference ||
      (calibration as any).acceptanceCriteriaReference ||
      latestTemplate?.acceptance_criteria_reference ||
      (latestTemplate as any)?.acceptanceCriteriaReference;

    let acceptanceCriteriaText = '';
    if (acceptanceCriteriaReference) {
      acceptanceCriteriaText = acceptanceCriteriaReference;
    } else if (acceptanceCriteriaDocNo) {
      const revPart = acceptanceCriteriaRev
        ? ` Rev-${acceptanceCriteriaRev.replace(/^rev-?/i, '')}`
        : '';
      const datePart = acceptanceCriteriaDate ? ` dated ${acceptanceCriteriaDate}` : '';
      acceptanceCriteriaText = `AS Per ${acceptanceCriteriaDocNo}${revPart}${datePart}`;
    }

    const headerRightBoxText1 = docNo ? 'Doc. No.' : (certConfig?.headerRightBoxText1 || 'NABL / LAB');
    const headerRightBoxText2 = docNo || certConfig?.headerRightBoxText2 || 'CC - 2632';
    const footerLine1 = certConfig?.footerLine1 || 'CALIBRATION CENTER :';
    const footerLine2 =
      certConfig?.footerLine2 ||
      'Laboratory Address, Behind Main Road, Industrial Zone, State - 440024.';
    const footerLine3 =
      certConfig?.footerLine3 ||
      'Website: www.gaugemaster.com | Email: info@gaugemaster.com | Phone: +91 98222 23948';
    const borderColor = certConfig?.borderColor || '#0369a1';
    const headerDisplayMode = certConfig?.headerDisplayMode || 'name'; // 'name' | 'logo' | 'both'
    const companyLogoPath = certConfig?.companyLogoPath || null;

    // ── Typography & Font Sizes Configuration (Centralized & Customizable) ──
    // All certificate font sizes are centralized here and can be overridden via Settings -> Certificate Configuration
    const titleFontSize = Number((certConfig as any)?.titleFontSize) || 8.0;
    const tableHeaderFontSize = Number((certConfig as any)?.tableHeaderFontSize) || 7.2;
    const contentFontSize = Number((certConfig as any)?.contentFontSize) || 6.8;
    const labelFontSize = Number((certConfig as any)?.labelFontSize) || 7.0;
    const valueFontSize = Number((certConfig as any)?.valueFontSize) || 7.5;
    const signatureFontSize = Number((certConfig as any)?.signatureFontSize) || 7.0;

    // ── Signature Dimensions & Table Spacing Configuration ──
    const signatureImageWidth = Number((certConfig as any)?.signatureImageWidth) || 75;
    const signatureImageHeight = Number((certConfig as any)?.signatureImageHeight) || 28;
    const tableGap =
      (certConfig as any)?.tableGap !== undefined &&
      (certConfig as any)?.tableGap !== null &&
      !isNaN(Number((certConfig as any)?.tableGap))
        ? Number((certConfig as any)?.tableGap)
        : 2.5;

    const standardReference =
      (calibration as any).standard_reference || calibration.remarks || 'Standard calibration per ISO/IEC 17025';

    const resolveImagePath = (src: string) => {
      if (!src) return src;
      if (src.startsWith('data:')) return src;
      if (src.startsWith('http://') || src.startsWith('https://')) return src;
      const relativePath = src.startsWith('/') ? src.slice(1) : src;
      return path.join(process.cwd(), relativePath);
    };

    const fixPdfmakeContent = (nodes: any[]) => {
      if (!Array.isArray(nodes)) return;
      nodes.forEach((node) => {
        if (!node) return;
        if (node.table) {
          const colCount = node.table.body?.[0]?.length || 0;
          if (colCount === 3) {
            node.table.widths = [130, '*', 130];
          } else if (colCount === 2) {
            node.table.widths = ['*', '*'];
          } else {
            node.table.widths = Array(colCount).fill('*');
          }
          node.layout = 'noBorders';
          if (node.table.body) {
            node.table.body.forEach((row: any[]) => {
              if (Array.isArray(row)) {
                row.forEach((cell: any) => {
                  if (Array.isArray(cell)) fixPdfmakeContent(cell);
                  else if (cell && cell.stack) fixPdfmakeContent(cell.stack);
                  else if (cell && typeof cell === 'object')
                    fixPdfmakeContent([cell]);
                });
              }
            });
          }
        }
        if (node.image) {
          node.image = resolveImagePath(node.image);
          if (!node.width || node.width > 120) node.width = 120;
          delete node.height;
        }
        if (node.stack) fixPdfmakeContent(node.stack);
        if (node.columns) fixPdfmakeContent(node.columns);
      });
    };

    // Build pdfmake header content from HTML
    let headerStack: any[] = [];
    if (headerText) {
      const domHeader = new JSDOM(headerText);
      domHeader.window.document.querySelectorAll('img').forEach((img: any) => {
        const w = parseInt(img.getAttribute('width') || '0', 10);
        if (!w || w > 120) img.setAttribute('width', '120');
        img.removeAttribute('height');
      });
      const headerResult = htmlToPdfmake(
        domHeader.window.document.body.innerHTML,
        { window: domHeader.window },
      );
      headerStack = Array.isArray(headerResult.content || headerResult)
        ? headerResult.content || headerResult
        : [headerResult.content || headerResult];
      fixPdfmakeContent(headerStack);
    }

    // Build footer content
    let footerStack: any[] = [];
    if (footerText) {
      const domFooter = new JSDOM(footerText);
      domFooter.window.document.querySelectorAll('img').forEach((img: any) => {
        const w = parseInt(img.getAttribute('width') || '0', 10);
        if (!w || w > 120) img.setAttribute('width', '120');
        img.removeAttribute('height');
      });
      const footerResult = htmlToPdfmake(
        domFooter.window.document.body.innerHTML,
        { window: domFooter.window },
      );
      footerStack = Array.isArray(footerResult.content || footerResult)
        ? footerResult.content || footerResult
        : [footerResult.content || footerResult];
      fixPdfmakeContent(footerStack);
    }

    // ── Helper: format date ──────────────────────────────────
    const fmtDate = (d: any) => {
      if (!d) return '-';
      const dt = d instanceof Date ? d : new Date(d);
      if (isNaN(dt.getTime())) return '-';
      return dt.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    // ── Check for Canvas Template Layout Blocks ──
    const isCanvasTemplate = Boolean(
      calibration.is_canvas_template ||
      (calibration.layout_blocks && calibration.layout_blocks.length > 0) ||
      (latestTemplate as any)?.is_canvas_template ||
      ((latestTemplate as any)?.layout_blocks && (latestTemplate as any).layout_blocks.length > 0),
    );

    const rawCanvasBlocks =
      calibration.layout_blocks ||
      (latestTemplate as any)?.layout_blocks ||
      [];
    const canvasBlocks = await Promise.all(
      rawCanvasBlocks.map(async (b: any) => {
        if ((b.type === 'diagram_block' || b.type === 'diagram') && (b.imageUrl || b.image)) {
          const rawUrl = b.imageUrl || b.image;
          const resolved = await resolvePdfDiagram(rawUrl);
          return { ...b, resolvedDiagram: resolved };
        }
        return b;
      }),
    );

    // ── Build calibration data table ─────────────────────────
    let rawDiagramToCheck: string | null = null;
    if (calibration.diagram_image !== undefined && calibration.diagram_image !== null) {
      rawDiagramToCheck = calibration.diagram_image;
    } else if ((calibration as any).instrument?.custom_parameters?.diagram_image !== undefined) {
      rawDiagramToCheck = (calibration as any).instrument?.custom_parameters?.diagram_image;
    } else if (latestTemplate?.diagram_image) {
      rawDiagramToCheck = latestTemplate.diagram_image;
    } else if (((calibration as any).template as any)?.diagram_image) {
      rawDiagramToCheck = ((calibration as any).template as any).diagram_image;
    }

    const hasDiagram = Boolean(
      rawDiagramToCheck &&
        typeof rawDiagramToCheck === 'string' &&
        rawDiagramToCheck.trim() !== '',
    );
    // Standard professional certificates adopt compact, space-efficient metrics to guarantee 1-page fit
    const isDense = true;
    const hasDescription = points.some(
      (pt: any) => pt.description && String(pt.description).trim() !== '',
    );
    const hasDescending = points.some(
      (pt: any) =>
        pt.descending_reading !== undefined &&
        pt.descending_reading !== null &&
        pt.descending_reading !== 0,
    );
    const unit = points[0]?.unit || 'mm';

    // Extract custom columns metadata from points AND column definitions
    const customColMap = new Map<string, string>(); // colId -> displayName
    const customColTypeMap = new Map<string, string>(); // colId -> 'text' | 'number' | 'formula'

    // Build from custom_columns definition (most authoritative source)
    const customColDefs: any[] = (calibration as any).custom_columns || (calibration as any).template?.custom_columns || [];
    customColDefs.forEach((col: any) => {
      if (col?.id) {
        const colName = col.label || col.name || col.title || col.header;
        if (colName && !colName.startsWith('col_')) {
          customColMap.set(col.id, colName);
        }
        customColTypeMap.set(col.id, col.type || 'text');
      }
    });

    // Also build standard_columns_config type map
    const colDecMap = new Map<string, number>(); // colId -> decimalPlaces
    const globalDecimals = (calibration as any).decimal_places ?? 4;

    const stdColConfig: Record<string, any> =
      (calibration as any).standard_columns_config || {};
    Object.entries(stdColConfig).forEach(([key, cfg]: [string, any]) => {
      if (cfg?.type) customColTypeMap.set(key, cfg.type);
      if (cfg?.decimalPlaces !== undefined && cfg?.decimalPlaces >= 0) {
        colDecMap.set(key, cfg.decimalPlaces);
      }
      if (cfg && typeof cfg === 'object') {
        const cfgName = cfg.label || cfg.name || cfg.title || cfg.header;
        if (cfgName && !cfgName.startsWith('col_')) {
          customColMap.set(key, cfgName);
        }
      }
    });

    customColDefs.forEach((col: any) => {
      if (col?.decimalPlaces !== undefined && col?.decimalPlaces >= 0) {
        colDecMap.set(col.id, col.decimalPlaces);
      }
    });

    const getColDec = (colId: string) => {
      return colDecMap.has(colId) ? colDecMap.get(colId)! : globalDecimals;
    };

    // Fill any remaining custom columns from points (if not already in defs)
    points.forEach((pt: any) => {
      if (pt.customFields && typeof pt.customFields === 'object') {
        Object.entries(pt.customFields).forEach(([key, val]) => {
          if (!customColMap.has(key) || customColMap.get(key)?.startsWith('col_')) {
            if (val && typeof val === 'object' && val !== null) {
              const nameInVal = (val as any).name || (val as any).label || (val as any).title || (val as any).header;
              if (nameInVal && !nameInVal.startsWith('col_')) {
                customColMap.set(key, nameInVal);
              }
            }
          }
        });
      }
    });

    const resolveHeaderTitle = (k: string): string => {
      if (k === 'description') return 'Description';
      if (k === 'nominal') return 'Nominal';
      if (k === 'tolerance') return 'Tolerance';
      if (k === 'ascending_reading') return hasDescending ? 'Ascending' : 'Actual';
      if (k === 'descending_reading') return 'Descending';
      if (k === 'error') return 'Error';

      const mapped = customColMap.get(k);
      if (mapped && !mapped.startsWith('col_')) return mapped;

      const def = customColDefs.find((c: any) => c.id === k || c.key === k || c.field === k);
      if (def) {
        const defName = def.label || def.name || def.title || def.header;
        if (defName && !defName.startsWith('col_')) return defName;
      }

      const stdCfg = stdColConfig[k];
      if (stdCfg) {
        const stdName = stdCfg.label || stdCfg.name || stdCfg.title || stdCfg.header;
        if (stdName && !stdName.startsWith('col_')) return stdName;
      }

      if (k.startsWith('col_')) return 'Remark';

      return k;
    };

    const hidden = new Set(
      calibration.hidden_columns ||
      ((calibration as any).template as any)?.hidden_columns ||
      [],
    );
    const showStatusColumn = !hidden.has('status');
    const columnOrder =
      calibration.column_order && calibration.column_order.length > 0
        ? calibration.column_order
        : [
            'description',
            'nominal',
            'tolerance',
            'ascending_reading',
            hasDescending ? 'descending_reading' : '',
            ...Array.from(customColMap.keys()),
            'error',
          ].filter(Boolean);

    // Always include 'pt' at start and 'status' at end conceptually, but we build headers exactly as requested.
    const activeColumns = columnOrder.filter(
      (k) => k !== 'pt' && k !== 'actions' && !hidden.has(k),
    );

    // Extract group names
    const colGroupMap = new Map<string, string>(); // colId -> groupName
    Object.entries(stdColConfig).forEach(([key, cfg]: [string, any]) => {
      if (cfg?.groupName) colGroupMap.set(key, cfg.groupName);
    });
    customColDefs.forEach((col: any) => {
      if (col?.groupName) colGroupMap.set(col.id, col.groupName);
    });
    const getColGroup = (colId: string) => colGroupMap.get(colId);

    // Build Table Header
    const activeColumnsNoStatus = activeColumns.filter((k) => k !== 'status');
    const hasAnyGroups = activeColumnsNoStatus.some((k) => getColGroup(k));

    let dataTableHeader: any[] = [];
    let dataTableSubHeader: any[] = [];

    if (hasAnyGroups) {
      dataTableHeader.push({
        text: 'Sr No.',
        style: 'thCell',
        rowSpan: 2,
        margin: [0, 6, 0, 0],
      });
      dataTableSubHeader.push({}); // dummy for Sr No

      let currentGroup: string | undefined = undefined;
      let currentGroupCount = 0;

      const pushGroup = () => {
        if (currentGroup) {
          dataTableHeader.push({
            text: currentGroup,
            style: 'thCell',
            colSpan: currentGroupCount,
            alignment: 'center',
          });
          for (let i = 1; i < currentGroupCount; i++) dataTableHeader.push({});
        }
      };

      activeColumnsNoStatus.forEach((k) => {
        const g = getColGroup(k);
        if (g) {
          if (currentGroup === g) {
            currentGroupCount++;
          } else {
            pushGroup();
            currentGroup = g;
            currentGroupCount = 1;
          }
        } else {
          pushGroup();
          currentGroup = undefined;
          currentGroupCount = 0;

          dataTableHeader.push({
            text: resolveHeaderTitle(k),
            style: 'thCell',
            rowSpan: 2,
            margin: [0, 6, 0, 0],
          });
        }

        // Populate sub-header inline to ensure exact matching indices
        if (g) {
          dataTableSubHeader.push({ text: resolveHeaderTitle(k), style: 'thCell' });
        } else {
          dataTableSubHeader.push({});
        }
      });
      pushGroup();

      if (showStatusColumn) {
        dataTableHeader.push({
          text: 'Status',
          style: 'thCell',
          rowSpan: 2,
          margin: [0, 6, 0, 0],
        });
        dataTableSubHeader.push({}); // dummy for status
      }
    } else {
      dataTableHeader = [{ text: 'Sr No.', style: 'thCell' }];
      activeColumnsNoStatus.forEach((k) => {
        dataTableHeader.push({
          text: resolveHeaderTitle(k),
          style: 'thCell',
        });
      });
      if (showStatusColumn) {
        dataTableHeader.push({ text: 'Status', style: 'thCell' });
      }
    }

    // ── Safe numeric formatter (never returns NaN to pdfmake) ──
    const safeNum = (val: any, decimals: number): string => {
      if (val === undefined || val === null || val === '') return '-';
      const n = typeof val === 'string' ? parseFloat(val) : Number(val);
      if (isNaN(n) || !isFinite(n)) return '-';
      return decimals === 0 ? String(Math.round(n)) : n.toFixed(decimals);
    };

    // Build Table Body
    const dataTableBody = hasAnyGroups
      ? [dataTableHeader, dataTableSubHeader]
      : [dataTableHeader];
    points.forEach((pt: CalibrationPoint, idx: number) => {
      const status = pt.status || '-';
      const statusColor =
        status === 'PASS' ? '#15803d' : status === 'FAIL' ? '#b91c1c' : '#000';

      const row: any[] = [
        {
          text: String(pt.point_number || idx + 1).padStart(2, '0'),
          style: 'tdCell',
        },
      ];

      activeColumnsNoStatus.forEach((k) => {
        if (k === 'description')
          row.push({
            text: String((pt as any).description || '-'),
            style: 'tdCell',
          });
        else if (k === 'nominal')
          row.push({
            text: safeNum(pt.nominal, getColDec('nominal')),
            style: 'tdCellMono',
          });
        else if (k === 'tolerance')
          row.push({
            text: safeNum((pt as any).tolerance, getColDec('tolerance')),
            style: 'tdCellMono',
          });
        else if (k === 'ascending_reading')
          row.push({
            text: safeNum(pt.ascending_reading, getColDec('ascending_reading')),
            style: 'tdCellMono',
          });
        else if (k === 'descending_reading')
          row.push({
            text: safeNum(
              pt.descending_reading,
              getColDec('descending_reading'),
            ),
            style: 'tdCellMono',
          });
        else if (k === 'error')
          row.push({
            text: safeNum(pt.error, getColDec('error')),
            style: 'tdCellMono',
          });
        else {
          // Custom column: extract raw value
          const obj = ((pt as any).customFields as any)?.[k];
          const rawVal =
            typeof obj === 'object' && obj !== null && 'value' in obj
              ? obj.value
              : obj;

          // Check column type — only apply numeric formatting if value is actually numeric
          const colType = customColTypeMap.get(k) || 'text';
          let displayVal: string;
          let cellColor = '#000000';
          let isBold = false;

          if (rawVal === undefined || rawVal === null || rawVal === '') {
            displayVal = '-';
          } else if (typeof rawVal === 'string' && isNaN(Number(rawVal.trim()))) {
            // Non-numeric string from formula or text (e.g. "PASS", "FAIL", "OK")
            displayVal = rawVal.trim();
            if (displayVal.toUpperCase() === 'PASS') {
              cellColor = '#15803d';
              isBold = true;
            } else if (displayVal.toUpperCase() === 'FAIL') {
              cellColor = '#b91c1c';
              isBold = true;
            }
          } else if (colType === 'number' || colType === 'formula') {
            displayVal = safeNum(rawVal, getColDec(k));
          } else {
            // Text column: print exactly as stored
            displayVal = String(rawVal);
          }
          row.push({
            text: displayVal,
            style: 'tdCellMono',
            color: cellColor,
            bold: isBold,
          });
        }
      });

      if (showStatusColumn) {
        row.push({
          text: status,
          style: 'tdCell',
          color: statusColor,
          bold: true,
        });
      }
      dataTableBody.push(row);
    });

    const totalCols = dataTableHeader.length;
    const tableFontSize =
      totalCols > 14 ? 4.5 : totalCols > 12 ? 4.8 : totalCols > 10 ? 5.2 : totalCols > 7 ? 6.0 : isDense ? 6.8 : 7.5;
    const tableMonoFontSize =
      totalCols > 14 ? 4.2 : totalCols > 12 ? 4.5 : totalCols > 10 ? 4.9 : totalCols > 7 ? 5.7 : isDense ? 6.5 : 7.2;

    // Auto landscape for very wide tables (12+ total columns)
    const useLandscape = totalCols > 12;

    // ── Auto-adjust column widths to strictly fit within printable page width ──
    // Subtract cell padding (both sides per column) and border line widths from the budget
    const cellPadPerCol = totalCols > 12 ? 1.6 : totalCols > 9 ? 2.0 : totalCols > 7 ? 3.0 : 5.0; // paddingLeft + paddingRight
    const borderOverhead = (totalCols + 1) * 0.5; // 0.5pt border per vertical line
    const pageContentWidth = useLandscape ? 802.0 : 555.0; // A4 landscape vs portrait usable width
    const totalAvailableWidth = pageContentWidth - (totalCols * cellPadPerCol) - borderOverhead;
    const srNoWidth = totalCols > 12 ? 18 : totalCols > 9 ? 22 : totalCols > 7 ? 26 : 30;
    const statusWidth = showStatusColumn ? (totalCols > 12 ? 28 : totalCols > 9 ? 32 : totalCols > 7 ? 36 : 42) : 0;
    const remainingWidth = totalAvailableWidth - srNoWidth - statusWidth;

    const colWeights = activeColumnsNoStatus.map((k) =>
      k === 'description' ? (totalCols > 12 ? 1.2 : totalCols > 8 ? 1.4 : 2.0) : 1.0,
    );
    const sumWeights = colWeights.reduce((a, b) => a + b, 0) || 1;

    const dataColWidths = colWeights.map(
      (w) => Math.round(((w * remainingWidth) / sumWeights) * 100) / 100,
    );

    // Adjust any rounding delta onto the first column
    const currentSum =
      srNoWidth +
      statusWidth +
      dataColWidths.reduce((a, b) => a + b, 0);
    const delta = Math.round((totalAvailableWidth - currentSum) * 100) / 100;
    if (dataColWidths.length > 0 && Math.abs(delta) > 0.01) {
      dataColWidths[0] = Math.round((dataColWidths[0] + delta) * 100) / 100;
    }

    const tableWidths: number[] = [
      srNoWidth,
      ...dataColWidths,
      ...(showStatusColumn ? [statusWidth] : []),
    ];

    // ── Reference Standard rows ──
    let referenceStandards: any[] = [];
    if (
      calibration.reference_standards &&
      calibration.reference_standards.length > 0
    ) {
      referenceStandards = calibration.reference_standards;
    } else {
      referenceStandards = [
        {
          name: (calibration as any)?.reference_standard_name || 'Gauge Block Set',
          make: (calibration as any)?.reference_standard_make || (calibration as any)?.instrument?.make || 'Standard',
          id: (calibration as any)?.reference_standard_id || 'REF-01',
          cert_no: (calibration as any)?.reference_standard_cert_no || (calibration as any)?.reference_standard_traceable_to || (calibration as any)?.certificate_number || 'AE/CC/REF/101',
          cal_date: calibration.calibration_date,
          validity: (calibration as any)?.reference_standard_validity,
          agency: (calibration as any)?.reference_standard_agency || (calibration as any)?.calibration_agency || (calibration as any)?.calibration_source || (calibration as any)?.reference_standard_traceable_to || ((calibration as any)?.instrument && ((calibration as any).instrument.calibration_agency || (calibration as any).instrument.calibration_source)) || 'NABL Accredited Lab',
        },
      ];
    }

    // ── Resolve logo to base64 for pdfmake ──
    let logoDataUrl: string | null = null;
    if (
      companyLogoPath &&
      (headerDisplayMode === 'logo' || headerDisplayMode === 'both')
    ) {
      try {
        const logoAbsPath = companyLogoPath.startsWith('/')
          ? path.join(process.cwd(), companyLogoPath.slice(1))
          : path.join(process.cwd(), companyLogoPath);
        if (fs.existsSync(logoAbsPath)) {
          let logoBuffer = fs.readFileSync(logoAbsPath);
          try {
            logoBuffer = await removeWhiteBackground(logoBuffer);
          } catch (e) {
            // fallback to original if processing fails
          }
          logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        }
      } catch (e) {
        // logo not found, fall back to name
      }
    }

    // ── Resolve Approval Seal image to base64 for pdfmake ──
    let sealDataUrl: string | null = null;
    const possibleSealPaths = [
      path.join(process.cwd(), 'src', 'assets', 'Approved-seal1.png'),
      path.join(process.cwd(), 'src', 'public', 'Approved-seal1.png'),
      path.join(process.cwd(), 'dist', 'public', 'Approved-seal1.png'),
      path.join(process.cwd(), 'backend', 'src', 'assets', 'Approved-seal1.png'),
      path.join(process.cwd(), 'backend', 'dist', 'public', 'Approved-seal1.png'),
      path.join(process.cwd(), 'backend', 'src', 'public', 'Approved-seal1.png'),
      path.join(process.cwd(), 'public', 'Approved-seal1.png'),
      path.join(process.cwd(), '..', 'frontend', 'public', 'Approved-seal1.png'),
      path.join(__dirname, '..', '..', 'public', 'Approved-seal1.png'),
      path.join(__dirname, '..', 'public', 'Approved-seal1.png'),
      path.join(__dirname, '..', 'assets', 'Approved-seal1.png'),
      path.join(__dirname, 'assets', 'Approved-seal1.png'),
    ];
    for (const p of possibleSealPaths) {
      if (fs.existsSync(p)) {
        try {
          let sealBuffer = fs.readFileSync(p);
          const headerHex = sealBuffer.slice(0, 8).toString('hex');
          const isJpeg = headerHex.startsWith('ffd8ff');
          const isPng = headerHex.startsWith('89504e47');
          if (isPng) {
            try {
              sealBuffer = await removeWhiteBackground(sealBuffer);
            } catch (e) {}
            sealDataUrl = `data:image/png;base64,${sealBuffer.toString('base64')}`;
            break;
          } else if (isJpeg) {
            sealDataUrl = `data:image/jpeg;base64,${sealBuffer.toString('base64')}`;
            break;
          }
        } catch (e) {}
      }
    }
    // Fallback to embedded default approval seal base64 if not resolved from filesystem
    if (!sealDataUrl) {
      sealDataUrl = DEFAULT_APPROVAL_SEAL_BASE64;
    }

    // ── Resolve Diagram Image to base64 for pdfmake ──
    let rawDiagram: string | null = null;
    if (calibration.diagram_image !== undefined && calibration.diagram_image !== null) {
      rawDiagram = calibration.diagram_image;
    } else if ((calibration as any).instrument?.custom_parameters?.diagram_image !== undefined) {
      rawDiagram = (calibration as any).instrument?.custom_parameters?.diagram_image;
    } else if (latestTemplate?.diagram_image) {
      rawDiagram = latestTemplate.diagram_image;
    } else if (((calibration as any).template as any)?.diagram_image) {
      rawDiagram = ((calibration as any).template as any).diagram_image;
    }
    const diagramWidth =
      calibration.diagram_image_width ||
      latestTemplate?.diagram_image_width ||
      ((calibration as any).template as any)?.diagram_image_width ||
      (calibration as any).instrument?.custom_parameters?.diagram_image_width ||
      300;
    const diagramHeight =
      calibration.diagram_image_height ||
      latestTemplate?.diagram_image_height ||
      ((calibration as any).template as any)?.diagram_image_height ||
      (calibration as any).instrument?.custom_parameters?.diagram_image_height ||
      140;
    const diagramAlignment =
      calibration.diagram_image_alignment ||
      latestTemplate?.diagram_image_alignment ||
      ((calibration as any).template as any)?.diagram_image_alignment ||
      (calibration as any).instrument?.custom_parameters?.diagram_image_alignment ||
      'center';

    let resolvedDiagram: ResolvedPdfDiagram | null = null;
    if (rawDiagram && typeof rawDiagram === 'string' && rawDiagram.trim()) {
      resolvedDiagram = await resolvePdfDiagram(rawDiagram);
    }

    const targetDiagramWidth = Math.min(diagramWidth, 545);
    const targetDiagramHeight = Math.min(diagramHeight, 260);

    const headerBgColor = (certConfig as any)?.headerBgColor || '#54c6f3'; // Cyan sky blue banner color matching Image 1 & Image 2 layout

    // ── Build left header cell (logo and/or company name) ──
    let leftHeaderContent: any;
    if (
      logoDataUrl &&
      (headerDisplayMode === 'logo' || headerDisplayMode === 'both')
    ) {
      if (headerDisplayMode === 'both') {
        const logoBadge = {
          image: logoDataUrl,
          fit: [65, 36] as [number, number],
        };
        leftHeaderContent = {
          columns: [
            {
              width: 'auto',
              stack: [logoBadge],
              margin: [0, 0, 6, 0],
            },
            {
              width: '*',
              stack: [
                {
                  text: headerCompanyName,
                  bold: true,
                  fontSize: 8.5,
                  color: '#000000',
                },
                ...(headerCompanySubtitle
                  ? [
                      {
                        text: headerCompanySubtitle,
                        fontSize: 7,
                        bold: true,
                        color: '#000000',
                        margin: [0, 1, 0, 0],
                      },
                    ]
                  : []),
              ],
              margin: [0, 5, 0, 0],
            },
          ],
        };
      } else {
        const logoBadge = {
          image: logoDataUrl,
          fit: [130, 38] as [number, number],
        };
        leftHeaderContent = { stack: [logoBadge] };
      }
    } else {
      leftHeaderContent = {
        stack: [
          {
            text: headerCompanyName,
            bold: true,
            fontSize: 9,
            color: '#000000',
          },
          ...(headerCompanySubtitle
            ? [
                {
                  text: headerCompanySubtitle,
                  fontSize: 7.5,
                  bold: true,
                  color: '#000000',
                  margin: [0, 1, 0, 0],
                },
              ]
            : []),
        ],
        margin: [0, 2, 0, 0],
      };
    }

    if (isCanvasTemplate && canvasBlocks.length > 0) {
      const explicitBreaks = canvasBlocks.filter((b: any) => b.type === 'page_break').length;
      if (explicitBreaks > 0) {
        totalPages = 1 + explicitBreaks;
      } else {
        let estH = 0;
        if (hasDiagram) estH += 140;
        canvasBlocks.forEach((b: any) => {
          if (b.type === 'table_grid') {
            if (b.orientation === 'horizontal') {
              const displayRows = (b.columns || []).filter(
                (c: any) => c.id !== 'point_number' && c.id !== 'sl_no' && c.id !== 'sino'
              ).length || 3;
              estH += 16 + (displayRows + 1) * 9.5;
            } else {
              estH += 18 + (b.rows?.length || 0) * 9.5;
            }
          } else if (b.type === 'split_row') {
            const maxR = Math.max(
              b.children?.[0]?.rows?.length || 0,
              b.children?.[1]?.rows?.length || 0
            );
            estH += 18 + maxR * 9.5;
          } else if (b.type === 'matrix_table') {
            estH += 16 + ((b.headers?.length || 1) + (b.rows?.length || 0)) * 9.5;
          } else if (b.type === 'text_block') {
            estH += 12;
          }
        });
        estH += 40; // compact signature block
        const page1Usable = hasDiagram ? 380 : 540;
        totalPages = estH > page1Usable ? Math.max(2, 1 + Math.ceil((estH - page1Usable) / 600)) : 1;
      }
      sheetNoText = `1 of ${totalPages}`;
    }

    const buildPdfCanvasBlocks = (blocks: any[], dense: boolean): any[] => {
      const resultElements: any[] = [];

      const evalRowFormula = (formula: string, row: any, tolerance: number = 0.02, dec: number = 3): string => {
        if (!formula) return '-';
        try {
          let expr = formula.trim();
          const rawNom = (row.nominal_value !== undefined && row.nominal_value !== null && String(row.nominal_value).trim() !== '')
            ? row.nominal_value
            : (row.nominal !== undefined && row.nominal !== null && String(row.nominal).trim() !== '' && row.nominal !== 0 && row.nominal !== '0')
            ? row.nominal
            : row.nom ?? row.std_spec ?? row.std_value ?? row.nominal ?? 0;
          const nominal = parseFloat(String(rawNom)) || 0;
          const tol = parseFloat(String(row.tolerance ?? tolerance)) || 0.02;

          // 1. AVERAGE (ensure it's not a subtraction formula like "average - nominal")
          const isSubtraction = expr.includes('-') || /(avg|average|reading|actual)\s*-\s*(nominal|std)/i.test(expr);
          const avgMatch = !isSubtraction && expr.match(/^=?AVERAGE\(([^)]+)\)/i);
          if (avgMatch || (!isSubtraction && (expr.toLowerCase() === 'avg' || expr.toLowerCase() === 'average'))) {
            let trials: number[] = [];
            if (avgMatch) {
              const varNames = avgMatch[1].split(',').map((s: string) => s.trim());
              varNames.forEach((v: string) => {
                const rawVal = row[v] ?? row[`col_${v}`] ?? row[`t${v}`];
                if (rawVal !== undefined && String(rawVal).trim() !== '') {
                  const val = parseFloat(String(rawVal));
                  if (!isNaN(val)) trials.push(val);
                }
              });
            }
            if (trials.length === 0) {
              const candidateKeys = [row.t1, row.t2, row.t3, row.t4, row.t5, row.col_1, row.col_2, row.col_3, row.col_4, row.col_5];
              trials = candidateKeys
                .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
                .map((v) => parseFloat(String(v)))
                .filter((v) => !isNaN(v));
            }
            if (trials.length === 0) return '-';
            const avg = trials.reduce((a, b) => a + b, 0) / trials.length;
            return avg.toFixed(dec);
          }

          // 2. ERROR (measured - nominal or nominal - measured)
          const isError =
            /(avg|average|reading|actual)\s*-\s*(nominal|std)/i.test(expr) ||
            /(nominal|std)\s*-\s*(avg|average|reading|actual)/i.test(expr) ||
            (/error/i.test(expr) && !/PASS.*FAIL/i.test(expr));

          if (isError) {
            const isInverted = /(nominal|std)\s*-\s*(avg|average|reading|actual)/i.test(expr);
            let measuredVal: number | undefined = undefined;

            if (row.avg !== undefined && row.avg !== '-' && String(row.avg).trim() !== '') {
              measuredVal = parseFloat(String(row.avg));
            } else if (row.average !== undefined && row.average !== '-' && String(row.average).trim() !== '') {
              measuredVal = parseFloat(String(row.average));
            } else {
              const trials = [row.t1, row.t2, row.t3, row.t4, row.t5]
                .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
                .map((v) => parseFloat(String(v)))
                .filter((v) => !isNaN(v));
              if (trials.length > 0) {
                measuredVal = trials.reduce((a, b) => a + b, 0) / trials.length;
              } else if (row.actual_value !== undefined && String(row.actual_value).trim() !== '') {
                measuredVal = parseFloat(String(row.actual_value));
              } else if (row.reading !== undefined && String(row.reading).trim() !== '') {
                measuredVal = parseFloat(String(row.reading));
              } else if (row.ascending_reading !== undefined && String(row.ascending_reading).trim() !== '') {
                measuredVal = parseFloat(String(row.ascending_reading));
              } else if (row.t1 !== undefined && String(row.t1).trim() !== '') {
                measuredVal = parseFloat(String(row.t1));
              }
            }

            if (measuredVal === undefined || isNaN(measuredVal)) return '-';
            const err = isInverted ? nominal - measuredVal : measuredVal - nominal;
            return (err >= 0 ? '+' : '') + err.toFixed(dec);
          }

          // 3. STATUS / JUDGEMENT
          if (/IF\(.*PASS.*FAIL.*\)/i.test(expr) || /PASS.*FAIL/i.test(expr)) {
            const limitMatch = expr.match(/<=\s*([0-9.]+)/i) || expr.match(/<\s*([0-9.]+)/i);
            const tolLimit = limitMatch ? parseFloat(limitMatch[1]) : tol;

            const hasReading =
              row.error !== undefined ||
              row.avg !== undefined ||
              row.average !== undefined ||
              (row.reading !== undefined && String(row.reading).trim() !== '') ||
              (row.t1 !== undefined && String(row.t1).trim() !== '');
            if (!hasReading) return '-';

            let errVal: number;
            if (row.error !== undefined && row.error !== '-') {
              errVal = Math.abs(typeof row.error === 'number' ? row.error : parseFloat(String(row.error).replace('+', '')) || 0);
            } else {
              const readVal = parseFloat(String(row.avg ?? row.average ?? row.reading ?? row.ascending_reading ?? row.t1 ?? nominal));
              errVal = Math.abs(parseFloat((readVal - nominal).toFixed(dec)) || 0);
            }
            return errVal <= tolLimit + 1e-9 ? 'PASS' : 'FAIL';
          }

          return row[expr] ?? row[formula] ?? '-';
        } catch {
          return '-';
        }
      };

      const resolvePdfCellValue = (
        row: any,
        col: any,
        tblTolerance: number = 0.02,
        tblDec: number = 3,
        rIdx?: number,
      ): string => {
        if (!row || !col) return '-';

        const rawCell = row[col.id];
        const colIdLower = String(col.id || '').toLowerCase().trim();
        const colType = String(col.type || '').toLowerCase().trim();
        const colRole = String(col.role || '').toUpperCase().trim();
        const colLabelLower = String(col.label || '').toLowerCase().trim();

        const dec =
          col.decimal_places ??
          col.decimalPrecision ??
          tblDec;

        // 1. Point / Serial No / Metadata
        const isPointNo =
          colIdLower === 'point_number' ||
          colIdLower === 'sl_no' ||
          colIdLower === 'sino' ||
          colRole === 'METADATA';
        if (isPointNo) {
          const pt = row.point_number ?? row.sl_no ?? rawCell ?? (rIdx !== undefined ? rIdx + 1 : undefined);
          return pt !== undefined && pt !== null && String(pt).trim() !== '' ? String(pt) : '-';
        }

        // 2. Status / Judgement
        const isStatusCol =
          colType === 'status' ||
          colRole === 'JUDGEMENT' ||
          /judg|verdict|status|decision|acceptance/i.test(colIdLower) ||
          /judg|verdict|status/i.test(colLabelLower);

        if (isStatusCol) {
          if (rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== '') {
            return String(rawCell).trim();
          }
          const fallbackStatus = row.judgement ?? row.status ?? row.verdict ?? row.result;
          if (fallbackStatus !== undefined && fallbackStatus !== null && String(fallbackStatus).trim() !== '') {
            return String(fallbackStatus).trim();
          }
          if (col.formula && typeof col.formula === 'string' && col.formula.trim().length > 0) {
            const fRes = evalRowFormula(col.formula, row, tblTolerance, dec);
            if (fRes !== undefined && fRes !== null && String(fRes).trim() !== '' && fRes !== '-') {
              return String(fRes).trim();
            }
          }
          return 'OK';
        }

        // 3. Nominal Specification
        const isNominalCol =
          colType === 'nominal' ||
          colRole === 'SPECIFICATION' ||
          colIdLower === 'nominal' ||
          colIdLower === 'nom' ||
          colIdLower === 'nominal_value' ||
          colIdLower === 'std_spec' ||
          colIdLower === 'std_value';

        if (isNominalCol) {
          const rawNom =
            rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== ''
              ? rawCell
              : row.nominal_value !== undefined && row.nominal_value !== null && String(row.nominal_value).trim() !== ''
              ? row.nominal_value
              : row.nominal !== undefined && row.nominal !== null && String(row.nominal).trim() !== '' && row.nominal !== 0 && row.nominal !== '0'
              ? row.nominal
              : row.nom ?? row.std_spec ?? row.std_value ?? row.nominal;

          if (rawNom !== undefined && rawNom !== null && String(rawNom).trim() !== '' && rawNom !== '-') {
            const strNom = String(rawNom).trim();
            const p = parseFloat(strNom);
            if (!isNaN(p) && /^[+-]?\d+(\.\d+)?$/.test(strNom)) {
              return dec === 0 ? String(Math.round(p)) : p.toFixed(dec);
            }
            return strNom;
          }
          return '-';
        }

        // 4. Specification / Required Dimension / Text
        const isSpecCol =
          colType === 'text' ||
          colIdLower === 'required_dimension' ||
          colIdLower === 'specification' ||
          colIdLower === 'description' ||
          /spec|dimension/i.test(colLabelLower);

        if (isSpecCol) {
          const textVal =
            rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== ''
              ? rawCell
              : row.required_dimension || row.specification || row.description;
          if (textVal !== undefined && textVal !== null && String(textVal).trim() !== '') {
            return String(textVal);
          }
          if (colType === 'text') return '-';
        }

        // 5. Formula Column
        const hasFormula =
          colType === 'formula' ||
          (typeof col.formula === 'string' && col.formula.trim().length > 0);

        if (hasFormula) {
          if (rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== '') {
            const strCell = String(rawCell).trim();
            const p = parseFloat(strCell);
            if (!isNaN(p) && /^[+-]?\d+(\.\d+)?$/.test(strCell)) {
              return dec === 0 ? String(Math.round(p)) : p.toFixed(dec);
            }
            return strCell;
          }
          if (col.formula && typeof col.formula === 'string' && col.formula.trim().length > 0) {
            const fRes = evalRowFormula(col.formula, row, tblTolerance, dec);
            if (fRes !== undefined && fRes !== null && String(fRes).trim() !== '') {
              return String(fRes).trim();
            }
          }
          return '-';
        }

        // 6. General Cell Value (Readings, Trials, Numbers, Custom Text)
        if (rawCell !== undefined && rawCell !== null && String(rawCell).trim() !== '') {
          const strVal = String(rawCell).trim();
          if (strVal === '-') return '-';
          const p = parseFloat(strVal);
          if (!isNaN(p) && /^[+-]?\d+(\.\d+)?$/.test(strVal)) {
            return dec === 0 ? String(Math.round(p)) : p.toFixed(dec);
          }
          return strVal;
        }

        if (colIdLower.includes('actual') && row.actual_dimension) return String(row.actual_dimension);
        if (colIdLower.includes('required') && row.required_dimension) return String(row.required_dimension);

        return '-';
      };

      const buildSingleTableElement = (tbl: any, isHalf: boolean = false): any => {
        const bodyWidth = isHalf
          ? ((useLandscape ? 841.89 : 595.28) - 36 - 12) / 2
          : ((useLandscape ? 841.89 : 595.28) - 36);

        const mapAlign = (align?: string): 'left' | 'center' | 'right' => {
          if (align === 'left') return 'left';
          if (align === 'right') return 'right';
          return 'center';
        };

        if (tbl.orientation === 'horizontal') {
          const displayCols = (tbl.columns || []).filter((c: any) => c.id !== 'point_number' && c.id !== 'sl_no' && c.id !== 'sino');
          const rowCount = (tbl.rows || []).length;
          const numCols = rowCount + 1;
          const dec = tbl.decimal_places !== undefined ? tbl.decimal_places : 3;

          const isHighColCount = rowCount > 12;
          const isVeryHighColCount = rowCount >= 18;
          const hPadH = isVeryHighColCount ? 0.6 : isHighColCount ? 1.0 : 1.5;
          const hPadV = 0.8;
          const labelPadH = 3.0; // clean padding gap for Parameter column matching preview px-1
          const col0PadTotal = labelPadH * 2;
          const dataColsPadTotal = rowCount * (hPadH * 2);
          const cellPadTotal = col0PadTotal + dataColsPadTotal;
          const vBordersTotal = (numCols + 1) * 0.4;
          const netBudget = Math.max(50, bodyWidth - cellPadTotal - vBordersTotal - 0.5);

          // Support user-configured first column width or intelligent default so label text never wraps onto multiple lines
          let labelColWidth: number;
          if (typeof tbl.firstColWidth === 'number' && tbl.firstColWidth > 0) {
            labelColWidth = tbl.firstColWidth;
          } else if (typeof tbl.firstColWidth === 'string' && parseFloat(tbl.firstColWidth) > 0) {
            labelColWidth = parseFloat(tbl.firstColWidth);
          } else if (typeof tbl.parameterWidth === 'number' && tbl.parameterWidth > 0) {
            labelColWidth = tbl.parameterWidth;
          } else if (typeof tbl.columns?.[0]?.width === 'number' && tbl.columns[0].width > 0) {
            labelColWidth = tbl.columns[0].width;
          } else if (typeof tbl.columns?.[0]?.width === 'string' && parseFloat(tbl.columns[0].width) > 0) {
            labelColWidth = parseFloat(tbl.columns[0].width);
          } else {
            // Intelligent default based on rowCount and printable width
            labelColWidth = isVeryHighColCount ? 102 : rowCount > 12 ? 110 : rowCount > 8 ? 100 : 90;
          }

          // Bound labelColWidth to prevent starvation of data columns on A4
          // When rowCount >= 18 (e.g. 21 points), each point needs >= 19.5pt so numbers like "10.000" never wrap!
          const maxLabelWidthForCols = isVeryHighColCount
            ? Math.max(85, Math.min(104, bodyWidth - (rowCount * 19.5) - cellPadTotal - vBordersTotal))
            : bodyWidth * 0.35;
          labelColWidth = Math.min(labelColWidth, maxLabelWidthForCols);

          const remainingBudget = Math.max(10 * rowCount, netBudget - labelColWidth);
          const dataColWidth = Math.floor((remainingBudget / Math.max(1, rowCount)) * 100) / 100;
          const colWidths = [labelColWidth, ...Array(rowCount).fill(dataColWidth)];

          // Distribute any rounding delta onto the label column
          const currentSum = colWidths.reduce((a, b) => a + b, 0);
          const delta = Math.round((netBudget - currentSum) * 100) / 100;
          if (Math.abs(delta) > 0.001) {
            colWidths[0] = Math.round((colWidths[0] + delta) * 100) / 100;
          }

          // Respect user-configured certificate font sizes directly (or block-level settings if configured)
          const effectiveHTableHeaderFontSize = tbl.headerFontSize
            ? Number(tbl.headerFontSize)
            : tableHeaderFontSize;
          const effectiveHContentFontSize = tbl.fontSize
            ? Number(tbl.fontSize)
            : contentFontSize;
          const effectiveHTitleFontSize = tbl.titleFontSize
            ? Number(tbl.titleFontSize)
            : titleFontSize;

          // For very high column count tables (>= 18 points), ensure point cells fit 6-character numbers without wrapping
          const pointCellFontSize = isVeryHighColCount
            ? Math.min(effectiveHContentFontSize, 5.4)
            : effectiveHContentFontSize;
          const pointHeaderFontSize = isVeryHighColCount
            ? Math.min(effectiveHTableHeaderFontSize, 5.5)
            : effectiveHTableHeaderFontSize;

          const tblBody: any[] = [];

          // Title Row (only if user provided a title)
          const hasTitle = Boolean(tbl.title && String(tbl.title).trim() !== '');
          const unitStr = tbl.unit ? String(tbl.unit).trim() : '';

          if (hasTitle) {
            const titleText = `${String(tbl.title).trim()}${unitStr ? ` (ALL VALUES ARE IN ${unitStr})` : ''}`;
            tblBody.push([
              {
                text: titleText,
                style: 'boxHeader',
                fontSize: effectiveHTitleFontSize,
                margin: [1, 0.5, 1, 0.5],
                colSpan: numCols,
              },
              ...Array(numCols - 1).fill({}),
            ]);
          }

          // Header Row: Parameter + Point numbers 1..N
          const firstColAlign = mapAlign(tbl.columns?.[0]?.align || 'center');
          tblBody.push([
            {
              text: 'Parameter / Sl no',
              style: 'thCell',
              fontSize: effectiveHTableHeaderFontSize,
              margin: [0, 0.5, 0, 0.5],
              fillColor: '#e2e8f0',
              alignment: firstColAlign,
              bold: true,
              noWrap: true,
            },
            ...(tbl.rows || []).map((r: any, rIdx: number) => ({
              text: String(r.point_number ?? (rIdx + 1)),
              style: 'thCell',
              fontSize: pointHeaderFontSize,
              margin: [0, 0.5, 0, 0.5],
              fillColor: '#f1f5f9',
              alignment: 'center',
              bold: true,
              noWrap: true,
            })),
          ]);

          // Data Rows (one row per parameter)
          displayCols.forEach((col: any) => {
            const colAlign = mapAlign(col.align || 'center');
            const rowCells: any[] = [
              {
                text: col.label || col.id,
                style: 'tdCell',
                fontSize: effectiveHContentFontSize,
                margin: [0, 0.5, 0, 0.5],
                fillColor: '#f8fafc',
                alignment: colAlign,
                bold: true,
                noWrap: labelColWidth >= 95,
              },
            ];

            (tbl.rows || []).forEach((row: any, rIdx: number) => {
              const val = resolvePdfCellValue(row, col, tbl.tolerance, dec, rIdx);

              const valUpper = String(val).toUpperCase().trim();
              const isPass = valUpper === 'PASS' || valUpper === 'OK' || valUpper === 'NORMAL' || valUpper === 'ACCEPT';
              const isFail = valUpper === 'FAIL' || valUpper === 'REJECT' || valUpper === 'NOT OK' || valUpper === 'NG';

              rowCells.push({
                text: String(val),
                style: col.type === 'text' ? 'tdCell' : 'tdCellMono',
                fontSize: pointCellFontSize,
                alignment: 'center',
                margin: [0, 0.5, 0, 0.5],
                color: isPass ? '#15803d' : isFail ? '#b91c1c' : '#000000',
                bold: isPass || isFail || col.type === 'nominal',
                noWrap: true,
              });
            });

            tblBody.push(rowCells);
          });

          // Footer Note (if any)
          if (tbl.footerNote) {
            tblBody.push([
              {
                text: tbl.footerNote,
                style: 'tdCell',
                fontSize: signatureFontSize,
                margin: [0, 0.5, 0, 0.5],
                italics: true,
                alignment: 'center',
                fillColor: '#f8fafc',
                colSpan: numCols,
              },
              ...Array(numCols - 1).fill({}),
            ]);
          }

          return {
            unbreakable: true,
            table: {
              dontBreakRows: true,
              headerRows: hasTitle ? 2 : 1,
              widths: colWidths,
              body: tblBody,
            },
            layout: {
              hLineWidth: (i: number, node: any) => (i === 0 || (hasTitle ? i === 1 || i === 2 : i === 1) || i === node.table.body.length ? 0.75 : 0.4),
              vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 0.75 : 0.4),
              hLineColor: () => '#000000',
              vLineColor: () => '#000000',
              paddingLeft: (i: number) => (i === 0 ? labelPadH : hPadH),
              paddingRight: (i: number) => (i === 0 ? labelPadH : hPadH),
              paddingTop: () => hPadV,
              paddingBottom: () => hPadV,
            },
            margin: [
              0,
              tbl.marginTop !== undefined ? Number(tbl.marginTop) : 0,
              0,
              tbl.marginBottom !== undefined ? Number(tbl.marginBottom) : tableGap,
            ],
          };
        }

        const numCols = tbl.columns?.length || 1;

        const padH = numCols > 12 ? 0.8 : numCols > 9 ? 1.0 : 1.5;
        const cellPadTotal = padH * 2;
        const vBordersTotal = (numCols + 1) * 0.5;
        // Strict net budget ensuring table drawn width NEVER exceeds outer border (with 0.5pt safety margin)
        const netBudget = Math.max(50, bodyWidth - (numCols * cellPadTotal) - vBordersTotal - 0.5);

        // Use user's configured font sizes directly so all tables look consistent, sharp, and match Settings
        const effectiveHeaderFontSize = tbl.headerFontSize ? Number(tbl.headerFontSize) : tableHeaderFontSize;
        const effectiveContentFontSize = tbl.fontSize ? Number(tbl.fontSize) : contentFontSize;

        // Extract user configured column widths or fall back to intelligent type-based weights
        const rawWeights = (tbl.columns || []).map((col: any) => {
          if (typeof col.width === 'number' && !isNaN(col.width) && col.width > 0) {
            return col.width;
          }
          if (typeof col.width === 'string' && col.width.trim() !== '') {
            const s = col.width.trim();
            if (s.endsWith('%')) {
              const pct = parseFloat(s);
              if (!isNaN(pct) && pct > 0) return (pct / 100) * netBudget;
            }
            const parsed = parseFloat(s);
            if (!isNaN(parsed) && parsed > 0) return parsed;
          }
          const cId = String(col.id || col.key || '').toLowerCase();
          const cType = String(col.type || '').toLowerCase();
          if (cId === 'point_number' || cId === 'sl_no' || cId === 'sino' || cId === 'sr_no') return 25;
          if (cType === 'status' || cId === 'judgement' || cId === 'status') return 35;
          if (cType === 'text' || cId === 'specification' || cId === 'description' || cId === 'parameter') return 70;
          if (cId.includes('master')) return 45;
          return 45;
        });

        const sumRawWeights = rawWeights.reduce((a: number, b: number) => a + b, 0) || 1;

        // Proportional distribution guaranteeing total table width fits exactly within the page width
        const colWidths = rawWeights.map((w: number) =>
          Math.round(((w * netBudget) / sumRawWeights) * 100) / 100
        );

        // Distribute rounding delta onto the widest column
        const currentSum = colWidths.reduce((a: number, b: number) => a + b, 0);
        const delta = Math.round((netBudget - currentSum) * 100) / 100;
        if (Math.abs(delta) > 0.001 && colWidths.length > 0) {
          let maxIdx = 0;
          for (let i = 1; i < colWidths.length; i++) {
            if (colWidths[i] > colWidths[maxIdx]) maxIdx = i;
          }
          colWidths[maxIdx] = Math.round((colWidths[maxIdx] + delta) * 100) / 100;
        }

        const tblBody: any[] = [];

        // Title Row (only if user provided a title)
        const hasTitle = Boolean(tbl.title && String(tbl.title).trim() !== '');
        const unitStr = tbl.unit ? String(tbl.unit).trim() : '';

        if (hasTitle) {
          const titleText = `${String(tbl.title).trim()}${unitStr ? ` (ALL VALUES ARE IN ${unitStr})` : ''}`;
          tblBody.push([
            {
              text: titleText,
              style: 'boxHeader',
              fontSize: titleFontSize,
              margin: [1, 0.5, 1, 0.5],
              colSpan: numCols,
            },
            ...Array(numCols - 1).fill({}),
          ]);
        }

        // Header Row (Standard 1-tier or Grouped 2-tier)
        const hasHeaderGroups = (tbl.columns || []).some(
          (c: any) => c && c.groupName && String(c.groupName).trim() !== ''
        );

        let tableHeaderRows = (hasTitle ? 1 : 0) + (hasHeaderGroups ? 2 : 1);

        if (!hasHeaderGroups) {
          tblBody.push(
            tbl.columns.map((col: any) => ({
              text: col.label || col.id,
              style: 'thCell',
              fontSize: effectiveHeaderFontSize,
              margin: [0, 0.5, 0, 0.5],
              fillColor: '#f1f5f9',
              alignment: mapAlign(col.align || 'center'),
            }))
          );
        } else {
          tableHeaderRows = 3;
          // Row 1 & Row 2 for 2-tier headers in PDFMake
          const topHeaderCells: any[] = [];
          const subHeaderCells: any[] = [];

          let colIdx = 0;
          while (colIdx < tbl.columns.length) {
            const col = tbl.columns[colIdx];
            const group = col.groupName ? String(col.groupName).trim() : '';

            if (group) {
              let groupSpan = 0;
              while (
                colIdx + groupSpan < tbl.columns.length &&
                tbl.columns[colIdx + groupSpan].groupName &&
                String(tbl.columns[colIdx + groupSpan].groupName).trim() === group
              ) {
                groupSpan++;
              }

              topHeaderCells.push({
                text: group,
                style: 'thCell',
                fontSize: effectiveHeaderFontSize,
                margin: [0, 0.5, 0, 0.5],
                fillColor: '#e2e8f0',
                colSpan: groupSpan,
                bold: true,
                alignment: 'center',
              });

              for (let d = 1; d < groupSpan; d++) {
                topHeaderCells.push({});
              }

              for (let d = 0; d < groupSpan; d++) {
                const subCol = tbl.columns[colIdx + d];
                subHeaderCells.push({
                  text: subCol.label || subCol.id,
                  style: 'thCell',
                  fontSize: effectiveHeaderFontSize,
                  margin: [0, 0.5, 0, 0.5],
                  fillColor: '#f1f5f9',
                  alignment: mapAlign(subCol.align || 'center'),
                });
              }

              colIdx += groupSpan;
            } else {
              topHeaderCells.push({
                text: col.label || col.id,
                style: 'thCell',
                fontSize: effectiveHeaderFontSize,
                margin: [0, 1.5, 0, 0.5],
                fillColor: '#f1f5f9',
                rowSpan: 2,
                alignment: mapAlign(col.align || 'center'),
              });
              subHeaderCells.push({});
              colIdx++;
            }
          }

          tblBody.push(topHeaderCells);
          tblBody.push(subHeaderCells);
        }

        // Data Rows
        const coveredCells = getCoveredCells(tbl.rows || [], tbl.columns || []);
        (tbl.rows || []).forEach((row: any, rIdx: number) => {
          if (row.is_merged || row.isMerged) {
            tblBody.push([
              {
                text: row.statement || row.merged_text || row.description || row.required_dimension || 'All the jaws are free from dent and damages',
                colSpan: numCols,
                style: 'tdCell',
                bold: true,
                fontSize: effectiveContentFontSize,
                fillColor: '#f8fafc',
                margin: [2, 0.5, 2, 0.5],
              },
              ...Array(numCols - 1).fill({}),
            ]);
            return;
          }
          const rowCells: any[] = [];
          tbl.columns.forEach((col: any) => {
            if (coveredCells.has(`${rIdx}_${col.id}`)) {
              rowCells.push({});
              return;
            }
            const spanInfo = row.cellSpans?.[col.id];
            const span = spanInfo?.colSpan || 1;
            const rSpan = spanInfo?.rowSpan || 1;
            const isMerged = span > 1 || rSpan > 1;

            if (isMerged) {
              const val = (row[col.id] !== undefined && row[col.id] !== '')
                ? row[col.id]
                : (col.id === 'nominal' ? row.nominal : '') ?? '';
              const numLines = String(val).split('\n').length;
              const extraTextHeight = (numLines - 1) * (effectiveContentFontSize * 1.18);
              const rowHeight = effectiveContentFontSize * 1.18 + 3.1;
              const topPad = rSpan > 1
                ? Math.max(0.5, 0.5 + ((rSpan - 1) * rowHeight - extraTextHeight) / 2)
                : 0.5;
              rowCells.push({
                text: String(val),
                colSpan: span > 1 ? span : undefined,
                rowSpan: rSpan > 1 ? rSpan : undefined,
                style: 'tdCell',
                fontSize: effectiveContentFontSize,
                margin: [0, topPad, 0, 0.5],
                alignment: 'center',
                verticalAlignment: 'middle',
                bold: true,
                fillColor: '#f8fafc',
              });
              return;
            }
            const isPointNo = col.id === 'point_number' || col.id === 'sl_no' || col.id === 'sino';
            let val: any = row[col.id];
            if (isPointNo) {
              val = row.point_number ?? row[col.id] ?? (tblBody.length - 1);
              const rowHeight = effectiveContentFontSize * 1.18 + 3.1;
              const topPad = rSpan > 1
                ? Math.max(0.5, 0.5 + ((rSpan - 1) * rowHeight) / 2)
                : 0.5;
              rowCells.push({
                text: String(val),
                colSpan: span > 1 ? span : undefined,
                rowSpan: rSpan > 1 ? rSpan : undefined,
                style: 'tdCellMono',
                fontSize: effectiveContentFontSize,
                margin: [0, topPad, 0, 0.5],
                alignment: 'center',
                verticalAlignment: 'middle',
              });
              return;
            }
            const decimals = tbl.decimal_places !== undefined ? tbl.decimal_places : 3;
            val = resolvePdfCellValue(row, col, tbl.tolerance, decimals, rIdx);

            const valUpper = String(val).toUpperCase().trim();
            const isPass = valUpper === 'PASS' || valUpper === 'OK' || valUpper === 'NORMAL' || valUpper === 'ACCEPT';
            const isFail = valUpper === 'FAIL' || valUpper === 'REJECT' || valUpper === 'NOT OK' || valUpper === 'NG';

            rowCells.push({
              text: String(val),
              style: col.type === 'text' ? 'tdCell' : 'tdCellMono',
              fontSize: effectiveContentFontSize,
              margin: [0, 0.5, 0, 0.5],
              alignment: mapAlign(col.align || 'center'),
              color: isPass ? '#15803d' : isFail ? '#b91c1c' : '#000000',
              bold: isPass || isFail || col.type === 'nominal',
            });
          });
          tblBody.push(rowCells);
        });

        // Footer Note (if any)
        if (tbl.footerNote) {
          tblBody.push([
            {
              text: tbl.footerNote,
              fontSize: signatureFontSize,
              margin: [0, 0.5, 0, 0.5],
              italics: true,
              alignment: 'center',
              fillColor: '#f8fafc',
              colSpan: numCols,
            },
            ...Array(numCols - 1).fill({}),
          ]);
        }

        return {
          unbreakable: (tbl.rows || []).length <= 15,
          table: {
            dontBreakRows: true,
            headerRows: tableHeaderRows,
            widths: colWidths,
            body: tblBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000',
            paddingLeft: () => padH,
            paddingRight: () => padH,
            paddingTop: () => 0.8,
            paddingBottom: () => 0.8,
          },
          margin: [
            0,
            tbl.marginTop !== undefined ? Number(tbl.marginTop) : 0,
            0,
            tbl.marginBottom !== undefined ? Number(tbl.marginBottom) : tableGap,
          ],
        };
      };

      blocks.forEach((block: any) => {
        const mt = block.marginTop !== undefined ? Number(block.marginTop) : 0;
        const mb = block.marginBottom !== undefined ? Number(block.marginBottom) : tableGap;

        if (block.type === 'table_grid') {
          resultElements.push(buildSingleTableElement(block));
        } else if (block.type === 'split_row') {
          const leftChild = block.children?.[0];
          const rightChild = block.children?.[1];

          const buildChildPdf = (child: any) => {
            if (!child || child.type === 'blank' || child.type === 'empty' || (child.type === 'text_block' && !child.content?.trim())) {
              return [];
            }
            if (child.type === 'table_grid') {
              return [buildSingleTableElement(child, true)];
            }
            if (child.type === 'text_block' && child.content?.trim()) {
              return [
                {
                  table: {
                    widths: ['*'],
                    body: [
                      [
                        {
                          text: child.content,
                          fontSize: contentFontSize,
                          alignment: 'center',
                          italics: true,
                          margin: [2, 2, 2, 2],
                        },
                      ],
                    ],
                  },
                  layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => '#000000',
                    vLineColor: () => '#000000',
                  },
                },
              ];
            }
            return [];
          };

          resultElements.push({
            unbreakable: true,
            columns: [
              {
                width: '49%',
                stack: buildChildPdf(leftChild),
              },
              { width: '2%', text: '' },
              {
                width: '49%',
                stack: buildChildPdf(rightChild),
              },
            ],
            margin: [0, mt, 0, mb],
          });
        } else if (block.type === 'matrix_table') {
          const matrixBody: any[] = [];
          
          // 1. Calculate max columns from rows or headers taking colSpans into account
          let matrixCols = 1;
          (block.headers || []).forEach((hRow: any[]) => {
            let rowSpanSum = 0;
            (hRow || []).forEach((c: any) => {
              rowSpanSum += (c && typeof c === 'object' && c.colSpan ? Number(c.colSpan) : 1);
            });
            if (rowSpanSum > matrixCols) matrixCols = rowSpanSum;
          });
          (block.rows || []).forEach((r: any[]) => {
            let rowSpanSum = 0;
            (r || []).forEach((c: any) => {
              rowSpanSum += (c && typeof c === 'object' && c.colSpan ? Number(c.colSpan) : 1);
            });
            if (rowSpanSum > matrixCols) matrixCols = rowSpanSum;
          });

          const isHalfWidth = block.width === '50%';
          const matrixPadH = matrixCols > 12 ? 0.8 : matrixCols > 9 ? 1.0 : 1.5;
          const fullMatrixBodyWidth = (useLandscape ? 841.89 : 595.28) - 36;
          const matrixBodyWidth = isHalfWidth ? fullMatrixBodyWidth * 0.55 : fullMatrixBodyWidth;
          const matrixNetBudget = Math.max(50, matrixBodyWidth - (matrixCols * matrixPadH * 2) - ((matrixCols + 1) * 0.5) - 0.5);

          // Intelligent column width allocation for matrix tables:
          // Requirement/Specification column in reference tables needs ~52% width so standard sentences do not wrap to 2 lines
          let colWidths: number[];
          if (Array.isArray(block.columnWidths) && block.columnWidths.length === matrixCols) {
            const rawSum = block.columnWidths.reduce((a: number, b: number) => a + Number(b), 0) || 1;
            colWidths = block.columnWidths.map((w: number) => Math.round(((Number(w) * matrixNetBudget) / rawSum) * 100) / 100);
          } else if (matrixCols === 3) {
            // Standard 3-column reference matrix (e.g. IS 2092: Requirement | 0.01 Dial Gauge | 0.002 Dial Gauge)
            const w0 = Math.round(matrixNetBudget * 0.52 * 100) / 100;
            const wRemaining = matrixNetBudget - w0;
            const w1 = Math.round((wRemaining / 2) * 100) / 100;
            const w2 = Math.round((wRemaining - w1) * 100) / 100;
            colWidths = [w0, w1, w2];
          } else if (matrixCols >= 2) {
            // Multi-column matrix: give first column 45% for labels, divide remainder evenly
            const w0 = Math.round(matrixNetBudget * 0.45 * 100) / 100;
            const wOther = Math.round(((matrixNetBudget - w0) / (matrixCols - 1)) * 100) / 100;
            colWidths = [w0, ...Array(matrixCols - 2).fill(wOther)];
            const currentSum = colWidths.reduce((a, b) => a + b, 0);
            colWidths.push(Math.round((matrixNetBudget - currentSum) * 100) / 100);
          } else {
            colWidths = Array(matrixCols).fill(Math.round((matrixNetBudget / matrixCols) * 100) / 100);
          }

          // Balance any rounding delta onto column 0
          const sumMatrixCols = colWidths.reduce((a, b) => a + b, 0);
          const matrixDelta = Math.round((matrixNetBudget - sumMatrixCols) * 100) / 100;
          if (Math.abs(matrixDelta) > 0.001) {
            colWidths[0] = Math.round((colWidths[0] + matrixDelta) * 100) / 100;
          }

          // Title (only if user provided a title)
          const hasMatrixTitle = Boolean(block.title && String(block.title).trim() !== '');
          if (hasMatrixTitle) {
            matrixBody.push([
              {
                text: String(block.title).trim(),
                style: 'boxHeader',
                fontSize: titleFontSize,
                colSpan: matrixCols,
              },
              ...Array(matrixCols - 1).fill({}),
            ]);
          }

          // Build 2D Header Grid to safely handle multi-row colSpan & rowSpan without undefined cells
          const numHeaderRows = (block.headers || []).length;
          const headerGrid: any[][] = Array.from({ length: numHeaderRows }, () =>
            Array(matrixCols).fill(null)
          );

          (block.headers || []).forEach((hRow: any[], rIdx: number) => {
            (hRow || []).forEach((rawCell: any) => {
              // Find first empty cell in this row
              let cIdx = 0;
              while (cIdx < matrixCols && headerGrid[rIdx][cIdx] !== null) {
                cIdx++;
              }
              if (cIdx >= matrixCols) return;

              const cellObj = rawCell && typeof rawCell === 'object' && 'text' in rawCell
                ? rawCell
                : { text: String(rawCell ?? '') };

              const cSpan = Math.min(Number(cellObj.colSpan) || 1, matrixCols - cIdx);
              const rSpan = Math.min(Number(cellObj.rowSpan) || 1, numHeaderRows - rIdx);
              const rowHeight = tableHeaderFontSize * 1.18 + 3.1;
              const topPad = rSpan > 1
                ? Math.max(0.5, 0.5 + ((rSpan - 1) * rowHeight) / 2)
                : 0.5;

              // Set the origin cell
              headerGrid[rIdx][cIdx] = {
                text: cellObj.text || '',
                style: 'thCell',
                fontSize: tableHeaderFontSize,
                fillColor: '#f1f5f9',
                colSpan: cSpan,
                rowSpan: rSpan,
                margin: [0, topPad, 0, 0.5],
                alignment: cellObj.align || 'center',
                verticalAlignment: 'middle',
              };

              // Fill dummy objects for spanned slots
              for (let dr = 0; dr < rSpan; dr++) {
                for (let dc = 0; dc < cSpan; dc++) {
                  if (dr !== 0 || dc !== 0) {
                    const targetR = rIdx + dr;
                    const targetC = cIdx + dc;
                    if (targetR < numHeaderRows && targetC < matrixCols) {
                      headerGrid[targetR][targetC] = {};
                    }
                  }
                }
              }
            });
          });

          // Ensure no null entries exist in headerGrid
          headerGrid.forEach((hRow) => {
            for (let c = 0; c < matrixCols; c++) {
              if (hRow[c] === null) {
                hRow[c] = {};
              }
            }
            matrixBody.push(hRow);
          });

          // Build 2D Body Grid to safely handle multi-row colSpan, rowSpan, and cell alignments
          const numBodyRows = (block.rows || []).length;
          const bodyGrid: any[][] = Array.from({ length: numBodyRows }, () =>
            Array(matrixCols).fill(null)
          );

          (block.rows || []).forEach((rRow: any[], rIdx: number) => {
            const cells = Array.isArray(rRow) ? rRow : [rRow];
            cells.forEach((rawCell: any) => {
              // Find first empty cell in this row
              let cIdx = 0;
              while (cIdx < matrixCols && bodyGrid[rIdx][cIdx] !== null) {
                cIdx++;
              }
              if (cIdx >= matrixCols) return;

              const cellObj = rawCell && typeof rawCell === 'object' && 'text' in rawCell
                ? rawCell
                : { text: String(rawCell ?? '-') };

              const cSpan = Math.min(Number(cellObj.colSpan) || 1, matrixCols - cIdx);
              const rSpan = Math.min(Number(cellObj.rowSpan) || 1, numBodyRows - rIdx);
              const rowHeight = contentFontSize * 1.18 + 2.5;
              const topPad = rSpan > 1
                ? Math.max(0.5, 0.5 + ((rSpan - 1) * rowHeight) / 2)
                : 0.5;

              bodyGrid[rIdx][cIdx] = {
                text: String(cellObj.text ?? '-'),
                style: 'tdCellMono',
                fontSize: contentFontSize,
                colSpan: cSpan,
                rowSpan: rSpan,
                alignment: cellObj.align || 'center',
                margin: [0, topPad, 0, 0.5],
              };

              // Fill dummy objects for spanned slots
              for (let dr = 0; dr < rSpan; dr++) {
                for (let dc = 0; dc < cSpan; dc++) {
                  if (dr !== 0 || dc !== 0) {
                    const targetR = rIdx + dr;
                    const targetC = cIdx + dc;
                    if (targetR < numBodyRows && targetC < matrixCols) {
                      bodyGrid[targetR][targetC] = {};
                    }
                  }
                }
              }
            });
          });

          // Ensure no null entries exist in bodyGrid
          bodyGrid.forEach((bRow) => {
            for (let c = 0; c < matrixCols; c++) {
              if (bRow[c] === null) {
                bRow[c] = {};
              }
            }
            matrixBody.push(bRow);
          });

          // If no body rows exist, provide a fallback single row so PDFMake table remains valid
          if (numBodyRows === 0) {
            const emptyFallbackRow: any[] = [
              {
                text: '-',
                style: 'tdCellMono',
                fontSize: contentFontSize,
                colSpan: matrixCols,
                alignment: 'center',
                margin: [0, 0.5, 0, 0.5],
              },
              ...Array(Math.max(0, matrixCols - 1)).fill({}),
            ];
            matrixBody.push(emptyFallbackRow);
          }

          resultElements.push({
            unbreakable: true,
            table: {
              dontBreakRows: true,
              headerRows: (hasMatrixTitle ? 1 : 0) + numHeaderRows,
              widths: colWidths,
              body: matrixBody,
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#000000',
              vLineColor: () => '#000000',
              paddingLeft: () => matrixPadH,
              paddingRight: () => matrixPadH,
              paddingTop: () => 0.8,
              paddingBottom: () => 0.8,
            },
            margin: [
              isHalfWidth ? (fullMatrixBodyWidth - matrixBodyWidth) / 2 : 0,
              mt,
              0,
              block.marginBottom !== undefined ? Number(block.marginBottom) : mb,
            ],
          });
        } else if (block.type === 'text_block') {
          resultElements.push({
            unbreakable: true,
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    text: block.content || '',
                    fontSize: dense ? 6.5 : 7.5,
                    alignment: 'center',
                    italics: true,
                    margin: [2, 2, 2, 2],
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#000000',
              vLineColor: () => '#000000',
            },
            margin: [0, mt, 0, mb],
          });
        } else if (block.type === 'diagram_block' || block.type === 'diagram') {
          const dResolved: ResolvedPdfDiagram | null = block.resolvedDiagram;
          if (dResolved) {
            const blockWidth = block.width ? Math.min(Number(block.width), 360) : 240;
            const blockAlign = block.alignment || 'center';
            const cellNode =
              dResolved.type === 'svg'
                ? {
                    svg: dResolved.content,
                    width: blockWidth,
                    alignment: blockAlign,
                    margin: [2, 2, 2, 2],
                  }
                : {
                    image: dResolved.dataUrl,
                    width: blockWidth,
                    alignment: blockAlign,
                    margin: [2, 2, 2, 2],
                  };

            resultElements.push({
              __isDiagramNode: true,
              unbreakable: true,
              table: {
                widths: ['*'],
                body: [[cellNode]],
              },
              layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                hLineColor: () => '#000000',
                vLineColor: () => '#000000',
              },
              margin: [0, mt, 0, mb],
            });
          }
        } else if (block.type === 'page_break') {
          resultElements.push({ text: '', pageBreak: 'before' });
        }
      });

      return resultElements;
    };

    // Deterministic signature block height calculation to anchor seamlessly on top of footer without border overflow
    const clampedSigImgHeight = Math.max(18, Math.min(24, signatureImageHeight));
    const sealImgHeight = Math.max(22, Math.min(26, signatureImageHeight));
    const sigTableRowHeight = 48;
    const sigBlockHeight = sigTableRowHeight + 1.5;
    const bottomMargin = 46 + sigBlockHeight;

    // ── PDF Document Definition (NABL Certificate Layout) ──
    const docDefinition = {
      pageSize: 'A4' as const,
      pageOrientation: (useLandscape ? 'landscape' : 'portrait') as
        | 'portrait'
        | 'landscape',
      pageMargins: [18, 52, 18, bottomMargin] as [number, number, number, number],
      ...(calibration.approval_status !== 'Approved'
        ? {
            watermark: {
              text:
                calibration.approval_status === 'Reviewed' || calibration.approval_status === 'Pending Approval'
                  ? 'REVIEWED - PENDING FINAL APPROVAL'
                  : 'DRAFT - PENDING REVIEW',
              color: '#ef4444',
              opacity: 0.18,
              bold: true,
              italics: false,
            },
          }
        : {}),

      // ── 0. BACKGROUND OUTLINE BORDER & FULL-BLEED BANNERS (On EVERY page) ──
      background: (currentPage: number, pageCount: number) => {
        const pageWidth = useLandscape ? 841.89 : 595.28;
        const pageHeight = useLandscape ? 595.28 : 841.89;
        const headerHeight = 52;
        const footerHeight = 46;
        const footerY = pageHeight - footerHeight;
        const rectHeight = footerY - headerHeight;

        return [
          {
            canvas: [
              // Top Header Banner background (edge-to-edge)
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: pageWidth,
                h: headerHeight,
                color: headerBgColor,
              },
              // Outer border rect surrounding certificate body
              {
                type: 'rect',
                x: 18,
                y: headerHeight,
                w: pageWidth - 36,
                h: rectHeight,
                lineWidth: 1,
                lineColor: '#000000',
              },
              // Bottom Footer Banner background (Edge-to-edge flush to bottom edge of page)
              {
                type: 'rect',
                x: 0,
                y: footerY,
                w: pageWidth,
                h: footerHeight,
                color: headerBgColor,
              },
            ],
          },
        ];
      },

      // ── 1. HEADER (Edge-to-Edge Full Width Banner at Top) ──
      header: (currentPage: number, pageCount: number) => {
        const rightTextSize =
          headerRightBoxText2.length > 20
            ? 7
            : headerRightBoxText2.length > 15
              ? 8
              : headerRightBoxText2.length > 12
                ? 8.5
                : 9.5;

        return {
          table: {
            widths: [135, '*', 155],
            body: [
              [
                {
                  ...leftHeaderContent,
                  fillColor: headerBgColor,
                  margin: [10, 7, 0, 0],
                },
                {
                  text: 'CALIBRATION CERTIFICATE',
                  bold: true,
                  fontSize: 17,
                  color: '#000000',
                  alignment: 'center',
                  fillColor: headerBgColor,
                  margin: [0, 14, 0, 0],
                },
                {
                  stack: [
                    ...(docNo
                      ? [
                          {
                            stack: [
                              {
                                text: `Doc.No : ${docNo}`,
                                fontSize: 8,
                                bold: true,
                                alignment: 'right',
                                color: '#000000',
                                noWrap: true,
                              },
                              {
                                text: `Date & Rev : ${docDate || '-'} & ${docRev || '-'}`,
                                fontSize: 8,
                                bold: true,
                                alignment: 'right',
                                color: '#000000',
                                noWrap: true,
                                margin: [0, 2, 0, 0],
                              },
                            ],
                            fillColor: headerBgColor,
                            margin: [0, 0, 0, 0],
                          },
                        ]
                      : [
                          {
                            text: headerRightBoxText1,
                            fontSize: 7.5,
                            bold: true,
                            alignment: 'right',
                            color: '#000000',
                            noWrap: true,
                          },
                          {
                            text: headerRightBoxText2,
                            fontSize: rightTextSize,
                            bold: true,
                            alignment: 'right',
                            color: '#000000',
                            noWrap: true,
                            margin: [0, 2, 0, 0],
                          },
                        ]),
                    ...(pageCount > 1
                      ? [
                          {
                            text: `Sheet ${currentPage} of ${pageCount}`,
                            fontSize: 6.8,
                            bold: true,
                            alignment: 'right',
                            color: '#000000',
                            noWrap: true,
                            margin: [0, 2, 0, 0],
                          },
                        ]
                      : []),
                  ],
                  fillColor: headerBgColor,
                  margin: [0, 13, 8, 0],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
          },
          margin: [0, 0, 0, 0],
        };
      },

      // ── 3. FOOTER (Edge-to-Edge Banner at Bottom with Signature Table Anchored Directly on Top) ──
      footer: (currentPage: number, pageCount: number) => {
        const pageWidth = useLandscape ? 841.89 : 595.28;
        const footerItems: any[] = [
          {
            text: footerLine1 || 'CALIBRATION CENTER :',
            bold: true,
            fontSize: 7.5,
            alignment: 'center',
            color: '#000000',
            margin: [0, 0, 0, 1],
          },
          ...(footerLine2
            ? [
                {
                  text: footerLine2,
                  fontSize: 6.8,
                  bold: true,
                  alignment: 'center',
                  color: '#000000',
                  margin: [0, 0, 0, 1],
                },
              ]
            : []),
          {
            text:
              footerLine3 ||
              'Website: www.gaugemaster.com | Email: info@gaugemaster.com | Phone: +91 98222 23948',
            fontSize: 6.8,
            bold: true,
            alignment: 'center',
            color: '#000000',
            margin: [0, 0, 0, (certConfig as any)?.footerLine4 ? 1 : 0],
          },
          ...((certConfig as any)?.footerLine4
            ? [
                {
                  text: (certConfig as any).footerLine4,
                  fontSize: 6.8,
                  bold: true,
                  alignment: 'center',
                  color: '#000000',
                },
              ]
            : []),
        ];

        // Total footer banner height is 46pt. Calculate vertical padding to vertically center content perfectly.
        const lineCount = footerItems.length;
        const totalTextHeight = lineCount * 8.0;
        const verticalPad = Math.max(3, Math.round((46 - totalTextHeight) / 2));

        const footerBanner = {
          stack: footerItems,
          alignment: 'center',
          margin: [18, verticalPad, 18, 0],
        };

        // Determine if cells have signature images
        const hasCalibratedSigImg = !!(
          calibratedSig && calibratedSig.startsWith('data:image')
        );
        const hasReviewedSigImg = !!(
          reviewedSig && reviewedSig.startsWith('data:image')
        );
        const hasApprovedSigImg = !!(
          approvedSig && approvedSig.startsWith('data:image')
        );

        // Content height estimation for signature cells:
        // With image: clampedSigImgHeight (24) + margin (1.5) + Name (8.5) + margin (0.5) + Designation (6.5) = 41 pt
        // Without image: underline (7) + margin (1.5) + Name (8.5) + margin (0.5) + Designation (6.5) = 24 pt
        const sigImgContentHeight = clampedSigImgHeight + 17;
        const sigNoImgContentHeight = 24;

        const calSigTopPad = Math.max(
          2,
          Math.round(
            (sigTableRowHeight -
              (hasCalibratedSigImg
                ? sigImgContentHeight
                : sigNoImgContentHeight)) /
              2,
          ),
        );
        const revSigTopPad = Math.max(
          2,
          Math.round(
            (sigTableRowHeight -
              (hasReviewedSigImg
                ? sigImgContentHeight
                : sigNoImgContentHeight)) /
              2,
          ),
        );
        const appSigTopPad = Math.max(
          2,
          Math.round(
            (sigTableRowHeight -
              (hasApprovedSigImg
                ? sigImgContentHeight
                : sigNoImgContentHeight)) /
              2,
          ),
        );

        const signatureBlockNode = {
          table: {
            widths: ['*', '*', '*'],
            heights: [sigTableRowHeight],
            body: [
              [
                // Column 1: Calibrated By
                {
                  stack: [
                    calibratedSig && calibratedSig.startsWith('data:image')
                      ? {
                          image: calibratedSig,
                          fit: [signatureImageWidth, clampedSigImgHeight],
                          alignment: 'center',
                        }
                      : {
                          text: '________________________',
                          alignment: 'center',
                          fontSize: Math.max(5.5, signatureFontSize - 0.5),
                        },
                    {
                      text: calibration.calibrated_by || 'Calibrated By',
                      alignment: 'center',
                      bold: true,
                      fontSize: signatureFontSize,
                      lineHeight: 1.05,
                      margin: [0, 1.5, 0, 0],
                      noWrap: true,
                    },
                    {
                      text:
                        calibration.calibrated_by_designation ||
                        'Calibration Engineer',
                      alignment: 'center',
                      fontSize: Math.max(5.5, signatureFontSize - 0.8),
                      color: '#475569',
                      lineHeight: 1.05,
                      margin: [0, 0.5, 0, 0],
                      noWrap: true,
                    },
                  ],
                  margin: [1, calSigTopPad, 1, 0],
                },
                // Column 2: Reviewed By
                {
                  stack: [
                    reviewedSig && reviewedSig.startsWith('data:image')
                      ? {
                          image: reviewedSig,
                          fit: [signatureImageWidth, clampedSigImgHeight],
                          alignment: 'center',
                        }
                      : {
                          text: '________________________',
                          alignment: 'center',
                          fontSize: Math.max(5.5, signatureFontSize - 0.5),
                        },
                    {
                      text: calibration.reviewed_by || 'Reviewed By',
                      alignment: 'center',
                      bold: true,
                      fontSize: signatureFontSize,
                      lineHeight: 1.05,
                      margin: [0, 1.5, 0, 0],
                      noWrap: true,
                    },
                    {
                      text:
                        calibration.reviewed_by_designation ||
                        'Calibration Reviewer',
                      alignment: 'center',
                      fontSize: Math.max(5.5, signatureFontSize - 0.8),
                      color: '#475569',
                      lineHeight: 1.05,
                      margin: [0, 0.5, 0, 0],
                      noWrap: true,
                    },
                  ],
                  margin: [1, revSigTopPad, 1, 0],
                },
                // Column 3: Approved By
                {
                  stack: [
                    approvedSig && approvedSig.startsWith('data:image')
                      ? {
                          image: approvedSig,
                          fit: [signatureImageWidth, clampedSigImgHeight],
                          alignment: 'center',
                        }
                      : {
                          text: '________________________',
                          alignment: 'center',
                          fontSize: Math.max(5.5, signatureFontSize - 0.5),
                        },
                    {
                      text:
                        calibration.approved_by ||
                        'Approved By',
                      alignment: 'center',
                      bold: true,
                      fontSize: signatureFontSize,
                      lineHeight: 1.05,
                      margin: [0, 1.5, 0, 0],
                      noWrap: true,
                    },
                    {
                      text:
                        calibration.approved_by_designation ||
                        'Quality Manager / Approver',
                      alignment: 'center',
                      fontSize: Math.max(5.5, signatureFontSize - 0.8),
                      color: '#475569',
                      lineHeight: 1.05,
                      margin: [0, 0.5, 0, 0],
                      noWrap: true,
                    },
                  ],
                  margin: [1, appSigTopPad, 1, 0],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: (i: number) => (i === 0 ? 0.5 : 0),
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000',
            paddingLeft: () => 2,
            paddingRight: () => 2,
            paddingTop: () => 0.5,
            paddingBottom: () => 0.5,
          },
          margin: [18, 0, 18, 0],
        };

        const isLastPage = currentPage === pageCount;
        if (isLastPage) {
          return {
            stack: [signatureBlockNode, footerBanner],
            margin: [0, 0, 0, 0],
          };
        }

        return {
          ...footerBanner,
          margin: [18, sigBlockHeight + verticalPad, 18, 0],
        };
      },

      content: [
        // ── 2. BODY CONTENT SECTION ──
        // Top Certificate Metadata Grid
        {
          table: {
            widths: calibration.ulr_number
              ? ['23%', '13%', '14%', '15%', '13%', '13%', '9%']
              : ['26%', '15%', '16%', '17%', '15%', '11%'],
            body: calibration.ulr_number
              ? [
                  [
                    { text: 'Calibration Location', style: 'gridTh' },
                    { text: 'Calibration On', style: 'gridTh' },
                    { text: 'Next Calibration Due', style: 'gridTh' },
                    { text: 'Certificate No.:', style: 'gridTh' },
                    { text: 'ULR No.', style: 'gridTh' },
                    { text: 'Certi Issue Date', style: 'gridTh' },
                    { text: 'Sheet No.', style: 'gridTh' },
                  ],
                  [
                    {
                      text:
                        inst?.calibration_source ||
                        inst?.location ||
                        'Permanent Laboratory',
                      style: 'gridTdBold',
                    },
                    {
                      text: fmtDate(calibration.calibration_date),
                      style: 'gridTd',
                    },
                    {
                      text: fmtDate(calibration.next_calibration_date),
                      style: 'gridTd',
                    },
                    {
                      text: calibration.certificate_number || '—',
                      style: 'gridTdBold',
                    },
                    {
                      text: calibration.ulr_number || '—',
                      style: 'gridTdBold',
                    },
                    {
                      text: fmtDate(
                        calibration.certificate_issue_date ||
                          calibration.calibration_date,
                      ),
                      style: 'gridTd',
                    },
                    { text: sheetNoText, style: 'gridTd' },
                  ],
                ]
              : [
                  [
                    { text: 'Calibration Location', style: 'gridTh' },
                    { text: 'Calibration On', style: 'gridTh' },
                    { text: 'Next Calibration Due', style: 'gridTh' },
                    { text: 'Certificate No.:', style: 'gridTh' },
                    { text: 'Certi Issue Date', style: 'gridTh' },
                    { text: 'Sheet No.', style: 'gridTh' },
                  ],
                  [
                    {
                      text:
                        inst?.calibration_source ||
                        inst?.location ||
                        'Permanent Laboratory',
                      style: 'gridTdBold',
                    },
                    {
                      text: fmtDate(calibration.calibration_date),
                      style: 'gridTd',
                    },
                    {
                      text: fmtDate(calibration.next_calibration_date),
                      style: 'gridTd',
                    },
                    {
                      text: calibration.certificate_number || '—',
                      style: 'gridTdBold',
                    },
                    {
                      text: fmtDate(
                        calibration.certificate_issue_date ||
                          calibration.calibration_date,
                      ),
                      style: 'gridTd',
                    },
                    { text: sheetNoText, style: 'gridTd' },
                  ],
                ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000',
            vLineColor: () => '#000',
            paddingLeft: () => 2,
            paddingRight: () => 2,
            paddingTop: () => 1.0,
            paddingBottom: () => 1.0,
          },
          margin: [0, 0, 0, tableGap] as [
            number,
            number,
            number,
            number,
          ],
        },

        // Description & Identification Box
        // Description & Identification Table (4 Columns / 2 Rows)
        {
          table: {
            widths: ['26%', '28%', '24%', '22%'],
            body: [
              [
                {
                  text: 'Description & Identification',
                  style: 'boxHeader',
                  alignment: 'center',
                  fontSize: titleFontSize,
                  colSpan: 4,
                  margin: [2, 0.8, 2, 0.8],
                },
                {},
                {},
                {},
              ],
              // Row 1: Instrument (DUC) | Make | Range | Serial No
              [
                {
                  stack: [
                    {
                      text: 'Instrument (DUC)',
                      bold: true,
                      fontSize: labelFontSize,
                      color: '#475569',
                    },
                    {
                      text: inst?.name || '-',
                      fontSize: valueFontSize,
                      bold: true,
                      margin: [0, 0.5, 0, 0],
                    },
                  ],
                  margin: [1, 0, 1, 0],
                },
                {
                  stack: [
                    {
                      text: 'Make',
                      bold: true,
                      fontSize: labelFontSize,
                      color: '#475569',
                    },
                    {
                      text: inst?.make || '-',
                      fontSize: valueFontSize,
                      bold: true,
                      margin: [0, 0.5, 0, 0],
                    },
                  ],
                  margin: [1, 0, 1, 0],
                },
                {
                  stack: [
                    {
                      text: rangeLabel,
                      bold: true,
                      fontSize: labelFontSize,
                      color: '#475569',
                    },
                    {
                      text: inst?.range || '-',
                      fontSize: valueFontSize,
                      bold: true,
                      margin: [0, 0.5, 0, 0],
                    },
                  ],
                  margin: [1, 0, 1, 0],
                },
                {
                  stack: [
                    {
                      text: 'Serial No.',
                      bold: true,
                      fontSize: labelFontSize,
                      color: '#475569',
                    },
                    {
                      text: inst?.serial_no || '-',
                      fontSize: valueFontSize,
                      bold: true,
                      margin: [0, 0.5, 0, 0],
                    },
                  ],
                  margin: [1, 0, 1, 0],
                },
              ],
              // Row 2: Least Count | ID No | Instrument Cond | Location
              [
                {
                  stack: [
                    {
                      text: 'Least Count',
                      bold: true,
                      fontSize: labelFontSize,
                      color: '#475569',
                    },
                    {
                      text: inst?.least_count || '-',
                      fontSize: valueFontSize,
                      bold: true,
                      margin: [0, 0.5, 0, 0],
                    },
                  ],
                  margin: [1, 0, 1, 0],
                },
                {
                  stack: [
                    {
                      text: 'ID No.',
                      bold: true,
                      fontSize: labelFontSize,
                      color: '#475569',
                    },
                    {
                      text: inst?.id_code || '-',
                      fontSize: valueFontSize,
                      bold: true,
                      margin: [0, 0.5, 0, 0],
                    },
                  ],
                  margin: [1, 0, 1, 0],
                },
                {
                  stack: [
                    {
                      text: 'Instrument Cond.',
                      bold: true,
                      fontSize: labelFontSize,
                      color: '#475569',
                    },
                    {
                      text: 'SATISFACTORY',
                      fontSize: valueFontSize,
                      bold: true,
                      margin: [0, 0.5, 0, 0],
                    },
                  ],
                  margin: [1, 0, 1, 0],
                },
                {
                  stack: [
                    {
                      text: 'Location',
                      bold: true,
                      fontSize: labelFontSize,
                      color: '#475569',
                    },
                    {
                      text: inst?.location || 'Permanent Laboratory',
                      fontSize: valueFontSize,
                      bold: true,
                      margin: [0, 0.5, 0, 0],
                    },
                  ],
                  margin: [1, 0, 1, 0],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000',
            paddingLeft: () => 2.5,
            paddingRight: () => 2.5,
            paddingTop: () => 1.2,
            paddingBottom: () => 1.2,
          },
          margin: [0, 0, 0, tableGap] as [
            number,
            number,
            number,
            number,
          ],
        },

        // Procedure & Environmental Conditions Table (3-row table: Header Row, Data Row, Environmental Conditions Row)
        {
          table: {
            widths: ['26%', '28%', '24%', '22%'],
            body: [
              // Row 1: Header Row
              [
                {
                  text: 'Procedure No, Name & Rev-Date',
                  style: 'gridTh',
                  fontSize: tableHeaderFontSize,
                  alignment: 'left',
                  fillColor: '#f1f5f9',
                  margin: [1, 0.5, 1, 0.5],
                  noWrap: true,
                },
                {
                  text: 'Acceptance Criteria Doc.No & Rev-Date',
                  style: 'gridTh',
                  fontSize: tableHeaderFontSize,
                  alignment: 'left',
                  fillColor: '#f1f5f9',
                  margin: [1, 0.5, 1, 0.5],
                  noWrap: true,
                },
                {
                  text: 'Standard Reference',
                  style: 'gridTh',
                  fontSize: tableHeaderFontSize,
                  alignment: 'left',
                  fillColor: '#f1f5f9',
                  margin: [1, 0.5, 1, 0.5],
                },
                {
                  text: 'Discipline',
                  style: 'gridTh',
                  fontSize: tableHeaderFontSize,
                  alignment: 'left',
                  fillColor: '#f1f5f9',
                  margin: [1, 0.5, 1, 0.5],
                },
              ],
              // Row 2: Data Row
              [
                {
                  stack: [
                    {
                      text: procedureName || '-',
                      bold: true,
                      fontSize: valueFontSize,
                      color: '#000000',
                    },
                    ...(procedureNo
                      ? [
                          {
                            text: `Proc No: ${procedureNo}`,
                            bold: true,
                            fontSize: contentFontSize,
                            color: '#000000',
                            margin: [0, 0.5, 0, 0],
                          },
                        ]
                      : []),
                    ...(procedureRev || procedureDate
                      ? [
                          {
                            text: [
                              procedureRev
                                ? `Rev-${procedureRev.replace(/^rev-?/i, '')}`
                                : '',
                              procedureDate ? `dated ${procedureDate}` : '',
                            ]
                              .filter(Boolean)
                              .join(' '),
                            fontSize: contentFontSize,
                            color: '#334155',
                            margin: [0, 0.5, 0, 0],
                          },
                        ]
                      : []),
                  ],
                  margin: [1, 0.5, 1, 0.5],
                },
                {
                  stack: [
                    ...(acceptanceCriteriaDocNo || acceptanceCriteriaReference
                      ? [
                          {
                            text: `Doc.No.: ${acceptanceCriteriaDocNo || acceptanceCriteriaReference}`,
                            bold: true,
                            fontSize: valueFontSize,
                            color: '#000000',
                          },
                          ...(acceptanceCriteriaRev || acceptanceCriteriaDate
                            ? [
                                {
                                  text: [
                                    acceptanceCriteriaRev
                                      ? `Rev-${acceptanceCriteriaRev.replace(/^rev-?/i, '')}`
                                      : '',
                                    acceptanceCriteriaDate
                                      ? `dated ${acceptanceCriteriaDate}`
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' '),
                                  fontSize: contentFontSize,
                                  color: '#334155',
                                  margin: [0, 0.5, 0, 0],
                                },
                              ]
                            : []),
                        ]
                      : [
                          {
                            text: acceptanceCriteriaText || '-',
                            fontSize: contentFontSize,
                            color: '#000000',
                          },
                        ]),
                  ],
                  margin: [1, 0.5, 1, 0.5],
                },
                {
                  text:
                    standardReference ||
                    'Standard calibration per ISO/IEC 17025',
                  fontSize: contentFontSize,
                  margin: [1, 0.5, 1, 0.5],
                },
                {
                  text:
                    (calibration as any).discipline ||
                    'DIMENSION (Basic Measuring Instrument, Gauge etc)',
                  fontSize: contentFontSize,
                  margin: [1, 0.5, 1, 0.5],
                },
              ],
              // Row 3: Environmental Conditions (Full Colspan)
              [
                {
                  colSpan: 4,
                  text: [
                    { text: 'Environmental Conditions : ', bold: true },
                    {
                      text: `Temperature at ${env.temperature || '-'}° C  RH ${env.humidity || '-'} %`,
                    },
                    ...(env.soaking_time ||
                    env.soaking_start_time ||
                    env.soaking_end_time
                      ? [
                          { text: '   |   ', bold: true },
                          { text: 'Soaking Details : ', bold: true },
                          {
                            text: [
                              env.soaking_start_time
                                ? `Start: ${env.soaking_start_time}`
                                : null,
                              env.soaking_end_time
                                ? `End: ${env.soaking_end_time}`
                                : null,
                              env.soaking_time
                                ? `Soaking Time: ${env.soaking_time}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join('  |  '),
                          },
                        ]
                      : []),
                    ...((env as any).receipt_condition || (calibration as any).receipt_condition
                      ? [
                          { text: '   |   ', bold: true },
                          { text: 'Receipt Condition : ', bold: true },
                          { text: String((env as any).receipt_condition || (calibration as any).receipt_condition) },
                        ]
                      : []),
                  ],
                  fontSize: contentFontSize,
                  margin: [1, 0.5, 1, 0.5],
                },
                {},
                {},
                {},
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000',
            paddingLeft: () => 2.5,
            paddingRight: () => 2.5,
            paddingTop: () => 1.0,
            paddingBottom: () => 1.0,
          },
          margin: [0, 0, 0, tableGap] as [
            number,
            number,
            number,
            number,
          ],
        },

        // Traceability of Master Used
        {
          table: {
            widths: ['*', '*', '*', '*', '*', '*'],
            body: [
              [
                {
                  text: 'TRACEABILITY OF MASTER USED :',
                  style: 'boxHeader',
                  alignment: 'center',
                  fontSize: titleFontSize,
                  margin: [1, 0.5, 1, 0.5],
                  colSpan: 6,
                },
                {},
                {},
                {},
                {},
                {},
              ],
              [
                { text: 'Instrument Desc.', style: 'thCellDark', fontSize: tableHeaderFontSize, margin: [0, 0.5, 0, 0.5] },
                { text: 'Make', style: 'thCellDark', fontSize: tableHeaderFontSize, margin: [0, 0.5, 0, 0.5] },
                { text: 'Sr No / Id. No.', style: 'thCellDark', fontSize: tableHeaderFontSize, margin: [0, 0.5, 0, 0.5] },
                { text: 'Cert.No.', style: 'thCellDark', fontSize: tableHeaderFontSize, margin: [0, 0.5, 0, 0.5] },
                { text: 'Validity', style: 'thCellDark', fontSize: tableHeaderFontSize, margin: [0, 0.5, 0, 0.5] },
                { text: 'Cal.Agency', style: 'thCellDark', fontSize: tableHeaderFontSize, margin: [0, 0.5, 0, 0.5] },
              ],
              ...referenceStandards.map((ref) => [
                {
                  text:
                    ref.name || ref.instrument_desc || ref.description || '-',
                  style: 'tdCell',
                  fontSize: contentFontSize,
                  margin: [0, 0.5, 0, 0.5],
                },
                {
                  text:
                    ref.make ||
                    ref.manufacturer ||
                    ref.brand ||
                    (calibration as any)?.instrument?.make ||
                    '-',
                  style: 'tdCell',
                  fontSize: contentFontSize,
                  margin: [0, 0.5, 0, 0.5],
                },
                {
                  text:
                    ref.id || ref.id_code || ref.serial_no || ref.sr_no || '-',
                  style: 'tdCell',
                  fontSize: contentFontSize,
                  margin: [0, 0.5, 0, 0.5],
                },
                {
                  text:
                    ref.cert_no ||
                    ref.certificate_no ||
                    ref.cert_number ||
                    ref.traceable_to ||
                    (calibration as any)?.certificate_number ||
                    'AE/CC/REF/01',
                  style: 'tdCell',
                  fontSize: contentFontSize,
                  margin: [0, 0.5, 0, 0.5],
                },
                {
                  text: fmtDate(
                    ref.validity ||
                      ref.due_date ||
                      ref.valid_till ||
                      (calibration as any)?.reference_standard_validity,
                  ),
                  style: 'tdCell',
                  fontSize: contentFontSize,
                  margin: [0, 0.5, 0, 0.5],
                },
                {
                  text:
                    ref.agency ||
                    ref.cal_agency ||
                    ref.calibration_agency ||
                    ref.traceable_to ||
                    ref.traceable ||
                    (calibration as any)?.calibration_agency ||
                    (calibration as any)?.calibration_source ||
                    (calibration as any)?.traceable_to ||
                    ((calibration as any)?.instrument &&
                      ((calibration as any).instrument.calibration_agency ||
                        (calibration as any).instrument.calibration_source ||
                        (calibration as any).instrument.traceable)) ||
                    'NABL Lab',
                  style: 'tdCell',
                  fontSize: contentFontSize,
                  margin: [0, 0.5, 0, 0.5],
                },
              ]),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000',
            paddingLeft: () => 2,
            paddingRight: () => 2,
            paddingTop: () => 1.0,
            paddingBottom: () => 1.0,
          },
          margin: [0, 0, 0, tableGap] as [
            number,
            number,
            number,
            number,
          ],
        },

        // ── Optional Diagram / Schematic Image (Printed above calibration results) ──
        ...(resolvedDiagram
          ? [
              {
                __isDiagramNode: true,
                table: {
                  widths: ['*'],
                  body: [
                    [
                      resolvedDiagram.type === 'svg'
                        ? {
                            svg: resolvedDiagram.content,
                            fit: [targetDiagramWidth, targetDiagramHeight] as [
                              number,
                              number,
                            ],
                            alignment: diagramAlignment,
                            margin: [0, 2, 0, 2],
                          }
                        : {
                            image: resolvedDiagram.dataUrl,
                            fit: [targetDiagramWidth, targetDiagramHeight] as [
                              number,
                              number,
                            ],
                            alignment: diagramAlignment,
                            margin: [0, 2, 0, 2],
                          },
                    ],
                  ],
                },
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  hLineColor: () => '#000000',
                  vLineColor: () => '#000000',
                },
                margin: [0, 0, 0, tableGap] as [
                  number,
                  number,
                  number,
                  number,
                ],
              },
            ]
          : []),

        // Calibration Result (Canvas Blocks or Standard Table)
        ...(isCanvasTemplate && canvasBlocks.length > 0
          ? buildPdfCanvasBlocks(canvasBlocks, isDense)
          : points.length > 0
            ? [
                {
                  table: {
                    dontBreakRows: true,
                    headerRows: (calibration as any).acceptance_criteria
                      ?.enabled
                      ? hasAnyGroups
                        ? 4
                        : 3
                      : hasAnyGroups
                        ? 3
                        : 2,
                    widths: tableWidths,
                    body: [
                      [
                        {
                          text: `Calibration Result (ALL VALUES ARE IN ${unit})`,
                          style: 'boxHeader',
                          colSpan: totalCols,
                        },
                        ...Array(totalCols - 1).fill({}),
                      ],
                      ...((calibration as any).acceptance_criteria?.enabled
                        ? [
                            [
                              {
                                text: `Acceptance Criteria: ${(calibration as any).acceptance_criteria.value} ${(calibration as any).acceptance_criteria.type === 'percentage' ? '%' : unit}`,
                                fontSize: isDense ? 7.5 : 8,
                                bold: true,
                                alignment: 'center',
                                fillColor: '#fef3c7',
                                margin: [
                                  2,
                                  isDense ? 1.5 : 3,
                                  2,
                                  isDense ? 1.5 : 3,
                                ],
                                colSpan: totalCols,
                              },
                              ...Array(totalCols - 1).fill({}),
                            ],
                          ]
                        : []),
                      ...dataTableBody,
                      ...(calibration.uncertainty &&
                      String(calibration.uncertainty).trim()
                        ? [
                            [
                              {
                                text: `Uncertainty of Measurement at coverage factor k = 2 at 95.45 % of confidence Level = ${
                                  String(calibration.uncertainty)
                                    .trim()
                                    .startsWith('±') ||
                                  /[a-zA-Z]/.test(
                                    String(calibration.uncertainty).trim(),
                                  )
                                    ? String(calibration.uncertainty).trim()
                                    : `±${String(calibration.uncertainty).trim()}${unit ? ` ${unit}` : ''}`
                                }`,
                                fontSize: isDense ? 7.5 : 8,
                                bold: true,
                                alignment: 'center',
                                fillColor: '#f8fafc',
                                margin: [
                                  2,
                                  isDense ? 1.5 : 3,
                                  2,
                                  isDense ? 1.5 : 3,
                                ],
                                colSpan: totalCols,
                              },
                              ...Array(totalCols - 1).fill({}),
                            ],
                          ]
                        : []),
                    ],
                  },
                  layout: {
                    fillColor: (rowIndex: number) => {
                      const headerStartIdx = (calibration as any)
                        .acceptance_criteria?.enabled
                        ? 2
                        : 1;
                      const headerEndIdx =
                        headerStartIdx + (hasAnyGroups ? 2 : 1);
                      if (rowIndex >= headerStartIdx && rowIndex < headerEndIdx)
                        return '#f1f5f9';
                      return null;
                    },
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => '#000000',
                    vLineColor: () => '#000000',
                    paddingLeft: () =>
                      totalCols > 12
                        ? 0.8
                        : totalCols > 9
                          ? 1.0
                          : totalCols > 7
                            ? 1.5
                            : 2.5,
                    paddingRight: () =>
                      totalCols > 12
                        ? 0.8
                        : totalCols > 9
                          ? 1.0
                          : totalCols > 7
                            ? 1.5
                            : 2.5,
                    paddingTop: () => 1.0,
                    paddingBottom: () => 1.0,
                  },
                  margin: [0, 0, 0, tableGap] as [
                    number,
                    number,
                    number,
                    number,
                  ],
                },
              ]
            : []),

      ],

      styles: {
        gridTh: {
          fontSize: tableHeaderFontSize,
          bold: true,
          alignment: 'center' as const,
          fillColor: '#f1f5f9',
          margin: [0, 0.5, 0, 0.5] as [number, number, number, number],
        },
        gridTd: {
          fontSize: contentFontSize,
          alignment: 'center' as const,
          margin: [0, 0.5, 0, 0.5] as [number, number, number, number],
        },
        gridTdBold: {
          fontSize: contentFontSize,
          bold: true,
          alignment: 'center' as const,
          margin: [0, 0.5, 0, 0.5] as [number, number, number, number],
        },
        boxHeader: {
          fontSize: titleFontSize,
          bold: true,
          alignment: 'center' as const,
          color: '#000',
          fillColor: '#e2e8f0',
          margin: [2, 0.8, 2, 0.8] as [number, number, number, number],
        },
        kvPair: {
          fontSize: labelFontSize,
          bold: true,
          margin: [0, 0.5, 0, 0.5] as [number, number, number, number],
        },
        subNote: {
          fontSize: signatureFontSize,
          bold: true,
          margin: [0, 0.5, 0, 0.5] as [number, number, number, number],
        },
        thCellDark: {
          fontSize: tableHeaderFontSize,
          bold: true,
          alignment: 'center' as const,
          fillColor: '#f1f5f9',
          margin: [0, 0.5, 0, 0.5] as [number, number, number, number],
        },
        thCell: {
          fontSize: tableHeaderFontSize,
          bold: true,
          color: '#000',
          alignment: 'center' as const,
          fillColor: '#f1f5f9',
          margin: [0, 0.5, 0, 0.5] as [number, number, number, number],
        },
        tdCell: {
          fontSize: contentFontSize,
          alignment: 'center' as const,
          margin: [0, 0.5, 0, 0.5] as [number, number, number, number],
        },
        tdCellMono: {
          fontSize: contentFontSize,
          alignment: 'center' as const,
          margin: [0, 0.5, 0, 0.5] as [number, number, number, number],
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
    };

    let pdfDoc: any;
    try {
      pdfDoc = this.printer.createPdfKitDocument(docDefinition as any);
    } catch (err: any) {
      this.logger.error(
        `Failed to compile PDF document with image/diagram elements: ${err?.message || err}. Attempting fallback certificate generation...`,
      );
      // Remove any diagram table nodes from content to guarantee certificate issuance never fails
      const fallbackContent = (docDefinition.content as any[]).filter(
        (node: any) => !node?.__isDiagramNode,
      );
      docDefinition.content = fallbackContent;
      pdfDoc = this.printer.createPdfKitDocument(docDefinition as any);
    }

    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      pdfDoc.on('data', (chunk: any) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (err: any) => reject(err));
      pdfDoc.end();
    });
  }
}
