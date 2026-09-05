import React, { useState } from "react";
import {
  CanvasBlock,
  TableGridBlock,
  SplitRowBlock,
  MatrixTableBlock,
  TextBlock,
  DiagramBlock,
  PageBreakBlock,
  CanvasColumnDef,
  CanvasRowData,
  MatrixHeaderCell,
} from "@/types/template";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Columns,
  Sparkles,
  LayoutGrid,
  FileText,
  Table,
  Sliders,
  SplitSquareVertical,
  Layers,
  Check,
  RotateCcw,
  BookOpen,
  Settings2,
  MousePointerClick,
  CheckCircle2,
  HelpCircle,
  FlaskConical,
  X,
  ArrowUpDown,
  ArrowLeftRight,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { CANVAS_PRESETS, CanvasTemplatePreset } from "@/data/canvasPresets";
import { AiTemplateGeneratorModal } from "@/components/calibration/template-management/AiTemplateGeneratorModal";
import { TrialRunModal } from "@/components/calibration/template-management/TrialRunModal";
import { GeneratedTemplateResult } from "@/lib/geminiService";
import {
  getEffectiveTableOrientation,
  getTableOrientationRecommendation,
} from "@/lib/tableLayoutOptimizer";

export { CANVAS_PRESETS };
export type { CanvasTemplatePreset };

interface CanvasTemplateEditorProps {
  blocks: CanvasBlock[];
  onChange: (blocks: CanvasBlock[]) => void;
  onSelectPreset?: (preset: CanvasTemplatePreset) => void;
  onApplyGeneratedTemplate?: (template: GeneratedTemplateResult) => void;
  templateName?: string;
  diagramImage?: string | null;
  diagramImageWidth?: number;
  diagramImageHeight?: number;
  diagramImageAlignment?: "center" | "left" | "right";
  defaultUnit?: string;
  defaultTolerance?: number;
  decimalPlaces?: number;
  onDecimalPlacesChange?: (dp: number) => void;
}

