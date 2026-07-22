import { Injectable } from '@nestjs/common';
import { Calibration, CalibrationPoint } from './calibration.entity';
import PdfPrinter from 'pdfmake';
import { SettingsService } from '../settings/settings.service';
import { ReportTemplatesService } from '../report-templates/report-templates.service';
// ── Parse header/footer HTML for pdfmake ─────────────────
const htmlToPdfmake = require('html-to-pdfmake');
const { JSDOM } = require('jsdom');
const path = require('path');
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
@Injectable()
export class CertificateService {
  private printer = new PdfPrinter(fonts);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly reportTemplatesService: ReportTemplatesService,
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
    const inst = calibration.instrument;
    const points = calibration.calibration_points || [];
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

    // Extract custom columns metadata from points
    const customColMap = new Map<string, string>();
    points.forEach((pt: any) => {
      if (pt.customFields && typeof pt.customFields === 'object') {
        Object.entries(pt.customFields).forEach(([key, val]) => {
          if (val && typeof val === 'object' && 'name' in val) {
            customColMap.set(key, (val as any).name);
          } else if (
            typeof val !== 'object' &&
            val !== null &&
            val !== undefined
          ) {
            customColMap.set(key, key);
          }
        });
      }
    });
    const customKeys = Array.from(customColMap.keys());

    // Build Table Header
    const dataTableHeader: any[] = [{ text: 'Sr No.', style: 'thCell' }];
    if (hasDescription) {
      dataTableHeader.push({ text: 'Description', style: 'thCell' });
    }
    dataTableHeader.push(
      { text: 'STANDARD VALUE', style: 'thCell' },
      {
        text: hasDescending ? 'AVG OBS VALUE (ASC)' : 'AVG OBS VALUE UUC',
        style: 'thCell',
      },
    );
    if (hasDescending) {
      dataTableHeader.push({ text: 'AVG OBS VALUE (DESC)', style: 'thCell' });
    }
    customKeys.forEach((k) => {
      const label = customColMap.get(k) || k;
      dataTableHeader.push({ text: label, style: 'thCell' });
    });
    dataTableHeader.push(
      { text: 'ERROR', style: 'thCell' },
      { text: 'Status', style: 'thCell' },
    );

    // Build Table Body
    const dataTableBody = [dataTableHeader];
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

      if (hasDescription) {
        row.push({
          text: String((pt as any).description || '-'),
          style: 'tdCell',
        });
      }

      row.push(
        { text: Number(pt.nominal ?? 0).toFixed(4), style: 'tdCellMono' },
        {
          text: Number(pt.ascending_reading ?? 0).toFixed(4),
          style: 'tdCellMono',
        },
      );

      if (hasDescending) {
        row.push({
          text: Number(pt.descending_reading ?? 0).toFixed(4),
          style: 'tdCellMono',
        });
      }

      customKeys.forEach((k) => {
        const obj = ((pt as any).customFields as any)?.[k];
        const valStr =
          typeof obj === 'object' && obj !== null && 'value' in obj
            ? String(obj.value ?? '-')
            : String(obj ?? '-');
        row.push({ text: valStr, style: 'tdCellMono' });
      });

