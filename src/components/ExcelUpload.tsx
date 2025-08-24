import { useState } from "react";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import api from "@/lib/apis";
import { useAuth } from "@/lib/auth";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface ExcelUploadProps {
  endpoint: string;
  mapRow: (row: Record<string, any>) => Record<string, any>;
  onComplete?: () => void;
}



export const downloadTemplate = async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Template");

  const headers = [
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


export default function ExcelUpload({ endpoint, mapRow, onComplete }: ExcelUploadProps) {
  const { user } = useAuth();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  // Required columns for validation
  const requiredColumns = [
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
          };
          try {
            await api.post(endpoint, payload);
          } catch (err) {
            console.error(`Row ${i + 1} failed`, err);
          }
          setUploadProgress(Math.round(((i + 1) / rows.length) * 100));
        }

        toast({ title: "Upload complete", description: `${rows.length} records uploaded.` });
        onComplete?.();
      } catch (err) {
        console.error(err);
        toast({ title: "Error", description: "Failed to read Excel file", variant: "destructive" });
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
        <label className="cursor-pointer flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-muted/50 transition-colors">
          <FileSpreadsheet size={36} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Click to select or drag & drop</span>
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>

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

        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          Download Sample Template
        </Button>
      </CardContent>
    </Card>
  );
}
