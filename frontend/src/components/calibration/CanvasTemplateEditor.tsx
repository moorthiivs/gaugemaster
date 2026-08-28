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
  Edit3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Check,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

import { CANVAS_PRESETS, CanvasTemplatePreset } from "@/data/canvasPresets";
export { CANVAS_PRESETS };
export type { CanvasTemplatePreset };

interface CanvasTemplateEditorProps {
  blocks: CanvasBlock[];
  onChange: (blocks: CanvasBlock[]) => void;
  onSelectPreset?: (preset: CanvasTemplatePreset) => void;
  defaultUnit?: string;
  defaultTolerance?: number;
}

export function CanvasTemplateEditor({
  blocks,
  onChange,
  onSelectPreset,
  defaultUnit = "mm",
  defaultTolerance = 0.01,
}: CanvasTemplateEditorProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingTableBlock, setEditingTableBlock] = useState<TableGridBlock | null>(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);

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
      decimal_places: 3,
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
          decimal_places: 3,
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
          decimal_places: 3,
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
    toast.success("Added Side-by-Side Split Row container");
  };

  const addMatrixBlock = () => {
    const newBlock: MatrixTableBlock = {
      id: `matrix_${Date.now()}`,
      type: "matrix_table",
      title: "Acceptance Criteria Reference Table",
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
        ["300 - 600", "±0.030", "±0.040", "±0.040", "±0.050"],
      ],
    };
    markChanged([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
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
    toast.success("Block duplicated");
  };

  const deleteBlock = (index: number) => {
    const updated = blocks.filter((_, i) => i !== index);
    markChanged(updated);
    toast.info("Block removed from canvas");
  };

  const updateBlock = (index: number, updatedBlock: CanvasBlock) => {
    const updated = [...blocks];
    updated[index] = updatedBlock;
    markChanged(updated);
  };

  const openTableEditor = (block: TableGridBlock) => {
    setEditingTableBlock(JSON.parse(JSON.stringify(block)));
    setShowTableModal(true);
  };

  const saveTableEditor = () => {
    if (!editingTableBlock) return;
    const updated = blocks.map((b) => {
      if (b.id === editingTableBlock.id) return editingTableBlock;
      if (b.type === "split_row") {
        return {
          ...b,
          children: b.children.map((c) => (c.id === editingTableBlock.id ? editingTableBlock : c)),
        };
      }
      return b;
    });
    markChanged(updated);
    setShowTableModal(false);
    toast.success("Table configuration updated");
  };

  // Helper to evaluate formula preview in builder
  const evaluatePreviewCell = (row: CanvasRowData, col: CanvasColumnDef): string => {
    if (col.type === "nominal") return row.nominal !== undefined ? `${row.nominal}` : "-";
    if (col.type === "text") return row.description || "-";
    if (col.type === "trial" || col.type === "reading") return row[col.id] !== undefined ? `${row[col.id]}` : "";
    if (col.type === "formula" || col.type === "status") {
      return "(Formula)";
    }
    return "-";
  };

  return (
    <div className="space-y-4">
      {/* Canvas Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-900 text-white p-3 rounded-lg shadow-md border border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Visual Canvas Layout Designer
              <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/40 bg-amber-500/10">
                {blocks.length} Modular Blocks
              </Badge>
            </h3>
            <p className="text-[11px] text-slate-400">
              Build custom multi-table, side-by-side split, reference matrices, and multi-page calibration certificates
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPresetsModal(true)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40 gap-1.5 h-8 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Load Preset (IS 3651 / 2967)
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={addTableBlock}
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-8 shadow-xs"
          >
            <Table className="w-3.5 h-3.5" />
            + Data Table
          </Button>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addSplitRowBlock}
            className="text-xs gap-1.5 h-8 shadow-xs"
          >
            <SplitSquareVertical className="w-3.5 h-3.5 text-blue-500" />
            + Side-by-Side (50/50)
          </Button>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addMatrixBlock}
            className="text-xs gap-1.5 h-8 shadow-xs"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-purple-500" />
            + Matrix Table
          </Button>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addTextBlock}
            className="text-xs gap-1.5 h-8 shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-500" />
            + Note
          </Button>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addPageBreak}
            className="text-xs gap-1.5 h-8 shadow-xs"
          >
            <Columns className="w-3.5 h-3.5 text-amber-500" />
            + Page Break
          </Button>
        </div>
      </div>

      {/* Main Canvas Workspace (Simulates Printed Certificate Sheet) */}
      <div className="bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 rounded-xl border border-slate-300 dark:border-slate-800 min-h-[500px] flex flex-col items-center">
        <div className="w-full max-w-[1000px] bg-white dark:bg-slate-900 shadow-xl border border-black/80 rounded-sm p-4 sm:p-6 space-y-4 text-black dark:text-slate-100 font-sans">
          
          {/* Simulated Certificate Header */}
          <div className="border border-black p-2 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
            <span className="font-bold tracking-wide uppercase text-[11px] text-slate-700 dark:text-slate-300">
              [ Instrument Certificate Header & Metadata Area ]
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">Document Sheet Preview</span>
          </div>

          {/* Render Blocks */}
          {blocks.length === 0 ? (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center space-y-3">
              <Table className="w-10 h-10 mx-auto text-muted-foreground/50" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm">Your Canvas is Empty</h4>
                <p className="text-xs text-muted-foreground">
                  Click <strong>&quot;Load Preset&quot;</strong> above to quickly load the Vernier Caliper (IS 3651) layout, or add your custom tables and split rows.
                </p>
              </div>
              <div className="pt-2">
                <Button size="sm" onClick={() => setShowPresetsModal(true)} className="gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Load Vernier Caliper Preset (IS 3651)
                </Button>
              </div>
            </div>
          ) : (
            blocks.map((block, index) => (
              <div
                key={block.id}
                onClick={() => setSelectedBlockId(block.id)}
                className={`relative group border transition-all rounded-sm ${
                  selectedBlockId === block.id
                    ? "ring-2 ring-primary border-primary bg-primary/[0.02]"
                    : "border-slate-300 hover:border-primary/50"
                }`}
              >
                {/* Block Controls Float Bar */}
                <div className="absolute -top-3.5 right-2 z-10 hidden group-hover:flex items-center gap-1 bg-slate-900 text-white px-2 py-0.5 rounded shadow text-xs">
                  <span className="text-[10px] font-mono text-slate-300 mr-1 uppercase">{block.type}</span>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={(e) => { e.stopPropagation(); moveBlock(index, "up"); }}
                    className="p-1 hover:text-amber-400 disabled:opacity-30"
                    title="Move Up"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={index === blocks.length - 1}
                    onClick={(e) => { e.stopPropagation(); moveBlock(index, "down"); }}
                    className="p-1 hover:text-amber-400 disabled:opacity-30"
                    title="Move Down"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); duplicateBlock(block, index); }}
                    className="p-1 hover:text-emerald-400"
                    title="Duplicate Block"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteBlock(index); }}
                    className="p-1 hover:text-red-400"
                    title="Delete Block"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* 1. TABLE GRID BLOCK */}
                {block.type === "table_grid" && (
                  <div className="border border-black overflow-hidden bg-white dark:bg-slate-900">
                    <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-2 py-1 flex items-center justify-between border-b border-black">
                      <div className="flex items-center gap-2">
                        <Input
                          value={block.title}
                          onChange={(e) => {
                            const updated = { ...block, title: e.target.value };
                            updateBlock(index, updated);
                          }}
                          className="h-6 text-xs font-bold bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary w-64 p-0"
                          placeholder="Table Section Title"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                          Unit: {block.unit || "mm"} • Tol: ±{block.tolerance ?? "0.01"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openTableEditor(block)}
                          className="h-5 px-1.5 text-[10px] font-bold text-primary hover:bg-primary/10 gap-1"
                        >
                          <Sliders className="w-2.5 h-2.5" />
                          Configure Columns ({block.columns.length})
                        </Button>
                      </div>
                    </div>

                    {/* Table View */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-[10px] text-center border-black">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black">
                            {block.columns.map((col) => (
                              <th key={col.id} style={{ width: col.width }} className="py-1 px-1.5">
                                {col.label}
                                {col.type === "formula" && <span className="text-[8px] text-primary block font-normal">(fx)</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black">
                          {block.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="divide-x divide-black hover:bg-slate-50/50">
                              {block.columns.map((col) => (
                                <td key={col.id} className="py-1 px-1.5">
                                  {col.type === "nominal" ? (
                                    <Input
                                      type="number"
                                      step="any"
                                      value={row.nominal ?? ""}
                                      onChange={(e) => {
                                        const newRows = [...block.rows];
                                        newRows[rIdx] = { ...newRows[rIdx], nominal: parseFloat(e.target.value) || 0 };
                                        updateBlock(index, { ...block, rows: newRows });
                                      }}
                                      className="h-5 text-[10px] text-center border-none p-0 bg-transparent focus-visible:ring-1"
                                    />
                                  ) : col.type === "text" ? (
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
                                  ) : (
                                    <span className="text-muted-foreground font-mono">{evaluatePreviewCell(row, col)}</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Row Footer Controls */}
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
                        Add Row
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
                          Remove Last Row
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. SPLIT ROW (SIDE-BY-SIDE 50/50 OR 60/40) */}
                {block.type === "split_row" && (
                  <div className="space-y-2 p-1 bg-slate-50/50 dark:bg-slate-800/30 rounded border border-dashed border-blue-400">
                    <div className="flex items-center justify-between text-[10px] text-blue-600 font-bold px-1">
                      <span className="flex items-center gap-1">
                        <SplitSquareVertical className="w-3 h-3" />
                        Side-by-Side Container ({block.children.length} Columns)
                      </span>
                    </div>

                    <div className={`grid grid-cols-1 md:grid-cols-${block.children.length} gap-2 items-start`}>
                      {block.children.map((child, cIdx) => {
                        const isBlank = child.type === "blank" || child.type === "empty" || (child.type === "text_block" && !child.content);
                        return (
                          <div
                            key={child.id || cIdx}
                            className={
                              isBlank
                                ? "border border-dashed border-slate-300 dark:border-slate-700 rounded p-4 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/30 text-center min-h-[90px]"
                                : "border border-black overflow-hidden bg-white dark:bg-slate-900 flex flex-col"
                            }
                          >
                            {isBlank ? (
                              <div className="space-y-1.5">
                                <span className="text-[11px] text-muted-foreground italic font-medium flex items-center justify-center gap-1">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  Empty / Blank Space (Invisible in Certificate)
                                </span>
                                <div className="flex items-center gap-1.5 justify-center">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const updatedChildren = [...block.children];
                                      updatedChildren[cIdx] = {
                                        id: `tbl_${Date.now()}_${cIdx}`,
                                        type: "table_grid",
                                        title: `Section ${cIdx + 1} Table`,
                                        unit: defaultUnit,
                                        tolerance: defaultTolerance,
                                        decimal_places: 3,
                                        columns: [
                                          { id: "nominal", label: "Nominal Value", type: "nominal", width: "35%" },
                                          { id: "reading", label: "Actual Value", type: "reading", width: "35%" },
                                          { id: "error", label: "Error", type: "formula", formula: "reading - nominal", width: "30%" },
                                        ],
                                        rows: [
                                          { point_number: 1, nominal: 10.0, unit: defaultUnit },
                                        ],
                                      };
                                      updateBlock(index, { ...block, children: updatedChildren });
                                    }}
                                    className="h-5 px-2 text-[9px] gap-1 font-semibold"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    Add Table
                                  </Button>
                                </div>
                              </div>
                            ) : child.type === "table_grid" ? (
                              <>
                                <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-2 py-0.5 flex items-center justify-between border-b border-black">
                                  <Input
                                    value={child.title}
                                    onChange={(e) => {
                                      const updatedChildren = [...block.children];
                                      updatedChildren[cIdx] = { ...child, title: e.target.value };
                                      updateBlock(index, { ...block, children: updatedChildren });
                                    }}
                                    className="h-5 text-[10px] font-bold bg-transparent border-none p-0 focus-visible:ring-1 w-40"
                                  />
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openTableEditor(child)}
                                      className="h-4 px-1 text-[9px] text-primary"
                                    >
                                      Configure
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updatedChildren = [...block.children];
                                        updatedChildren[cIdx] = {
                                          id: `blank_${Date.now()}_${cIdx}`,
                                          type: "blank",
                                          content: "",
                                        };
                                        updateBlock(index, { ...block, children: updatedChildren });
                                        toast.info("Converted column to Empty Blank Space");
                                      }}
                                      className="h-4 px-1 text-[9px] text-muted-foreground hover:text-destructive"
                                      title="Clear this column to empty blank space"
                                    >
                                      Make Blank
                                    </Button>
                                  </div>
                                </div>

                                <table className="w-full border-collapse text-[9px] text-center">
                                  <thead>
                                    <tr className="bg-slate-100 font-bold border-b border-black divide-x divide-black">
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
                                            {col.type === "nominal" ? row.nominal : col.type === "text" ? row.description : "-"}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                {child.footerNote && (
                                  <div className="p-1 text-[9px] italic border-t border-black text-center bg-slate-50">
                                    {child.footerNote}
                                  </div>
                                )}
                              </>
                            ) : child.type === "text_block" && child.content ? (
                              <div className="p-2 text-[10px] text-center italic bg-slate-50 dark:bg-slate-800">
                                {child.content}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. MATRIX TABLE BLOCK (ACCEPTANCE CRITERIA) */}
                {block.type === "matrix_table" && (
                  <div className="border border-black overflow-hidden bg-white dark:bg-slate-900">
                    <div className="bg-slate-200 dark:bg-slate-800 text-black dark:text-white px-2 py-1 border-b border-black flex items-center justify-between">
                      <Input
                        value={block.title}
                        onChange={(e) => {
                          updateBlock(index, { ...block, title: e.target.value });
                        }}
                        className="h-6 text-xs font-bold bg-transparent border-none p-0 focus-visible:ring-1 w-64"
                        placeholder="Matrix Table Title"
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">Reference Matrix Table</span>
                    </div>

                    <table className="w-full border-collapse text-[9.5px] text-center border-black">
                      <thead>
                        {block.headers.map((hRow, hIdx) => (
                          <tr key={hIdx} className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-black divide-x divide-black">
                            {hRow.map((cell, cIdx) => (
                              <th
                                key={cIdx}
                                colSpan={cell.colSpan}
                                rowSpan={cell.rowSpan}
                                className="py-1 px-1.5"
                              >
                                {cell.text}
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody className="divide-y divide-black font-mono">
                        {block.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="divide-x divide-black hover:bg-slate-50/50">
                            {row.map((cellVal, cIdx) => (
                              <td key={cIdx} className="py-1 px-1.5">
                                {cellVal}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 4. TEXT BLOCK */}
                {block.type === "text_block" && (
                  <div className="p-2 border border-black bg-slate-50 dark:bg-slate-800/40 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <Input
                      value={block.content}
                      onChange={(e) => updateBlock(index, { ...block, content: e.target.value })}
                      className="text-xs bg-transparent border-none p-0 focus-visible:ring-1 font-medium"
                      placeholder="Enter compliance statement or observation notes..."
                    />
                  </div>
                )}

                {/* 5. PAGE BREAK BLOCK */}
                {block.type === "page_break" && (
                  <div className="border-2 border-dashed border-amber-500/80 bg-amber-50 dark:bg-amber-950/20 p-2 rounded text-center my-3">
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                      <Columns className="w-4 h-4" />
                      PAGE BREAK (Next content starts on new page)
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Bottom Simulated Footer */}
          <div className="border border-black p-2 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Standard Signatures & NABL Accreditation Footer</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>

      {/* MODAL: Table Column & Formula Configuration */}
      <Dialog open={showTableModal} onOpenChange={setShowTableModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              Configure Columns & Formulas: {editingTableBlock?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add custom columns, set types (trial, reading, formula), and configure Excel-like formulas (e.g. AVERAGE, SUBTRACT).
            </DialogDescription>
          </DialogHeader>

          {editingTableBlock && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Table Title</Label>
                  <Input
                    value={editingTableBlock.title}
                    onChange={(e) => setEditingTableBlock({ ...editingTableBlock, title: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Input
                    value={editingTableBlock.unit || "mm"}
                    onChange={(e) => setEditingTableBlock({ ...editingTableBlock, unit: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Default Tolerance (±)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={editingTableBlock.tolerance ?? 0.01}
                    onChange={(e) => setEditingTableBlock({ ...editingTableBlock, tolerance: parseFloat(e.target.value) || 0 })}
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              {/* Columns List */}
              <div className="space-y-2 border rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold">Columns Definition ({editingTableBlock.columns.length})</h4>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const newColId = `col_${Date.now().toString().slice(-4)}`;
                      const newCol: CanvasColumnDef = {
                        id: newColId,
                        label: `Col ${editingTableBlock.columns.length + 1}`,
                        type: "trial",
                        width: "10%",
                      };
                      setEditingTableBlock({
                        ...editingTableBlock,
                        columns: [...editingTableBlock.columns, newCol],
                      });
                    }}
                    className="h-6 text-[11px] gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Column
                  </Button>
                </div>

                <div className="space-y-2">
                  {editingTableBlock.columns.map((col, cIdx) => (
                    <div key={col.id} className="grid grid-cols-12 gap-2 items-center bg-background p-2 rounded border text-xs">
                      <div className="col-span-3">
                        <Label className="text-[10px] text-muted-foreground">Header Label</Label>
                        <Input
                          value={col.label}
                          onChange={(e) => {
                            const updated = [...editingTableBlock.columns];
                            updated[cIdx] = { ...col, label: e.target.value };
                            setEditingTableBlock({ ...editingTableBlock, columns: updated });
                          }}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>

                      <div className="col-span-3">
                        <Label className="text-[10px] text-muted-foreground">Column Type</Label>
                        <Select
                          value={col.type}
                          onValueChange={(val: any) => {
                            const updated = [...editingTableBlock.columns];
                            updated[cIdx] = { ...col, type: val };
                            setEditingTableBlock({ ...editingTableBlock, columns: updated });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs mt-0.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nominal">Nominal / Spec</SelectItem>
                            <SelectItem value="trial">Trial / Reading</SelectItem>
                            <SelectItem value="formula">Formula (fx)</SelectItem>
                            <SelectItem value="status">Status (PASS/FAIL)</SelectItem>
                            <SelectItem value="text">Text / Description</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-4">
                        {col.type === "formula" || col.type === "status" ? (
                          <div>
                            <Label className="text-[10px] text-muted-foreground font-mono">Formula (e.g. AVERAGE(t1,t2))</Label>
                            <Input
                              value={col.formula || ""}
                              onChange={(e) => {
                                const updated = [...editingTableBlock.columns];
                                updated[cIdx] = { ...col, formula: e.target.value };
                                setEditingTableBlock({ ...editingTableBlock, columns: updated });
                              }}
                              className="h-7 text-xs font-mono mt-0.5"
                              placeholder="e.g. AVERAGE(t1,t2,t3)"
                            />
                          </div>
                        ) : (
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Column Key</Label>
                            <Input value={col.id} disabled className="h-7 text-xs font-mono mt-0.5 bg-muted" />
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-1 pt-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={editingTableBlock.columns.length <= 1}
                          onClick={() => {
                            const updated = editingTableBlock.columns.filter((_, i) => i !== cIdx);
                            setEditingTableBlock({ ...editingTableBlock, columns: updated });
                          }}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Note */}
              <div>
                <Label className="text-xs">Table Footer Note / Statement (Optional)</Label>
                <Input
                  value={editingTableBlock.footerNote || ""}
                  onChange={(e) => setEditingTableBlock({ ...editingTableBlock, footerNote: e.target.value })}
                  placeholder="e.g., All the jaws are free from dent and damages."
                  className="text-xs mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setShowTableModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveTableEditor} className="gap-1.5 shadow-xs">
              <Check className="w-3.5 h-3.5" />
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Load Standard Presets */}
      <Dialog open={showPresetsModal} onOpenChange={setShowPresetsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Standard Calibration Template Presets
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select an industry-standard preset to immediately populate your canvas with calibrated layouts.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 py-2">
            {CANVAS_PRESETS.map((preset) => (
              <div
                key={preset.id}
                onClick={() => {
                  if (onSelectPreset) {
                    onSelectPreset(preset);
                  } else {
                    markChanged(JSON.parse(JSON.stringify(preset.blocks)));
                    toast.success(`Loaded "${preset.name}" preset!`);
                  }
                  setShowPresetsModal(false);
                }}
                className="p-3.5 border rounded-lg hover:border-primary/80 hover:bg-primary/[0.03] cursor-pointer transition-all space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    {preset.name}
                  </h4>
                  <Badge variant="secondary" className="text-[10px]">
                    {preset.blocks.length} Blocks
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setShowPresetsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