      row.push(
        { text: Number(pt.error ?? 0).toFixed(4), style: 'tdCellMono' },
        { text: status, style: 'tdCell', color: statusColor, bold: true },
      );

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
          name: calibration.reference_standard_name || 'Gauge Block Set',
          make: 'Standard',
          id: calibration.reference_standard_id || 'REF-01',
          cert_no: 'AE/CC/REF/101',
          cal_date: calibration.calibration_date,
          validity: calibration.reference_standard_validity,
          agency: 'NABL Accredited Lab',
        },
      ];
    }

    // ── PDF Document Definition (NABL Certificate Layout) ──
    const docDefinition = {
      pageSize: 'A4' as const,
      pageOrientation: 'portrait' as const,
      pageMargins: [25, 25, 25, 25],

      content: [
        // Title Header Block
        {
          table: {
            widths: [130, '*', 90],
            body: [
              [
                {
                  stack: [
                    {
                      text: 'ACME ENTERPRISES',
                      bold: true,
                      fontSize: 11,
                      color: '#000',
                    },
                    {
                      text: '(CALIBRATION LABORATORY)',
                      fontSize: 7.5,
                      bold: true,
                      color: '#475569',
                    },
                  ],
                },
                {
                  text: 'CALIBRATION CERTIFICATE',
                  bold: true,
                  fontSize: 13,
                  color: '#0369a1',
                  alignment: 'center',
                  margin: [0, 4, 0, 0],
                },
                {
                  stack: [
                    {
                      text: 'NABL / LAB',
                      fontSize: 7,
                      bold: true,
                      alignment: 'right',
                    },
                    {
                      text: 'CC - 2632',
                      fontSize: 9,
                      bold: true,
                      alignment: 'right',
                    },
                  ],
                },
              ],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 6] as [number, number, number, number],
        },

        // Top 5-Column Certificate Metadata Grid
        {
          table: {
            widths: ['*', '*', '*', '*', '*'],
            body: [
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
                  text: fmtDate(calibration.calibration_date),
                  style: 'gridTd',
                },
                { text: '1 of 1', style: 'gridTd' },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000',
            vLineColor: () => '#000',
          },
          margin: [0, 0, 0, 6] as [number, number, number, number],
        },

        // Customer & Location Grid
        {
          table: {
            widths: ['*', '*'],
            body: [
              [
                {
                  stack: [
                    {
                      text: inst?.location || 'M/s Customer Name',
                      bold: true,
                      fontSize: 8.5,
                    },
                    {
                      text: 'Calibration Customer / Address Details',
                      fontSize: 7.5,
                      color: '#475569',
                    },
                  ],
                  margin: [2, 2, 2, 2],
                },
                {
                  stack: [
                    {
                      text: 'Location of Calibration : Permanent Laboratory',
                      fontSize: 8,
                      bold: true,
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
          margin: [0, 0, 0, 6] as [number, number, number, number],
        },

        // Description & Identification Box
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  text: 'Description & Identification',
                  style: 'boxHeader',
                },
              ],
              [
                {
                  stack: [
                    {
                      columns: [
                        {
                          text: 'Instrument (UUC) : ' + (inst?.name || '-'),
                          style: 'kvPair',
                        },
                        {
                          text:
                            'Model No. : ' + ((inst as any)?.model_no || '-'),
                          style: 'kvPair',
                        },
                      ],
                    },
                    {
                      columns: [
                        {
                          text: 'Make : ' + (inst?.make || '-'),
                          style: 'kvPair',
                        },
                        {
                          text: 'Range : ' + (inst?.range || '-'),
                          style: 'kvPair',
                        },
                      ],
                    },
                    {
                      columns: [
                        {
                          text: 'Serial No. : ' + (inst?.serial_no || '-'),
                          style: 'kvPair',
                        },
                        {
                          text: 'Least Count : ' + (inst?.least_count || '-'),
                          style: 'kvPair',
                        },
                      ],
                    },
                    {
                      columns: [
                        {
                          text: 'ID No. : ' + (inst?.id_code || '-'),
                          style: 'kvPair',
                        },
                        {
                          text: 'Instrument Cond. : SATISFACTORY',
                          style: 'kvPair',
                        },
                      ],
                    },
                    {
                      columns: [
                        {
                          text: 'Calibration Range : ' + (inst?.range || '-'),
                          style: 'kvPair',
                        },
                        {
                          text:
                            'Location : ' +
                            (inst?.location || 'Permanent Laboratory'),
                          style: 'kvPair',
                        },
                      ],
                    },
                  ],
                  margin: [4, 4, 4, 4],
                },
              ],
              [
                {
                  stack: [
                    {
                      text: 'Procedure reference : AE/CAL-SOP/01',
                      style: 'subNote',
                    },
                    {
                      text: `Environmental Conditions : Temperature at ${env.temperature}° C  RH ${env.humidity} %`,
                      style: 'subNote',
                    },
                    {
                      text: 'Standard Reference : IS / ISO Standard Calibration Guidelines',
                      style: 'subNote',
                    },
                    {
                      text: 'Discipline : DIMENSION (Basic Measuring Instrument, Gauge etc)',
                      style: 'subNote',
                    },
                  ],
                  fillColor: '#f8fafc',
                  margin: [4, 4, 4, 4],
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
          margin: [0, 0, 0, 6] as [number, number, number, number],
        },

        // Traceability of Master Used
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  text: 'TRACEABILITY OF MASTER USED :',
                  style: 'boxHeader',
                },
              ],
              [
                {
                  table: {
                    widths: ['*', '*', '*', '*', '*', '*', '*'],
                    body: [
                      [
                        { text: 'Instrument Desc.', style: 'thCellDark' },
                        { text: 'Make', style: 'thCellDark' },
                        { text: 'Sr No / Id. No.', style: 'thCellDark' },
                        { text: 'Cert.No.', style: 'thCellDark' },
                        { text: 'Dt.of Cal', style: 'thCellDark' },
                        { text: 'Due Dt.', style: 'thCellDark' },
                        { text: 'Cal.Agency', style: 'thCellDark' },
                      ],
                      ...referenceStandards.map((ref) => [
                        { text: ref.name || '-', style: 'tdCell' },
                        { text: ref.make || '-', style: 'tdCell' },
                        { text: ref.id || '-', style: 'tdCell' },
                        {
                          text: ref.cert_no || 'AE/CC/REF/01',
                          style: 'tdCell',
                        },
                        {
                          text: fmtDate(
                            ref.cal_date || calibration.calibration_date,
                          ),
                          style: 'tdCell',
                        },
                        { text: fmtDate(ref.validity), style: 'tdCell' },
                        { text: ref.agency || 'NABL Lab', style: 'tdCell' },
                      ]),
                    ],
                  },
                  layout: {
                    hLineWidth: () => 0.5,
                    vLineWidth: () => 0.5,
                    hLineColor: () => '#cbd5e1',
                    vLineColor: () => '#cbd5e1',
                  },
                },
              ],
              [
                {
                  text: 'All the measurements performed are traceable to National/Int. standards through NABL accredited cal.lab.',
                  fontSize: 7,
                  italics: true,
                  color: '#334155',
                  margin: [4, 2, 4, 2],
                  fillColor: '#f8fafc',
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
          margin: [0, 0, 0, 6] as [number, number, number, number],
        },

        // Calibration Result
        points.length > 0
          ? {
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      text: `Calibration Result (ALL VALUES ARE IN ${unit})`,
                      style: 'boxHeader',
                    },
                  ],
                  [
                    {
                      table: {
                        headerRows: 1,
                        widths: tableWidths,
                        body: dataTableBody,
                      },
                      layout: {
                        fillColor: (rowIndex: number) =>
                          rowIndex === 0 ? '#f1f5f9' : null,
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0.5,
                        hLineColor: () => '#cbd5e1',
                        vLineColor: () => '#cbd5e1',
                      },
                    },
                  ],
                  [
                    {
                      text: `Uncertainty of Measurement at coverage factor k = 2 at 95.45 % of confidence Level = ±${calibration.uncertainty || '0.00'}${unit}`,
                      fontSize: 8,
                      bold: true,
                      alignment: 'center',
                      fillColor: '#f8fafc',
                      margin: [2, 3, 2, 3],
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
              margin: [0, 0, 0, 8] as [number, number, number, number],
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
                    { text: ' ', margin: [0, 10, 0, 0] },
                    {
                      text: '________________________',
                      alignment: 'center',
                      fontSize: 8,
                    },
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
                    calibration.ulr_number
                      ? {
                          text: `ULR : ${calibration.ulr_number}`,
                          alignment: 'center',
                          fontSize: 7,
                          bold: true,
                        }
                      : { text: '' },
                  ],
                  margin: [2, 2, 2, 2],
                },
                {
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
                  margin: [2, 10, 2, 2],
                },
                {
                  stack: [
                    { text: ' ', margin: [0, 10, 0, 0] },
                    {
                      text: '________________________',
                      alignment: 'center',
                      fontSize: 8,
                    },
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
          margin: [0, 0, 0, 6] as [number, number, number, number],
        },

        // Footer Laboratory Address Banner
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    {
                      text: 'CALIBRATION CENTER :',
                      bold: true,
                      fontSize: 8,
                      alignment: 'center',
                    },
                    {
                      text: 'Laboratory Address, Behind Main Road, Industrial Zone, State - 440024.',
                      fontSize: 7.5,
                      alignment: 'center',
                    },
                    {
                      text: 'Website: www.gaugemaster.com | Email: info@gaugemaster.com | Phone: +91 98222 23948',
                      fontSize: 7,
                      alignment: 'center',
                      color: '#334155',
                    },
                  ],
                  fillColor: '#f1f5f9',
                  margin: [2, 3, 2, 3],
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
        },
      ],

      styles: {
        gridTh: {
          fontSize: 7.5,
          bold: true,
          alignment: 'center' as const,
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
