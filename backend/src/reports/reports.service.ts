import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Instrument } from 'src/instruments/instrument.entity';
import { Between, Repository } from 'typeorm';
import { stringify } from 'csv-stringify/sync';
import PdfPrinter from 'pdfmake';
import * as ExcelJS from 'exceljs';


import { SettingsService } from '../settings/settings.service';
import { ReportTemplatesService } from '../report-templates/report-templates.service';
const { JSDOM } = require('jsdom');
const fonts = {
    Roboto: {
        normal: 'src/fonts/Roboto-Regular.ttf',
        bold: 'src/fonts/Roboto-Medium.ttf',
        italics: 'src/fonts/Roboto-Italic.ttf',
        bolditalics: 'src/fonts/Roboto-MediumItalic.ttf',
    },
};


@Injectable()
export class ReportsService {
    private printer = new PdfPrinter(fonts);

    constructor(
        @InjectRepository(Instrument)
        private readonly instrumentRepository: Repository<Instrument>,
        private readonly settingsService: SettingsService,
        private readonly reportTemplatesService: ReportTemplatesService,
    ) { }

    private async generatePdfReport(
        instruments: Instrument[],
        selectedColumns?: string[],
        userid?: string,
        templateId?: string
    ): Promise<Buffer> {
        const columnMap: Record<string, string> = {
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
                if (col === 'sino') text = (i + 1).toString();
                else if (col === 'last_calibration_date' || col === 'due_date' || col === 'gauge_issue_date') {
                    const date = inst[col as keyof Instrument];
                    text = date instanceof Date ? date.toISOString().split('T')[0] : '-';
                } else if (col === 'created_by') {
                    text = inst.created_by?.name || inst.created_by?.id || '-';
                } else {
                    text = (inst[col as keyof Instrument] as string) || '-';
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
        } else {
            const userSettings = userid ? await this.settingsService.findOneByUserId(userid) : null;
            console.log("PDF Generation - Fetched userSettings for userid:", userid, userSettings);
            customHeaderHtml = userSettings?.reportConfig?.headerText || '<h1>Calibration Instruments Report</h1>';
            customFooterHtml = userSettings?.reportConfig?.footerText || '';
        }
        console.log("PDF Generation - customHeaderHtml:", customHeaderHtml);

        // Dynamically import html-to-pdfmake and jsdom to convert React Quill HTML
        const htmlToPdfmake = require('html-to-pdfmake');
        const { JSDOM } = require('jsdom');

        const domHeader = new JSDOM(customHeaderHtml);
        const docHeader = domHeader.window.document;
        // Cap all images to max 120px width for PDF - Jodit images often have large widths
        docHeader.querySelectorAll('img').forEach((img: any) => {
            const currentWidth = parseInt(img.getAttribute('width') || '0', 10);
            if (!currentWidth || currentWidth > 120) {
                img.setAttribute('width', '120');
            }
            // Remove height to maintain aspect ratio
            img.removeAttribute('height');
        });
        docHeader.querySelectorAll('table').forEach((table: any) => {
            table.setAttribute('width', '100%');
            table.style.width = '100%';
            // Ensure all TDs have proper width distribution for the header layout
            const rows = table.querySelectorAll('tr');
            rows.forEach((row: any) => {
                const cells = row.querySelectorAll('td, th');
                if (cells.length === 3) {
                    // Typical header layout: [logo] [title] [logo]
                    cells[0].style.width = '20%';
                    cells[1].style.width = '60%';
                    cells[1].style.textAlign = cells[1].style.textAlign || 'center';
                    cells[2].style.width = '20%';
                } else if (cells.length === 2) {
                    cells[0].style.width = '50%';
                    cells[1].style.width = '50%';
                }
            });
        });
        const safeHeaderHtml = docHeader.body.innerHTML;

        const domFooter = new JSDOM(customFooterHtml);
        const docFooter = domFooter.window.document;
        docFooter.querySelectorAll('img').forEach((img: any) => {
            const currentWidth = parseInt(img.getAttribute('width') || '0', 10);
            if (!currentWidth || currentWidth > 120) {
                img.setAttribute('width', '120');
            }
            img.removeAttribute('height');
        });
        docFooter.querySelectorAll('table').forEach((table: any) => {
            table.setAttribute('width', '100%');
            table.style.width = '100%';
            const rows = table.querySelectorAll('tr');
            rows.forEach((row: any) => {
                const cells = row.querySelectorAll('td, th');
                if (cells.length === 3) {
                    cells[0].style.width = '20%';
                    cells[1].style.width = '60%';
                    cells[1].style.textAlign = cells[1].style.textAlign || 'center';
                    cells[2].style.width = '20%';
                } else if (cells.length === 2) {
                    cells[0].style.width = '50%';
                    cells[1].style.width = '50%';
                }
            });
        });
        const safeFooterHtml = docFooter.body.innerHTML;

        const path = require('path');
        const resolveImagePath = (src: string) => {
            if (!src) return src;
            if (src.startsWith('data:')) return src; // Base64 is fine
            if (src.startsWith('http://') || src.startsWith('https://')) return src;
            // Remove leading slash if any
            const relativePath = src.startsWith('/') ? src.slice(1) : src;
            return path.join(process.cwd(), relativePath);
        };

        // Post-process: fix table widths, resolve image paths and constrain image sizes in pdfmake nodes
        const fixPdfmakeContent = (nodes: any[]) => {
            if (!Array.isArray(nodes)) return;
            nodes.forEach(node => {
                if (!node) return;
                // Fix table column widths
                if (node.table) {
                    const colCount = node.table.body?.[0]?.length || 0;
                    if (colCount === 3) {
                        // [logo 130pt] [title fill] [logo 130pt] - fixed widths for logos
                        node.table.widths = [130, '*', 130];
                    } else if (colCount === 2) {
                        node.table.widths = ['*', '*'];
                    } else {
                        node.table.widths = Array(colCount).fill('*');
                    }
                    // Remove borders from header/footer tables
                    node.layout = 'noBorders';
                    // Recurse into table cells
                    if (node.table.body) {
                        node.table.body.forEach((row: any[]) => {
                            if (Array.isArray(row)) {
                                row.forEach((cell: any) => {
                                    if (Array.isArray(cell)) fixPdfmakeContent(cell);
                                    else if (cell && cell.stack) fixPdfmakeContent(cell.stack);
                                    else if (cell && typeof cell === 'object') fixPdfmakeContent([cell]);
                                });
                            }
                        });
                    }
                }
                // Constrain image sizes - cap at 120pt width and resolve image path
                if (node.image) {
                    node.image = resolveImagePath(node.image);
                    if (!node.width || node.width > 120) {
                        node.width = 120;
                    }
                    delete node.height; // let it auto-scale with aspect ratio
                }
                // Recurse into stacks/columns
                if (node.stack) fixPdfmakeContent(node.stack);
                if (node.columns) fixPdfmakeContent(node.columns);
            });
        };

        const docDefinition = {
            pageSize: activeColumns.length > 8 ? 'A3' : 'A4',
            pageOrientation: activeColumns.length > 5 ? 'landscape' : 'portrait',
            pageMargins: [20, 100, 20, 80],
            header: function (currentPage: number, pageCount: number, pageSize: any) {
                const headerResult = htmlToPdfmake(safeHeaderHtml, { window: domHeader.window });
                const headerParsed = headerResult.content || headerResult;
                const headerStack = Array.isArray(headerParsed) ? headerParsed : [headerParsed];
                fixPdfmakeContent(headerStack);
                return {
                    margin: [20, 20, 20, 0],
                    stack: headerStack
                };
            },
            footer: function (currentPage: number, pageCount: number) {
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
                        fillColor: (rowIndex: number) =>
                            rowIndex === 0 ? '#CCCCCC' : rowIndex % 2 === 0 ? '#F9F9F9' : null,
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

        const pdfDoc = this.printer.createPdfKitDocument(docDefinition as any);
        const chunks: Buffer[] = [];

        return new Promise((resolve, reject) => {
            pdfDoc.on('data', (chunk: any) => chunks.push(chunk));
            pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
            pdfDoc.on('error', (err: any) => reject(err));
            pdfDoc.end();
        });
    }

    async generateReport(
        from: string,
        to: string,
        format: string,
        userid: string,
        columnsStr?: string,
        templateId?: string
    ): Promise<Buffer> {
        const instruments = await this.instrumentRepository.find({
            where: {
                due_date: Between(new Date(from), new Date(to)),
                created_by: { id: userid },
            },
            relations: ['created_by'],
            order: {
                due_date: 'ASC',
            },
        });

        const selectedColumns = columnsStr ? columnsStr.split(',') : undefined;

        if (format === 'xlsx') {
            const columnMap: Record<string, string> = {
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

            // Header & Footer Template Extraction
            let rawHeaderHtml = '';
            let rawFooterHtml = '';
            if (templateId && templateId !== 'default' && templateId !== 'undefined') {
                const template = await this.reportTemplatesService.findOne(templateId);
                if (template) {
                    rawHeaderHtml = template.headerText || '';
                    rawFooterHtml = template.footerText || '';
                }
            } else {
                const userSettings = userid ? await this.settingsService.findOneByUserId(userid) : null;
                if (userSettings?.reportConfig) {
                    rawHeaderHtml = userSettings.reportConfig.headerText || '';
                    rawFooterHtml = userSettings.reportConfig.footerText || '';
                }
            }

            const dom = new JSDOM(rawHeaderHtml);
            const doc = dom.window.document;
            
            // Extract text from header
            let headerText = doc.body.textContent ? doc.body.textContent.trim() : '';

            // Extract all logos
            const imgs = doc.querySelectorAll('img');
            const images: { id: number, ext: string }[] = [];
            
            imgs.forEach((img: any) => {
                if (img.src && img.src.startsWith('data:image')) {
                    try {
                        const base64Data = img.src.split(',')[1];
                        const extStr = img.src.split(';')[0].split('/')[1] || 'png';
                        const imageId = workbook.addImage({
                            base64: base64Data,
                            extension: extStr as 'jpeg' | 'png' | 'gif',
                        });
                        images.push({ id: imageId, ext: extStr });
                    } catch (err) {
                        console.error("Failed to parse image for XLSX", err);
                    }
                }
            });

            // Helper for Excel column names (e.g. 1 -> A, 27 -> AA)
            const getColName = (n: number) => {
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
                // Title Row
                worksheet.addRow([headerText]);
                worksheet.mergeCells('A1:' + endCol + '1');
                const titleCell = worksheet.getCell('A1');
                titleCell.font = { size: 16, bold: true };
                titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                
                if (images.length > 0) {
                    worksheet.getRow(1).height = 70;
                    
                    // First image top left
                    worksheet.addImage(images[0].id, {
                        tl: { col: 0, row: 0 },
                        ext: { width: 100, height: 60 }
                    });
                    
                    // Second image top right (if exists)
                    if (images.length > 1) {
                        worksheet.addImage(images[1].id, {
                            tl: { col: endColIndex - 1, row: 0 }, // -1 because tl.col is 0-indexed
                            ext: { width: 100, height: 60 }
                        });
                    }
                } else {
                    worksheet.getRow(1).height = Math.max(40, headerText.length > 50 ? 60 : 40);
                }
                
                worksheet.addRow([]); // Spacer
                worksheet.getRow(2).height = 10;
            } else {
                // If no header template at all, just skip adding empty rows at the top
                // Add a small spacer if needed, or nothing.
            }

            // Headers
            const headerRow = worksheet.addRow(activeColumns.map(col => columnMap[col] || col));
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });

            // Data
            instruments.forEach((inst, index) => {
                const rowData: any[] = [];
                activeColumns.forEach(col => {
                    if (col === 'sino') rowData.push(index + 1);
                    else if (col === 'last_calibration_date' || col === 'due_date' || col === 'gauge_issue_date') {
                        const date = inst[col as keyof Instrument];
                        rowData.push(date instanceof Date ? date.toISOString().split('T')[0] : '-');
                    } else if (col === 'created_by') {
                        rowData.push(inst.created_by?.name || inst.created_by?.id || '');
                    } else {
                        rowData.push(inst[col as keyof Instrument] || '');
                    }
                });
                const row = worksheet.addRow(rowData);
                row.eachCell(cell => {
                    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                });
            });

            // Auto-fit columns
            worksheet.columns.forEach((column, i) => {
                let maxLength = 0;
                column.eachCell?.({ includeEmpty: true }, (cell, rowNumber) => {
                    if (rowNumber < 4) return;
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
                column.width = maxLength < 10 ? 10 : maxLength + 2;
            });

            // Render Footer
            if (rawFooterHtml) {
                const domFooter = new JSDOM(rawFooterHtml);
                const docFooter = domFooter.window.document;
                const footerText = docFooter.body.textContent ? docFooter.body.textContent.trim() : '';

                const footerImgs = docFooter.querySelectorAll('img');
                const footerImages: { id: number, ext: string }[] = [];
                
                footerImgs.forEach((img: any) => {
                    if (img.src && img.src.startsWith('data:image')) {
                        try {
                            const base64Data = img.src.split(',')[1];
                            const extStr = img.src.split(';')[0].split('/')[1] || 'png';
                            const imageId = workbook.addImage({
                                base64: base64Data,
                                extension: extStr as 'jpeg' | 'png' | 'gif',
                            });
                            footerImages.push({ id: imageId, ext: extStr });
                        } catch (err) { }
                    }
                });

                worksheet.addRow([]); // Spacer
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
                } else {
                    worksheet.getRow(footerRowNumber).height = Math.max(30, footerText.length > 50 ? 50 : 30);
                }
            }

            const buffer = await workbook.xlsx.writeBuffer();
            return Buffer.from(buffer as ArrayBuffer);
        } else if (format === 'html') {
            return await this.generateHtmlReport(instruments, selectedColumns, userid, templateId);
        }

        throw new Error('Unsupported format');
    }

    private async generateHtmlReport(
        instruments: Instrument[],
        selectedColumns?: string[],
        userid?: string,
        templateId?: string
    ): Promise<Buffer> {
        const columnMap: Record<string, string> = {
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
        } else {
            const userSettings = userid ? await this.settingsService.findOneByUserId(userid) : null;
            rawHeaderHtml = userSettings?.reportConfig?.headerText || '<h1 style="text-align: center;">Calibration Instruments Report</h1>';
            rawFooterHtml = userSettings?.reportConfig?.footerText || '';
        }

        // Process header/footer HTML through JSDOM to fix table layout
        

        const processHtmlForPrint = (html: string): string => {
            if (!html) return html;
            const dom = new JSDOM(html);
            const doc = dom.window.document;
            // Ensure tables span full width with fixed layout for equal columns
            doc.querySelectorAll('table').forEach((table: any) => {
                table.style.width = '100%';
                table.style.tableLayout = 'fixed';
                table.style.borderCollapse = 'collapse';
                const rows = table.querySelectorAll('tr');
                rows.forEach((row: any) => {
                    const cells = row.querySelectorAll('td, th');
                    if (cells.length === 3) {
                        cells[0].style.width = '20%';
                        cells[0].style.textAlign = cells[0].style.textAlign || 'center';
                        cells[1].style.width = '60%';
                        cells[1].style.textAlign = cells[1].style.textAlign || 'center';
                        cells[2].style.width = '20%';
                        cells[2].style.textAlign = cells[2].style.textAlign || 'center';
                    } else if (cells.length === 2) {
                        cells[0].style.width = '50%';
                        cells[1].style.width = '50%';
                    }
                    // Ensure all cells have vertical-align
                    cells.forEach((cell: any) => {
                        cell.style.verticalAlign = 'middle';
                        cell.style.padding = '5px';
                    });
                });
            });
            // Strip explicit width/height from images so they scale within their cell
            doc.querySelectorAll('img').forEach((img: any) => {
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
                if (col === 'sino') text = (i + 1).toString();
                else if (col === 'last_calibration_date' || col === 'due_date' || col === 'gauge_issue_date') {
                    const date = inst[col as keyof Instrument];
                    text = date instanceof Date ? date.toISOString().split('T')[0] : '-';
                } else if (col === 'created_by') {
                    text = inst.created_by?.name || inst.created_by?.id || '-';
                } else {
                    text = (inst[col as keyof Instrument] as string) || '-';
                }
                let style = 'border: 1px solid #ddd; padding: 8px; font-size: 12px;';
                // Prevent wrapping for dates and ID codes
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

    async getReportData(
        from: string,
        to: string,
        userid: string,
        page: number = 1,
        pageSize: number = 10,
        filters: Record<string, string | undefined> = {}
    ): Promise<{ items: Instrument[], total: number }> {
        const where: any = {
            due_date: Between(new Date(from), new Date(to)),
            created_by: { id: userid },
        };

        // Apply dynamic filters
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
}
