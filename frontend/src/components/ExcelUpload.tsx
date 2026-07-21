import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, DownloadCloudIcon, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import httpClient from "@/lib/httpClient";
import { useAuth } from "@/lib/auth";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import TooltipProv from "./TooltipProv";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExcelUploadProps {
  endpoint: string;
  mapRow: (row: Record<string, any>) => Record<string, any>;
  onComplete?: () => void;
  onRefresh?: () => void;
  rejectedFile: Blob | null;
  setRejectedFile: React.Dispatch<React.SetStateAction<Blob | null>>;
}

type Step = "upload" | "preview" | "result";

interface ParsedRow {
  rowIndex: number;
  raw: Record<string, any>;
  mapped: Record<string, any>;
  errors: string[];
  isValid: boolean;
}

interface UploadResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  failedRows: { row: number; error: string }[];
}

const REQUIRED_COLUMNS = [
  "S.No", "NAME OF INSTRUMENT", "ID CODE", "RANGE", "SERIAL NO",
  "LEAST COUNT", "LOCATION", "CALIBRATION FREQUENCY",
  "LAST CALIBRATION DATE", "DUE DATE", "CALIBRATION AGENCY AND TC No", "STATUS",
  // Alternative names from Master List
  "P.Sl.No", "Description", "IMTE", "Items Sl.No / Model", "Least Count", "Item Location", 
  "CALIB. FREQUENCY in month", "Last Cal. Date", "Next Cal. Date", "Calibration Status"
];

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: "upload", label: "Upload File", icon: <Upload size={16} /> },
  { key: "preview", label: "Preview & Validate", icon: <CheckCircle2 size={16} /> },
  { key: "result", label: "Result", icon: <FileSpreadsheet size={16} /> },
];

export const downloadTemplate = async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Template");
  const headers = [
    "S.No", "NAME OF INSTRUMENT", "ID CODE", "RANGE", "SERIAL NO",
    "LEAST COUNT", "LOCATION", "CALIBRATION FREQUENCY",
    "LAST CALIBRATION DATE", "DUE DATE", "CALIBRATION AGENCY AND TC No", "STATUS", "ITEM STATUS",
    "Item Make", "Item Type", "PART NO", "Part Name", "Module",
    "Calibration Source", "Customer", "Sector", "Criticality Level",
    "Cert. No.", "Remarks", "Gauge Issue Date", "Gauges Received By",
    "Gauges Issued By", "Calibration Procedure& Ref Std", "Traceable",
    "Is Reference Standard"
  ];
  const sampleRow = [
    "001", "Vernier Caliper", "VC-001", "0-150mm", "SN123456",
    "0.02mm", "Lab 1", "12 MONTH", "2024-01-10", "2024-07-10",
    "ABC Labs - TC123", "OK", "Active",
    "Mitutoyo", "Mechanical", "PN-001", "Slide", "MOD1",
    "External", "Acme Corp", "Manufacturing", "High",
    "CERT-001", "Tested okay", "2024-01-01", "John Doe",
    "Jane Doe", "ISO 9001", "NABL", "No"
  ];
  ws.addRow(headers);
  ws.addRow(sampleRow);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  // Add dropdown validation for frequency column (Column H)
  (ws as any).dataValidations.add("H2:H999", {
    type: "list",
    allowBlank: true,
    formulae: ['"1 MONTH,2 MONTH,3 MONTH,6 MONTH,12 MONTH,24 MONTH,36 MONTH,48 MONTH,60 MONTH"'],
  });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), "Calibration_Template.xlsx");
};

export const exportRejectedToExcel = async (rejected: any[]) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Rejected Rows");

  const formatValueForExcel = (key: string, val: any): any => {
    if (val === null || val === undefined) return "";
    
    const isDateColumn = key.toLowerCase().includes("date");
    if (isDateColumn) {
      // 1. If it's a number (Excel date code)
      if (typeof val === "number") {
        try {
          const utc_days = Math.floor(val - 25569);
          const date = new Date(utc_days * 86400 * 1000);
          if (!isNaN(date.getTime())) {
            const d = String(date.getDate()).padStart(2, "0");
            const m = String(date.getMonth() + 1).padStart(2, "0");
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
          }
        } catch (e) {
          // ignore and fallback
        }
      }
      
      // 2. If it's a string, see if it's a valid date or ISO string
      const dateStr = val.toString().trim();
      if (dateStr) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          const d = String(parsed.getDate()).padStart(2, "0");
          const m = String(parsed.getMonth() + 1).padStart(2, "0");
          const y = parsed.getFullYear();
          return `${d}/${m}/${y}`;
        }
      }
    }
    
    return val;
  };

  if (rejected.length > 0) {
    const headers = Object.keys(rejected[0]);
    worksheet.addRow(headers);
    rejected.forEach(item => {
      const formattedRow = Object.keys(item).map(key => formatValueForExcel(key, item[key]));
      worksheet.addRow(formattedRow);
    });
    worksheet.getRow(1).font = { bold: true };
  }

  return await workbook.xlsx.writeBuffer();
};

