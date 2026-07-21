import { Injectable } from '@nestjs/common';
import { Calibration, CalibrationPoint } from './calibration.entity';
import PdfPrinter from 'pdfmake';
import { SettingsService } from '../settings/settings.service';
import { ReportTemplatesService } from '../report-templates/report-templates.service';

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
    const env = calibration.environmental_conditions || { temperature: '-', humidity: '-' };

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
      headerText =
        userSettings?.reportConfig?.headerText || '';
      footerText =
        userSettings?.reportConfig?.footerText || '';
    }

    // ── Parse header/footer HTML for pdfmake ─────────────────
    const htmlToPdfmake = require('html-to-pdfmake');
    const { JSDOM } = require('jsdom');
    const path = require('path');

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
    const dataTableHeader = [
      { text: 'Pt', style: 'thCell' },
      { text: 'Nominal', style: 'thCell' },
      { text: 'Ascending', style: 'thCell' },
      { text: 'Descending', style: 'thCell' },
      { text: 'Error', style: 'thCell' },
      { text: 'Tolerance', style: 'thCell' },
      { text: 'Status', style: 'thCell' },
    ];

    const dataTableBody = [dataTableHeader];
    points.forEach((pt: CalibrationPoint, idx: number) => {
      const status = pt.status || '-';
      const statusColor = status === 'PASS' ? '#16a34a' : status === 'FAIL' ? '#dc2626' : '#000';
      dataTableBody.push([
        { text: String(pt.point_number || idx + 1), style: 'tdCell' },
        { text: String(pt.nominal ?? '-'), style: 'tdCell' },
        { text: String(pt.ascending_reading ?? '-'), style: 'tdCell' },
        { text: String(pt.descending_reading ?? '-'), style: 'tdCell' },
        { text: String(pt.error ?? '-'), style: 'tdCell' },
        { text: pt.tolerance != null ? `±${pt.tolerance}` : '-', style: 'tdCell' },
        { text: status, style: 'tdCell', color: statusColor, bold: true },
      ] as any);
    });

    // ── Instrument details table ─────────────────────────────
    const instrumentDetails = [
      ['Instrument Name', inst?.name || '-'],
      ['ID Code', inst?.id_code || '-'],
      ['Make', inst?.make || '-'],
      ['Range', inst?.range || '-'],
      ['Least Count', inst?.least_count || '-'],
      ['Serial No', inst?.serial_no || '-'],
      ['Location', inst?.location || '-'],
    ];

    // ── Reference standard table(s) ─────────────────────────────
    let referenceStandards: any[] = [];
    if (calibration.reference_standards && calibration.reference_standards.length > 0) {
      referenceStandards = calibration.reference_standards;
    } else if (calibration.reference_standard_name) {
      referenceStandards = [{
        name: calibration.reference_standard_name,
        id: calibration.reference_standard_id,
        traceable_to: calibration.reference_standard_traceable_to,
        range: calibration.reference_standard_range,
        least_count: calibration.reference_standard_least_count,
        validity: calibration.reference_standard_validity
      }];
    }

    // ── Verdict display ──────────────────────────────────────
    const verdictText = calibration.verdict || 'PENDING';
    const verdictColor =
      verdictText === 'PASS'
        ? '#16a34a'
        : verdictText === 'FAIL'
        ? '#dc2626'
        : '#d97706';

    // ── PDF Document Definition ──────────────────────────────
    const docDefinition = {
      pageSize: 'A4' as const,
      pageOrientation: 'portrait' as const,
      pageMargins: [30, headerText ? 110 : 40, 30, footerText ? 90 : 50],

      header: headerText
        ? function () {
            return { margin: [30, 20, 30, 0], stack: headerStack };
          }
        : undefined,

      footer: function (currentPage: number, pageCount: number) {
        const pageInfo = {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: 'center' as const,
          fontSize: 8,
          margin: [0, 5, 0, 0] as [number, number, number, number],
        };
        if (footerText && footerStack.length > 0) {
          return {
            margin: [30, 10, 30, 0] as [number, number, number, number],
            stack: [...footerStack, pageInfo],
          };
        }
        return {
          margin: [30, 10, 30, 0] as [number, number, number, number],
          stack: [pageInfo],
        };
      },

      content: [
        // Title
        {
          text: 'CALIBRATION CERTIFICATE',
          style: 'title',
          alignment: 'center' as const,
          margin: [0, 0, 0, 6] as [number, number, number, number],
        },

        // Certificate & ULR numbers
        {
          columns: [
            {
              width: '*',
              text: [
                { text: 'Certificate No: ', bold: true, fontSize: 9 },
                { text: calibration.certificate_number || '-', fontSize: 9 },
              ],
            },
            calibration.ulr_number
              ? {
                  width: '*',
                  text: [
                    { text: 'ULR No: ', bold: true, fontSize: 9 },
                    { text: calibration.ulr_number, fontSize: 9 },
                  ],
                  alignment: 'right' as const,
                }
              : { width: '*', text: '' },
          ],
          margin: [0, 0, 0, 2] as [number, number, number, number],
        },
        {
          columns: [
            {
              width: '*',
              text: [
                { text: 'Date of Calibration: ', bold: true, fontSize: 9 },
                { text: fmtDate(calibration.calibration_date), fontSize: 9 },
              ],
            },
            {
              width: '*',
              text: [
                { text: 'Next Due Date: ', bold: true, fontSize: 9 },
                { text: fmtDate(calibration.next_calibration_date), fontSize: 9 },
              ],
              alignment: 'right' as const,
            },
          ],
          margin: [0, 0, 0, 10] as [number, number, number, number],
        },

        // ── Instrument Under Calibration ──
        {
          text: 'INSTRUMENT UNDER CALIBRATION',
          style: 'sectionHeader',
        },
        {
          table: {
            widths: [120, '*'],
            body: instrumentDetails.map(([k, v]) => [
              { text: k, bold: true, fontSize: 9, margin: [0, 2, 0, 2] },
              { text: v, fontSize: 9, margin: [0, 2, 0, 2] },
            ]),
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#ddd',
            vLineColor: () => '#ddd',
          },
          margin: [0, 0, 0, 10] as [number, number, number, number],
        },

        // ── Reference Standards ──
        {
          text: 'REFERENCE STANDARD / MASTER INSTRUMENT',
          style: 'sectionHeader',
        },
        referenceStandards.length > 0 
          ? referenceStandards.map((ref, idx) => ([
              idx > 0 ? { text: ' ', margin: [0, 4, 0, 4] as [number, number, number, number] } : null,
              {
                table: {
                  widths: [120, '*'],
                  body: [
                    [{ text: 'Name', bold: true, fontSize: 9, margin: [0, 2, 0, 2] }, { text: ref.name || '-', fontSize: 9, margin: [0, 2, 0, 2] }],
                    [{ text: 'ID / Serial No', bold: true, fontSize: 9, margin: [0, 2, 0, 2] }, { text: ref.id || '-', fontSize: 9, margin: [0, 2, 0, 2] }],
                    [{ text: 'Traceable To', bold: true, fontSize: 9, margin: [0, 2, 0, 2] }, { text: ref.traceable_to || '-', fontSize: 9, margin: [0, 2, 0, 2] }],
                    [{ text: 'Range', bold: true, fontSize: 9, margin: [0, 2, 0, 2] }, { text: ref.range || '-', fontSize: 9, margin: [0, 2, 0, 2] }],
                    [{ text: 'Least Count', bold: true, fontSize: 9, margin: [0, 2, 0, 2] }, { text: ref.least_count || '-', fontSize: 9, margin: [0, 2, 0, 2] }],
                    [{ text: 'Valid Until', bold: true, fontSize: 9, margin: [0, 2, 0, 2] }, { text: fmtDate(ref.validity), fontSize: 9, margin: [0, 2, 0, 2] }],
                  ]
                },
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0.5,
                  hLineColor: () => '#ddd',
                  vLineColor: () => '#ddd',
                },
                margin: [0, 0, 0, idx === referenceStandards.length - 1 ? 10 : 0] as [number, number, number, number],
              }
            ]))
          : {
              text: 'No Reference Standard Used',
              italics: true,
              fontSize: 9,
              margin: [0, 0, 0, 10] as [number, number, number, number],
            },

        // ── Environmental Conditions ──
        {
          text: 'ENVIRONMENTAL CONDITIONS',
          style: 'sectionHeader',
        },
        {
          columns: [
            {
              text: [
                { text: 'Temperature: ', bold: true, fontSize: 9 },
                { text: env.temperature || '-', fontSize: 9 },
              ],
            },
            {
              text: [
                { text: 'Humidity: ', bold: true, fontSize: 9 },
                { text: env.humidity || '-', fontSize: 9 },
              ],
            },
            env.pressure
              ? {
                  text: [
                    { text: 'Pressure: ', bold: true, fontSize: 9 },
                    { text: env.pressure, fontSize: 9 },
                  ],
                }
              : { text: '' },
          ],
          margin: [0, 0, 0, 10] as [number, number, number, number],
        },

        // ── Calibration Data ──
        {
          text: 'CALIBRATION DATA',
          style: 'sectionHeader',
        },
        points.length > 0
          ? {
              table: {
                headerRows: 1,
                widths: ['auto', '*', '*', '*', '*', '*', 'auto'],
                body: dataTableBody,
              },
              layout: {
                fillColor: (rowIndex: number) =>
                  rowIndex === 0 ? '#2563eb' : rowIndex % 2 === 0 ? '#f8fafc' : null,
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                hLineColor: () => '#cbd5e1',
                vLineColor: () => '#cbd5e1',
              },
              margin: [0, 0, 0, 10] as [number, number, number, number],
            }
          : {
              text: 'No calibration data points recorded.',
              fontSize: 9,
              italics: true,
              margin: [0, 0, 0, 10] as [number, number, number, number],
            },

        // ── Result ──
        {
          text: 'RESULT',
          style: 'sectionHeader',
        },
        {
          columns: [
            {
              width: '*',
              stack: [
                {
                  text: [
                    { text: 'Measurement Uncertainty: ', bold: true, fontSize: 9 },
                    { text: calibration.uncertainty || '-', fontSize: 9 },
                  ],
                  margin: [0, 0, 0, 4] as [number, number, number, number],
                },
                {
                  text: [
                    { text: 'Verdict: ', bold: true, fontSize: 10 },
                    {
                      text: ` ${verdictText} `,
                      bold: true,
                      fontSize: 11,
                      color: '#fff',
                      background: verdictColor,
                    },
                  ],
                  margin: [0, 0, 0, 4] as [number, number, number, number],
                },
              ],
            },
          ],
          margin: [0, 0, 0, 4] as [number, number, number, number],
        },
        calibration.remarks
          ? {
              text: [
                { text: 'Remarks: ', bold: true, fontSize: 9 },
                { text: calibration.remarks, fontSize: 9 },
              ],
              margin: [0, 0, 0, 10] as [number, number, number, number],
            }
          : { text: '', margin: [0, 0, 0, 10] as [number, number, number, number] },

        // ── Signature Block ──
        {
          margin: [0, 20, 0, 0] as [number, number, number, number],
          columns: [
            {
              width: '*',
              stack: [
                { text: '________________________', alignment: 'center' as const, fontSize: 9, margin: [0, 0, 0, 4] as [number, number, number, number] },
                { text: calibration.calibrated_by || '(Name)', alignment: 'center' as const, bold: true, fontSize: 9 },
                { text: calibration.calibrated_by_designation || 'Calibrated By', alignment: 'center' as const, fontSize: 8, color: '#64748b' },
              ],
            },
            {
              width: '*',
              stack: [
                { text: '________________________', alignment: 'center' as const, fontSize: 9, margin: [0, 0, 0, 4] as [number, number, number, number] },
                { text: calibration.reviewed_by || '(Name)', alignment: 'center' as const, bold: true, fontSize: 9 },
                { text: calibration.reviewed_by_designation || 'Reviewed By', alignment: 'center' as const, fontSize: 8, color: '#64748b' },
              ],
            },
            {
              width: '*',
              stack: [
                { text: '________________________', alignment: 'center' as const, fontSize: 9, margin: [0, 0, 0, 4] as [number, number, number, number] },
                { text: calibration.approved_by || '(Name)', alignment: 'center' as const, bold: true, fontSize: 9 },
                { text: calibration.approved_by_designation || 'Approved By', alignment: 'center' as const, fontSize: 8, color: '#64748b' },
              ],
            },
          ],
        },

        // ── Disclaimer ──
        {
          text: 'This certificate is issued based on calibration conducted as per standard procedures. The results relate only to the item calibrated.',
          fontSize: 7,
          color: '#94a3b8',
          alignment: 'center' as const,
          margin: [0, 20, 0, 0] as [number, number, number, number],
        },
      ],

      styles: {
        title: {
          fontSize: 16,
          bold: true,
          color: '#1e293b',
        },
        sectionHeader: {
          fontSize: 10,
          bold: true,
          color: '#fff',
          fillColor: '#334155',
          margin: [0, 0, 0, 4] as [number, number, number, number],
          padding: [4, 3, 4, 3],
        },
        thCell: {
          fontSize: 8,
          bold: true,
          color: '#fff',
          alignment: 'center' as const,
          margin: [0, 3, 0, 3] as [number, number, number, number],
        },
        tdCell: {
          fontSize: 8,
          alignment: 'center' as const,
          margin: [0, 3, 0, 3] as [number, number, number, number],
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