export function CanvasTemplateEditor({
  blocks,
  onChange,
  onSelectPreset,
  onApplyGeneratedTemplate,
  templateName,
  diagramImage,
  diagramImageWidth,
  diagramImageHeight,
  diagramImageAlignment,
  defaultUnit = "mm",
  defaultTolerance = 0.01,
  decimalPlaces = 3,
  onDecimalPlacesChange,
}: CanvasTemplateEditorProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() => blocks[0]?.id || null);
  const [selectedChildTableId, setSelectedChildTableId] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showTrialRun, setShowTrialRun] = useState(false);
  const [showInspector, setShowInspector] = useState(false);

  const markChanged = (newBlocks: CanvasBlock[]) => {
    onChange(newBlocks);
  };

  // Block Manipulation Helpers
  const addTableBlock = () => {
    const newBlock: TableGridBlock = {
      id: `table_${Date.now()}`,
      type: "table_grid",
      title: "New Calibration Table",
      width: "100%",
      unit: defaultUnit,
      tolerance: defaultTolerance,
      decimal_places: decimalPlaces,
      columns: [
        { id: "point_number", label: "Sl.No.", type: "nominal", width: "8%" },
        { id: "nominal", label: "Std. Spec", type: "nominal", width: "22%" },
        { id: "reading", label: "Actual Reading", type: "reading", width: "25%" },
        { id: "error", label: "Error", type: "formula", formula: "reading - nominal", width: "25%" },
        { id: "status", label: "Judgement", type: "status", formula: "IF(ABS(error)<=tolerance,'PASS','FAIL')", width: "20%" },
      ],
      rows: [
        { point_number: 1, nominal: 10.0, unit: defaultUnit },
        { point_number: 2, nominal: 20.0, unit: defaultUnit },
        { point_number: 3, nominal: 50.0, unit: defaultUnit },
      ],
    };
    markChanged([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    setSelectedChildTableId(null);
    toast.success("Added Table Grid block");
  };

  const addSplitRowBlock = () => {
    const newBlock: SplitRowBlock = {
      id: `split_${Date.now()}`,
      type: "split_row",
      columnsCount: 2,
      columnRatio: "50/50",
      children: [
        {
          id: `tbl_left_${Date.now()}`,
          type: "table_grid",
          title: "Left Section Table",
          unit: defaultUnit,
          tolerance: defaultTolerance,
          decimal_places: decimalPlaces,
          columns: [
            { id: "nominal", label: "Std Spec", type: "nominal", width: "30%" },
            { id: "reading", label: "Observed", type: "reading", width: "35%" },
            { id: "error", label: "Error", type: "formula", formula: "reading - nominal", width: "35%" },
          ],
          rows: [
            { point_number: 1, nominal: 20.0, unit: defaultUnit },
            { point_number: 2, nominal: 50.0, unit: defaultUnit },
          ],
        },
        {
          id: `tbl_right_${Date.now()}`,
          type: "table_grid",
          title: "Right Section Table",
          unit: defaultUnit,
          tolerance: defaultTolerance,
          decimal_places: decimalPlaces,
          columns: [
            { id: "description", label: "Item", type: "text", width: "35%" },
            { id: "reading", label: "Observed", type: "reading", width: "35%" },
            { id: "status", label: "Judge.", type: "status", width: "30%" },
          ],
          rows: [
            { point_number: 1, description: "Sample Face A", unit: defaultUnit },
            { point_number: 2, description: "Sample Face B", unit: defaultUnit },
          ],
        },
      ],
    };
    markChanged([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    setSelectedChildTableId(newBlock.children[0]?.id || null);
    toast.success("Added Side-by-Side Split Row container");
  };

  const addMatrixBlock = () => {
    const newBlock: MatrixTableBlock = {
      id: `matrix_${Date.now()}`,
      type: "matrix_table",
      title: "Acceptance Criteria Reference Matrix",
      width: "100%",
      headers: [
        [
          { text: "LEAST COUNT", rowSpan: 2 },
          { text: "0.01mm", colSpan: 2 },
          { text: "0.02mm", colSpan: 2 },
        ],
        [{ text: "Maximum Permissible Error (MPE)", colSpan: 4 }],
        [
          { text: "Length (mm)" },
          { text: "New" },
          { text: "Recalib" },
          { text: "New" },
          { text: "Recalib" },
        ],
      ],
      rows: [
        ["0 - 100", "±0.010", "±0.020", "±0.020", "±0.030"],
        ["100 - 300", "±0.020", "±0.030", "±0.030", "±0.040"],
      ],
    };
    markChanged([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    setSelectedChildTableId(null);
    toast.success("Added Acceptance Criteria Matrix table");
  };

  const addTextBlock = () => {
    const newBlock: TextBlock = {
      id: `text_${Date.now()}`,
      type: "text_block",
      content: "All measuring faces and jaws are verified free from dents, corrosion, and physical damage.",
      style: "callout",
    };
    markChanged([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    setSelectedChildTableId(null);
    toast.success("Added Note / Condition block");
  };

  const addPageBreak = () => {
    const newBlock: PageBreakBlock = {
      id: `pb_${Date.now()}`,
      type: "page_break",
      label: "Next Page / Page Break",
    };
    markChanged([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    setSelectedChildTableId(null);
    toast.success("Added Page Break");
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const updated = [...blocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    markChanged(updated);
  };

  const duplicateBlock = (block: CanvasBlock, index: number) => {
    const clone = JSON.parse(JSON.stringify(block));
    clone.id = `${block.type}_${Date.now()}`;
    if (clone.title) clone.title = `${clone.title} (Copy)`;
    const updated = [...blocks];
    updated.splice(index + 1, 0, clone);
    markChanged(updated);
    setSelectedBlockId(clone.id);
    toast.success("Block duplicated");
  };

  const deleteBlock = (index: number) => {
    const updated = blocks.filter((_, i) => i !== index);
    markChanged(updated);
    if (selectedBlockId === blocks[index]?.id) {
      setSelectedBlockId(updated[0]?.id || null);
    }
    toast.info("Block removed from canvas");
  };

  const updateBlock = (index: number, updatedBlock: CanvasBlock) => {
    const updated = [...blocks];
    updated[index] = updatedBlock;
    markChanged(updated);
  };

  // Find currently selected block
  const selectedBlockIndex = blocks.findIndex((b) => b.id === selectedBlockId);
  const selectedBlock = selectedBlockIndex !== -1 ? blocks[selectedBlockIndex] : null;

  // Selected Table inside Split Row or Root Table
  let activeTableBlock: TableGridBlock | null = null;
  if (selectedBlock?.type === "table_grid") {
    activeTableBlock = selectedBlock as TableGridBlock;
  } else if (selectedBlock?.type === "split_row") {
    const split = selectedBlock as SplitRowBlock;
    activeTableBlock = (split.children.find((c) => c.id === selectedChildTableId && c.type === "table_grid") as TableGridBlock) ||
      (split.children.find((c) => c.type === "table_grid") as TableGridBlock) || null;
  }

  // Update active table block either at root or inside split row
  const updateActiveTable = (updatedTbl: TableGridBlock) => {
    if (!selectedBlock) return;
    if (selectedBlock.type === "table_grid") {
      updateBlock(selectedBlockIndex, updatedTbl);
    } else if (selectedBlock.type === "split_row") {
      const split = selectedBlock as SplitRowBlock;
      const updatedChildren = split.children.map((c) => (c.id === updatedTbl.id ? updatedTbl : c));
      updateBlock(selectedBlockIndex, { ...split, children: updatedChildren });
    }
  };

  // Helper to evaluate formula preview in builder with decimal formatting
  const evaluatePreviewCell = (
    row: CanvasRowData,
    col: CanvasColumnDef,
    tableDec: number = 3
  ): React.ReactNode => {
    const dec = col.decimal_places ?? tableDec ?? decimalPlaces ?? 3;
    if (col.type === "nominal") {
      return row.nominal !== undefined && row.nominal !== null
        ? Number(row.nominal).toFixed(dec)
        : "-";
    }
    if (col.type === "text") return row.description || "-";
    if (col.type === "trial" || col.type === "reading") {
      const val = row[col.id] ?? row.reading ?? row.nominal;
      return val !== undefined && val !== null ? Number(val).toFixed(dec) : "-";
    }
    if (col.type === "formula") {
      const formula = (col.formula || "").toLowerCase();
      const nom = Number(row.nominal ?? 0);
      if (formula.includes("average")) {
        return nom.toFixed(dec);
      }
      if (formula.includes("reading - nominal") || formula.includes("avg - nominal") || formula.includes("error")) {
        return `+${(0).toFixed(dec)}`;
      }
      return `+${(0).toFixed(dec)}`;
    }
    if (col.type === "status") {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          PASS
        </span>
      );
    }
    return "-";
  };

  const handleApplyAiGenerated = (result: GeneratedTemplateResult) => {
    if (result.blocks && result.blocks.length > 0) {
      markChanged(result.blocks);
      setSelectedBlockId(result.blocks[0]?.id || null);
    }
    if (onApplyGeneratedTemplate) {
      onApplyGeneratedTemplate(result);
    }
    toast.success(`Loaded "${result.name}" with ${result.blocks.length} blocks!`);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Presets Header */}
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-md border border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              WYSIWYG Visual Canvas Designer 2.0
              <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/40 bg-amber-500/10">
                {blocks.length} Modular Blocks
              </Badge>
            </h3>
            <p className="text-[11px] text-slate-400">
              Click any block on the central certificate to edit its properties, formulas & tolerances in the Right Inspector Panel.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={showInspector ? "default" : "outline"}
            size="sm"
            onClick={() => setShowInspector(!showInspector)}
            className={`text-xs gap-1.5 h-8 font-bold shadow-sm ${
              showInspector ? "bg-primary text-primary-foreground" : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {showInspector ? "Hide Properties" : "⚙️ Block Properties"}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setShowTrialRun(true)}
            disabled={blocks.length === 0}
            className="text-xs bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white gap-1.5 h-8 font-bold shadow-sm"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            🧪 Trial Run & Certificate Preview
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setShowAiModal(true)}
            className="text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white gap-1.5 h-8 font-bold shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Smart Generate (Excel / Image)
          </Button>
        </div>
      </div>

      {/* 3-COLUMN WYSIWYG WORKSPACE */}
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
        
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT TOOLBOX & PRESETS (240px) */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[240px] shrink-0 space-y-4">
          {/* Add Blocks Toolbox */}
          <div className="bg-card border rounded-xl p-3 shadow-sm space-y-2.5">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-primary" />
              Add Modular Blocks
            </h4>
            <div className="grid grid-cols-1 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTableBlock}
                className="justify-start text-xs h-8 gap-2 bg-slate-50 dark:bg-slate-900/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40 font-medium"
              >
                <Table className="w-3.5 h-3.5 text-blue-500" />
                + Data Table Grid
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSplitRowBlock}
                className="justify-start text-xs h-8 gap-2 bg-slate-50 dark:bg-slate-900/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40 font-medium"
              >
                <SplitSquareVertical className="w-3.5 h-3.5 text-indigo-500" />
                + Side-by-Side (50/50)
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMatrixBlock}
                className="justify-start text-xs h-8 gap-2 bg-slate-50 dark:bg-slate-900/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40 font-medium"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-purple-500" />
                + Reference Matrix
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTextBlock}
                className="justify-start text-xs h-8 gap-2 bg-slate-50 dark:bg-slate-900/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40 font-medium"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                + Note / Statement
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPageBreak}
                className="justify-start text-xs h-8 gap-2 bg-slate-50 dark:bg-slate-900/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40 font-medium"
              >
                <Columns className="w-3.5 h-3.5 text-amber-500" />
                + Page Break
              </Button>
            </div>
          </div>

          {/* Standard Presets List */}
          <div className="bg-card border rounded-xl p-3 shadow-sm space-y-2.5">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-500" />
              1-Click Standard Presets
            </h4>
            <div className="space-y-1.5">
              {CANVAS_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    if (onSelectPreset) {
                      onSelectPreset(preset);
                    } else {
                      markChanged(JSON.parse(JSON.stringify(preset.blocks)));
                    }
                    setSelectedBlockId(preset.blocks[0]?.id || null);
                    toast.success(`Loaded "${preset.name}" preset!`);
                  }}
                  className="w-full text-left p-2 rounded-lg border bg-slate-50/60 dark:bg-slate-900/40 hover:bg-primary/5 hover:border-primary/40 transition-all group space-y-0.5"
                >
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-primary flex items-center justify-between">
                    {preset.name}
                    <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">
                      {preset.instrumentType}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTRAL CANVAS WORKSPACE (LIVE A4 CERTIFICATE SHEET) */}
        {/* ========================================================================= */}
        <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950 p-3 sm:p-5 rounded-xl border border-slate-300 dark:border-slate-800 min-h-[700px] flex flex-col items-center overflow-x-auto">
          <div className="w-full max-w-[850px] bg-white dark:bg-slate-900 shadow-xl border border-black/80 rounded-sm p-4 sm:p-6 space-y-3.5 text-black dark:text-slate-100 font-sans">
            
            {/* Certificate Header Banner */}
            <div className="border border-black p-2 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
              <span className="font-bold tracking-wide uppercase text-[10.5px] text-slate-700 dark:text-slate-300">
                [ Calibration Certificate Live Layout Preview ]
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">ISO/IEC 17025 Accredited Sheet</span>
            </div>

            {/* Blocks List */}
            {blocks.length === 0 ? (
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-10 text-center space-y-3">
                <Table className="w-8 h-8 mx-auto text-muted-foreground/50" />
                <div className="space-y-1">
                  <h4 className="font-bold text-xs">Your Certificate Canvas is Empty</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Click a block on the left or use <strong>AI Smart Generate</strong> to build your template.
                  </p>
                </div>
              </div>
            ) : (
              blocks.map((block, index) => (
                <div
                  key={block.id}
                  onClick={() => {
                    setSelectedBlockId(block.id);
                    setShowInspector(true);
                  }}
                  style={{
                    marginTop: `${(block as any).marginTop !== undefined ? (block as any).marginTop : 0}px`,
                    marginBottom: `${(block as any).marginBottom !== undefined ? (block as any).marginBottom : 6}px`,
                  }}
                  className={`relative group border transition-all rounded-sm cursor-pointer ${
                    selectedBlockId === block.id
                      ? "ring-2 ring-primary border-primary shadow-sm bg-primary/[0.01]"
                      : "border-slate-300 hover:border-primary/50"
                  }`}
                >
                  {/* Floating Action Controls on Hover */}
                  <div className="absolute -top-3.5 right-2 z-10 hidden group-hover:flex items-center gap-1 bg-slate-900 text-white px-2 py-0.5 rounded shadow text-xs">
                    <span className="text-[9px] font-mono text-amber-400 mr-1 uppercase font-bold">{block.type}</span>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={(e) => { e.stopPropagation(); moveBlock(index, "up"); }}
                      className="p-0.5 hover:text-amber-400 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={index === blocks.length - 1}
                      onClick={(e) => { e.stopPropagation(); moveBlock(index, "down"); }}
                      className="p-0.5 hover:text-amber-400 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); duplicateBlock(block, index); }}
                      className="p-0.5 hover:text-emerald-400"
                      title="Duplicate Block"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteBlock(index); }}
                      className="p-0.5 hover:text-red-400"
                      title="Delete Block"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* 1. TABLE GRID BLOCK */}
                  {block.type === "table_grid" && (() => {
                    const effOrient = getEffectiveTableOrientation(block as TableGridBlock);
                    const isAuto = !block.orientation || block.orientation === "auto";
                    const displayCols = (block.columns || []).filter(
                      (c) => c.id !== "point_number" && c.id !== "sl_no" && c.id !== "sino" && c.id !== "slno"
                    );

                    return (
                      <div className="border border-black overflow-hidden bg-white dark:bg-slate-900">
                        <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-2 py-1 flex items-center justify-between border-b border-black flex-wrap gap-1">
                          <Input
                            value={block.title}
                            onChange={(e) => {
                              const updated = { ...block, title: e.target.value };
                              updateBlock(index, updated);
                            }}
                            className="h-5 text-xs font-bold bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary w-56 p-0"
                            placeholder="Table Section Title"
                          />
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                            <span>Unit: {block.unit || "mm"}</span>
                            <span>• Tol: ±{block.tolerance ?? "0.01"}</span>
                            <span>• Dec: {block.decimal_places ?? decimalPlaces}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextOrient =
                                  block.orientation === "horizontal"
                                    ? "vertical"
                                    : block.orientation === "vertical"
                                    ? "auto"
                                    : "horizontal";
                                updateBlock(index, { ...block, orientation: nextOrient });
                                toast.info(`Print Orientation: ${nextOrient === "auto" ? `Auto (${getEffectiveTableOrientation({ ...block, orientation: "auto" })})` : nextOrient}`);
                              }}
                              title="Click to toggle print orientation (Auto / Horizontal / Vertical)"
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 border transition-colors ${
                                effOrient === "horizontal"
                                  ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-400 hover:bg-indigo-200"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-400 hover:bg-slate-200"
                              }`}
                            >
                              {effOrient === "horizontal" ? (
                                <ArrowLeftRight className="w-2.5 h-2.5" />
                              ) : (
                                <ArrowUpDown className="w-2.5 h-2.5" />
                              )}
                              <span>{isAuto ? `Auto (${effOrient})` : effOrient}</span>
                            </button>
                          </div>
                        </div>

                        {/* HORIZONTAL TRANSPOSED VIEW */}
                        {effOrient === "horizontal" ? (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[10px] text-center border-black" style={{ tableLayout: 'auto' }}>
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black">
                                  <th className="py-1 px-2 text-left bg-slate-200/80 dark:bg-slate-700/80 font-bold w-36 min-w-[130px] text-black dark:text-white">
                                    Parameter / Sl no
                                  </th>
                                  {block.rows.map((r, rIdx) => (
                                    <th key={rIdx} className="py-1 px-1.5 font-bold min-w-[45px] text-black dark:text-white">
                                      {r.point_number ?? (rIdx + 1)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black font-mono">
                                {displayCols.map((col) => (
                                  <tr key={col.id} className="divide-x divide-black hover:bg-slate-50/50">
                                    <td className="py-1 px-2 text-left font-bold bg-slate-50 dark:bg-slate-800/60 text-[9.5px] font-sans text-black dark:text-slate-200">
                                      {col.label}
                                      {col.type === "formula" && <span className="text-[8px] text-primary ml-1 font-normal">(fx)</span>}
                                    </td>
                                    {block.rows.map((row, rIdx) => {
                                      if (col.type === "nominal") {
                                        return (
                                          <td key={rIdx} className="py-0.5 px-1 min-w-[45px]">
                                            <Input
                                              type="number"
                                              step="any"
                                              value={row.nominal ?? ""}
                                              onChange={(e) => {
                                                const newRows = [...block.rows];
                                                newRows[rIdx] = { ...newRows[rIdx], nominal: parseFloat(e.target.value) || 0 };
                                                updateBlock(index, { ...block, rows: newRows });
                                              }}
                                              className="h-5 text-[10px] text-center border-none p-0 bg-transparent focus-visible:ring-1 font-bold"
                                            />
                                          </td>
                                        );
                                      }
                                      if (col.type === "text") {
                                        return (
                                          <td key={rIdx} className="py-0.5 px-1 min-w-[50px]">
                                            <Input
                                              value={row.description || ""}
                                              onChange={(e) => {
                                                const newRows = [...block.rows];
                                                newRows[rIdx] = { ...newRows[rIdx], description: e.target.value };
                                                updateBlock(index, { ...block, rows: newRows });
                                              }}
                                              className="h-5 text-[10px] text-center border-none p-0 bg-transparent focus-visible:ring-1"
                                              placeholder="Desc"
                                            />
                                          </td>
                                        );
                                      }
                                      return (
                                        <td key={rIdx} className="py-1 px-1.5 min-w-[45px]">
                                          <span className="text-muted-foreground font-mono">
                                            {evaluatePreviewCell(row, col, block.decimal_places ?? decimalPlaces)}
                                          </span>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          /* VERTICAL STANDARD VIEW */
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[10px] text-center border-black">
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black">
                                  {block.columns.map((col) => (
                                    <th key={col.id} style={{ width: col.width }} className="py-1 px-1.5 font-bold">
                                      {col.label}
                                      {col.type === "formula" && <span className="text-[8px] text-primary block font-normal">(fx)</span>}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black">
                                {block.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="divide-x divide-black hover:bg-slate-50/50">
                                    {block.columns.map((col) => {
                                      const isPointNo = col.id === "point_number" || col.id === "sl_no" || col.id === "sino";
                                      if (isPointNo) {
                                        return (
                                          <td key={col.id} className="py-1 px-1.5 font-bold text-slate-700 dark:text-slate-300">
                                            {row.point_number ?? (rIdx + 1)}
                                          </td>
                                        );
                                      }
                                      if (col.type === "nominal") {
                                        return (
                                          <td key={col.id} className="py-0.5 px-1">
                                            <Input
                                              type="number"
                                              step="any"
                                              value={row.nominal ?? ""}
                                              onChange={(e) => {
                                                const newRows = [...block.rows];
                                                newRows[rIdx] = { ...newRows[rIdx], nominal: parseFloat(e.target.value) || 0 };
                                                updateBlock(index, { ...block, rows: newRows });
                                              }}
                                              className="h-5 text-[10px] text-center border-none p-0 bg-transparent focus-visible:ring-1 font-bold"
                                            />
                                          </td>
                                        );
                                      }
                                      if (col.type === "text") {
                                        return (
                                          <td key={col.id} className="py-0.5 px-1">
                                            <Input
                                              value={row.description || ""}
                                              onChange={(e) => {
                                                const newRows = [...block.rows];
                                                newRows[rIdx] = { ...newRows[rIdx], description: e.target.value };
                                                updateBlock(index, { ...block, rows: newRows });
                                              }}
                                              className="h-5 text-[10px] text-center border-none p-0 bg-transparent focus-visible:ring-1"
                                              placeholder="Description"
                                            />
                                          </td>
                                        );
                                      }
                                      return (
                                        <td key={col.id} className="py-1 px-1.5">
                                          <span className="text-muted-foreground font-mono">
                                            {evaluatePreviewCell(row, col, block.decimal_places ?? decimalPlaces)}
                                          </span>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Add Row Controls */}
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-1 flex items-center justify-between text-[10px] border-t border-black">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newRow: CanvasRowData = {
                                point_number: block.rows.length + 1,
                                nominal: (block.rows[block.rows.length - 1]?.nominal || 0) + 10,
                                unit: block.unit || "mm",
                              };
                              updateBlock(index, { ...block, rows: [...block.rows, newRow] });
                            }}
                            className="h-5 px-1.5 text-[10px] text-primary gap-1 font-semibold hover:bg-primary/10"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            Add Point / Row
                          </Button>
                          {block.rows.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newRows = block.rows.slice(0, -1);
                                updateBlock(index, { ...block, rows: newRows });
                              }}
                              className="h-5 px-1.5 text-[10px] text-destructive hover:bg-destructive/10"
                            >
                              Remove Last Point
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. SPLIT ROW CONTAINER */}
                  {block.type === "split_row" && (
                    <div className="space-y-2 p-1.5 bg-slate-50/50 dark:bg-slate-800/30 rounded border border-dashed border-indigo-400">
                      <div className="flex items-center justify-between text-[10px] text-indigo-600 dark:text-indigo-400 font-bold px-1">
                        <span className="flex items-center gap-1">
                          <SplitSquareVertical className="w-3 h-3" />
                          Side-by-Side Split ({block.children.length} Columns)
                        </span>
                      </div>

                      <div className={`grid grid-cols-1 md:grid-cols-${block.children.length} gap-2 items-start`}>
                        {block.children.map((child, cIdx) => (
                          <div
                            key={child.id || cIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBlockId(block.id);
                              setSelectedChildTableId(child.id);
                              setShowInspector(true);
                            }}
                            className={`border border-black overflow-hidden bg-white dark:bg-slate-900 flex flex-col ${
                              selectedChildTableId === child.id ? "ring-2 ring-indigo-500" : ""
                            }`}
                          >
                            {child.type === "table_grid" && (() => {
                              const childEff = getEffectiveTableOrientation(child);
                              const childDisplayCols = (child.columns || []).filter(
                                (c) => c.id !== "point_number" && c.id !== "sl_no" && c.id !== "sino" && c.id !== "slno"
                              );
                              return (
                                <>
                                  <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-2 py-0.5 flex items-center justify-between border-b border-black">
                                    <span className="text-[10px] font-bold">{child.title}</span>
                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                      <span>Dec: {child.decimal_places ?? decimalPlaces}</span>
                                      <Badge variant="outline" className="text-[8px] py-0 px-1 font-mono uppercase">
                                        {childEff}
                                      </Badge>
                                    </div>
                                  </div>
                                  {childEff === "horizontal" ? (
                                    <div className="overflow-x-auto">
                                      <table className="w-full border-collapse text-[9px] text-center border-black">
                                        <thead>
                                          <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black">
                                            <th className="py-0.5 px-1 text-left bg-slate-200/80 font-bold">Sl no</th>
                                            {child.rows.map((r, rIdx) => (
                                              <th key={rIdx} className="py-0.5 px-1 font-bold">{r.point_number ?? (rIdx + 1)}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-black font-mono">
                                          {childDisplayCols.map((col) => (
                                            <tr key={col.id} className="divide-x divide-black">
                                              <td className="py-0.5 px-1 text-left font-bold bg-slate-50 font-sans">{col.label}</td>
                                              {child.rows.map((row, rIdx) => (
                                                <td key={rIdx} className="py-0.5 px-1">
                                                  {evaluatePreviewCell(row, col, child.decimal_places ?? decimalPlaces)}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <table className="w-full border-collapse text-[9.5px] text-center border-black">
                                      <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black">
                                          {child.columns.map((col) => (
                                            <th key={col.id} className="py-0.5 px-1">{col.label}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-black">
                                        {child.rows.map((row, rIdx) => (
                                          <tr key={rIdx} className="divide-x divide-black">
                                            {child.columns.map((col) => (
                                              <td key={col.id} className="py-0.5 px-1 font-mono">
                                                {evaluatePreviewCell(row, col, child.decimal_places ?? decimalPlaces)}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. MATRIX TABLE */}
                  {block.type === "matrix_table" && (
                    <div className="border border-black overflow-hidden bg-white dark:bg-slate-900">
                      <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-2 py-1 flex items-center justify-between border-b border-black">
                        <Input
                          value={block.title}
                          onChange={(e) => {
                            const updated = { ...block, title: e.target.value };
                            updateBlock(index, updated);
                          }}
                          className="h-5 text-xs font-bold bg-transparent border-none focus-visible:ring-1 w-80 p-0"
                        />
                        <Badge variant="outline" className="text-[9px] uppercase">
                          Matrix Table
                        </Badge>
                      </div>
                      <table className="w-full border-collapse text-[10px] text-center border-black">
                        <thead>
                          {(block.headers || []).map((hRow, hIdx) => {
                            const cells: any[] = Array.isArray(hRow)
                              ? hRow
                              : (hRow && typeof hRow === "object")
                                ? [hRow]
                                : [{ text: String(hRow || "") }];
                            return (
                              <tr key={hIdx} className="bg-slate-100 dark:bg-slate-800 font-bold">
                                {cells.map((cell: any, cIdx: number) => {
                                  const cellText = typeof cell === "object" && cell !== null ? (cell.text ?? "") : String(cell ?? "");
                                  const colSpan = typeof cell === "object" && cell !== null ? cell.colSpan : undefined;
                                  const rowSpan = typeof cell === "object" && cell !== null ? cell.rowSpan : undefined;
                                  return (
                                    <th key={cIdx} colSpan={colSpan} rowSpan={rowSpan} className="py-1 px-1.5 font-bold border border-black">
                                      {cellText}
                                    </th>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </thead>
                        <tbody>
                          {(block.rows || []).map((r: any, rIdx: number) => {
                            const cells: any[] = Array.isArray(r)
                              ? r
                              : (r && typeof r === "object")
                                ? Object.values(r)
                                : [r];
                            return (
                              <tr key={rIdx} className="hover:bg-slate-50/50">
                                {cells.map((val: any, cIdx: number) => (
                                  <td key={cIdx} className="py-1 px-1.5 font-mono text-[10px] border border-black">
                                    {typeof val === "object" && val !== null ? (val.text ?? JSON.stringify(val)) : String(val ?? "")}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 4. NOTE / CALLOUT */}
                  {block.type === "text_block" && (
                    <div className="p-2 border border-black bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <Input
                        value={block.content}
                        onChange={(e) => updateBlock(index, { ...block, content: e.target.value })}
                        className="text-xs bg-transparent border-none p-0 focus-visible:ring-1 font-medium"
                        placeholder="Enter statement or observation notes..."
                      />
                    </div>
                  )}

                  {/* 5. PAGE BREAK */}
                  {block.type === "page_break" && (
                    <div className="border-2 border-dashed border-amber-500/80 bg-amber-50 dark:bg-amber-950/20 p-2 rounded text-center my-2">
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                        <Columns className="w-4 h-4" />
                        PAGE BREAK (Next content starts on new certificate sheet)
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Simulated Footer */}
            <div className="border border-black p-2 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Standard Signatures & NABL Calibration Footer</span>
              <span>Page 1 of 1</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT INSPECTOR PANEL (DEFAULT HIDDEN, TOGGLEABLE!) (340px) */}
        {/* ========================================================================= */}
        {showInspector && (
          <div className="w-full lg:w-[340px] shrink-0 bg-card border rounded-xl p-4 shadow-sm space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <Settings2 className="w-4 h-4 text-primary" />
                Inspector & Properties
              </h4>
              <div className="flex items-center gap-1.5">
                {selectedBlock && (
                  <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                    {selectedBlock.type}
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowInspector(false)}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  title="Close Inspector"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

          {/* Universal Spacing & Gaps Control for Selected Block */}
          {selectedBlock && (
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900/70 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-primary" />
                  Block Spacing & Gaps (px)
                </Label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Top: {(selectedBlock as any).marginTop ?? 0}px • Bottom: {(selectedBlock as any).marginBottom ?? 6}px
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Top Gap */}
                <div className="space-y-1">
                  <Label className="text-[10.5px] text-muted-foreground font-semibold">Top Gap (px)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={(selectedBlock as any).marginTop ?? 0}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      updateBlock(selectedBlockIndex, { ...selectedBlock, marginTop: val } as any);
                    }}
                    className="h-7 text-xs font-mono"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {[0, 4, 8, 12, 16].map((gap) => (
                      <button
                        key={gap}
                        type="button"
                        onClick={() => updateBlock(selectedBlockIndex, { ...selectedBlock, marginTop: gap } as any)}
                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono transition-colors ${
                          ((selectedBlock as any).marginTop ?? 0) === gap
                            ? "bg-primary text-primary-foreground font-bold"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary/20"
                        }`}
                      >
                        {gap}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bottom Gap */}
                <div className="space-y-1">
                  <Label className="text-[10.5px] text-muted-foreground font-semibold">Bottom Gap (px)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={(selectedBlock as any).marginBottom ?? 6}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      updateBlock(selectedBlockIndex, { ...selectedBlock, marginBottom: val } as any);
                    }}
                    className="h-7 text-xs font-mono"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {[0, 4, 6, 12, 18, 24].map((gap) => (
                      <button
                        key={gap}
                        type="button"
                        onClick={() => updateBlock(selectedBlockIndex, { ...selectedBlock, marginBottom: gap } as any)}
                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono transition-colors ${
                          ((selectedBlock as any).marginBottom ?? 6) === gap
                            ? "bg-primary text-primary-foreground font-bold"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary/20"
                        }`}
                      >
                        {gap}px
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INSPECTOR: Table Grid Selected */}
          {activeTableBlock ? (
            <div className="space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Table Section Title</Label>
                <Input
                  value={activeTableBlock.title}
                  onChange={(e) => updateActiveTable({ ...activeTableBlock!, title: e.target.value })}
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Unit</Label>
                  <Input
                    value={activeTableBlock.unit || "mm"}
                    onChange={(e) => updateActiveTable({ ...activeTableBlock!, unit: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Tolerance (±)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={activeTableBlock.tolerance ?? 0.01}
                    onChange={(e) => updateActiveTable({ ...activeTableBlock!, tolerance: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Decimal Precision</Label>
                <Select
                  value={String(activeTableBlock.decimal_places ?? decimalPlaces)}
                  onValueChange={(val) => {
                    const dp = parseInt(val) || 3;
                    updateActiveTable({ ...activeTableBlock!, decimal_places: dp });
                    if (onDecimalPlacesChange) onDecimalPlacesChange(dp);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (0.0)</SelectItem>
                    <SelectItem value="2">2 (0.00)</SelectItem>
                    <SelectItem value="3">3 (0.000)</SelectItem>
                    <SelectItem value="4">4 (0.0000)</SelectItem>
                    <SelectItem value="5">5 (0.00000)</SelectItem>
                    <SelectItem value="6">6 (0.000000)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table Print Orientation */}
              <div className="space-y-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                    Table Print Orientation
                  </Label>
                  <Badge variant="outline" className="text-[9px] font-mono capitalize">
                    {getEffectiveTableOrientation(activeTableBlock)}
                  </Badge>
                </div>
                <Select
                  value={activeTableBlock.orientation || "auto"}
                  onValueChange={(val: any) => {
                    updateActiveTable({ ...activeTableBlock!, orientation: val });
                    toast.success(
                      `Table orientation set to ${
                        val === "auto"
                          ? `Auto (${getEffectiveTableOrientation({ ...activeTableBlock!, orientation: "auto" })})`
                          : val
                      }`
                    );
                  }}
                >
                  <SelectTrigger className="h-8 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Auto (Smart Column/Row Optimized)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="vertical">
                      <div className="flex items-center gap-1.5">
                        <ArrowUpDown className="w-3.5 h-3.5 text-blue-500" />
                        <span>Vertical (Standard Columns at Top)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="horizontal">
                      <div className="flex items-center gap-1.5">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Horizontal (Transposed Matrix Across)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  💡 {getTableOrientationRecommendation(activeTableBlock).reason}
                </p>
              </div>

              {/* Columns Editor with Variable Chips & Snippets */}
              <div className="border rounded-lg p-2.5 bg-slate-50/50 dark:bg-slate-900/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1">
                    <Columns className="w-3 h-3 text-primary" />
                    Columns ({activeTableBlock.columns.length})
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const newColId = `col_${Date.now().toString().slice(-4)}`;
                      const newCol: CanvasColumnDef = {
                        id: newColId,
                        label: `Col ${activeTableBlock!.columns.length + 1}`,
                        type: "trial",
                        width: "14%",
                      };
                      updateActiveTable({ ...activeTableBlock!, columns: [...activeTableBlock!.columns, newCol] });
                    }}
                    className="h-6 text-[10px] gap-1 bg-primary text-primary-foreground font-semibold"
                  >
                    <Plus className="w-3 h-3" /> Add Col
                  </Button>
                </div>

                <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                  {activeTableBlock.columns.map((col, cIdx) => (
                    <div key={col.id || cIdx} className="p-2 border rounded bg-card space-y-1.5 text-xs shadow-sm">
                      <div className="flex items-center justify-between gap-1">
                        <Input
                          value={col.label}
                          onChange={(e) => {
                            const updatedCols = [...activeTableBlock!.columns];
                            updatedCols[cIdx] = { ...col, label: e.target.value };
                            updateActiveTable({ ...activeTableBlock!, columns: updatedCols });
                          }}
                          className="h-6 text-xs font-bold"
                          placeholder="Header Label"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={activeTableBlock!.columns.length <= 1}
                          onClick={() => {
                            const updatedCols = activeTableBlock!.columns.filter((_, i) => i !== cIdx);
                            updateActiveTable({ ...activeTableBlock!, columns: updatedCols });
                          }}
                          className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      <Select
                        value={col.type}
                        onValueChange={(val: any) => {
                          const updatedCols = [...activeTableBlock!.columns];
                          let defFormula = col.formula;
                          if (val === "formula" && !defFormula) defFormula = "reading - nominal";
                          if (val === "status" && !defFormula) defFormula = "IF(ABS(error)<=tolerance,'PASS','FAIL')";
                          updatedCols[cIdx] = { ...col, type: val, formula: defFormula };
                          updateActiveTable({ ...activeTableBlock!, columns: updatedCols });
                        }}
                      >
                        <SelectTrigger className="h-6 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nominal">Nominal / Spec</SelectItem>
                          <SelectItem value="reading">Actual / Reading</SelectItem>
                          <SelectItem value="trial">Trial (t1, t2..)</SelectItem>
                          <SelectItem value="formula">Formula (fx)</SelectItem>
                          <SelectItem value="status">Status (PASS/FAIL)</SelectItem>
                          <SelectItem value="text">Text / Desc</SelectItem>
                        </SelectContent>
                      </Select>

                      {(col.type === "formula" || col.type === "status") && (
                        <div className="space-y-1 pt-1 border-t border-dashed">
                          <Input
                            value={col.formula || ""}
                            onChange={(e) => {
                              const updatedCols = [...activeTableBlock!.columns];
                              updatedCols[cIdx] = { ...col, formula: e.target.value };
                              updateActiveTable({ ...activeTableBlock!, columns: updatedCols });
                            }}
                            className="h-6 text-[10px] font-mono bg-slate-50 dark:bg-slate-900"
                            placeholder="e.g. reading - nominal"
                          />

                          {/* Variable Chips */}
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {["nominal", "reading", "error", "tolerance", "MPE", "t1", "t2", "avg"].map((tok) => (
                              <button
                                key={tok}
                                type="button"
                                onClick={() => {
                                  const updatedCols = [...activeTableBlock!.columns];
                                  const cur = col.formula || "";
                                  updatedCols[cIdx] = { ...col, formula: cur ? `${cur} ${tok}` : tok };
                                  updateActiveTable({ ...activeTableBlock!, columns: updatedCols });
                                }}
                                className="px-1 py-0.2 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-mono text-[9px]"
                              >
                                +{tok}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Footer Reference Statement</Label>
                <Input
                  value={activeTableBlock.footerNote || ""}
                  onChange={(e) => updateActiveTable({ ...activeTableBlock!, footerNote: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="e.g. All dimensions verified via length masters."
                />
              </div>
            </div>
          ) : selectedBlock?.type === "text_block" ? (
            /* INSPECTOR: Note / Statement Block */
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Note / Compliance Content</Label>
                <Textarea
                  value={(selectedBlock as TextBlock).content}
                  onChange={(e) => updateBlock(selectedBlockIndex, { ...selectedBlock, content: e.target.value })}
                  className="text-xs h-24"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Style</Label>
                <Select
                  value={(selectedBlock as TextBlock).style || "callout"}
                  onValueChange={(val: any) => updateBlock(selectedBlockIndex, { ...selectedBlock, style: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="callout">Callout Box</SelectItem>
                    <SelectItem value="standard">Standard Text</SelectItem>
                    <SelectItem value="bold">Bold Statement</SelectItem>
                    <SelectItem value="centered">Centered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : selectedBlock?.type === "diagram_block" ? (
            /* INSPECTOR: Diagram / Schematic Block */
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Diagram Caption</Label>
                <Input
                  value={(selectedBlock as DiagramBlock).caption || ""}
                  onChange={(e) => updateBlock(selectedBlockIndex, { ...selectedBlock, caption: e.target.value } as any)}
                  className="h-8 text-xs"
                  placeholder="e.g. Measurement Points Schematic"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Width (px)</Label>
                  <Input
                    type="number"
                    value={(selectedBlock as DiagramBlock).width || 320}
                    onChange={(e) => updateBlock(selectedBlockIndex, { ...selectedBlock, width: parseInt(e.target.value) || 320 } as any)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Height (px)</Label>
                  <Input
                    type="number"
                    value={(selectedBlock as DiagramBlock).height || 160}
                    onChange={(e) => updateBlock(selectedBlockIndex, { ...selectedBlock, height: parseInt(e.target.value) || 160 } as any)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Alignment</Label>
                <Select
                  value={(selectedBlock as DiagramBlock).alignment || "center"}
                  onValueChange={(val: any) => updateBlock(selectedBlockIndex, { ...selectedBlock, alignment: val } as any)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : selectedBlock?.type === "split_row" ? (
            /* INSPECTOR: Split Row Container */
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Column Layout</Label>
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border text-xs font-medium text-muted-foreground">
                  Side-by-Side Dual Column Grid ({(selectedBlock as SplitRowBlock).children.length} columns)
                </div>
              </div>
            </div>
          ) : selectedBlock?.type === "matrix_table" ? (
            /* INSPECTOR: Matrix Table Block */
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Matrix Section Title</Label>
                <Input
                  value={(selectedBlock as MatrixTableBlock).title || ""}
                  onChange={(e) => updateBlock(selectedBlockIndex, { ...selectedBlock, title: e.target.value } as any)}
                  className="h-8 text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Footer Note</Label>
                <Input
                  value={(selectedBlock as MatrixTableBlock).footerNote || ""}
                  onChange={(e) => updateBlock(selectedBlockIndex, { ...selectedBlock, footerNote: e.target.value } as any)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ) : (
            /* INSPECTOR: Global Template Settings */
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border space-y-1.5">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <MousePointerClick className="w-4 h-4 text-primary" />
                  Select a Block on Canvas
                </div>
                <p className="text-[11px]">
                  Click on any table, note, or matrix on the certificate sheet to edit its specific columns, formulas, and tolerances.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between">
                  <span>Default Unit:</span>
                  <span className="font-bold text-foreground">{defaultUnit}</span>
                </div>
                <div className="flex justify-between">
                  <span>Default Tolerance:</span>
                  <span className="font-bold text-foreground">±{defaultTolerance}</span>
                </div>
                <div className="flex justify-between">
                  <span>Global Decimals:</span>
                  <span className="font-bold text-foreground">{decimalPlaces} digits</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Canvas Blocks:</span>
                  <span className="font-bold text-foreground">{blocks.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* MODAL: AI Template Generator (Gemini 1.5 Flash / 2.0 Flash) */}
      <AiTemplateGeneratorModal
        open={showAiModal}
        onOpenChange={setShowAiModal}
        onApplyTemplate={handleApplyAiGenerated}
      />

      {/* MODAL: Trial Run & Certificate Live Verification */}
      <TrialRunModal
        open={showTrialRun}
        onOpenChange={setShowTrialRun}
        blocks={blocks}
        templateName={templateName || "Visual Canvas Template"}
        diagramImage={diagramImage}
        diagramImageWidth={diagramImageWidth}
        diagramImageHeight={diagramImageHeight}
        diagramImageAlignment={diagramImageAlignment}
        defaultUnit={defaultUnit}
        defaultTolerance={defaultTolerance}
        decimalPlaces={decimalPlaces}
      />
    </div>
  );
}
