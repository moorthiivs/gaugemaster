import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Upload,
  FileSpreadsheet,
  Image as ImageIcon,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  ArrowRight,
  ExternalLink,
  Table,
  Layers,
  RotateCcw,
  Check,
  FileText,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import {
  generateTemplateFromImage,
  generateTemplateFromExcel,
  getStoredGeminiApiKey,
  saveStoredGeminiApiKey,
  GeneratedTemplateResult,
} from "@/lib/geminiService";
import { TableGridBlock, MatrixTableBlock, TextBlock, CanvasBlock, SplitRowBlock } from "@/types/template";
import { CANVAS_PRESETS, CanvasTemplatePreset } from "@/data/canvasPresets";

interface AiTemplateGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyTemplate: (result: GeneratedTemplateResult) => void;
}

export function AiTemplateGeneratorModal({
  open,
  onOpenChange,
  onApplyTemplate,
}: AiTemplateGeneratorModalProps) {
  const [apiKey, setApiKey] = useState<string>(() => getStoredGeminiApiKey());
  const [showKeyInput, setShowKeyInput] = useState<boolean>(!getStoredGeminiApiKey());
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"image" | "excel">("image");
  const [previewMode, setPreviewMode] = useState<"sheet" | "summary">("sheet");

  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel Upload State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelSummary, setExcelSummary] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Loading & Generation State
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedResult, setExtractedResult] = useState<GeneratedTemplateResult | null>(null);

  const handleSaveApiKey = () => {
    saveStoredGeminiApiKey(apiKey);
    toast.success("Gemini API key saved!");
    setShowKeyInput(false);
  };

  // Process selected image file
  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP)");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Process selected Excel file
  const handleExcelSelect = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls") && !file.name.endsWith(".csv")) {
      toast.error("Please select a valid Excel or CSV file (.xlsx, .xls, .csv)");
      return;
    }
    setExcelFile(file);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      let textOutput = "";
      workbook.eachSheet((worksheet) => {
        textOutput += `Sheet: ${worksheet.name}\n`;
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          const rowValues = Array.isArray(row.values)
            ? row.values.slice(1).map((v) => (v !== null && v !== undefined ? String(v) : "")).join(" | ")
            : "";
          textOutput += `Row ${rowNumber}: ${rowValues}\n`;
        });
        textOutput += "\n";
      });

      setExcelSummary(textOutput);
      toast.success(`Loaded Excel file (${workbook.worksheets.length} sheets)`);
    } catch (err: any) {
      console.error("Excel parse error", err);
      toast.error("Could not parse Excel workbook. You can still proceed with AI extraction.");
    }
  };

  // Generate Template via Gemini
  const handleGenerate = async () => {
    const keyToUse = apiKey.trim() || getStoredGeminiApiKey();
    if (!keyToUse) {
      toast.error("Please enter a Google Gemini API Key first.");
      setShowKeyInput(true);
      return;
    }

    if (activeTab === "image" && !imageFile) {
      toast.error("Please upload or paste an image of the calibration sheet first.");
      return;
    }

    if (activeTab === "excel" && (!excelFile || !excelSummary)) {
      toast.error("Please upload an Excel file first.");
      return;
    }

    setIsProcessing(true);
    setExtractedResult(null);

    try {
      let result: GeneratedTemplateResult;
      if (activeTab === "image" && imageFile) {
        result = await generateTemplateFromImage(imageFile, customInstructions, keyToUse);
      } else {
        result = await generateTemplateFromExcel(excelSummary || "", customInstructions, keyToUse);
      }

      setExtractedResult(result);
      toast.success(`Successfully extracted "${result.name}" template with ${result.blocks.length} blocks!`);
    } catch (err: any) {
      console.error("AI Generation Error", err);
      toast.error(err.message || "Failed to generate template from document.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (!extractedResult) return;
    onApplyTemplate(extractedResult);
    onOpenChange(false);
    toast.success("Applied AI generated template to Visual Canvas Designer!");
  };

  const handleReset = () => {
    setImageFile(null);
    setImagePreview(null);
    setExcelFile(null);
    setExcelSummary(null);
    setExtractedResult(null);
  };

  const handleLoadPreset = (preset: CanvasTemplatePreset) => {
    setExtractedResult({
      name: preset.name,
      description: preset.description,
      instrumentType: preset.instrumentType,
      defaultUnit: preset.defaultUnit,
      defaultTolerance: preset.defaultTolerance,
      decimalPlaces: 3,
      acceptanceCriteria: {
        enabled: true,
        type: "absolute",
        value: preset.defaultTolerance,
      },
      blocks: preset.blocks,
    });
    toast.success(`Loaded "${preset.name}" preset into Preview!`);
  };

  // Helper to render Table Grid in sheet preview
  const renderPreviewTableGrid = (tbl: TableGridBlock, keyPrefix: string) => {
    const dec = tbl.decimal_places ?? extractedResult?.decimalPlaces ?? 3;
    return (
      <div key={keyPrefix} className="border border-black overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
        <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-2 py-1 flex items-center justify-between border-b border-black text-[11px] font-bold">
          <span>{tbl.title || "Calibration Table"}</span>
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground font-normal">
            <span>Unit: {tbl.unit || extractedResult?.defaultUnit || "mm"}</span>
            <span>• Tol: ±{tbl.tolerance ?? extractedResult?.defaultTolerance ?? 0.005}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[10px] text-center border-black">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black">
                {tbl.columns.map((col) => (
                  <th key={col.id} style={{ width: col.width }} className="py-1 px-1.5">
                    {col.label}
                    {col.type === "formula" && <span className="text-[8px] text-primary block font-normal">(fx)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {tbl.rows.map((row, rIdx) => (
                <tr key={rIdx} className="divide-x divide-black hover:bg-slate-50/50">
                  {tbl.columns.map((col) => {
                    if (col.id === "point_number" || col.id === "sl_no") {
                      return <td key={col.id} className="py-1 px-1.5 font-bold">{row.point_number ?? (rIdx + 1)}</td>;
                    }
                    if (col.type === "text" || col.id === "description") {
                      return <td key={col.id} className="py-1 px-1.5 font-semibold text-slate-800 dark:text-slate-200">{row.description || "-"}</td>;
                    }
                    if (col.type === "nominal") {
                      return <td key={col.id} className="py-1 px-1.5 font-bold">{Number(row.nominal ?? 0).toFixed(dec)}</td>;
                    }
                    if (col.type === "formula") {
                      return <td key={col.id} className="py-1 px-1.5 font-mono text-muted-foreground">{`+${(0).toFixed(dec)}`}</td>;
                    }
                    if (col.type === "status") {
                      return (
                        <td key={col.id} className="py-1 px-1.5">
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">PASS</span>
                        </td>
                      );
                    }
                    return <td key={col.id} className="py-1 px-1.5 font-mono text-muted-foreground">{Number(row.nominal ?? 0).toFixed(dec)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tbl.footerNote && (
          <div className="p-1 bg-slate-50 dark:bg-slate-800/40 text-[9px] text-muted-foreground italic border-t border-black">
            * {tbl.footerNote}
          </div>
        )}
      </div>
    );
  };

  // Helper to render Matrix Table in sheet preview
  const renderPreviewMatrixTable = (matrix: MatrixTableBlock, keyPrefix: string) => {
    return (
      <div key={keyPrefix} className="border border-black overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
        <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-2 py-1 text-[11px] font-bold border-b border-black flex items-center justify-between">
          <span>{matrix.title || "Acceptance critiria"}</span>
          <Badge variant="outline" className="text-[9px] border-black/30 font-mono">
            Acceptance Limits
          </Badge>
        </div>
        <table className="w-full border-collapse text-[10px] text-center border-black">
          <thead>
            {(matrix.headers || []).map((hRow, hIdx) => {
              const cells: any[] = Array.isArray(hRow)
                ? hRow
                : (hRow && typeof hRow === "object")
                  ? [hRow]
                  : [{ text: String(hRow || "") }];
              return (
                <tr key={hIdx} className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black">
                  {cells.map((cell: any, cIdx: number) => {
                    const cellText = typeof cell === "object" && cell !== null ? (cell.text ?? "") : String(cell ?? "");
                    const colSpan = typeof cell === "object" && cell !== null ? cell.colSpan : undefined;
                    const rowSpan = typeof cell === "object" && cell !== null ? cell.rowSpan : undefined;
                    return (
                      <th key={cIdx} colSpan={colSpan} rowSpan={rowSpan} className="py-1 px-1.5">
                        {cellText}
                      </th>
                    );
                  })}
                </tr>
              );
            })}
          </thead>
          <tbody className="divide-y divide-black">
            {(matrix.rows || []).map((r: any, rIdx: number) => {
              const cells: any[] = Array.isArray(r)
                ? r
                : (r && typeof r === "object")
                  ? Object.values(r)
                  : [r];
              return (
                <tr key={rIdx} className="divide-x divide-black hover:bg-slate-50/50">
                  {cells.map((val: any, cIdx: number) => (
                    <td key={cIdx} className={`py-1 px-1.5 ${cIdx === 1 ? "font-semibold text-left pl-3" : "font-mono"}`}>
                      {typeof val === "object" && val !== null ? (val.text ?? JSON.stringify(val)) : String(val ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Helper to render Text Block in sheet preview
  const renderPreviewTextBlock = (textBlock: TextBlock, keyPrefix: string) => {
    return (
      <div key={keyPrefix} className="p-2 border border-black bg-slate-50 dark:bg-slate-800/40 text-xs flex items-center gap-2 shadow-xs">
        <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>{textBlock.content}</span>
      </div>
    );
  };

  // Helper to render Split Row (Side-by-Side) in sheet preview
  const renderPreviewSplitRow = (splitBlock: SplitRowBlock, keyPrefix: string) => {
    const colCount = splitBlock.children?.length || 2;
    return (
      <div key={keyPrefix} className="space-y-1.5 p-2 bg-indigo-50/20 dark:bg-indigo-950/20 rounded border border-dashed border-indigo-400">
        <div className="flex items-center justify-between text-[10px] text-indigo-700 dark:text-indigo-300 font-bold px-0.5">
          <span className="flex items-center gap-1">
            <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
            Side-by-Side Split Tables ({colCount} Columns)
          </span>
          <Badge variant="outline" className="text-[9px] border-indigo-300 text-indigo-700 dark:text-indigo-300">
            {splitBlock.columnRatio || "50/50"} Layout
          </Badge>
        </div>

        <div className={`grid grid-cols-1 ${colCount === 3 ? "md:grid-cols-3" : "md:grid-cols-2"} gap-2 items-start`}>
          {splitBlock.children?.map((child, cIdx) => (
            <div key={child.id || `${keyPrefix}_c${cIdx}`} className="min-w-0">
              {child.type === "table_grid" && renderPreviewTableGrid(child as TableGridBlock, `${keyPrefix}_t${cIdx}`)}
              {child.type === "matrix_table" && renderPreviewMatrixTable(child as MatrixTableBlock, `${keyPrefix}_m${cIdx}`)}
              {child.type === "text_block" && renderPreviewTextBlock(child as TextBlock, `${keyPrefix}_txt${cIdx}`)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
                  AI Smart Template Generator
                  <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/40 bg-amber-500/10">
                    Gemini 2.0 / 1.5 Flash
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300">
                  Upload an Excel sheet or calibration drawing/certificate image to auto-generate a complete Canvas Template.
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 h-8 gap-1.5"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              {apiKey ? "API Key Configured" : "Enter API Key"}
            </Button>
          </div>

          {/* API Key Configuration Dropdown */}
          {showKeyInput && (
            <div className="mt-3 p-3 bg-slate-800/90 rounded-lg border border-slate-700 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Google Gemini API Key (Free from AI Studio)
                </Label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                >
                  Get Free API Key <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="h-8 text-xs bg-slate-900 border-slate-700 font-mono text-white"
                />
                <Button size="sm" onClick={handleSaveApiKey} className="h-8 text-xs shrink-0">
                  Save Key
                </Button>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {!extractedResult ? (
            <>
              {/* Tabs for Upload Method */}
              <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="image" className="text-xs gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-500" />
                    Image / Drawing / Scanned Certificate
                  </TabsTrigger>
                  <TabsTrigger value="excel" className="text-xs gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    Excel Workbook (.xlsx / .csv)
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Image Upload */}
                <TabsContent value="image" className="space-y-3 pt-2">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files?.[0]) {
                        handleImageSelect(e.dataTransfer.files[0]);
                      }
                    }}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary/60 rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-900/30 flex flex-col items-center justify-center min-h-[160px]"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleImageSelect(e.target.files[0]);
                      }}
                    />

                    {imagePreview ? (
                      <div className="space-y-2">
                        <img
                          src={imagePreview}
                          alt="Uploaded Calibration Standard"
                          className="max-h-44 max-w-full rounded border shadow-sm mx-auto object-contain"
                        />
                        <div className="text-xs text-muted-foreground font-medium">
                          {imageFile?.name} ({(imageFile!.size / 1024).toFixed(1)} KB) - Click to change
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-xs font-semibold">
                          Click to upload or Drag & Drop calibration image / standard drawing
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Supports PNG, JPG, JPEG, WebP (Max 10MB)
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Tab 2: Excel Upload */}
                <TabsContent value="excel" className="space-y-3 pt-2">
                  <div
                    onClick={() => excelInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files?.[0]) {
                        handleExcelSelect(e.dataTransfer.files[0]);
                      }
                    }}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500/60 rounded-xl p-6 text-center cursor-pointer transition-all bg-emerald-50/20 dark:bg-emerald-950/10 flex flex-col items-center justify-center min-h-[160px]"
                  >
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleExcelSelect(e.target.files[0]);
                      }}
                    />

                    {excelFile ? (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                          <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {excelFile.name} ({(excelFile.size / 1024).toFixed(1)} KB)
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Ready for AI parsing and conversion - Click to change file
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-xs font-semibold">
                          Click to upload or Drag & Drop Excel calibration sheet
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Supports .xlsx, .xls, and .csv files
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Quick Standard Presets Bar */}
              <div className="p-3 bg-gradient-to-r from-indigo-50/80 via-blue-50/40 to-purple-50/80 dark:from-indigo-950/40 dark:via-blue-950/20 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Instant Accredited Presets (ISO / IS Calibration Standards)
                  </span>
                  <Badge variant="outline" className="text-[10px] text-indigo-700 dark:text-indigo-300 border-indigo-300">
                    Zero Setup
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CANVAS_PRESETS.slice(0, 5).map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadPreset(preset)}
                      className="h-7 text-[11px] px-2.5 py-0 border-indigo-300/80 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-950 dark:text-indigo-200 rounded-full font-medium"
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Optional Custom Instructions */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Optional AI Guidance / Special Requirements</Label>
                <Textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g. Include 5 trials for measuring anvils, place Flatness and Parallelism side-by-side in a split row, extract Acceptance criteria table..."
                  className="text-xs resize-none h-16"
                />
              </div>
            </>
          ) : (
            /* Review Extracted Result with Sheet Table Preview */
            <div className="space-y-3">
              {/* Header Status Bar */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                      Extraction Complete: {extractedResult.name}
                    </h4>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-400">
                      Instrument: <strong>{extractedResult.instrumentType}</strong> | Unit: <strong>{extractedResult.defaultUnit}</strong> | Tolerance: <strong>±{extractedResult.defaultTolerance}</strong> | Decimals: <strong>{extractedResult.decimalPlaces}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-200 dark:bg-slate-800 rounded p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("sheet")}
                      className={`px-2 py-1 rounded font-medium transition-all ${
                        previewMode === "sheet"
                          ? "bg-white dark:bg-slate-900 shadow-xs text-primary font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Table className="w-3 h-3 inline mr-1" />
                      Table Format Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("summary")}
                      className={`px-2 py-1 rounded font-medium transition-all ${
                        previewMode === "summary"
                          ? "bg-white dark:bg-slate-900 shadow-xs text-primary font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Layers className="w-3 h-3 inline mr-1" />
                      Block List ({extractedResult.blocks.length})
                    </button>
                  </div>

                  <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs gap-1">
                    <RotateCcw className="w-3 h-3" /> Re-upload
                  </Button>
                </div>
              </div>

              {/* VIEW 1: FULL TABLE FORMAT SHEET PREVIEW */}
              {previewMode === "sheet" ? (
                <div className="border border-black bg-white dark:bg-slate-950 rounded p-4 space-y-3.5 max-h-[420px] overflow-y-auto shadow-inner font-sans text-black dark:text-slate-100">
                  <div className="border-b border-black pb-1.5 flex items-center justify-between text-xs">
                    <span className="font-bold text-[11px] uppercase tracking-wide">
                      {extractedResult.name} (Live Layout Preview)
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Precision: {extractedResult.decimalPlaces} Decimals
                    </span>
                  </div>

                  {extractedResult.blocks.map((block, idx) => (
                    <div key={block.id || idx} className="space-y-1.5">
                      {block.type === "table_grid" && renderPreviewTableGrid(block as TableGridBlock, `b_${idx}`)}
                      {block.type === "split_row" && renderPreviewSplitRow(block as SplitRowBlock, `b_${idx}`)}
                      {block.type === "matrix_table" && renderPreviewMatrixTable(block as MatrixTableBlock, `b_${idx}`)}
                      {block.type === "text_block" && renderPreviewTextBlock(block as TextBlock, `b_${idx}`)}
                    </div>
                  ))}
                </div>
              ) : (
                /* VIEW 2: MODULAR BLOCK LIST SUMMARY */
                <div className="border rounded-lg p-3 bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-primary" />
                      Extracted Modular Blocks ({extractedResult.blocks.length})
                    </h4>
                    <Badge variant="secondary" className="text-[10px]">
                      Ready to Apply
                    </Badge>
                  </div>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto">
                    {extractedResult.blocks.map((block, idx) => (
                      <div
                        key={block.id || idx}
                        className="border rounded p-2.5 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">#{idx + 1}</span>
                            {(block as any).title || (block as any).content?.slice(0, 40) || block.type}
                            <Badge variant="outline" className="text-[9px] uppercase">
                              {block.type}
                            </Badge>
                          </div>
                          {block.type === "table_grid" && (
                            <div className="text-[11px] text-muted-foreground">
                              {(block as any).rows?.length || 0} Test Points | {(block as any).columns?.length || 0} Columns | Unit: {(block as any).unit || "mm"}
                            </div>
                          )}
                          {block.type === "split_row" && (
                            <div className="text-[11px] text-muted-foreground">
                              Side-by-Side Split: {(block as SplitRowBlock).children?.map((c: any) => c.title || c.type).join(" + ")} ({(block as SplitRowBlock).children?.length || 0} sub-tables)
                            </div>
                          )}
                          {block.type === "matrix_table" && (
                            <div className="text-[11px] text-muted-foreground">
                              Reference Matrix ({(block as any).rows?.length || 0} rows)
                            </div>
                          )}
                        </div>
                        <Badge className="bg-emerald-600 text-white text-[10px]">Valid</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 sm:p-4 bg-muted/40 border-t flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>

          {!extractedResult ? (
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isProcessing || (activeTab === "image" ? !imageFile : !excelFile)}
              className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting Layout with Gemini...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Canvas Template
                </>
              )}
            </Button>
          ) : (
            <Button size="sm" onClick={handleApply} className="gap-2 bg-primary shadow-sm font-bold">
              <Check className="w-4 h-4" />
              Apply to Visual Canvas Designer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
