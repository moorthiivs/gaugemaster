import { useState } from "react";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, DownloadCloudIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import api from "@/lib/apis";
import { useAuth } from "@/lib/auth";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import TooltipProv from "./TooltipProv";

interface ExcelUploadProps {
  endpoint: string;
  mapRow: (row: Record<string, any>) => Record<string, any>;
  onComplete?: () => void;
  rejectedFile: Blob | null;
  setRejectedFile: React.Dispatch<React.SetStateAction<Blob | null>>;
}



export const downloadTemplate = async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Template");

  const headers = [
    "S.No",
    "NAME OF INSTRUMENT",
    "ID CODE",
    "RANGE",
    "SERIAL NO",
    "LEAST COUNT",
    "LOCATION",
    "CALIBRATION FREQUENCY",
    "LAST CALIBRATION DATE",
    "DUE DATE",
    "CALIBRATION AGENCY AND TC No",
    "STATUS",
  ];

  const sampleRow = [
    "001",
    "Vernier Caliper",
    "VC-001",
    "0-150mm",
    "SN123456",
    "0.02mm",
    "Lab 1",
    "6 Months",
    "2024-01-10",
    "2024-07-10",
    "ABC Labs - TC123",
    "Active",
  ];

  // Add headers and sample
  ws.addRow(headers);
  ws.addRow(sampleRow);

  // Style headers
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  // ID CODE uniqueness validation
  ws.getColumn(2).eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "custom",
        formulae: [`COUNTIF($B:$B,B${rowNumber})=1`],
        showErrorMessage: true,
        errorStyle: 'stop', // Force rejection
        errorTitle: "Duplicate ID CODE",
        error: "Each ID CODE must be unique.",
        allowBlank: true,

      };
    }
  });

  // Date validation for LAST CALIBRATION DATE & DUE DATE
  [8, 9].forEach((colIndex) => {
    ws.getColumn(colIndex).eachCell((cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.dataValidation = {
          type: "date",
          operator: "between",
          formulae: [
            new Date(2000, 0, 1),
            new Date(2100, 11, 31)
          ],
          showErrorMessage: true,
          errorStyle: 'stop', // Reject invalid date
          errorTitle: "Invalid Date",
          error: "Please enter a valid date (YYYY-MM-DD).",
          allowBlank: true,
        };

      }
    });
  });

  // Export file
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), "Calibration_Template.xlsx");
};


export const exportRejectedToExcel = async (rejected: any[]) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Rejected Rows");

  worksheet.columns = [
    { header: "Row", key: "row", width: 10 },
    { header: "S.No", key: "sino", width: 15 },
    { header: "NAME OF INSTRUMENT", key: "name", width: 20 },
    { header: "ID CODE", key: "id_code", width: 15 },
    { header: "RANGE", key: "range", width: 20 },
    { header: "SERIAL NO", key: "serial_no", width: 20 },
    { header: "LEAST COUNT", key: "least_count", width: 20 },
    { header: "LOCATION", key: "location", width: 20 },
    { header: "CALIBRATION FREQUENCY", key: "frequency", width: 20 },
    { header: "LAST CALIBRATION DATE", key: "last_calibration_date", width: 20 },
    { header: "DUE DATE", key: "due_date", width: 20 },
    { header: "CALIBRATION AGENCY AND TC No", key: "agency", width: 20 },
    { header: "STATUS", key: "status", width: 20 },
    { header: "Error", key: "error", width: 40 },

  ];

  worksheet.addRows(
    rejected.map((r, index) => ({ row: index + 1, ...r }))
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}


