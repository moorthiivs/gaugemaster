"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const instrument_entity_1 = require("../instruments/instrument.entity");
const typeorm_2 = require("typeorm");
const pdfmake_1 = __importDefault(require("pdfmake"));
const ExcelJS = __importStar(require("exceljs"));
const settings_service_1 = require("../settings/settings.service");
const report_templates_service_1 = require("../report-templates/report-templates.service");
const { JSDOM } = require('jsdom');
const fonts = {
    Roboto: {
        normal: 'src/fonts/Roboto-Regular.ttf',
        bold: 'src/fonts/Roboto-Medium.ttf',
        italics: 'src/fonts/Roboto-Italic.ttf',
        bolditalics: 'src/fonts/Roboto-MediumItalic.ttf',
    },
};
let ReportsService = class ReportsService {
    instrumentRepository;
    settingsService;
    reportTemplatesService;
    printer = new pdfmake_1.default(fonts);
    constructor(instrumentRepository, settingsService, reportTemplatesService) {
        this.instrumentRepository = instrumentRepository;
        this.settingsService = settingsService;
        this.reportTemplatesService = reportTemplatesService;
    }
    async generatePdfReport(instruments, selectedColumns, userid, templateId) {
        const columnMap = {
            sino: 'S.No',
            id_code: 'ID Code',
            name: 'Name',
            location: 'Location',
            frequency: 'Frequency',
            last_calibration_date: 'Last Cal Date',
            due_date: 'Due Date',
            agency: 'Agency',
            range: 'Range',
            serial_no: 'Serial No',
            least_count: 'Least Count',
            status: 'Status',
            item_status: 'Item Status',
            notes: 'Notes',
            make: 'Make',
            item_type: 'Item Type',
            part_no: 'Part No',
            part_name: 'Part Name',
            module: 'Module',
            calibration_source: 'Calib Source',
            customer: 'Customer',
            sector: 'Sector',
            criticality_level: 'Criticality',
            cert_no: 'Cert No',
            remarks: 'Remarks',
            gauge_issue_date: 'Issue Date',
            gauges_received_by: 'Received By',
            gauges_issued_by: 'Issued By',
            calibration_procedure: 'Procedure',
            traceable: 'Traceable',
        };
        const activeColumns = selectedColumns || ['sino', 'id_code', 'name', 'location', 'due_date', 'status'];
        const headerRow = activeColumns.map(col => ({ text: columnMap[col] || col, style: 'tableHeader' }));
        const body = [headerRow];
        instruments.forEach((inst, i) => {
            const row = activeColumns.map(col => {
                let text = '';
                if (col === 'sino')
                    text = (i + 1).toString();
                else if (col === 'last_calibration_date' || col === 'due_date' || col === 'gauge_issue_date') {
                    const date = inst[col];
                    text = date instanceof Date ? date.toISOString().split('T')[0] : '-';
                }
                else if (col === 'created_by') {
                    text = inst.created_by?.name || inst.created_by?.id || '-';
                }
                else {
                    text = inst[col] || '-';
                }
                return { text, style: 'tableData' };
            });
            body.push(row);
        });
        let customHeaderHtml = '<h1>Calibration Instruments Report</h1>';
        let customFooterHtml = '';
        const hasTemplateId = templateId &&
            templateId !== 'undefined' &&
            templateId !== 'null' &&
            templateId !== 'default' &&
            templateId !== '';
        if (hasTemplateId) {
            const template = await this.reportTemplatesService.findOne(templateId);
            if (template) {
                customHeaderHtml = template.headerText || '';
                customFooterHtml = template.footerText || '';
            }
        }
        else {
            const userSettings = userid ? await this.settingsService.findOneByUserId(userid) : null;
            console.log("PDF Generation - Fetched userSettings for userid:", userid, userSettings);
            customHeaderHtml = userSettings?.reportConfig?.headerText || '<h1>Calibration Instruments Report</h1>';
            customFooterHtml = userSettings?.reportConfig?.footerText || '';
        }
        console.log("PDF Generation - customHeaderHtml:", customHeaderHtml);
        const htmlToPdfmake = require('html-to-pdfmake');
        const { JSDOM } = require('jsdom');
        const domHeader = new JSDOM(customHeaderHtml);
        const docHeader = domHeader.window.document;
        docHeader.querySelectorAll('img').forEach((img) => {
            const currentWidth = parseInt(img.getAttribute('width') || '0', 10);
            if (!currentWidth || currentWidth > 120) {
                img.setAttribute('width', '120');
            }
            img.removeAttribute('height');
        });
        docHeader.querySelectorAll('table').forEach((table) => {
            table.setAttribute('width', '100%');
            table.style.width = '100%';
            const rows = table.querySelectorAll('tr');
            rows.forEach((row) => {
                const cells = row.querySelectorAll('td, th');
                if (cells.length === 3) {
                    cells[0].style.width = '20%';
                    cells[1].style.width = '60%';
                    cells[1].style.textAlign = cells[1].style.textAlign || 'center';
                    cells[2].style.width = '20%';
                }
                else if (cells.length === 2) {
                    cells[0].style.width = '50%';
                    cells[1].style.width = '50%';
                }
            });
        });
        const safeHeaderHtml = docHeader.body.innerHTML;
        const domFooter = new JSDOM(customFooterHtml);
        const docFooter = domFooter.window.document;
        docFooter.querySelectorAll('img').forEach((img) => {
            const currentWidth = parseInt(img.getAttribute('width') || '0', 10);
            if (!currentWidth || currentWidth > 120) {
                img.setAttribute('width', '120');
            }
            img.removeAttribute('height');
        });
        docFooter.querySelectorAll('table').forEach((table) => {
            table.setAttribute('width', '100%');
            table.style.width = '100%';
            const rows = table.querySelectorAll('tr');
            rows.forEach((row) => {
                const cells = row.querySelectorAll('td, th');
                if (cells.length === 3) {
                    cells[0].style.width = '20%';
                    cells[1].style.width = '60%';
                    cells[1].style.textAlign = cells[1].style.textAlign || 'center';
                    cells[2].style.width = '20%';
                }
                else if (cells.length === 2) {
                    cells[0].style.width = '50%';
                    cells[1].style.width = '50%';
                }
            });
        });
        const safeFooterHtml = docFooter.body.innerHTML;
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
            nodes.forEach(node => {
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
                    if (!node.width || node.width > 120) {
                        node.width = 120;
                    }
                    delete node.height;
                }
                if (node.stack)
                    fixPdfmakeContent(node.stack);
                if (node.columns)
                    fixPdfmakeContent(node.columns);
            });
        };
        const docDefinition = {
            pageSize: activeColumns.length > 8 ? 'A3' : 'A4',
            pageOrientation: activeColumns.length > 5 ? 'landscape' : 'portrait',
            pageMargins: [20, 100, 20, 80],
            header: function (currentPage, pageCount, pageSize) {
                const headerResult = htmlToPdfmake(safeHeaderHtml, { window: domHeader.window });
                const headerParsed = headerResult.content || headerResult;
                const headerStack = Array.isArray(headerParsed) ? headerParsed : [headerParsed];
                fixPdfmakeContent(headerStack);
                return {
                    margin: [20, 20, 20, 0],
                    stack: headerStack
                };
            },
            footer: function (currentPage, pageCount) {
                const footerResult = safeFooterHtml ? htmlToPdfmake(safeFooterHtml, { window: domFooter.window }) : [];
                const footerParsed = footerResult.content || footerResult;
                const footerStack = Array.isArray(footerParsed) ? footerParsed : [footerParsed];
                fixPdfmakeContent(footerStack);
                return {
                    margin: [20, 10, 20, 0],
                    stack: [
                        ...footerStack,
                        { text: `Page ${currentPage} of ${pageCount}`, alignment: 'center', margin: [0, 5, 0, 0], fontSize: 8 }
                    ]
                };
            },
            content: [
                {
                    style: 'tableExample',
                    table: {
                        headerRows: 1,
                        widths: activeColumns.map(() => 'auto'),
                        body: body,
                    },
                    layout: {
                        fillColor: (rowIndex) => rowIndex === 0 ? '#CCCCCC' : rowIndex % 2 === 0 ? '#F9F9F9' : null,
                    },
                },
            ],
            styles: {
                header: {
                    fontSize: 18,
                    bold: true,
                    alignment: 'center',
                },
                tableExample: {
                    margin: [0, 5, 0, 15],
                    fontSize: 8,
                },
                tableHeader: {
                    bold: true,
                    fontSize: 9,
                    color: 'black',
                    fillColor: '#CCCCCC',
                },
                tableData: {
                    fontSize: 8
                }
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
    async generateReport(from, to, format, userid, columnsStr, templateId) {
        const instruments = await this.instrumentRepository.find({
            where: {
                due_date: (0, typeorm_2.Between)(new Date(from), new Date(to)),
                created_by: { id: userid },
            },
            relations: ['created_by'],
            order: {
                due_date: 'ASC',
            },
        });
        const selectedColumns = columnsStr ? columnsStr.split(',') : undefined;
        if (format === 'xlsx') {
            const columnMap = {
                sino: 'S.No', id_code: 'ID Code', name: 'Name', location: 'Location',
                frequency: 'Frequency', last_calibration_date: 'Last Calibration Date', due_date: 'Due Date',
                agency: 'Agency', range: 'Range', serial_no: 'Serial Number', least_count: 'Least Count',
                notes: 'Notes', status: 'Status', item_status: 'Item Status', make: 'Make',
                item_type: 'Item Type', part_no: 'Part Number', part_name: 'Part Name', module: 'Module',
                calibration_source: 'Calibration Source', customer: 'Customer', sector: 'Sector',
                criticality_level: 'Criticality Level', cert_no: 'Certificate No', remarks: 'Remarks',
                gauge_issue_date: 'Gauge Issue Date', gauges_received_by: 'Gauges Received By',
                gauges_issued_by: 'Gauges Issued By', calibration_procedure: 'Calibration Procedure', traceable: 'Traceable',
            };
            const activeColumns = selectedColumns || ['sino', 'id_code', 'name', 'location', 'due_date', 'status'];
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Calibration Report');
            let rawHeaderHtml = '';
            let rawFooterHtml = '';
            if (templateId && templateId !== 'default' && templateId !== 'undefined') {
                const template = await this.reportTemplatesService.findOne(templateId);
                if (template) {
                    rawHeaderHtml = template.headerText || '';
                    rawFooterHtml = template.footerText || '';
                }
            }
            else {
                const userSettings = userid ? await this.settingsService.findOneByUserId(userid) : null;
                if (userSettings?.reportConfig) {
                    rawHeaderHtml = userSettings.reportConfig.headerText || '';
                    rawFooterHtml = userSettings.reportConfig.footerText || '';
                }
            }
            const dom = new JSDOM(rawHeaderHtml);
            const doc = dom.window.document;
            let headerText = doc.body.textContent ? doc.body.textContent.trim() : '';
            const imgs = doc.querySelectorAll('img');
            const images = [];
            imgs.forEach((img) => {
                if (img.src && img.src.startsWith('data:image')) {
                    try {
                        const base64Data = img.src.split(',')[1];
                        const extStr = img.src.split(';')[0].split('/')[1] || 'png';
                        const imageId = workbook.addImage({
                            base64: base64Data,
                            extension: extStr,
                        });
                        images.push({ id: imageId, ext: extStr });
                    }
                    catch (err) {
                        console.error("Failed to parse image for XLSX", err);
                    }
                }
            });
            const getColName = (n) => {
                let name = '';
                while (n > 0) {
                    let rem = (n - 1) % 26;
                    name = String.fromCharCode(65 + rem) + name;
                    n = Math.floor((n - 1) / 26);
                }
                return name;
            };
            const endColIndex = Math.max(1, activeColumns.length);
            const endCol = getColName(endColIndex);
            if (rawHeaderHtml) {
                worksheet.addRow([headerText]);
                worksheet.mergeCells('A1:' + endCol + '1');
                const titleCell = worksheet.getCell('A1');
                titleCell.font = { size: 16, bold: true };
                titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                if (images.length > 0) {
                    worksheet.getRow(1).height = 70;
                    worksheet.addImage(images[0].id, {
                        tl: { col: 0, row: 0 },
                        ext: { width: 100, height: 60 }
                    });
                    if (images.length > 1) {
                        worksheet.addImage(images[1].id, {
                            tl: { col: endColIndex - 1, row: 0 },
                            ext: { width: 100, height: 60 }
                        });
                    }
                }
                else {
                    worksheet.getRow(1).height = Math.max(40, headerText.length > 50 ? 60 : 40);
                }
                worksheet.addRow([]);
                worksheet.getRow(2).height = 10;
            }
            else {
            }
            const headerRow = worksheet.addRow(activeColumns.map(col => columnMap[col] || col));
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            instruments.forEach((inst, index) => {
                const rowData = [];
                activeColumns.forEach(col => {
                    if (col === 'sino')
                        rowData.push(index + 1);
                    else if (col === 'last_calibration_date' || col === 'due_date' || col === 'gauge_issue_date') {
                        const date = inst[col];
                        rowData.push(date instanceof Date ? date.toISOString().split('T')[0] : '-');
                    }
                    else if (col === 'created_by') {
                        rowData.push(inst.created_by?.name || inst.created_by?.id || '');
                    }
                    else {
                        rowData.push(inst[col] || '');
                    }
                });
                const row = worksheet.addRow(rowData);
                row.eachCell(cell => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            });
            worksheet.columns.forEach((column, i) => {
                let maxLength = 0;
                column.eachCell?.({ includeEmpty: true }, (cell, rowNumber) => {
                    if (rowNumber < 4)
                        return;
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
                column.width = maxLength < 10 ? 10 : maxLength + 2;
            });
            if (rawFooterHtml) {
                const domFooter = new JSDOM(rawFooterHtml);
                const docFooter = domFooter.window.document;
                const footerText = docFooter.body.textContent ? docFooter.body.textContent.trim() : '';
                const footerImgs = docFooter.querySelectorAll('img');
                const footerImages = [];
                footerImgs.forEach((img) => {
                    if (img.src && img.src.startsWith('data:image')) {
                        try {
                            const base64Data = img.src.split(',')[1];
                            const extStr = img.src.split(';')[0].split('/')[1] || 'png';
                            const imageId = workbook.addImage({
                                base64: base64Data,
                                extension: extStr,
                            });
                            footerImages.push({ id: imageId, ext: extStr });
                        }
                        catch (err) { }
                    }
                });
                worksheet.addRow([]);
                const footerRowNumber = worksheet.rowCount + 1;
                worksheet.addRow([footerText]);
                worksheet.mergeCells(`A${footerRowNumber}:${endCol}${footerRowNumber}`);
                const fCell = worksheet.getCell(`A${footerRowNumber}`);
                fCell.font = { size: 14, bold: true };
                fCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                if (footerImages.length > 0) {
                    worksheet.getRow(footerRowNumber).height = 70;
                    worksheet.addImage(footerImages[0].id, {
                        tl: { col: 0, row: footerRowNumber - 1 },
                        ext: { width: 100, height: 60 }
                    });
                    if (footerImages.length > 1) {
                        worksheet.addImage(footerImages[1].id, {
                            tl: { col: endColIndex - 1, row: footerRowNumber - 1 },
                            ext: { width: 100, height: 60 }
                        });
                    }
                }
                else {
                    worksheet.getRow(footerRowNumber).height = Math.max(30, footerText.length > 50 ? 50 : 30);
                }
            }
            const buffer = await workbook.xlsx.writeBuffer();
            return Buffer.from(buffer);
        }
        else if (format === 'html') {
            return await this.generateHtmlReport(instruments, selectedColumns, userid, templateId);
        }
        throw new Error('Unsupported format');
    }
    async generateHtmlReport(instruments, selectedColumns, userid, templateId) {
        const columnMap = {
            sino: 'S.No', id_code: 'ID Code', name: 'Name', location: 'Location',
            frequency: 'Frequency', last_calibration_date: 'Last Cal Date', due_date: 'Due Date',
            agency: 'Agency', range: 'Range', serial_no: 'Serial No', least_count: 'Least Count',
            status: 'Status', item_status: 'Item Status', notes: 'Notes', make: 'Make',
            item_type: 'Item Type', part_no: 'Part No', part_name: 'Part Name', module: 'Module',
            calibration_source: 'Calib Source', customer: 'Customer', sector: 'Sector',
            criticality_level: 'Criticality', cert_no: 'Cert No', remarks: 'Remarks',
            gauge_issue_date: 'Issue Date', gauges_received_by: 'Received By', gauges_issued_by: 'Issued By',
            calibration_procedure: 'Procedure', traceable: 'Traceable',
        };
        const activeColumns = selectedColumns || ['sino', 'id_code', 'name', 'location', 'due_date', 'status'];
        let rawHeaderHtml = '<h1 style="text-align: center;">Calibration Instruments Report</h1>';
        let rawFooterHtml = '';
        if (templateId) {
            const template = await this.reportTemplatesService.findOne(templateId);
            if (template) {
                rawHeaderHtml = template.headerText || '';
                rawFooterHtml = template.footerText || '';
            }
        }
        else {
            const userSettings = userid ? await this.settingsService.findOneByUserId(userid) : null;
            rawHeaderHtml = userSettings?.reportConfig?.headerText || '<h1 style="text-align: center;">Calibration Instruments Report</h1>';
            rawFooterHtml = userSettings?.reportConfig?.footerText || '';
        }
        const processHtmlForPrint = (html) => {
            if (!html)
                return html;
            const dom = new JSDOM(html);
            const doc = dom.window.document;
            doc.querySelectorAll('table').forEach((table) => {
                table.style.width = '100%';
                table.style.tableLayout = 'fixed';
                table.style.borderCollapse = 'collapse';
                const rows = table.querySelectorAll('tr');
                rows.forEach((row) => {
                    const cells = row.querySelectorAll('td, th');
                    if (cells.length === 3) {
                        cells[0].style.width = '20%';
                        cells[0].style.textAlign = cells[0].style.textAlign || 'center';
                        cells[1].style.width = '60%';
                        cells[1].style.textAlign = cells[1].style.textAlign || 'center';
                        cells[2].style.width = '20%';
                        cells[2].style.textAlign = cells[2].style.textAlign || 'center';
                    }
                    else if (cells.length === 2) {
                        cells[0].style.width = '50%';
                        cells[1].style.width = '50%';
                    }
                    cells.forEach((cell) => {
                        cell.style.verticalAlign = 'middle';
                        cell.style.padding = '5px';
                    });
                });
            });
            doc.querySelectorAll('img').forEach((img) => {
                img.removeAttribute('width');
                img.removeAttribute('height');
                img.style.width = '';
                img.style.height = '';
                img.style.maxWidth = '100%';
                img.style.maxHeight = '80px';
                img.style.objectFit = 'contain';
            });
            return doc.body.innerHTML;
        };
        const customHeaderHtml = processHtmlForPrint(rawHeaderHtml);
        const customFooterHtml = processHtmlForPrint(rawFooterHtml);
        let tableHtml = '<table class="data-table" style="width: 100%; border-collapse: collapse; margin-top: 0;">';
        tableHtml += '<thead>';
        tableHtml += `<tr><th colspan="${activeColumns.length}" style="border: none; padding-top: 10mm; padding-bottom: 10px; background: white;"><div class="header-container">${customHeaderHtml}</div></th></tr>`;
        tableHtml += '<tr>';
        activeColumns.forEach(col => {
            tableHtml += `<th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2; font-size: 12px; font-weight: bold;">${columnMap[col] || col}</th>`;
        });
        tableHtml += '</tr></thead>';
        tableHtml += '<tfoot>';
        tableHtml += `<tr><td colspan="${activeColumns.length}" style="border: none; padding-top: 10px; padding-bottom: 10mm; background: white;"><div class="footer-container">${customFooterHtml}</div></td></tr>`;
        tableHtml += '</tfoot>';
        tableHtml += '<tbody>';
        instruments.forEach((inst, i) => {
            tableHtml += '<tr>';
            activeColumns.forEach(col => {
                let text = '';
                if (col === 'sino')
                    text = (i + 1).toString();
                else if (col === 'last_calibration_date' || col === 'due_date' || col === 'gauge_issue_date') {
                    const date = inst[col];
                    text = date instanceof Date ? date.toISOString().split('T')[0] : '-';
                }
                else if (col === 'created_by') {
                    text = inst.created_by?.name || inst.created_by?.id || '-';
                }
                else {
                    text = inst[col] || '-';
                }
                let style = 'border: 1px solid #ddd; padding: 8px; font-size: 12px;';
                if (['due_date', 'last_calibration_date', 'gauge_issue_date', 'id_code'].includes(col)) {
                    style += ' white-space: nowrap;';
                }
                tableHtml += `<td style="${style}">${text}</td>`;
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Calibration Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }

                    .header-container { width: 100%; margin-bottom: 20px; }
                    .header-container table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse; }
                    .header-container td { vertical-align: middle; padding: 5px; }
                    .header-container img { max-width: 100%; max-height: 80px; height: auto; object-fit: contain; display: block; margin: 0 auto; }
                    
                    .footer-container { width: 100%; margin-top: 40px; }
                    .footer-container table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse; }
                    .footer-container td { vertical-align: middle; padding: 5px; }
                    .footer-container img { max-width: 100%; max-height: 80px; height: auto; object-fit: contain; display: block; margin: 0 auto; }
                    
                    .data-table { width: 100%; }

                    @media print {
                        @page { margin: 0; }
                        body { padding: 0 10mm; margin: 0; }
                        .data-table { font-size: 11px; }
                        .header-container img { max-height: 70px !important; }
                    }
                </style>
            </head>
            <body>
                ${tableHtml}
            </body>
            </html>
        `;
        return Buffer.from(fullHtml);
    }
    async getReportData(from, to, userid, page = 1, pageSize = 10, filters = {}) {
        const where = {
            due_date: (0, typeorm_2.Between)(new Date(from), new Date(to)),
            created_by: { id: userid },
        };
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                const val = filters[key];
                if (key === 'name' || key === 'id_code' || key === 'location' || key === 'agency' || key === 'status') {
                    const { ILike } = require('typeorm');
                    where[key] = ILike(`%${val}%`);
                }
            }
        });
        const [items, total] = await this.instrumentRepository.findAndCount({
            where,
            relations: ['created_by'],
            order: {
                due_date: 'ASC',
            },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        return { items, total };
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(instrument_entity_1.Instrument)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        settings_service_1.SettingsService,
        report_templates_service_1.ReportTemplatesService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map