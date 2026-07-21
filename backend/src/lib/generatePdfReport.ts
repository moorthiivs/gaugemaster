import * as PdfPrinter from 'pdfmake';

const fonts = {
    Roboto: {
        normal: 'node_modules/pdfmake/fonts/Roboto-Regular.ttf',
        bold: 'node_modules/pdfmake/fonts/Roboto-Medium.ttf',
        italics: 'node_modules/pdfmake/fonts/Roboto-Italic.ttf',
        bolditalics: 'node_modules/pdfmake/fonts/Roboto-MediumItalic.ttf'
    }
};

const printer = new PdfPrinter(fonts);

async function generatePdfReport(instruments: any) {
    // Prepare table body with headers
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
        ]
    ];

    // Fill rows
    instruments.forEach((inst, i) => {
        body.push([
            i + 1,
            inst.id_code,
            inst.name,
            inst.location,
            inst.frequency,
            inst.last_calibration_date.toISOString().split('T')[0],
            inst.due_date.toISOString().split('T')[0],
            inst.agency,
            inst.range,
            inst.serial_no,
            inst.least_count,
            inst.status,
            inst.created_by?.name || inst.created_by?.id || '-',
        ]);
    });

    // Document definition
    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        content: [
            { text: 'Calibration Instruments Report', style: 'header', margin: [0, 0, 0, 20] },
            {
                style: 'tableExample',
                table: {
                    headerRows: 1,
                    widths: [30, 50, 70, 50, 50, 50, 50, 50, 40, 50, 50, 40, 70],
                    body: body
                },
                layout: {
                    fillColor: (rowIndex: number) => (rowIndex === 0 ? '#CCCCCC' : (rowIndex % 2 === 0 ? '#F9F9F9' : null))
                }
            }
        ],
        styles: {
            header: {
                fontSize: 18,
                bold: true,
                alignment: 'center'
            },
            tableExample: {
                margin: [0, 5, 0, 15],
                fontSize: 9
            },
            tableHeader: {
                bold: true,
                fontSize: 10,
                color: 'black',
                fillColor: '#CCCCCC'
            }
        },
        defaultStyle: {
            font: 'Roboto'
        }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
        pdfDoc.on('data', chunk => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.end();
    });
}
