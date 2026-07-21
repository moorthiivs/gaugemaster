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
Object.defineProperty(exports, "__esModule", { value: true });
const PdfPrinter = __importStar(require("pdfmake"));
const fonts = {
    Roboto: {
        normal: 'node_modules/pdfmake/fonts/Roboto-Regular.ttf',
        bold: 'node_modules/pdfmake/fonts/Roboto-Medium.ttf',
        italics: 'node_modules/pdfmake/fonts/Roboto-Italic.ttf',
        bolditalics: 'node_modules/pdfmake/fonts/Roboto-MediumItalic.ttf'
    }
};
const printer = new PdfPrinter(fonts);
async function generatePdfReport(instruments) {
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
                    fillColor: (rowIndex) => (rowIndex === 0 ? '#CCCCCC' : (rowIndex % 2 === 0 ? '#F9F9F9' : null))
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
    const chunks = [];
    return new Promise((resolve, reject) => {
        pdfDoc.on('data', chunk => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.end();
    });
}
//# sourceMappingURL=generatePdfReport.js.map