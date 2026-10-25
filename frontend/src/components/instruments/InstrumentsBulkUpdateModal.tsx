import React, { useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  DownloadCloudIcon,
  Loader2,
  RefreshCw,
  Search,
  Check,
  MinusCircle,
  Columns,
  Layers,
  Settings2,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import httpClient from "@/lib/httpClient";

export interface InstrumentsBulkUpdateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

type Step = "upload" | "preview" | "result";

export interface UpdatableFieldDef {
  key: string;
  label: string;
  aliases: string[];
}

export const ALL_UPDATABLE_FIELDS: UpdatableFieldDef[] = [
  { key: "id_code", label: "ID Code", aliases: ["change id code as below", "change id code", "new id code", "new id", "id code (new)", "id_code", "new id_code"] },
  { key: "part_no", label: "Part No", aliases: ["part no", "partno", "part number", "current part number", "change part number", "change part no", "new part no", "new part number", "change id code as below_1", "part no_1"] },
  { key: "module", label: "Module", aliases: ["module", "model", "moudle"] },
  { key: "serial_no", label: "Serial No", aliases: ["serial no", "items sl.no / model", "serialno", "serial number", "sl no"] },
  { key: "location", label: "Location", aliases: ["location", "item location", "loc"] },
  { key: "part_name", label: "Part Name", aliases: ["part name", "partname", "part_name"] },
  { key: "range", label: "Range", aliases: ["range", "size", "specification"] },
  { key: "make", label: "Make", aliases: ["make", "item make", "manufacturer"] },
  { key: "frequency", label: "Frequency", aliases: ["calibration frequency", "frequency", "calib. frequency in month"] },
  { key: "least_count", label: "Least Count", aliases: ["least count", "lc"] },
  { key: "agency", label: "Agency", aliases: ["calibration agency and tc no", "agency", "calibration agency"] },
  { key: "status", label: "Status", aliases: ["status", "calibration status"] },
  { key: "item_status", label: "Item Status", aliases: ["item status"] },
];

interface ProposedChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

interface PreviewRowItem {
  rowIndex: number;
  status: "ready" | "error" | "no_change";
  errors: string[];
  instrumentId?: string;
  sino?: number;
  name?: string;
  id_code?: string;
  changes: ProposedChange[];
  matchMethod?: string;
  raw: Record<string, any>;
}

interface PreviewResponse {
  totalRows: number;
  readyCount: number;
  errorCount: number;
  noChangeCount: number;
  columnUpdateCounts?: Record<string, number>;
  rows: PreviewRowItem[];
}

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: "upload", label: "Upload & Configure", icon: <Upload size={16} /> },
  { key: "preview", label: "Preview & Validate", icon: <CheckCircle2 size={16} /> },
  { key: "result", label: "Result", icon: <FileSpreadsheet size={16} /> },
];

