import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Instrument } from 'src/instruments/instrument.entity';
import { Between, Repository } from 'typeorm';
import { stringify } from 'csv-stringify/sync';
import PdfPrinter from 'pdfmake';


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
    ) { }

    private async generatePdfReport(instruments: Instrument[]): Promise<Buffer> {
        const body = [
            [
                { text: 'S.No', style: 'tableHeader' },
                { text: 'ID Code', style: 'tableHeader' },
                { text: 'Name', style: 'tableHeader' },
                { text: 'Location', style: 'tableHeader' },
                { text: 'Frequency', style: 'tableHeader' },
                { text: 'Last Cal Date', style: 'tableHeader' },
                { text: 'Due Date', style: 'tableHeader' },
                { text: 'Agency', style: 'tableHeader' },
                { text: 'Range', style: 'tableHeader' },
                { text: 'Serial No', style: 'tableHeader' },
                { text: 'Least Count', style: 'tableHeader' },
                { text: 'Status', style: 'tableHeader' },
                { text: 'Created By', style: 'tableHeader' },
            ],
        ];

        instruments.forEach((inst, i) => {
            body.push([
                { text: (i + 1).toString(), style: 'tableData' },
                { text: inst.id_code || '', style: 'tableData' },
                { text: inst.name || '', style: 'tableData' },
                { text: inst.location || '', style: 'tableData' },
                { text: inst.frequency || '', style: 'tableData' },
                { text: inst.last_calibration_date.toISOString().split('T')[0], style: 'tableData' },
                { text: inst.due_date.toISOString().split('T')[0], style: 'tableData' },
                { text: inst.agency || '', style: 'tableData' },
                { text: inst.range || '', style: 'tableData' },
                { text: inst.serial_no || '', style: 'tableData' },
                { text: inst.least_count || '', style: 'tableData' },
                { text: inst.status || '', style: 'tableData' },
                { text: inst.created_by?.name || inst.created_by?.id || '-', style: 'tableData' },
            ]);
        });


        const docDefinition = {
            pageSize: 'A3',
            pageMargins: [40, 60, 40, 60],
            content: [
                { text: 'Calibration Instruments Report', style: 'header', margin: [0, 0, 0, 20] },
                {
                    style: 'tableExample',
                    table: {
                        headerRows: 1,
                        widths: [30, 50, 70, 50, 50, 50, 50, 50, 40, 50, 50, 40, 70],
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
                    fontSize: 9,
                },
                tableHeader: {
                    bold: true,
                    fontSize: 10,
                    color: 'black',
                    fillColor: '#CCCCCC',
                },
            },
            defaultStyle: {
                font: 'Roboto',
            },
        };

        const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        return new Promise((resolve, reject) => {
            pdfDoc.on('data', (chunk: any) => chunks.push(chunk));
            pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
            pdfDoc.end();
        });
    }

    async generateReport(
        from: string,
        to: string,
        format: string,
        userid: string,
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

        if (format === 'csv') {
            const records = instruments.map((inst, index) => ({
                sr_no: index + 1,
                id_code: inst.id_code,
                name: inst.name,
                location: inst.location,
                frequency: inst.frequency,
                last_calibration_date: inst.last_calibration_date.toISOString().split('T')[0],
                due_date: inst.due_date.toISOString().split('T')[0],
                agency: inst.agency,
                range: inst.range,
                serial_no: inst.serial_no,
                least_count: inst.least_count,
                notes: inst.notes || '',
                status: inst.status,
                created_at: inst.created_at.toISOString(),
                updated_at: inst.updated_at.toISOString(),
                created_by: inst.created_by?.name || inst.created_by?.id || '',
            }));

            const csv = stringify(records, {
                header: true,
                columns: {
                    sr_no: 'S.No',
                    id_code: 'ID Code',
                    name: 'Name',
                    location: 'Location',
                    frequency: 'Frequency',
                    last_calibration_date: 'Last Calibration Date',
                    due_date: 'Due Date',
                    agency: 'Agency',
                    range: 'Range',
                    serial_no: 'Serial Number',
                    least_count: 'Least Count',
                    notes: 'Notes',
                    status: 'Status',
                    created_at: 'Created At',
                    updated_at: 'Updated At',
                    created_by: 'Created By',
                },
            });

            return Buffer.from(csv);
        } else if (format === 'pdf') {
            return await this.generatePdfReport(instruments);
        }

        throw new Error('Unsupported format');
    }
}