export default function ExcelUpload({ endpoint, mapRow, onComplete, rejectedFile, setRejectedFile }: ExcelUploadProps) {
  const { user } = useAuth();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  // Required columns for validation
  const requiredColumns = [
    "S.No",
    "NAME OF INSTRUMENT",
    "ID CODE",
    "RANGE",
    "SERIAL NO",
    "LEAST COUNT",
    "LOCATION",
    "CALIBRATION FREQUENCY",
    "LAST CALIBRATION DATE",
    "DUE DATE",
    "CALIBRATION AGENCY AND TC No",
    "STATUS",
  ];

  const excelDateToISO = (excelDate: any) => {
    if (!excelDate) return null;
    if (typeof excelDate === "number") {
      const dateObj = XLSX.SSF.parse_date_code(excelDate);
      if (!dateObj) return null;
      return new Date(
        dateObj.y,
        dateObj.m - 1,
        dateObj.d
      ).toISOString();
    }
    const parsed = new Date(excelDate);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  const handleFile = (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const failedRows: { row: number; data: any; error: string }[] = [];
      let successCount = 0;
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

        // Validate column headers
        const headers = Object.keys(rows[0] || {});
        const missing = requiredColumns.filter((col) => !headers.includes(col));
        if (missing.length > 0) {
          toast({
            title: "Invalid template",
            description: `Missing required columns: ${missing.join(", ")}`,
            variant: "destructive",
          });
          setIsUploading(false);
          return;
        }

        for (let i = 0; i < rows.length; i++) {
          const raw = rows[i];
          const payload = {
            ...mapRow({
              ...raw,
              "LAST CALIBRATION DATE": excelDateToISO(raw["LAST CALIBRATION DATE"]),
              "DUE DATE": excelDateToISO(raw["DUE DATE"]),
            }),
            created_by: user.id,
            updated_by: user.id,
            companyId: user.companyId,
          };


          const res = await api.post(endpoint, payload);
          const { successCount: s, failedCount, rejected } = res.data;

          successCount = s

          if (failedCount > 0) {
            toast({
              title: "Upload Partial ⚠️",
              description: `${successCount} success, ${failedCount} failed`,
              variant: "destructive",
            });

            const buffer = await exportRejectedToExcel(rejected);
            const blob = new Blob([buffer]);
            setRejectedFile(blob);
            saveAs(blob, "Rejected_Rows.xlsx");
          } else {
            toast({
              title: "Upload Success",
              description: `${successCount} records uploaded.`,
            });
          }

          setUploadProgress(Math.round(((i + 1) / rows.length) * 100));
        }
      }

      catch (err) {
        console.error(err);
        toast({
          title: "Error",
          description: "Failed to read Excel file",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };


  return (
    <Card className="w-full max-w-md border-dashed border-2 border-muted-foreground/40 hover:border-primary transition-colors">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-primary">
          <Upload size={20} /> Upload Excel File
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">

        <div className="w-full mt-3">
          <label className="cursor-pointer flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-muted/50 transition-colors border-dashed border-2 border-muted-foreground/40">
            <FileSpreadsheet size={40} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Click to select or drag & drop</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </div>


        {fileName && (
          <p className="text-sm font-medium text-center truncate max-w-full">{fileName}</p>
        )}

        {isUploading && (
          <div className="w-full space-y-1">
            <Progress value={uploadProgress} />
            <p className="text-xs text-muted-foreground text-center">{uploadProgress}%</p>
          </div>
        )}

        {!isUploading && fileName && (
          <Button variant="secondary" size="sm" onClick={() => setFileName("")}>
            Clear
          </Button>
        )}



        <div className="mt-10 flex gap-4">

          {/* Download Template */}
          <TooltipProv content="Download Sample Excel File">
            <Button variant="hero" size="sm" onClick={downloadTemplate}>
              <DownloadCloudIcon size={40} className="text-muted-foreground" />
              Template
            </Button>
          </TooltipProv>

          {/* Show only if rejectedFile exists */}
          {rejectedFile && (
            <TooltipProv content="Download Last Rejected File">
              <Button
                variant="hero"
                size="sm"
                onClick={() => saveAs(rejectedFile, "Rejected_Rows_Last.xlsx")}
              >
                <DownloadCloudIcon size={40} className="text-muted-foreground" />
                Rejected File
              </Button>
            </TooltipProv>
          )}
        </div>


      </CardContent>
    </Card >
  );
}
