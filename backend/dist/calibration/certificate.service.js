"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificateService = void 0;
const common_1 = require("@nestjs/common");
const pdfmake_1 = __importDefault(require("pdfmake"));
const settings_service_1 = require("../settings/settings.service");
const report_templates_service_1 = require("../report-templates/report-templates.service");
const fonts = {
    Roboto: {
        normal: 'src/fonts/Roboto-Regular.ttf',
        bold: 'src/fonts/Roboto-Medium.ttf',
        italics: 'src/fonts/Roboto-Italic.ttf',
        bolditalics: 'src/fonts/Roboto-MediumItalic.ttf',
    },
};
let CertificateService = class CertificateService {
    settingsService;
    reportTemplatesService;
    printer = new pdfmake_1.default(fonts);
    constructor(settingsService, reportTemplatesService) {
        this.settingsService = settingsService;
        this.reportTemplatesService = reportTemplatesService;
    }
    async generateCertificate(calibration, userId, templateId) {
        const inst = calibration.instrument;
        const points = calibration.calibration_points || [];
        const env = calibration.environmental_conditions || { temperature: '-', humidity: '-' };
        let headerText = '';
        let footerText = '';
        const hasTemplateId = templateId &&
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
        }
        else if (userId) {
            const userSettings = await this.settingsService.findOneByUserId(userId);
            headerText =
                userSettings?.reportConfig?.headerText || '';
            footerText =
                userSettings?.reportConfig?.footerText || '';
        }
        const htmlToPdfmake = require('html-to-pdfmake');
        const { JSDOM } = require('jsdom');
        const path = require('path');
        const resolveImagePath = (src) => {
            if (!src)
                return src;
            if (src.startsWith('data:'))
                return src;
            if (src.startsWith('http://') || src.startsWith('https://'))
                return src;
            const relativePath = src.startsWith('/') ? src.slice(1) : src;
            return path.join(process.cwd(), relativePath);
        };
        const fixPdfmakeContent = (nodes) => {
            if (!Array.isArray(nodes))
                return;
            nodes.forEach((node) => {
                if (!node)
                    return;
                if (node.table) {
                    const colCount = node.table.body?.[0]?.length || 0;
                    if (colCount === 3) {
                        node.table.widths = [130, '*', 130];
                    }
                    else if (colCount === 2) {
                        node.table.widths = ['*', '*'];
                    }
                    else {
                        node.table.widths = Array(colCount).fill('*');
                    }
                    node.layout = 'noBorders';
                    if (node.table.body) {
                        node.table.body.forEach((row) => {
                            if (Array.isArray(row)) {
                                row.forEach((cell) => {
                                    if (Array.isArray(cell))
                                        fixPdfmakeContent(cell);
                                    else if (cell && cell.stack)
                                        fixPdfmakeContent(cell.stack);
                                    else if (cell && typeof cell === 'object')
                                        fixPdfmakeContent([cell]);
                                });
                            }
                        });
                    }
                }
                if (node.image) {
                    node.image = resolveImagePath(node.image);
                    if (!node.width || node.width > 120)
                        node.width = 120;
                    delete node.height;
                }
                if (node.stack)
                    fixPdfmakeContent(node.stack);
                if (node.columns)
                    fixPdfmakeContent(node.columns);
            });
        };
        let headerStack = [];
        if (headerText) {
            const domHeader = new JSDOM(headerText);
            domHeader.window.document.querySelectorAll('img').forEach((img) => {
                const w = parseInt(img.getAttribute('width') || '0', 10);
                if (!w || w > 120)
                    img.setAttribute('width', '120');
                img.removeAttribute('height');
            });
            const headerResult = htmlToPdfmake(domHeader.window.document.body.innerHTML, { window: domHeader.window });
            headerStack = Array.isArray(headerResult.content || headerResult)
                ? headerResult.content || headerResult
                : [headerResult.content || headerResult];
            fixPdfmakeContent(headerStack);
        }
        let footerStack = [];
        if (footerText) {
            const domFooter = new JSDOM(footerText);
            domFooter.window.document.querySelectorAll('img').forEach((img) => {
                const w = parseInt(img.getAttribute('width') || '0', 10);
                if (!w || w > 120)
                    img.setAttribute('width', '120');
                img.removeAttribute('height');
            });
            const footerResult = htmlToPdfmake(domFooter.window.document.body.innerHTML, { window: domFooter.window });
            footerStack = Array.isArray(footerResult.content || footerResult)
                ? footerResult.content || footerResult
                : [footerResult.content || footerResult];
            fixPdfmakeContent(footerStack);
        }
        const fmtDate = (d) => {
            if (!d)
                return '-';
            const dt = d instanceof Date ? d : new Date(d);
            if (isNaN(dt.getTime()))
                return '-';
            return dt.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });
        };
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
        points.forEach((pt, idx) => {
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
            ]);
        });
        const instrumentDetails = [
            ['Instrument Name', inst?.name || '-'],
            ['ID Code', inst?.id_code || '-'],
            ['Make', inst?.make || '-'],
            ['Range', inst?.range || '-'],
            ['Least Count', inst?.least_count || '-'],
            ['Serial No', inst?.serial_no || '-'],
            ['Location', inst?.location || '-'],
        ];
        let referenceStandards = [];
        if (calibration.reference_standards && calibration.reference_standards.length > 0) {
            referenceStandards = calibration.reference_standards;
        }
        else if (calibration.reference_standard_name) {
            referenceStandards = [{
                    name: calibration.reference_standard_name,
                    id: calibration.reference_standard_id,
                    traceable_to: calibration.reference_standard_traceable_to,
                    range: calibration.reference_standard_range,
                    least_count: calibration.reference_standard_least_count,
                    validity: calibration.reference_standard_validity
                }];
        }
        const verdictText = calibration.verdict || 'PENDING';
        const verdictColor = verdictText === 'PASS'
            ? '#16a34a'
            : verdictText === 'FAIL'
                ? '#dc2626'
                : '#d97706';
        const docDefinition = {
            pageSize: 'A4',
            pageOrientation: 'portrait',
            pageMargins: [30, headerText ? 110 : 40, 30, footerText ? 90 : 50],
            header: headerText
                ? function () {
                    return { margin: [30, 20, 30, 0], stack: headerStack };
                }
                : undefined,
            footer: function (currentPage, pageCount) {
                const pageInfo = {
                    text: `Page ${currentPage} of ${pageCount}`,
                    alignment: 'center',
                    fontSize: 8,
                    margin: [0, 5, 0, 0],
                };
                if (footerText && footerStack.length > 0) {
                    return {
                        margin: [30, 10, 30, 0],
                        stack: [...footerStack, pageInfo],
                    };
                }
                return {
                    margin: [30, 10, 30, 0],
                    stack: [pageInfo],
                };
            },
            content: [
                {
                    text: 'CALIBRATION CERTIFICATE',
                    style: 'title',
                    alignment: 'center',
                    margin: [0, 0, 0, 6],
                },
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
                                alignment: 'right',
                            }
                            : { width: '*', text: '' },
                    ],
                    margin: [0, 0, 0, 2],
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
                            alignment: 'right',
                        },
                    ],
                    margin: [0, 0, 0, 10],
                },
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
                    margin: [0, 0, 0, 10],
                },
                {
                    text: 'REFERENCE STANDARD / MASTER INSTRUMENT',
                    style: 'sectionHeader',
                },
                referenceStandards.length > 0
                    ? referenceStandards.map((ref, idx) => ([
                        idx > 0 ? { text: ' ', margin: [0, 4, 0, 4] } : null,
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
                            margin: [0, 0, 0, idx === referenceStandards.length - 1 ? 10 : 0],
                        }
                    ]))
                    : {
                        text: 'No Reference Standard Used',
                        italics: true,
                        fontSize: 9,
                        margin: [0, 0, 0, 10],
                    },
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
                    margin: [0, 0, 0, 10],
                },
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
                            fillColor: (rowIndex) => rowIndex === 0 ? '#2563eb' : rowIndex % 2 === 0 ? '#f8fafc' : null,
                            hLineWidth: () => 0.5,
                            vLineWidth: () => 0.5,
                            hLineColor: () => '#cbd5e1',
                            vLineColor: () => '#cbd5e1',
                        },
                        margin: [0, 0, 0, 10],
                    }
                    : {
                        text: 'No calibration data points recorded.',
                        fontSize: 9,
                        italics: true,
                        margin: [0, 0, 0, 10],
                    },
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
                                    margin: [0, 0, 0, 4],
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
                                    margin: [0, 0, 0, 4],
                                },
                            ],
                        },
                    ],
                    margin: [0, 0, 0, 4],
                },
                calibration.remarks
                    ? {
                        text: [
                            { text: 'Remarks: ', bold: true, fontSize: 9 },
                            { text: calibration.remarks, fontSize: 9 },
                        ],
                        margin: [0, 0, 0, 10],
                    }
                    : { text: '', margin: [0, 0, 0, 10] },
                {
                    margin: [0, 20, 0, 0],
                    columns: [
                        {
                            width: '*',
                            stack: [
                                { text: '________________________', alignment: 'center', fontSize: 9, margin: [0, 0, 0, 4] },
                                { text: calibration.calibrated_by || '(Name)', alignment: 'center', bold: true, fontSize: 9 },
                                { text: calibration.calibrated_by_designation || 'Calibrated By', alignment: 'center', fontSize: 8, color: '#64748b' },
                            ],
                        },
                        {
                            width: '*',
                            stack: [
                                { text: '________________________', alignment: 'center', fontSize: 9, margin: [0, 0, 0, 4] },
                                { text: calibration.reviewed_by || '(Name)', alignment: 'center', bold: true, fontSize: 9 },
                                { text: calibration.reviewed_by_designation || 'Reviewed By', alignment: 'center', fontSize: 8, color: '#64748b' },
                            ],
                        },
                        {
                            width: '*',
                            stack: [
                                { text: '________________________', alignment: 'center', fontSize: 9, margin: [0, 0, 0, 4] },
                                { text: calibration.approved_by || '(Name)', alignment: 'center', bold: true, fontSize: 9 },
                                { text: calibration.approved_by_designation || 'Approved By', alignment: 'center', fontSize: 8, color: '#64748b' },
                            ],
                        },
                    ],
                },
                {
                    text: 'This certificate is issued based on calibration conducted as per standard procedures. The results relate only to the item calibrated.',
                    fontSize: 7,
                    color: '#94a3b8',
                    alignment: 'center',
                    margin: [0, 20, 0, 0],
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
                    margin: [0, 0, 0, 4],
                    padding: [4, 3, 4, 3],
                },
                thCell: {
                    fontSize: 8,
                    bold: true,
                    color: '#fff',
                    alignment: 'center',
                    margin: [0, 3, 0, 3],
                },
                tdCell: {
                    fontSize: 8,
                    alignment: 'center',
                    margin: [0, 3, 0, 3],
                },
            },
            defaultStyle: {
                font: 'Roboto',
            },
        };
        const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
        const chunks = [];
        return new Promise((resolve, reject) => {
            pdfDoc.on('data', (chunk) => chunks.push(chunk));
            pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
            pdfDoc.on('error', (err) => reject(err));
            pdfDoc.end();
        });
    }
};
exports.CertificateService = CertificateService;
exports.CertificateService = CertificateService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_service_1.SettingsService,
        report_templates_service_1.ReportTemplatesService])
], CertificateService);
//# sourceMappingURL=certificate.service.js.map