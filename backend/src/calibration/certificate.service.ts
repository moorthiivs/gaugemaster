import { Injectable } from '@nestjs/common';
import { Calibration, CalibrationPoint } from './calibration.entity';
import PdfPrinter from 'pdfmake';
import { SettingsService } from '../settings/settings.service';
import { ReportTemplatesService } from '../report-templates/report-templates.service';
// ── Parse header/footer HTML for pdfmake ─────────────────
const htmlToPdfmake = require('html-to-pdfmake');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const PNG = require('png-js');

function createCrcTable() {
  const cTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    cTable[n] = c;
  }
  return cTable;
}
const crcTable = createCrcTable();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const typeAndData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([lenBuf, typeAndData, crcBuf]);
}

function encodeRgbaPng(
  width: number,
  height: number,
  rgbaBuffer: Buffer,
): Buffer {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type 6 = RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const scanlineLength = 1 + width * 4;
  const scanlines = Buffer.alloc(height * scanlineLength);
  for (let y = 0; y < height; y++) {
    const offset = y * scanlineLength;
    scanlines[offset] = 0; // Filter type None
    const srcOffset = y * width * 4;
    rgbaBuffer.copy(scanlines, offset + 1, srcOffset, srcOffset + width * 4);
  }

  const idatChunk = makeChunk('IDAT', zlib.deflateSync(scanlines));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

async function removeWhiteBackground(fileBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve) => {
    try {
      const img = new PNG(fileBuffer);
      img.decode((pixels: Buffer) => {
        if (!pixels || pixels.length === 0) return resolve(fileBuffer);
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          if (r > 225 && g > 225 && b > 225) {
            pixels[i + 3] = 0;
          }
        }
        const transparentPng = encodeRgbaPng(img.width, img.height, pixels);
        resolve(transparentPng);
      });
    } catch (e) {
      resolve(fileBuffer);
    }
  });
}
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

    let approvedSig = calibration.approved_by_signature || calibration.reviewed_by_signature;
    const approvedName = calibration.approved_by || calibration.reviewed_by;
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

    const canvasBlocks =
      calibration.layout_blocks ||
      (latestTemplate as any)?.layout_blocks ||
      [];

    // ── Build calibration data table ─────────────────────────
    const hasDiagram = Boolean(
      calibration.diagram_image ||
      latestTemplate?.diagram_image ||
      ((calibration as any).template as any)?.diagram_image,
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
    const rawDiagram =
      latestTemplate?.diagram_image ||
      calibration.diagram_image ||
      ((calibration as any).template as any)?.diagram_image;
    const diagramWidth =
      latestTemplate?.diagram_image_width ||
      calibration.diagram_image_width ||
      ((calibration as any).template as any)?.diagram_image_width ||
      350;
    const diagramHeight =
      latestTemplate?.diagram_image_height ||
      calibration.diagram_image_height ||
      ((calibration as any).template as any)?.diagram_image_height ||
      160;
    const diagramAlignment =
      latestTemplate?.diagram_image_alignment ||
      calibration.diagram_image_alignment ||
      ((calibration as any).template as any)?.diagram_image_alignment ||
      'center';

    let diagramDataUrl: string | null = null;
    if (rawDiagram && typeof rawDiagram === 'string' && rawDiagram.trim()) {
      if (rawDiagram.startsWith('data:image')) {
        diagramDataUrl = rawDiagram;
      } else {
        try {
          const diagramAbsPath = rawDiagram.startsWith('/')
            ? path.join(process.cwd(), rawDiagram.slice(1))
            : path.join(process.cwd(), rawDiagram);
          if (fs.existsSync(diagramAbsPath)) {
            const buf = fs.readFileSync(diagramAbsPath);
            const mime = rawDiagram.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            diagramDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
          }
        } catch (e) {}
      }
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
            estH += 22 + (b.rows?.length || 0) * 11;
          } else if (b.type === 'split_row') {
            const maxR = Math.max(
              b.children?.[0]?.rows?.length || 0,
              b.children?.[1]?.rows?.length || 0
            );
            estH += 22 + maxR * 11;
          } else if (b.type === 'matrix_table') {
            estH += 25 + ((b.headers?.length || 1) + (b.rows?.length || 0)) * 11;
          } else if (b.type === 'text_block') {
            estH += 15;
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
          const nominal = parseFloat(String(row.nominal)) || 0;
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

      const buildSingleTableElement = (tbl: any, isHalf: boolean = false): any => {
        if (tbl.orientation === 'horizontal') {
          const displayCols = (tbl.columns || []).filter((c: any) => c.id !== 'point_number' && c.id !== 'sl_no' && c.id !== 'sino');
          const rowCount = (tbl.rows || []).length;
          const numCols = rowCount + 1;
          const colWidths = ['auto', ...Array(rowCount).fill('*')];
          const tblBody: any[] = [];
          const dec = tbl.decimal_places !== undefined ? tbl.decimal_places : 3;

          // Title Row
          tblBody.push([
            {
              text: `${tbl.title || 'Table'} ${tbl.unit ? `(ALL VALUES ARE IN ${tbl.unit})` : ''}`,
              style: 'boxHeader',
              fontSize: titleFontSize,
              margin: [1, 0.5, 1, 0.5],
              colSpan: numCols,
            },
            ...Array(numCols - 1).fill({}),
          ]);

          // Header Row: Parameter + Point numbers 1..N
          tblBody.push([
            {
              text: 'Parameter / Sl no',
              style: 'thCell',
              fontSize: tableHeaderFontSize,
              margin: [0, 0.5, 0, 0.5],
              fillColor: '#e2e8f0',
              alignment: 'left',
              bold: true,
            },
            ...(tbl.rows || []).map((r: any, rIdx: number) => ({
              text: String(r.point_number ?? (rIdx + 1)),
              style: 'thCell',
              fontSize: tableHeaderFontSize,
              margin: [0, 0.5, 0, 0.5],
              fillColor: '#f1f5f9',
              bold: true,
            })),
          ]);

          // Data Rows (one row per parameter)
          displayCols.forEach((col: any) => {
            const rowCells: any[] = [
              {
                text: col.label || col.id,
                style: 'tdCell',
                fontSize: contentFontSize,
                margin: [0, 0.5, 0, 0.5],
                fillColor: '#f8fafc',
                alignment: 'left',
                bold: true,
              },
            ];

            (tbl.rows || []).forEach((row: any) => {
              let val: any = row[col.id];
              if (col.type === 'nominal') {
                val = row.nominal !== undefined ? Number(row.nominal).toFixed(dec) : '-';
              } else if (col.type === 'text') {
                val = row.description || row[col.id] || '-';
              } else if (col.type === 'formula' || col.type === 'status') {
                val = row[col.id] ?? evalRowFormula(col.formula || col.id, row, tbl.tolerance, dec);
              } else if (val === undefined || val === null || val === '') {
                val = '-';
              }

              const isPass = String(val).toUpperCase() === 'PASS' || String(val).toUpperCase() === 'OK';
              const isFail = String(val).toUpperCase() === 'FAIL' || String(val).toUpperCase() === 'REJECT';

              rowCells.push({
                text: String(val),
                style: col.type === 'text' ? 'tdCell' : 'tdCellMono',
                fontSize: contentFontSize,
                margin: [0, 0.5, 0, 0.5],
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
            table: {
              headerRows: 2,
              widths: colWidths,
              body: tblBody,
            },
            layout: {
              hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === 2 || i === node.table.body.length ? 0.75 : 0.4),
              vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 0.75 : 0.4),
              hLineColor: () => '#000000',
              vLineColor: () => '#000000',
              paddingLeft: () => 1.5,
              paddingRight: () => 1.5,
              paddingTop: () => 0.8,
              paddingBottom: () => 0.8,
            },
            margin: [0, 0, 0, tbl.marginBottom !== undefined ? Number(tbl.marginBottom) : 2],
          };
        }

        const numCols = tbl.columns?.length || 1;
        const colWidths = tbl.columns?.map(() => '*') || ['*'];
        const tblBody: any[] = [];

        // Title Row
        tblBody.push([
          {
            text: `${tbl.title || 'Table'} ${tbl.unit ? `(ALL VALUES ARE IN ${tbl.unit})` : ''}`,
            style: 'boxHeader',
            fontSize: titleFontSize,
            margin: [1, 0.5, 1, 0.5],
            colSpan: numCols,
          },
          ...Array(numCols - 1).fill({}),
        ]);

        // Header Row
        tblBody.push(
          tbl.columns.map((col: any) => ({
            text: col.label || col.id,
            style: 'thCell',
            fontSize: tableHeaderFontSize,
            margin: [0, 0.5, 0, 0.5],
            fillColor: '#f1f5f9',
          }))
        );

        // Data Rows
        (tbl.rows || []).forEach((row: any) => {
          if (row.is_merged || row.isMerged) {
            tblBody.push([
              {
                text: row.statement || row.merged_text || row.description || row.required_dimension || 'All the jaws are free from dent and damages',
                colSpan: numCols,
                style: 'tdCell',
                bold: true,
                fontSize: contentFontSize,
                fillColor: '#f8fafc',
                margin: [2, 0.5, 2, 0.5],
              },
              ...Array(numCols - 1).fill({}),
            ]);
            return;
          }
          const rowCells: any[] = [];
          tbl.columns.forEach((col: any) => {
            const isPointNo = col.id === 'point_number' || col.id === 'sl_no' || col.id === 'sino';
            let val: any = row[col.id];
            if (isPointNo) {
              val = row.point_number ?? row[col.id] ?? (tblBody.length - 1);
            } else if (col.type === 'nominal') {
              const decimals = tbl.decimal_places !== undefined ? tbl.decimal_places : 3;
              val = row.nominal !== undefined ? Number(row.nominal).toFixed(decimals) : '-';
            } else if (col.type === 'text') {
              val = row[col.id] || row.required_dimension || row.description || '-';
            } else if (col.type === 'formula' || col.type === 'status') {
              val = row[col.id] ?? evalRowFormula(col.formula || col.id, row, tbl.tolerance, tbl.decimal_places !== undefined ? tbl.decimal_places : 3);
            } else if (val === undefined || val === null || val === '') {
              val = '-';
            }

            const isPass = String(val).toUpperCase() === 'PASS' || String(val).toUpperCase() === 'OK';
            const isFail = String(val).toUpperCase() === 'FAIL' || String(val).toUpperCase() === 'REJECT';

            rowCells.push({
              text: String(val),
              style: col.type === 'text' ? 'tdCell' : 'tdCellMono',
              fontSize: contentFontSize,
              margin: [0, 0.5, 0, 0.5],
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
            headerRows: 2,
            widths: colWidths,
            body: tblBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000',
            paddingLeft: () => 1.5,
            paddingRight: () => 1.5,
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
          
          // 1. Calculate max columns from rows or headers
          let matrixCols = block.rows?.[0]?.length || 1;
          (block.headers || []).forEach((hRow: any[]) => {
            let rowSpanSum = 0;
            hRow.forEach((c: any) => {
              rowSpanSum += (c.colSpan || 1);
            });
            if (rowSpanSum > matrixCols) matrixCols = rowSpanSum;
          });
          (block.rows || []).forEach((r: any[]) => {
            if (r.length > matrixCols) matrixCols = r.length;
          });

          const colWidths = Array(matrixCols).fill('*');

          // Title
          matrixBody.push([
            {
              text: block.title || 'Matrix Table',
              style: 'boxHeader',
              fontSize: titleFontSize,
              colSpan: matrixCols,
            },
            ...Array(matrixCols - 1).fill({}),
          ]);

          // Build 2D Header Grid to safely handle multi-row colSpan & rowSpan without undefined cells
          const numHeaderRows = (block.headers || []).length;
          const headerGrid: any[][] = Array.from({ length: numHeaderRows }, () =>
            Array(matrixCols).fill(null)
          );

          (block.headers || []).forEach((hRow: any[], rIdx: number) => {
            hRow.forEach((cell: any) => {
              // Find first empty cell in this row
              let cIdx = 0;
              while (cIdx < matrixCols && headerGrid[rIdx][cIdx] !== null) {
                cIdx++;
              }
              if (cIdx >= matrixCols) return;

              const cSpan = Math.min(cell.colSpan || 1, matrixCols - cIdx);
              const rSpan = Math.min(cell.rowSpan || 1, numHeaderRows - rIdx);

              // Set the origin cell
              headerGrid[rIdx][cIdx] = {
                text: cell.text || '',
                style: 'thCell',
                fontSize: tableHeaderFontSize,
                fillColor: '#f1f5f9',
                colSpan: cSpan,
                rowSpan: rSpan,
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

          // Data Rows
          (block.rows || []).forEach((r: any[]) => {
            const rowCells: any[] = [];
            for (let c = 0; c < matrixCols; c++) {
              rowCells.push({
                text: String(r[c] ?? '-'),
                style: 'tdCellMono',
                fontSize: contentFontSize,
                alignment: 'center',
              });
            }
            matrixBody.push(rowCells);
          });

          resultElements.push({
            unbreakable: true,
            table: {
              dontBreakRows: true,
              headerRows: 1 + numHeaderRows,
              widths: colWidths,
              body: matrixBody,
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#000000',
              vLineColor: () => '#000000',
            },
            margin: [0, mt, 0, mb],
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
          const dImg = block.imageUrl || block.image;
          if (dImg) {
            resultElements.push({
              unbreakable: true,
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      image: dImg,
                      width: block.width ? Math.min(Number(block.width), 360) : 240,
                      alignment: block.alignment || 'center',
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
              text: 'DRAFT - PENDING APPROVAL',
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

        // Determine if left & right cells have signature images
        const hasCalibratedSigImg = !!(
          calibratedSig && calibratedSig.startsWith('data:image')
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

        // Seal content height: with seal image = sealImgHeight (26 pt), with text placeholder = 14 pt
        const sealContentHeight = sealDataUrl ? sealImgHeight : 14;
        const sealTopPad = Math.max(
          2,
          Math.round((sigTableRowHeight - sealContentHeight) / 2),
        );

        const signatureBlockNode = {
          table: {
            widths: ['*', '*', '*'],
            heights: [sigTableRowHeight],
            body: [
              [
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
                {
                  stack: [
                    sealDataUrl
                      ? {
                          image: sealDataUrl,
                          fit: [
                            Math.round(signatureImageWidth * 0.85),
                            sealImgHeight,
                          ],
                          alignment: 'center',
                        }
                      : {
                          stack: [
                            {
                              text: 'CALIBRATION',
                              alignment: 'center',
                              fontSize: 5.8,
                              bold: true,
                              color: '#0369a1',
                            },
                            {
                              text: 'SEAL / STAMP',
                              alignment: 'center',
                              fontSize: 5.8,
                              bold: true,
                              color: '#0369a1',
                            },
                          ],
                        },
                  ],
                  margin: [1, sealTopPad, 1, 0],
                },
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
                        calibration.reviewed_by ||
                        'Authorized By',
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
                        'Quality Manager',
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
        // Description & Identification Table (3 Columns / Stacked)
        {
          table: {
            widths: ['33%', '34%', '33%'],
            body: [
              [
                {
                  text: 'Description & Identification',
                  style: 'boxHeader',
                  fontSize: titleFontSize,
                  colSpan: 3,
                  margin: [2, 0.8, 2, 0.8],
                },
                {},
                {},
              ],
              // Row 1
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
                      text: 'Model No.',
                      bold: true,
                      fontSize: labelFontSize,
                      color: '#475569',
                    },
                    {
                      text: (inst as any)?.model_no || '-',
                      fontSize: valueFontSize,
                      bold: true,
                      margin: [0, 0.5, 0, 0],
                    },
                  ],
                  margin: [1, 0, 1, 0],
                },
              ],
              // Row 2
              [
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
              ],
              // Row 3
              [
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
            paddingLeft: () => 3,
            paddingRight: () => 3,
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
            widths: ['28%', '24%', '24%', '24%'],
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
                },
                {
                  text: 'Acceptance Criteria Doc.No & Rev-Date',
                  style: 'gridTh',
                  fontSize: tableHeaderFontSize,
                  alignment: 'left',
                  fillColor: '#f1f5f9',
                  margin: [1, 0.5, 1, 0.5],
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
        ...(diagramDataUrl
          ? [
              {
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        image: diagramDataUrl,
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

    const pdfDoc = this.printer.createPdfKitDocument(docDefinition as any);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      pdfDoc.on('data', (chunk: any) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (err: any) => reject(err));
      pdfDoc.end();
    });
  }
}