export default function ExcelUpload({ endpoint, mapRow, onComplete, onRefresh, rejectedFile, setRejectedFile }: ExcelUploadProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [columnErrors, setColumnErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const excelDateToISO = (excelDate: any) => {
    if (!excelDate) return null;

    // Handle Excel numeric date codes
    if (typeof excelDate === "number") {
      const dateObj = XLSX.SSF.parse_date_code(excelDate);
      if (!dateObj) return null;
      return new Date(dateObj.y, dateObj.m - 1, dateObj.d).toISOString();
    }

    const dateStr = excelDate.toString().trim();
    if (!dateStr) return null;

    // Handle DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyyMatch) {
      const [_, day, month, year] = ddmmyyyyMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return isNaN(date.getTime()) ? null : date.toISOString();
    }

    // Fallback to standard JS parser
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  const [validationRules, setValidationRules] = useState<any[]>([]);

  const fetchValidationRules = useCallback(async () => {
    try {
      const res = await httpClient.get(`/validation/rules?companyId=${user.companyId}`);
      setValidationRules(res.data);
    } catch (err) {
      console.error("Failed to fetch validation rules", err);
    }
  }, [user.companyId]);

  useState(() => {
    fetchValidationRules();
  });

  const validateRow = (raw: Record<string, any>, mapped: Record<string, any>, rowIndex: number, allRows: Record<string, any>[], lastCalKey?: string, dueKey?: string): string[] => {
    const errors: string[] = [];
    
    // Check dynamic rules from backend
    validationRules.forEach(rule => {
      const value = mapped[rule.fieldName] || raw[rule.fieldName] || raw[rule.displayName];
      if (rule.isRequired && (!value || value.toString().trim() === "")) {
        errors.push(`${rule.displayName} is required`);
      }
    });

    // Keep hardcoded critical validations if not in rules
    const name = mapped.name || raw["NAME OF INSTRUMENT"] || raw["Description"];
    const idCode = mapped.id_code || raw["ID CODE"] || raw["IMTE"];
    const location = mapped.location || raw["LOCATION"] || raw["Item Location"];
    const frequency = mapped.frequency || raw["CALIBRATION FREQUENCY"] || raw["CALIB. FREQUENCY in month"];
    const status = mapped.status || raw["STATUS"] || raw["Calibration Status"]

    if (validationRules.length === 0) {
        if (!name?.toString().trim()) errors.push("Name is required");
        if (!idCode?.toString().trim()) errors.push("ID Code is required");
        if (!location?.toString().trim()) errors.push("Location is required");
        if (!frequency?.toString().trim()) errors.push("Frequency is required");
        if (!status?.toString().trim()) errors.push("Status is required");
    }

    const rawLastCal = lastCalKey ? raw[lastCalKey] : (raw["LAST CALIBRATION DATE"] || raw["Last Cal. Date"]);
    const lastCalRule = validationRules.find(r => r.fieldName === 'last_calibration_date');
    const isLastCalRequired = lastCalRule ? lastCalRule.isRequired : true;
    const isLastCalEmpty = !rawLastCal || rawLastCal.toString().trim() === "";

    let lastCalDate: string | null = null;
    if (isLastCalEmpty) {
      if (isLastCalRequired) {
        errors.push(`${lastCalRule?.displayName || "Last Calibration Date"} is required`);
      }
    } else {
      lastCalDate = excelDateToISO(rawLastCal);
    }

    const rawDue = dueKey ? raw[dueKey] : (raw["DUE DATE"] || raw["Next Cal. Date"]);
    const dueRule = validationRules.find(r => r.fieldName === 'due_date');
    const isDueRequired = dueRule ? dueRule.isRequired : true;
    const isDueEmpty = !rawDue || rawDue.toString().trim() === "";

    let dueDate: string | null = null;
    if (isDueEmpty) {
      if (isDueRequired) {
        errors.push(`${dueRule?.displayName || "Due Date"} is required`);
      }
    } else {
      dueDate = excelDateToISO(rawDue);
    }

    const enforceStrictDate = dueRule ? dueRule.isStrictDate !== false : true;

    if (enforceStrictDate && lastCalDate && dueDate && new Date(dueDate) <= new Date(lastCalDate)) {
      errors.push("Due Date must be after Last Calibration Date");
    }

    const idCodeRule = validationRules.find(r => r.fieldName === 'id_code');
    // Default to true if no rules configured yet, else strictly respect the flag
    const enforceUniqueId = idCodeRule ? idCodeRule.isUnique : true;

    const currentId = idCode?.toString().trim();
    if (currentId && enforceUniqueId) {
      const duplicates = allRows.filter((r, i) => {
        const otherId = (r["ID CODE"] || r["IMTE"])?.toString().trim();
        return i !== rowIndex && otherId === currentId;
      });
      if (duplicates.length > 0) errors.push("Duplicate ID Code in file");
    }
    return errors;
  };

  const parseFile = (file: File) => {
    setFileName(file.name);
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

        if (rows.length === 0) {
          toast({ title: "Empty file", description: "The Excel file has no data rows.", variant: "destructive" });
          return;
        }

        const headers = Object.keys(rows[0] || {});
        
        // Smarter validation: Check for sets of alternative names
        const requiredGroups = [
          ["ID CODE", "IMTE"],
          ["NAME OF INSTRUMENT", "Description"],
          ["LOCATION", "Item Location"],
          ["CALIBRATION FREQUENCY", "CALIB. FREQUENCY in month"],
          ["LAST CALIBRATION DATE", "Last Cal. Date"],
          ["DUE DATE", "Next Cal. Date"]
        ];

        const missingGroups = requiredGroups.filter(group => 
          !group.some(col => headers.includes(col))
        );

        if (missingGroups.length > 0) {
          const missingNames = missingGroups.map(group => group[0]).join(", ");
          setColumnErrors([`Missing required info: ${missingNames}`]);
          setStep("preview");
          return;
        }
        setColumnErrors([]);

        const findCol = (names: string[]) => {
          return headers.find(h => names.some(n => h.toLowerCase().trim().includes(n.toLowerCase())));
        };

        const lastCalKey = findCol(["last cal", "last calibration"]);
        const dueKey = findCol(["next cal", "due date", "next calibration"]);

        const parsed: ParsedRow[] = rows.map((raw, i) => {
          // Pre-extract dates using the found keys
          const lastCalRaw = lastCalKey ? raw[lastCalKey] : null;
          const dueRaw = dueKey ? raw[dueKey] : null;

          // Auto-parse any field with "Date" in it if it's a number (Excel date)
          const processedRaw = { ...raw };
          Object.keys(processedRaw).forEach(key => {
            if (key.toLowerCase().includes("date") && typeof processedRaw[key] === "number") {
              processedRaw[key] = excelDateToISO(processedRaw[key]);
            }
          });

          const mapped = {
            ...mapRow({
              ...processedRaw,
              "LAST CALIBRATION DATE": excelDateToISO(lastCalRaw),
              "DUE DATE": excelDateToISO(dueRaw),
            }),
            created_by: user.id,
            updated_by: user.id,
            companyId: user.companyId,
          };

          const errors = validateRow(raw, mapped, i, rows, lastCalKey, dueKey);
          
          return { rowIndex: i + 1, raw, mapped, errors, isValid: errors.length === 0 };
        });

        setParsedRows(parsed);
        setStep("preview");
      } catch (err) {
        console.error(err);
        toast({ title: "Error", description: "Failed to read Excel file", variant: "destructive" });
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      parseFile(file);
    } else {
      toast({ title: "Invalid file", description: "Please upload an .xlsx or .xls file", variant: "destructive" });
    }
  }, []);

  const handleUpload = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast({ title: "No valid rows", description: "Fix validation errors before uploading.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const payload = validRows.map((r) => r.mapped);
      
      await httpClient.post(`/upload-jobs/start?companyId=${user.companyId}`, {
        fileName,
        instruments: payload,
        userId: user.id,
      });
      
      // Dispatch custom window event to trigger immediate notification polling in AppHeader
      window.dispatchEvent(new Event("background-upload-started"));

      toast({
        title: "Background Upload Started",
        description: "Your file is being uploaded in the background. You can check its progress in the Notifications menu.",
      });

      onComplete?.();
      reset();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Upload Error",
        description: err?.response?.data?.message || "Could not start background upload",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setFileName("");
    setParsedRows([]);
    setColumnErrors([]);
    setUploadResult(null);
    setUploadProgress(0);
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-muted/20 rounded-xl">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 group">
            <div className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-300 ${
              step === s.key ? "bg-primary text-primary-foreground shadow-md scale-105" :
              STEPS.findIndex(x => x.key === step) > i ? "bg-green-500 text-white" :
              "bg-muted text-muted-foreground opacity-70"
            }`}>
              <div className="flex-shrink-0">{s.icon}</div>
              <span className="whitespace-nowrap">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 rounded-full ${
                STEPS.findIndex(x => x.key === step) > i ? "bg-green-500" : "bg-border"
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm space-y-1">
                <p className="font-semibold text-blue-800 dark:text-blue-300">Instructions</p>
                <p className="text-blue-700 dark:text-blue-400">
                  Download the template and fill in your instrument data.
                </p>
                <p className="text-blue-700 dark:text-blue-400">
                  Required columns: <strong>Name, ID Code, Location, Frequency, Dates, Agency, Status</strong>.
                </p>
                <p className="text-blue-700 dark:text-blue-400">
                  Duplicate ID Codes will be flagged. Dates must be valid (YYYY-MM-DD).
                </p>
              </div>
            </div>
          </div>

          {/* Download Template */}
          <div className="flex justify-center">
            <Button onClick={downloadTemplate} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 text-sm font-medium">
              <DownloadCloudIcon size={18} className="mr-2" />
              Download Excel Template
            </Button>
          </div>

          {/* Drag & Drop Zone */}
          <div className="pt-2">
            <p className="text-sm font-semibold text-center mb-3 text-foreground">Upload Filled Template</p>
            <label
              className={`cursor-pointer flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-all duration-200 ${
                isParsing ? "opacity-50 cursor-not-allowed" : ""
              } ${
                isDragOver
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                  : "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/10 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              }`}
              onDragOver={(e) => { e.preventDefault(); !isParsing && setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              {isParsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
                  <p className="text-sm font-medium text-emerald-700">Reading Excel data...</p>
                </div>
              ) : (
                <>
                  <div className="text-4xl">📁</div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Click or drag your Excel file here
                  </p>
                  <p className="text-xs text-muted-foreground">Supports .xlsx and .xls files</p>
                </>
              )}
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                disabled={isParsing}
                onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
              />
            </label>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Validate */}
      {step === "preview" && (
        <div className="space-y-4">
          {/* Column errors */}
          {columnErrors.length > 0 ? (
            <div className="space-y-3">
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <XCircle size={18} className="text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Missing Required Columns</p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                      {columnErrors.join(", ")}
                    </p>
                    <p className="text-xs text-red-600 mt-2">
                      Please download the template and ensure all columns are present.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={reset} size="sm">
                  <ArrowLeft size={14} className="mr-1" /> Back
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium">File: {fileName}</span>
                  <Badge variant="secondary" className="bg-slate-500/10 text-slate-700 dark:text-slate-400 border-0 cursor-pointer hover:bg-slate-500/20" onClick={() => setShowErrorsOnly(false)}>
                    {parsedRows.length} rows
                  </Badge>
                  <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-0">{validCount} valid</Badge>
                  {invalidCount > 0 && (
                    <Badge 
                      className={`cursor-pointer transition-all duration-200 border-0 ${
                        showErrorsOnly 
                        ? "bg-red-500 text-white shadow-sm scale-105" 
                        : "bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20"
                      }`}
                      onClick={() => setShowErrorsOnly(!showErrorsOnly)}
                    >
                      {invalidCount} errors
                    </Badge>
                  )}
                </div>

                {invalidCount > 0 && (
                  <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-full border border-border/50">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Filter:</span>
                    <button 
                      onClick={() => setShowErrorsOnly(!showErrorsOnly)}
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md transition-all ${
                        showErrorsOnly ? "bg-red-500 text-white" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Errors Only
                    </button>
                    <button 
                      onClick={() => setShowErrorsOnly(false)}
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md transition-all ${
                        !showErrorsOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      All Rows
                    </button>
                  </div>
                )}
              </div>

                {/* Data Table */}
                <ScrollArea className="h-[300px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="w-12">Status</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>ID Code</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Last Cal.</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows
                        .filter(row => !showErrorsOnly || !row.isValid)
                        .map((row) => (
                        <TableRow key={row.rowIndex} className={!row.isValid ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                          <TableCell className="text-xs text-muted-foreground">{row.rowIndex}</TableCell>
                          <TableCell>
                            {row.isValid ? (
                              <CheckCircle2 size={16} className="text-green-500" />
                            ) : (
                              <XCircle size={16} className="text-red-500" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{row.raw["NAME OF INSTRUMENT"] || row.raw["Description"] || "—"}</TableCell>
                          <TableCell className="text-sm">{row.raw["ID CODE"] || row.raw["IMTE"] || "—"}</TableCell>
                          <TableCell className="text-sm">{row.raw["LOCATION"] || row.raw["Item Location"] || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {row.mapped.last_calibration_date ? new Date(row.mapped.last_calibration_date).toLocaleDateString() : (row.raw["LAST CALIBRATION DATE"] || row.raw["Last Cal. Date"] || "—")}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.mapped.due_date ? new Date(row.mapped.due_date).toLocaleDateString() : (row.raw["DUE DATE"] || row.raw["Next Cal. Date"] || "—")}
                          </TableCell>
                          <TableCell>
                            {row.errors.length > 0 && (
                              <div className="flex flex-col gap-0.5">
                                {row.errors.map((e, i) => (
                                  <span key={i} className="text-xs text-red-600 dark:text-red-400">{e}</span>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" onClick={reset} size="sm">
                    <ArrowLeft size={14} className="mr-1" /> Back
                  </Button>
                  <div className="flex items-center gap-2">
                    {invalidCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        disabled={isExporting}
                        onClick={async () => {
                          setIsExporting(true);
                          try {
                            const invalidRows = parsedRows.filter(r => !r.isValid).map(r => ({
                              ...r.raw,
                              "ERROR DESCRIPTION": r.errors.join(", ")
                            }));
                            const buffer = await exportRejectedToExcel(invalidRows);
                            saveAs(new Blob([buffer]), `Fix_These_Rows_${fileName}`);
                          } catch (e) {
                            toast({ title: "Export Error", description: "Could not generate file", variant: "destructive" });
                          } finally {
                            setIsExporting(false);
                          }
                        }}
                      >
                        {isExporting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <DownloadCloudIcon size={14} className="mr-1" />}
                        Download {invalidCount} Invalid Rows
                      </Button>
                    )}
                    <Button
                      onClick={handleUpload}
                      disabled={isUploading || validCount === 0}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={14} className="mr-1 animate-spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          Upload {validCount} Valid Rows <ArrowRight size={14} className="ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {isUploading && (
                <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-dashed animate-pulse">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 size={20} className="text-emerald-600 animate-spin" />
                    <p className="text-sm font-semibold text-emerald-700">Saving {validCount} instruments to database...</p>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-[10px] text-muted-foreground text-center italic">This may take a few moments for large files</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: Result */}
      {step === "result" && uploadResult && (
        <div className="space-y-4">
          {/* Result summary card */}
          <div className={`rounded-lg p-6 text-center space-y-2 ${uploadResult.failedCount === 0
              ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
              : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
            }`}>
            {uploadResult.failedCount === 0 ? (
              <CheckCircle2 size={48} className="mx-auto text-green-500" />
            ) : (
              <AlertTriangle size={48} className="mx-auto text-amber-500" />
            )}
            <h3 className="text-lg font-semibold">
              {uploadResult.failedCount === 0 ? "Upload Complete!" : "Upload Partially Complete"}
            </h3>
            <div className="flex justify-center gap-6 text-sm">
              <span className="text-green-700 dark:text-green-400 font-medium">
                ✅ {uploadResult.successCount} Success
              </span>
              {uploadResult.failedCount > 0 && (
                <span className="text-red-700 dark:text-red-400 font-medium">
                  ❌ {uploadResult.failedCount} Failed
                </span>
              )}
            </div>
          </div>

          {/* Failed rows details */}
          {uploadResult.failedRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Failed Rows:</p>
              <ScrollArea className="h-[120px] rounded-md border">
                {uploadResult.failedRows.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 border-b text-xs">
                    <XCircle size={12} className="text-red-500 flex-shrink-0" />
                    <span>Row {f.row}: {f.error}</span>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={reset} size="sm">
              Upload Another File
            </Button>
            <div className="flex gap-2">
              {rejectedFile && (
                <Button variant="outline" size="sm" onClick={() => saveAs(rejectedFile, "Rejected_Rows.xlsx")}>
                  <DownloadCloudIcon size={14} className="mr-1" /> Download Rejected
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  onComplete?.();
                  reset();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