export function InstrumentsBulkUpdateModal({
  isOpen,
  onOpenChange,
  onRefresh,
}: InstrumentsBulkUpdateModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Configuration state
  const [overwrite, setOverwrite] = useState(true); // Default to Overwrite with Excel values
  const [detectedColumns, setDetectedColumns] = useState<UpdatableFieldDef[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [parsedMappedRows, setParsedMappedRows] = useState<any[]>([]);

  // Preview state
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "ready" | "error" | "no_change">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const PREVIEW_PAGE_SIZE = 50;

  // Execution state
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    successCount: number;
    failedCount: number;
    failedRows: Array<{ id: string; error: string }>;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const resetState = () => {
    setStep("upload");
    setFileName("");
    setPreviewData(null);
    setFilterMode("all");
    setSearchQuery("");
    setPreviewPage(1);
    setIsUpdating(false);
    setUpdateResult(null);
    setDetectedColumns([]);
    setSelectedColumns([]);
    setParsedMappedRows([]);
    setOverwrite(true);
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  // ── Download Sample Template ──────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Update_Template");

    ws.columns = [
      { header: "S.No", key: "sino", width: 10 },
      { header: "NAME OF INSTRUMENT", key: "name", width: 30 },
      { header: "ID CODE", key: "id_code", width: 25 },
      { header: "Module", key: "module", width: 22 },
      { header: "Part Name", key: "part_name", width: 22 },
      { header: "SERIAL NO", key: "serial_no", width: 20 },
      { header: "LOCATION", key: "location", width: 20 },
      { header: "RANGE", key: "range", width: 20 },
      { header: "MAKE", key: "make", width: 20 },
    ];

    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" }, // Teal header
    };

    // Sample data rows
    ws.addRow({
      sino: 1,
      name: "Granite Surface Plate",
      id_code: "GSP-001",
      module: "Surface Plate",
      part_name: "",
      serial_no: "8212",
      location: "QC STD ROOM",
      range: "1000x1600",
      make: "Mitutoyo",
    });
    ws.addRow({
      sino: 2,
      name: "Vernier Calliper",
      id_code: "VC-009",
      module: "Vernier Calliper",
      part_name: "",
      serial_no: "0023316",
      location: "TOOL ROOM",
      range: "0-300mm",
      make: "Mitutoyo",
    });

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "Instruments_Bulk_Update_Template.xlsx");
  };

  // ── Call Backend Preview API ──────────────────────────────────────────────
  const requestPreview = async (
    rows: any[],
    cols: string[],
    isOverwrite: boolean
  ): Promise<PreviewResponse | null> => {
    try {
      const res = await httpClient.post<PreviewResponse>("/instruments/bulk-update-preview", {
        rows,
        options: {
          overwrite: isOverwrite,
          selectedColumns: cols.length > 0 ? cols : undefined,
        },
      });
      return res.data;
    } catch (err: any) {
      console.error("Bulk update preview failed:", err);
      toast({
        title: "Preview Generation Failed",
        description: err?.response?.data?.message || err?.message || "Could not validate spreadsheet.",
        variant: "destructive",
      });
      return null;
    }
  };

  // ── Parse File and Request Server-Side Preview ────────────────────────────
  const parseAndPreview = async (file: File) => {
    setIsParsing(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      // Read sheet as 2D array to support multi-row headers properly
      const sheetData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (!sheetData || sheetData.length === 0) {
        toast({
          title: "Empty Spreadsheet",
          description: "The uploaded file contains no data rows.",
          variant: "destructive",
        });
        setIsParsing(false);
        return;
      }

      let headers: string[] = [];
      let dataStartRow = 1;

      const row0 = (sheetData[0] || []).map((c: any) => String(c ?? "").trim());
      const row1 = (sheetData[1] || []).map((c: any) => String(c ?? "").trim());

      // Check if Row 1 is a sub-header row (e.g. contains S.No, NAME OF INSTRUMENT, RANGE, LOCATION, PART NO, etc.)
      const isSubHeaderRow = row1.some((c: string) => {
        const norm = c.toLowerCase().replace(/[^a-z0-9]/g, "");
        return ["sno", "slno", "nameofinstrument", "instrumentname", "range", "location", "partno", "partname"].includes(norm);
      });

      if (isSubHeaderRow && sheetData.length > 2) {
        dataStartRow = 2;
        const maxCols = Math.max(row0.length, row1.length);
        for (let i = 0; i < maxCols; i++) {
          const h0 = row0[i] || "";
          const h1 = row1[i] || "";
          let finalHeader = "";

          if (h0.toLowerCase().includes("change") && (h1.toLowerCase().includes("part") || (i > 5 && h0.toLowerCase().includes("code")))) {
            finalHeader = "Change Part Number";
          } else if (h0.toLowerCase().includes("change") && (h1.toLowerCase().includes("id") || i <= 5)) {
            finalHeader = "Change ID Code as Below";
          } else if (h0) {
            finalHeader = h0;
          } else if (h1) {
            finalHeader = h1;
          } else {
            finalHeader = `Column_${i}`;
          }
          headers.push(finalHeader);
        }
      } else {
        headers = row0;
      }

      // Build structured rows using synthesized headers
      const rawRows: Record<string, any>[] = [];
      for (let r = dataStartRow; r < sheetData.length; r++) {
        const rowArr = sheetData[r];
        if (!rowArr || rowArr.length === 0 || rowArr.every((v) => v === undefined || v === null || String(v).trim() === "")) {
          continue;
        }
        const obj: Record<string, any> = {};
        for (let c = 0; c < headers.length; c++) {
          obj[headers[c]] = rowArr[c] !== undefined && rowArr[c] !== null ? rowArr[c] : "";
        }
        rawRows.push(obj);
      }

      // Discover sheet headers
      const sheetHeaders = headers.map((h) => h.trim());
      const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

      // Detect which updatable columns are present in the Excel
      const detected = ALL_UPDATABLE_FIELDS.filter((f) =>
        f.aliases.some((alias) =>
          sheetHeaders.some((sh) => normalizeHeader(sh) === normalizeHeader(alias))
        )
      );

      // Default selection: if 'module' is present, default to it, or select all detected target columns
      const defaultSelected = detected.map((d) => d.key);
      setDetectedColumns(detected);
      setSelectedColumns(defaultSelected);

      const cleanRawRows = rawRows;

      // Map rows for backend processing
      const mappedRows = cleanRawRows.map((raw, idx) => {
        const getVal = (aliases: string[]) => {
          const normAliases = aliases.map((a) => normalizeHeader(a));
          const key = Object.keys(raw || {}).find((k) => normAliases.includes(normalizeHeader(k)));
          return key !== undefined && raw[key] !== null ? String(raw[key]).trim() : undefined;
        };

        return {
          rowIndex: idx + 2, // Excel 1-based, row 1 is header
          raw,
          name: getVal(["NAME OF INSTRUMENT", "Name", "Description", "Instrument Name"]),
          id_code: getVal(["Current ID Code", "Old ID Code", "Current ID", "ID CODE", "IMTE", "Instrument ID", "Id"]),
          new_id_code: getVal(["Change ID Code as Below", "Change ID Code", "New ID Code", "New ID", "ID Code (New)", "ID CODE_1"]),
          current_part_no: getVal(["Current Part Number", "Current Part No", "Old Part Number", "Old Part No", "PART NO", "Part No"]),
          new_part_no: getVal(["Change Part Number", "New Part Number", "New Part No", "Change Part No", "Change ID Code as Below_1", "PART NO_1"]),
          part_no: getVal(["Change Part Number", "New Part Number", "New Part No", "Change Part No", "Change ID Code as Below_1", "PART NO_1", "PART NO", "Part No", "Part Number"]),
          sino: (() => {
            const s = getVal(["S.No", "sino", "Sl.No", "P.Sl.No"]);
            return s && !isNaN(Number(s)) ? Number(s) : undefined;
          })(),
          module: getVal(["Module", "Model", "Moudle"]),
          part_name: getVal(["Part Name", "part_name"]),
          serial_no: getVal(["SERIAL NO", "Serial No", "Items Sl.No / Model"]),
          location: getVal(["LOCATION", "Location", "Item Location"]),
          range: getVal(["RANGE", "Range"]),
          make: getVal(["MAKE", "Make", "Item Make"]),
          frequency: getVal(["CALIBRATION FREQUENCY", "Frequency", "CALIB. FREQUENCY in month"]),
          least_count: getVal(["LEAST COUNT", "Least Count"]),
          agency: getVal(["CALIBRATION AGENCY AND TC No", "Agency", "Calibration Agency"]),
          status: getVal(["STATUS", "Status", "Calibration Status"]),
          item_status: getVal(["ITEM STATUS", "Item Status"]),
        };
      });

      setParsedMappedRows(mappedRows);

      // Send to backend preview endpoint
      const previewRes = await requestPreview(mappedRows, defaultSelected, overwrite);
      if (previewRes) {
        setPreviewData(previewRes);
        setStep("preview");
      }
    } catch (err: any) {
      console.error("Spreadsheet parsing failed:", err);
      toast({
        title: "File Parse Error",
        description: err?.message || "Could not read the uploaded spreadsheet.",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  // ── Handle Column Selection Change with Instant Re-Preview ────────────────
  const handleToggleColumn = async (columnKey: string) => {
    let newCols: string[];
    if (selectedColumns.includes(columnKey)) {
      newCols = selectedColumns.filter((c) => c !== columnKey);
    } else {
      newCols = [...selectedColumns, columnKey];
    }
    setSelectedColumns(newCols);

    if (parsedMappedRows.length > 0) {
      setIsRecalculating(true);
      const previewRes = await requestPreview(parsedMappedRows, newCols, overwrite);
      if (previewRes) {
        setPreviewData(previewRes);
        setPreviewPage(1);
      }
      setIsRecalculating(false);
    }
  };

  const handleSelectAllColumns = async () => {
    const allCols = detectedColumns.map((c) => c.key);
    setSelectedColumns(allCols);

    if (parsedMappedRows.length > 0) {
      setIsRecalculating(true);
      const previewRes = await requestPreview(parsedMappedRows, allCols, overwrite);
      if (previewRes) {
        setPreviewData(previewRes);
        setPreviewPage(1);
      }
      setIsRecalculating(false);
    }
  };

  const handleDeselectAllColumns = async () => {
    setSelectedColumns([]);
    if (parsedMappedRows.length > 0) {
      setIsRecalculating(true);
      const previewRes = await requestPreview(parsedMappedRows, [], overwrite);
      if (previewRes) {
        setPreviewData(previewRes);
        setPreviewPage(1);
      }
      setIsRecalculating(false);
    }
  };

  const handleToggleOverwrite = async (newVal: boolean) => {
    setOverwrite(newVal);
    if (parsedMappedRows.length > 0) {
      setIsRecalculating(true);
      const previewRes = await requestPreview(parsedMappedRows, selectedColumns, newVal);
      if (previewRes) {
        setPreviewData(previewRes);
        setPreviewPage(1);
      }
      setIsRecalculating(false);
    }
  };

  // ── Execute Updates ───────────────────────────────────────────────────────
  const handleProceedUpdate = async () => {
    if (!previewData) return;
    const readyRows = previewData.rows.filter((r) => r.status === "ready" && r.instrumentId);

    if (readyRows.length === 0) {
      toast({
        title: "No Valid Updates",
        description: "There are no rows ready to be updated with the currently selected columns.",
        variant: "destructive",
      });
      return;
    }

    if (selectedColumns.length === 0) {
      toast({
        title: "No Columns Selected",
        description: "Please select at least one column to update into the database.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const updatesPayload = readyRows.map((r) => {
        const changes: Record<string, any> = {};
        for (const change of r.changes) {
          changes[change.field] = change.newValue;
        }
        return {
          id: r.instrumentId!,
          changes,
        };
      });

      const res = await httpClient.post("/instruments/bulk-update", {
        updates: updatesPayload,
      });

      setUpdateResult(res.data);
      setStep("result");
      onRefresh();
      toast({
        title: "Update Successful",
        description: `Successfully updated ${res.data.successCount} instruments in the database.`,
      });
    } catch (err: any) {
      console.error("Bulk update execution failed:", err);
      toast({
        title: "Update Failed",
        description: err?.response?.data?.message || err?.message || "Database transaction error.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Export Error Rows ─────────────────────────────────────────────────────
  const handleExportErrors = async () => {
    if (!previewData) return;
    setIsExporting(true);
    try {
      const errorRows = previewData.rows
        .filter((r) => r.status === "error")
        .map((r) => ({
          "Row Number": r.rowIndex,
          "ID CODE": r.id_code || r.raw?.["ID CODE"] || "",
          "NAME OF INSTRUMENT": r.name || r.raw?.["NAME OF INSTRUMENT"] || "",
          "ERROR REASON": r.errors.join("; "),
          ...r.raw,
        }));

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Failed_Rows");

      if (errorRows.length > 0) {
        const headers = Object.keys(errorRows[0]);
        ws.addRow(headers);
        ws.getRow(1).font = { bold: true };
        errorRows.forEach((row) => {
          ws.addRow(Object.values(row));
        });
      }

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Failed_Update_Rows_${fileName || "errors.xlsx"}`);
    } catch (err) {
      toast({
        title: "Export Error",
        description: "Could not export error rows.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ── Filter & Search Logic for Preview ─────────────────────────────────────
  const filteredRows = (previewData?.rows || []).filter((row) => {
    // Mode filter
    if (filterMode === "ready" && row.status !== "ready") return false;
    if (filterMode === "error" && row.status !== "error") return false;
    if (filterMode === "no_change" && row.status !== "no_change") return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (row.name || "").toLowerCase();
      const idCode = (row.id_code || "").toLowerCase();
      const changesText = row.changes.map((c) => `${c.label} ${c.newValue}`).join(" ").toLowerCase();
      const errorText = row.errors.join(" ").toLowerCase();
      return name.includes(q) || idCode.includes(q) || changesText.includes(q) || errorText.includes(q);
    }

    return true;
  });

  const totalPages = Math.ceil(filteredRows.length / PREVIEW_PAGE_SIZE) || 1;
  const paginatedRows = filteredRows.slice(
    (previewPage - 1) * PREVIEW_PAGE_SIZE,
    previewPage * PREVIEW_PAGE_SIZE
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-5xl h-[92vh] max-h-[850px] overflow-hidden flex flex-col p-5 gap-0">
        <DialogHeader className="shrink-0 pb-2.5 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <RefreshCw size={20} className="text-primary" />
            Bulk Update Instruments
          </DialogTitle>
          <DialogDescription className="text-xs">
            Match existing instruments by <span className="font-semibold text-foreground">Name</span> and{" "}
            <span className="font-semibold text-foreground">ID Code</span>, select which columns to update, and review live diffs before saving.
          </DialogDescription>

          {/* Stepper Wizard Indicator */}
          <div className="flex items-center justify-center gap-3 pt-3">
            {STEPS.map((s, idx) => {
              const isActive = s.key === step;
              const isPassed =
                (step === "preview" && s.key === "upload") ||
                (step === "result" && (s.key === "upload" || s.key === "preview"));

              return (
                <div key={s.key} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : isPassed
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isPassed ? <Check size={14} className="stroke-[2.5]" /> : s.icon}
                    <span>{s.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* ── STEP 1: UPLOAD & CONFIGURE ─────────────────────────────────── */}
        {step === "upload" && (
          <div className="space-y-4 py-2">
            {/* Instructions Alert Card */}
            <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4 text-xs text-blue-950 dark:text-blue-200 space-y-2">
              <div className="font-semibold flex items-center gap-1.5 text-blue-900 dark:text-blue-300">
                <AlertTriangle size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                How Bulk Update Works
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] leading-relaxed">
                <div>
                  <span className="font-semibold text-foreground">1. Validation & Matching Keys:</span>
                  <p className="text-muted-foreground">
                    Matches instruments using <span className="font-semibold text-blue-900 dark:text-blue-300">NAME OF INSTRUMENT</span> and{" "}
                    <span className="font-semibold text-blue-900 dark:text-blue-300">ID CODE</span>.
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-foreground">2. Selectable Target Columns:</span>
                  <p className="text-muted-foreground">
                    Choose one or multiple columns to update: <span className="font-semibold font-mono text-[10px]">Module, Location, Serial No, Part Name, Range</span>, etc.
                  </p>
                </div>
              </div>
            </div>

            {/* Default Update Strategy Card */}
            <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-lg border">
              <div className="space-y-0.5">
                <Label htmlFor="overwrite-strategy-toggle" className="text-xs font-semibold cursor-pointer">
                  Update Strategy: Overwrite Existing Values with Excel
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {overwrite
                    ? "Enabled: Updates database values whenever the Excel cell differs from the database."
                    : "Disabled: Preserves existing database values and only fills cells that are currently empty."}
                </p>
              </div>
              <Switch
                id="overwrite-strategy-toggle"
                checked={overwrite}
                onCheckedChange={setOverwrite}
              />
            </div>

            {/* Download Template Action */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-2 text-xs border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50"
              >
                <DownloadCloudIcon size={16} />
                Download Update Excel Template
              </Button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) parseAndPreview(file);
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <label className="flex flex-col items-center justify-center cursor-pointer gap-2">
                <FileSpreadsheet className="h-12 w-12 text-primary/70 animate-pulse" />
                <span className="text-sm font-semibold text-foreground">
                  {isParsing ? "Analyzing spreadsheet & matching instruments..." : "Click or drag your Excel file here"}
                </span>
                <span className="text-xs text-muted-foreground">Supports .xlsx and .xls files</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  disabled={isParsing}
                  onChange={(e) => e.target.files?.[0] && parseAndPreview(e.target.files[0])}
                />
              </label>
              {isParsing && (
                <div className="flex items-center justify-center gap-2 mt-4 text-xs text-primary font-medium">
                  <Loader2 className="animate-spin h-4 w-4" />
                  Generating preview and matching instruments...
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: PREVIEW & VALIDATE ─────────────────────────────────── */}
        {step === "preview" && previewData && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-2 py-2">
            {/* COLUMN SELECTOR & STRATEGY PANEL */}
            <div className="bg-card border rounded-lg p-3 space-y-2.5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div className="flex items-center gap-2">
                  <Columns size={15} className="text-primary shrink-0" />
                  <span className="text-xs font-bold text-foreground">
                    Select Database Column(s) to Update:
                  </span>
                  <Badge variant="outline" className="text-[11px] font-mono font-semibold">
                    {selectedColumns.length} of {detectedColumns.length} selected
                  </Badge>
                  {isRecalculating && (
                    <div className="flex items-center gap-1.5 text-[11px] text-primary animate-pulse ml-2 font-medium">
                      <Loader2 size={12} className="animate-spin" />
                      Recalculating preview...
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllColumns}
                    disabled={isRecalculating}
                    className="h-6 text-[11px] px-2 text-primary hover:bg-primary/10"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectAllColumns}
                    disabled={isRecalculating}
                    className="h-6 text-[11px] px-2 text-muted-foreground hover:bg-muted"
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Dynamic Checkbox Chips for Detected Columns with Live Update Counts */}
              <div className="flex flex-wrap items-center gap-2">
                {detectedColumns.map((col) => {
                  const isChecked = selectedColumns.includes(col.key);
                  const updateCount = previewData?.columnUpdateCounts?.[col.key] ?? 0;
                  return (
                    <button
                      key={col.key}
                      type="button"
                      disabled={isRecalculating}
                      onClick={() => handleToggleColumn(col.key)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-primary/10 border-primary/40 text-primary hover:bg-primary/15 font-semibold shadow-2xs"
                          : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggleColumn(col.key)}
                        className="pointer-events-none h-3.5 w-3.5"
                      />
                      <span>{col.label}</span>
                      {previewData && (
                        <span
                          className={`ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold leading-tight ${
                            isChecked && updateCount > 0
                              ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                              : "bg-muted text-muted-foreground opacity-80"
                          }`}
                        >
                          {updateCount > 0 ? `${updateCount.toLocaleString()} updates` : "0"}
                        </span>
                      )}
                    </button>
                  );
                })}

                {detectedColumns.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    No updatable columns detected in the uploaded file.
                  </span>
                )}
              </div>

              {/* Column Update Count Breakdown Bar */}
              {selectedColumns.length > 0 && previewData && previewData.readyCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground bg-muted/25 px-2.5 py-1.5 rounded-md border border-border/60">
                  <span className="font-semibold text-foreground text-[11px] mr-1">Database Update Impact:</span>
                  {selectedColumns.map((colKey) => {
                    const def = ALL_UPDATABLE_FIELDS.find((f) => f.key === colKey);
                    const count = previewData.columnUpdateCounts?.[colKey] ?? 0;
                    return (
                      <Badge
                        key={colKey}
                        variant="outline"
                        className={`text-[11px] font-mono px-2 py-0.5 ${
                          count > 0
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-500/30 font-semibold"
                            : "bg-muted/40 text-muted-foreground border-transparent opacity-75"
                        }`}
                      >
                        {def?.label || colKey}: {count.toLocaleString()} {count === 1 ? "row" : "rows"}
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Strategy Switch inside Preview */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-1 border-t text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <Settings2 size={13} className="text-primary" /> Update Strategy:
                  </span>
                  <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
                    <button
                      type="button"
                      disabled={isRecalculating}
                      onClick={() => handleToggleOverwrite(true)}
                      className={`px-3 py-1 rounded-md transition-all font-medium text-[11px] cursor-pointer ${
                        overwrite
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ✓ Overwrite with Excel values
                    </button>
                    <button
                      type="button"
                      disabled={isRecalculating}
                      onClick={() => handleToggleOverwrite(false)}
                      className={`px-3 py-1 rounded-md transition-all font-medium text-[11px] cursor-pointer ${
                        !overwrite
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Only fill empty cells in DB
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Matching keys: <span className="font-semibold text-foreground">Name & ID Code</span>
                </div>
              </div>

              {!overwrite && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                  <span>
                    <strong>"Only fill empty cells" mode is ON:</strong> Existing database values are preserved. To update existing database values with your Excel values, click <strong>"Overwrite with Excel values"</strong> above.
                  </span>
                </div>
              )}
            </div>

            {/* Summary Badges Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground truncate max-w-xs">{fileName}</span>
                <Badge
                  variant={filterMode === "all" ? "default" : "outline"}
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => {
                    setFilterMode("all");
                    setPreviewPage(1);
                  }}
                >
                  {previewData.totalRows} Total Rows
                </Badge>
                <Badge
                  className={`cursor-pointer transition-colors ${
                    filterMode === "ready"
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 border-0"
                  }`}
                  onClick={() => {
                    setFilterMode("ready");
                    setPreviewPage(1);
                  }}
                >
                  <CheckCircle2 size={13} className="mr-1" />
                  {previewData.readyCount} Ready to Update
                </Badge>
                {previewData.noChangeCount > 0 && (
                  <Badge
                    variant={filterMode === "no_change" ? "default" : "secondary"}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => {
                      setFilterMode("no_change");
                      setPreviewPage(1);
                    }}
                  >
                    <MinusCircle size={13} className="mr-1" />
                    {previewData.noChangeCount} No Changes
                  </Badge>
                )}
                {previewData.errorCount > 0 && (
                  <Badge
                    className={`cursor-pointer transition-colors ${
                      filterMode === "error"
                        ? "bg-rose-600 text-white"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-400 hover:bg-rose-500/25 border-0"
                    }`}
                    onClick={() => {
                      setFilterMode("error");
                      setPreviewPage(1);
                    }}
                  >
                    <XCircle size={13} className="mr-1" />
                    {previewData.errorCount} Unmatched / Errors
                  </Badge>
                )}
              </div>

              {/* Search Box */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2 text-muted-foreground" />
                  <Input
                    placeholder="Search preview rows..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPreviewPage(1);
                    }}
                    className="h-8 w-48 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Preview Table Container with Robust Native Scrolling */}
            <div className="border rounded-md overflow-hidden flex-1 min-h-[160px] flex flex-col bg-background shadow-xs">
              <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0 relative">
                <Table className="w-full text-xs">
                  <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur-xs border-b shadow-2xs">
                    <TableRow className="bg-muted/95 hover:bg-muted/95 text-xs">
                      <TableHead className="w-12 font-bold bg-muted/95">#</TableHead>
                      <TableHead className="w-14 font-bold bg-muted/95">Status</TableHead>
                      <TableHead className="w-36 font-bold bg-muted/95">ID Code</TableHead>
                      <TableHead className="w-48 font-bold bg-muted/95">Instrument Name</TableHead>
                      <TableHead className="font-bold bg-muted/95">Proposed Changes</TableHead>
                      <TableHead className="w-56 font-bold bg-muted/95">Match / Error Info</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                          {selectedColumns.length === 0
                            ? "No columns selected. Check at least one column above to preview updates."
                            : "No rows match the current filter or search criteria."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRows.map((row) => (
                        <TableRow
                          key={row.rowIndex}
                          className={`text-xs ${
                            row.status === "error"
                              ? "bg-rose-50/50 dark:bg-rose-950/20"
                              : row.status === "ready"
                              ? "hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20"
                              : ""
                          }`}
                        >
                          <TableCell className="font-mono text-muted-foreground">{row.rowIndex}</TableCell>
                          <TableCell>
                            {row.status === "ready" && (
                              <CheckCircle2 size={16} className="text-emerald-600" />
                            )}
                            {row.status === "error" && <XCircle size={16} className="text-rose-600" />}
                            {row.status === "no_change" && (
                              <MinusCircle size={16} className="text-slate-400" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium font-mono text-[11px]">
                            {row.id_code || row.raw?.["ID CODE"] || row.raw?.["IMTE"] || "—"}
                          </TableCell>
                          <TableCell className="font-medium truncate max-w-[200px]" title={row.name}>
                            {row.name || row.raw?.["NAME OF INSTRUMENT"] || "—"}
                          </TableCell>
                          <TableCell>
                            {row.changes.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {row.changes.map((c, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 text-[11px] font-normal"
                                  >
                                    <span className="font-semibold mr-1">{c.label}:</span>
                                    <span className="line-through opacity-70 mr-1">{c.oldValue}</span>
                                    <span>→ {c.newValue}</span>
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">No fields to update</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.errors.length > 0 ? (
                              <span
                                className={`text-[11px] ${
                                  row.status === "error"
                                    ? "text-rose-600 dark:text-rose-400 font-medium"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {row.errors.join("; ")}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">
                                {row.matchMethod || "Matched"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 text-xs shrink-0">
                  <span className="text-muted-foreground font-mono text-[11px]">
                    Showing {(previewPage - 1) * PREVIEW_PAGE_SIZE + 1}–
                    {Math.min(previewPage * PREVIEW_PAGE_SIZE, filteredRows.length)} of {filteredRows.length} rows
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={previewPage <= 1}
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      className="h-6 text-[11px] px-2"
                    >
                      Previous
                    </Button>
                    <span className="font-mono text-[11px] px-1 font-semibold">
                      Page {previewPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={previewPage >= totalPages}
                      onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                      className="h-6 text-[11px] px-2"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PINNED MODAL FOOTER ────────────────────────────────────────── */}
        {step === "preview" && previewData && (
          <DialogFooter className="shrink-0 pt-3 border-t w-full flex flex-row items-center justify-between sm:justify-between bg-background mt-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep("upload")}
              disabled={isUpdating}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft size={14} /> Back
            </Button>

            <div className="flex items-center gap-2">
              {previewData.errorCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportErrors}
                  disabled={isExporting}
                  className="gap-1.5 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30 font-medium"
                >
                  {isExporting ? <Loader2 size={14} className="animate-spin" /> : <DownloadCloudIcon size={14} />}
                  Download {previewData.errorCount} Error Rows
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleProceedUpdate}
                disabled={isUpdating || previewData.readyCount === 0 || selectedColumns.length === 0}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs px-4"
              >
                {isUpdating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Updating {previewData.readyCount} Instruments...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Proceed to Update ({previewData.readyCount} Instruments)
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        )}

        {/* ── STEP 3: RESULT ──────────────────────────────────────────────── */}
        {step === "result" && updateResult && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Bulk Update Complete!</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                Your database records have been successfully updated in an atomic transaction.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-sm pt-2">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg text-center">
                <span className="block text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {updateResult.successCount}
                </span>
                <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                  Updated Successfully
                </span>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <span className="block text-2xl font-bold text-foreground">
                  {updateResult.failedCount}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Failed / Skipped
                </span>
              </div>
            </div>

            <div className="pt-4 flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => {
                  handleModalClose(false);
                  onRefresh();
                }}
                className="gap-1.5 text-xs font-semibold px-6"
              >
                Done & View Inventory
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
