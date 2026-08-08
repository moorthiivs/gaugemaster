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
const fonts = {
  Roboto: {
    normal: 'src/fonts/Roboto-Regular.ttf',
    bold: 'src/fonts/Roboto-Medium.ttf',
    italics: 'src/fonts/Roboto-Italic.ttf',
    bolditalics: 'src/fonts/Roboto-MediumItalic.ttf',
  },
};

/**
 * Generates professional calibration certificate PDFs using pdfmake.
 * Reuses the existing report template system for company branding (header/footer).
 */
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class CertificateService {
  private printer = new PdfPrinter(fonts);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly reportTemplatesService: ReportTemplatesService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
    const totalPages = numPoints <= 21 ? 1 : 1 + Math.ceil((numPoints - 21) / 35);
    const sheetNoText = `1 of ${totalPages}`;
    const env = calibration.environmental_conditions || {
      temperature: '-',
      humidity: '-',
    };

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

    const certConfig = userId
      ? (await this.settingsService.findOneByUserId(userId))?.certificateConfig
      : null;
    const headerCompanyName =
      certConfig?.headerCompanyName || 'Company Name';
    const headerCompanySubtitle =
      certConfig?.headerCompanySubtitle || '(CALIBRATION LABORATORY)';
    const headerRightBoxText1 = certConfig?.headerRightBoxText1 || 'NABL / LAB';
    const headerRightBoxText2 = certConfig?.headerRightBoxText2 || 'CC - 2632';
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

    const procedureReference =
      calibration.procedure_reference || 'AE/CAL-SOP/01';
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

    // ── Build calibration data table ─────────────────────────
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

    const hidden = new Set(calibration.hidden_columns || []);
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

      dataTableHeader.push({
        text: 'Status',
        style: 'thCell',
        rowSpan: 2,
        margin: [0, 6, 0, 0],
      });
      dataTableSubHeader.push({}); // dummy for status
    } else {
      dataTableHeader = [{ text: 'Sr No.', style: 'thCell' }];
      activeColumnsNoStatus.forEach((k) => {
        dataTableHeader.push({
          text: resolveHeaderTitle(k),
          style: 'thCell',
        });
      });
      dataTableHeader.push({ text: 'Status', style: 'thCell' });
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

      activeColumns.forEach((k) => {
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
        else if (k === 'tolerance')
          row.push({
            text: safeNum(pt.tolerance, getColDec('tolerance')),
            style: 'tdCellMono',
          });
        else if (k === 'status') return;
        else {
          // Custom column: extract raw value
          const obj = ((pt as any).customFields as any)?.[k];
          const rawVal =
            typeof obj === 'object' && obj !== null && 'value' in obj
              ? obj.value
              : obj;

          // Check column type — only apply numeric formatting for number/formula columns
          const colType = customColTypeMap.get(k) || 'text';
          let displayVal: string;
          if (colType === 'number' || colType === 'formula') {
            displayVal = safeNum(rawVal, getColDec(k));
          } else {
            // Text column: print exactly as stored
            displayVal =
              rawVal !== undefined && rawVal !== null ? String(rawVal) : '-';
          }
          row.push({ text: displayVal, style: 'tdCellMono' });
        }
      });

      row.push({
        text: status,
        style: 'tdCell',
        color: statusColor,
        bold: true,
      });
      dataTableBody.push(row);
    });

    const totalCols = dataTableHeader.length;
    const tableWidths: any[] = Array(totalCols).fill('*');
    tableWidths[0] = 35; // Sr No column width
    tableWidths[totalCols - 1] = 45; // Status column width

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
      path.join(process.cwd(), 'public', 'Approved-seal1.png'),
      path.join(process.cwd(), '..', 'frontend', 'public', 'Approved-seal1.png'),
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

    const headerBgColor = (certConfig as any)?.headerBgColor || '#54c6f3'; // Cyan sky blue banner color matching Image 1 & Image 2 layout

    // ── Build left header cell (logo and/or company name) ──
    let leftHeaderContent: any;
    if (
      logoDataUrl &&
      (headerDisplayMode === 'logo' || headerDisplayMode === 'both')
    ) {
      const logoBadge = {
        image: logoDataUrl,
        fit: [36, 32],
      };

      if (headerDisplayMode === 'both') {
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
              margin: [0, 7, 0, 0],
            },
          ],
        };
      } else {
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

    // ── PDF Document Definition (NABL Certificate Layout) ──
    const docDefinition = {
      pageSize: 'A4' as const,
      pageOrientation: 'portrait' as const,
      pageMargins: [23, 54, 23, 58] as [number, number, number, number],
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

      // ── 0. BACKGROUND OUTLINE BORDER (Always surrounds content on EVERY page) ──
      background: (currentPage: number, pageCount: number) => {
        return [
          {
            canvas: [
              {
                type: 'rect',
                x: 20,
                y: 50,
                w: 555.28,
                h: 738,
                lineWidth: 1,
                lineColor: '#000000',
              },
            ],
          },
        ];
      },

      // ── 1. HEADER (Edge-to-Edge Full Width Banner at Top) ──
      header: (currentPage: number, pageCount: number) => {
        return {
          table: {
            widths: [190, '*', 70],
            body: [
              [
                {
                  ...leftHeaderContent,
                  fillColor: headerBgColor,
                  margin: [10, 6, 0, 5],
                },
                {
                  text: 'CALIBRATION CERTIFICATE',
                  bold: true,
                  fontSize: 20,
                  color: '#000',
                  alignment: 'center',
                  fillColor: headerBgColor,
                  margin: [0, 7, 0, 5],
                },
                {
                  stack: [
                    {
                      text: headerRightBoxText1,
                      fontSize: 8,
                      bold: true,
                      alignment: 'right',
                      color: '#000000',
                    },
                    {
                      text: headerRightBoxText2,
                      fontSize: 10,
                      bold: true,
                      alignment: 'right',
                      color: '#000000',
                      margin: [0, 2, 0, 0],
                    },
                  ],
                  fillColor: headerBgColor,
                  margin: [0, 8, 25, 5],
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

      // ── 3. FOOTER (Edge-to-Edge Full Width Banner at Absolute Bottom) ──
      footer: (currentPage: number, pageCount: number) => {
        return {
          table: {
            widths: [595.28],
            body: [
              [
                {
                  stack: [
                    {
                      text: footerLine1 || 'CALIBRATION CENTER :',
                      bold: true,
                      fontSize: 8.5,
                      alignment: 'center',
                      color: '#000000',
                      margin: [0, 0, 0, 1],
                    },
                    {
                      text:
                        footerLine2 ||
                        "",
                      fontSize: 7.5,
                      bold: true,
                      alignment: 'center',
                      color: '#000000',
                      margin: [0, 0, 0, 1],
                    },
                    {
                      text:
                        footerLine3 ||
                        '☎ : xxxx-xxxxx, xx xx xx xx xx, x,x,x,x,x,x,x   website: xxxxxxxxx.in',
                      fontSize: 7.5,
                      bold: true,
                      alignment: 'center',
                      color: '#000000',
                      margin: [0, 0, 0, 1],
                    },
                    {
                      text:
                        (certConfig as any)?.footerLine4 ||
                        'Mob: +91 xxxxxxxx, xxxxxxxx • E-mail : xxxxxxxxx@xxxxx.com',
                      fontSize: 7.5,
                      bold: true,
                      alignment: 'center',
                      color: '#000000',
                    },
                  ],
                  fillColor: headerBgColor,
                  margin: [25, 4, 25, 14],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: (i: number) => (i === 0 ? 1.5 : 0),
            vLineWidth: () => 0,
            hLineColor: () => '#000000',
          },
          margin: [0, 0, 0, 0],
        };
      },

      content: [
        // ── 2. BODY CONTENT SECTION ──
        // Top Certificate Metadata Grid
        {
          table: {
            widths: calibration.ulr_number
              ? ['*', '*', '*', '*', '*', '*']
              : ['*', '*', '*', '*', '*'],
            body: calibration.ulr_number
              ? [
                  [
                    { text: 'Calibration On', style: 'gridTh' },
                    { text: 'Next Calibration Due', style: 'gridTh' },
                    { text: 'Certificate No.:', style: 'gridTh' },
                    { text: 'ULR No.', style: 'gridTh' },
                    { text: 'Certi Issue Date', style: 'gridTh' },
                    { text: 'Sheet No.', style: 'gridTh' },
                  ],
                  [
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
                      text: fmtDate(calibration.certificate_issue_date || calibration.calibration_date),
                      style: 'gridTd',
                    },
                    { text: sheetNoText, style: 'gridTd' },
                  ],
                ]
              : [
                  [
                    { text: 'Calibration On', style: 'gridTh' },
                    { text: 'Next Calibration Due', style: 'gridTh' },
                    { text: 'Certificate No.:', style: 'gridTh' },
                    { text: 'Certi Issue Date', style: 'gridTh' },
                    { text: 'Sheet No.', style: 'gridTh' },
                  ],
                  [
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
                      text: fmtDate(calibration.certificate_issue_date || calibration.calibration_date),
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
          },
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },

        // Customer & Location Grid
        {
          table: {
            widths: ['55%', '45%'],
            body: [
              [
                {
                  stack: [
                    {
                      text: inst?.location || '-',
                      bold: true,
                      fontSize: 8.5,
                    },
                    {
                      text: 'Calibration Customer',
                      fontSize: 7.5,
                      color: '#334155',
                      margin: [0, 2, 0, 0],
                    },
                  ],
                  margin: [2, 2, 2, 2],
                },
                {
                  stack: [
                    {
                      text: 'IN - HOUSE',
                      bold: true,
                      fontSize: 8.5,
                    },
                    {
                      text: 'Calibration Location',
                      fontSize: 7.5,
                      color: '#334155',
                      margin: [0, 2, 0, 0],
                    },
                  ],
                  margin: [2, 2, 2, 2],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000',
            vLineColor: () => '#000',
          },
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },

        // Description & Identification Box
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [
              [
                {
                  text: 'Description & Identification',
                  style: 'boxHeader',
                  colSpan: 4,
                },
                {},
                {},
                {},
              ],
              [
                {
                  text: 'Instrument (UUC)',
                  bold: true,
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: inst?.name || '-',
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: 'Model No.',
                  bold: true,
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: (inst as any)?.model_no || '-',
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
              ],
              [
                {
                  text: 'Make',
                  bold: true,
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: inst?.make || '-',
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: 'Range',
                  bold: true,
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: inst?.range || '-',
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
              ],
              [
                {
                  text: 'Serial No. :',
                  bold: true,
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: inst?.serial_no || '-',
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: 'Least Count',
                  bold: true,
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: inst?.least_count || '-',
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
              ],
              [
                {
                  text: 'ID No.',
                  bold: true,
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: inst?.id_code || '-',
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: 'Instrument Cond.',
                  bold: true,
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: 'SATISFACTORY',
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
              ],
              [
                {
                  text: 'Calibration Range',
                  bold: true,
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: inst?.range || '-',
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: 'Location',
                  bold: true,
                  fontSize: 8.5,
                  margin: [2, 2, 2, 2],
                },
                {
                  text: inst?.location || 'Permanent Laboratory',
                  fontSize: 8.5,
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
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },

        // Procedure & Environmental Conditions Box
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    {
                      columns: [
                        {
                          text: 'Procedure reference',
                          bold: true,
                          fontSize: 8,
                          width: 140,
                        },
                        { text: `: ${procedureReference}`, fontSize: 8 },
                      ],
                      margin: [0, 3, 0, 3],
                    },
                    {
                      columns: [
                        {
                          text: 'Environmental Conditions',
                          bold: true,
                          fontSize: 8,
                          width: 140,
                        },
                        {
                          text: `: Temperature at ${env.temperature}° C  RH ${env.humidity} %`,
                          fontSize: 8,
                        },
                      ],
                      margin: [0, 3, 0, 3],
                    },
                    {
                      columns: [
                        {
                          text: 'Standard Reference',
                          bold: true,
                          fontSize: 8,
                          width: 140,
                        },
                        {
                          text: `: ${standardReference}`,
                          fontSize: 8,
                        },
                      ],
                      margin: [0, 3, 0, 3],
                    },
                    {
                      columns: [
                        {
                          text: 'Discipline',
                          bold: true,
                          fontSize: 8,
                          width: 140,
                        },
                        {
                          text: ': DIMENSION (Basic Measuring Instrument, Gauge etc)',
                          fontSize: 8,
                        },
                      ],
                      margin: [0, 3, 0, 3],
                    },
                  ],
                  margin: [4, 3, 4, 3],
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
          margin: [0, 0, 0, 4] as [number, number, number, number],
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
                  colSpan: 6,
                },
                {},
                {},
                {},
                {},
                {},
              ],
              [
                { text: 'Instrument Desc.', style: 'thCellDark' },
                { text: 'Make', style: 'thCellDark' },
                { text: 'Sr No / Id. No.', style: 'thCellDark' },
                { text: 'Cert.No.', style: 'thCellDark' },
                { text: 'Validity', style: 'thCellDark' },
                { text: 'Cal.Agency', style: 'thCellDark' },
              ],
              ...referenceStandards.map((ref) => [
                {
                  text: ref.name || ref.instrument_desc || ref.description || '-',
                  style: 'tdCell',
                },
                {
                  text: ref.make || ref.manufacturer || ref.brand || (calibration as any)?.instrument?.make || '-',
                  style: 'tdCell',
                },
                {
                  text: ref.id || ref.id_code || ref.serial_no || ref.sr_no || '-',
                  style: 'tdCell',
                },
                {
                  text: ref.cert_no || ref.certificate_no || ref.cert_number || ref.traceable_to || (calibration as any)?.certificate_number || 'AE/CC/REF/01',
                  style: 'tdCell',
                },
                {
                  text: fmtDate(ref.validity || ref.due_date || ref.valid_till || (calibration as any)?.reference_standard_validity),
                  style: 'tdCell',
                },
                {
                  text: ref.agency || ref.cal_agency || ref.calibration_agency || ref.traceable_to || ref.traceable || (calibration as any)?.calibration_agency || (calibration as any)?.calibration_source || (calibration as any)?.traceable_to || ((calibration as any)?.instrument && ((calibration as any).instrument.calibration_agency || (calibration as any).instrument.calibration_source || (calibration as any).instrument.traceable)) || 'NABL Lab',
                  style: 'tdCell',
                },
              ]),
              [
                {
                  text: 'All the measurements performed are traceable to National/Int. standards through NABL accredited cal.lab.',
                  fontSize: 7,
                  italics: true,
                  color: '#334155',
                  margin: [4, 2, 4, 2],
                  fillColor: '#f8fafc',
                  colSpan: 6,
                },
                {},
                {},
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
          },
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },

        // Calibration Result
        points.length > 0
          ? {
              table: {
                headerRows: (calibration as any).acceptance_criteria?.enabled
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
                            fontSize: 8,
                            bold: true,
                            alignment: 'center',
                            fillColor: '#fef3c7',
                            margin: [2, 3, 2, 3],
                            colSpan: totalCols,
                          },
                          ...Array(totalCols - 1).fill({}),
                        ],
                      ]
                    : []),
                  ...dataTableBody,
                  [
                    {
                      text: `Uncertainty of Measurement at coverage factor k = 2 at 95.45 % of confidence Level = ±${calibration.uncertainty || '0.00'}${unit}`,
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                      fillColor: '#f8fafc',
                      margin: [2, 3, 2, 3],
                      colSpan: totalCols,
                    },
                    ...Array(totalCols - 1).fill({}),
                  ],
                ],
              },
              layout: {
                fillColor: (rowIndex: number) => {
                  const headerStartIdx = (calibration as any)
                    .acceptance_criteria?.enabled
                    ? 2
                    : 1;
                  const headerEndIdx = headerStartIdx + (hasAnyGroups ? 2 : 1);
                  if (rowIndex >= headerStartIdx && rowIndex < headerEndIdx)
                    return '#f1f5f9';
                  return null;
                },
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                hLineColor: () => '#000000',
                vLineColor: () => '#000000',
              },
              margin: [0, 0, 0, 4] as [number, number, number, number],
            }
          : { text: '' },

        // Signature Block
        {
          table: {
            widths: ['*', '*', '*'],
            body: [
              [
                {
                  stack: [
                    calibratedSig && calibratedSig.startsWith('data:image')
                      ? { image: calibratedSig, fit: [80, 26], alignment: 'center' }
                      : { text: '________________________', alignment: 'center', fontSize: 8 },
                    {
                      text: calibration.calibrated_by || 'Calibrated By',
                      alignment: 'center',
                      bold: true,
                      fontSize: 8,
                    },
                    {
                      text:
                        calibration.calibrated_by_designation ||
                        'Calibration Engineer',
                      alignment: 'center',
                      fontSize: 7.5,
                      color: '#475569',
                    },
                  ],
                  margin: [2, 2, 2, 2],
                },
                {
                  stack: [
                    sealDataUrl
                      ? { image: sealDataUrl, fit: [75, 45], alignment: 'center' }
                      : {
                          stack: [
                            {
                              text: 'CALIBRATION',
                              alignment: 'center',
                              fontSize: 7,
                              bold: true,
                              color: '#0369a1',
                            },
                            {
                              text: 'SEAL / STAMP',
                              alignment: 'center',
                              fontSize: 7,
                              bold: true,
                              color: '#0369a1',
                            },
                          ],
                        },
                  ],
                  margin: [2, 2, 2, 2],
                },
                {
                  stack: [
                    approvedSig && approvedSig.startsWith('data:image')
                      ? { image: approvedSig, fit: [80, 26], alignment: 'center' }
                      : { text: '________________________', alignment: 'center', fontSize: 8 },
                    {
                      text:
                        calibration.approved_by ||
                        calibration.reviewed_by ||
                        'Authorized By',
                      alignment: 'center',
                      bold: true,
                      fontSize: 8,
                    },
                    {
                      text:
                        calibration.approved_by_designation ||
                        'Quality Manager',
                      alignment: 'center',
                      fontSize: 7.5,
                      color: '#475569',
                    },
                  ],
                  margin: [2, 2, 2, 2],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000',
            vLineColor: () => '#000',
          },
          margin: [0, 0, 0, 0],
        },
      ],

      styles: {
        gridTh: {
          fontSize: 7.5,
          bold: true,
          alignment: 'center' as const,
          fillColor: '#f1f5f9',
          margin: [0, 2, 0, 2] as [number, number, number, number],
        },
        gridTd: {
          fontSize: 7.5,
          alignment: 'center' as const,
          margin: [0, 2, 0, 2] as [number, number, number, number],
        },
        gridTdBold: {
          fontSize: 7.5,
          bold: true,
          alignment: 'center' as const,
          margin: [0, 2, 0, 2] as [number, number, number, number],
        },
        boxHeader: {
          fontSize: 8.5,
          bold: true,
          color: '#000',
          fillColor: '#e2e8f0',
          margin: [2, 2, 2, 2] as [number, number, number, number],
        },
        kvPair: {
          fontSize: 8,
          bold: true,
          margin: [0, 1, 0, 1] as [number, number, number, number],
        },
        subNote: {
          fontSize: 7.5,
          bold: true,
          margin: [0, 1, 0, 1] as [number, number, number, number],
        },
        thCellDark: {
          fontSize: 7.5,
          bold: true,
          alignment: 'center' as const,
          fillColor: '#f1f5f9',
          margin: [0, 2, 0, 2] as [number, number, number, number],
        },
        thCell: {
          fontSize: 7.5,
          bold: true,
          color: '#000',
          alignment: 'center' as const,
          fillColor: '#f1f5f9',
          margin: [0, 2, 0, 2] as [number, number, number, number],
        },
        tdCell: {
          fontSize: 7.5,
          alignment: 'center' as const,
          margin: [0, 2, 0, 2] as [number, number, number, number],
        },
        tdCellMono: {
          fontSize: 7.5,
          alignment: 'center' as const,
          margin: [0, 2, 0, 2] as [number, number, number, number],
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
