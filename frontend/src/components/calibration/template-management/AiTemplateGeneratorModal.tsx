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
import { TableGridBlock, MatrixTableBlock, TextBlock, CanvasBlock } from "@/types/template";

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
                    Gemini 1.5 Flash
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

              {/* Optional Custom Instructions */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Optional AI Guidance / Special Requirements</Label>
                <Textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g. Include 5 trials for external jaws, extract MPE limits from ISO 1502 standard, set tolerance to ±0.01 mm..."
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
                      {/* 1. TABLE GRID */}
                      {block.type === "table_grid" && (
                        <div className="border border-black overflow-hidden bg-white dark:bg-slate-900">
                          <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-2 py-1 flex items-center justify-between border-b border-black text-[11px] font-bold">
                            <span>{(block as TableGridBlock).title || `Calibration Section #${idx + 1}`}</span>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground font-normal">
                              <span>Unit: {(block as TableGridBlock).unit || extractedResult.defaultUnit}</span>
                              <span>• Tol: ±{(block as TableGridBlock).tolerance ?? extractedResult.defaultTolerance}</span>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[10px] text-center border-black">
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black">
                                  {(block as TableGridBlock).columns.map((col) => (
                                    <th key={col.id} style={{ width: col.width }} className="py-1 px-1.5">
                                      {col.label}
                                      {col.type === "formula" && <span className="text-[8px] text-primary block font-normal">(fx)</span>}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black">
                                {(block as TableGridBlock).rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="divide-x divide-black hover:bg-slate-50/50">
                                    {(block as TableGridBlock).columns.map((col) => {
                                      const dec = (block as TableGridBlock).decimal_places ?? extractedResult.decimalPlaces ?? 3;
                                      if (col.id === "point_number" || col.id === "sl_no") {
                                        return <td key={col.id} className="py-1 px-1.5 font-bold">{row.point_number ?? (rIdx + 1)}</td>;
                                      }
                                      if (col.type === "nominal") {
                                        return <td key={col.id} className="py-1 px-1.5 font-bold">{Number(row.nominal ?? 0).toFixed(dec)}</td>;
                                      }
                                      if (col.type === "text") {
                                        return <td key={col.id} className="py-1 px-1.5">{row.description || "-"}</td>;
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

                          {(block as TableGridBlock).footerNote && (
                            <div className="p-1 bg-slate-50 dark:bg-slate-800/40 text-[9px] text-muted-foreground italic border-t border-black">
                              * {(block as TableGridBlock).footerNote}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. MATRIX TABLE */}
                      {block.type === "matrix_table" && (
                        <div className="border border-black overflow-hidden bg-white dark:bg-slate-900">
                          <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-2 py-1 text-[11px] font-bold border-b border-black">
                            {(block as MatrixTableBlock).title || "Acceptance Criteria Reference Matrix"}
                          </div>
                          <table className="w-full border-collapse text-[10px] text-center border-black">
                            <thead>
                              {(block as MatrixTableBlock).headers.map((hRow, hIdx) => (
                                <tr key={hIdx} className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black">
                                  {hRow.map((cell, cIdx) => (
                                    <th key={cIdx} colSpan={cell.colSpan} rowSpan={cell.rowSpan} className="py-1 px-1.5">
                                      {cell.text}
                                    </th>
                                  ))}
                                </tr>
                              ))}
                            </thead>
                            <tbody className="divide-y divide-black">
                              {(block as MatrixTableBlock).rows.map((r, rIdx) => (
                                <tr key={rIdx} className="divide-x divide-black">
                                  {r.map((val, cIdx) => (
                                    <td key={cIdx} className="py-1 px-1.5 font-mono">{val}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* 3. NOTE / CALLOUT */}
                      {block.type === "text_block" && (
                        <div className="p-2 border border-black bg-slate-50 dark:bg-slate-800/40 text-xs flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{(block as TextBlock).content}</span>
                        </div>
                      )}
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
                  Extracting with Gemini 1.5 Flash...
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
