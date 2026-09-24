import React, { useState, useEffect, useRef } from "react";
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
  ChevronLeft,
  ChevronRight,
  Columns,
  Sparkles,
  LayoutGrid,
  FileText,
  FileSpreadsheet,
  Maximize2,
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
  Bot,
  ShieldCheck,
  Wand2,
  Grid2X2,
  SeparatorHorizontal,
  PanelRightClose,
  PanelRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { CANVAS_PRESETS, CanvasTemplatePreset } from "@/data/canvasPresets";
import { AiTemplateGeneratorModal } from "@/components/calibration/template-management/AiTemplateGeneratorModal";
import { TrialRunModal } from "@/components/calibration/template-management/TrialRunModal";
import { TableAuditModal } from "@/components/calibration/template-management/TableAuditModal";
import { PreSaveAuditModal } from "@/components/calibration/template-management/PreSaveAuditModal";
import { GaugemasterTemplateAssistant } from "@/components/calibration/template-management/GaugemasterTemplateAssistant";
import { GeneratedTemplateResult } from "@/lib/geminiService";
import { evaluateCanvasRowFormulas, buildRowContext, testEvaluateFormula } from "@/lib/formulaEngine";
import {
  getEffectiveTableOrientation,
  getTableOrientationRecommendation,
} from "@/lib/tableLayoutOptimizer";
import { ColumnFormulaInspector } from "@/components/calibration/template-management/ColumnFormulaInspector";

export { CANVAS_PRESETS };
export type { CanvasTemplatePreset };

export interface CanvasEditorActions {
  openTrialRun: () => void;
  openTableAudit: () => void;
  openAiGenerator: () => void;
  toggleInspector: () => void;
  toggleAssistant: () => void;
}

export interface CanvasTemplateEditorProps {
  blocks: CanvasBlock[];
  onChange: (blocks: CanvasBlock[]) => void;
  onSelectPreset?: (preset: CanvasTemplatePreset) => void;
  onApplyGeneratedTemplate?: (template: GeneratedTemplateResult) => void;
  onRegisterActions?: (actions: CanvasEditorActions) => void;
  templateName?: string;
  diagramImage?: string | null;
  diagramImageWidth?: number;
  diagramImageHeight?: number;
  diagramImageAlignment?: "center" | "left" | "right";
  defaultUnit?: string;
  defaultTolerance?: number;
  decimalPlaces?: number;
  onDecimalPlacesChange?: (dp: number) => void;
  docNo?: string;
  docDate?: string;
  docRev?: string;
  procedureReference?: string;
  procedureNo?: string;
  procedureName?: string;
  procedureDate?: string;
  procedureRev?: string;
  acceptanceCriteriaDocNo?: string;
  acceptanceCriteriaDate?: string;
  acceptanceCriteriaRev?: string;
  acceptanceCriteriaReference?: string;
  hideCopilotInside?: boolean;
  selectedBlockId?: string | null;
  onSelectBlockId?: (id: string | null) => void;
  selectedColumnId?: string | null;
  onSelectColumnId?: (id: string | null) => void;
}

export function CanvasTemplateEditor({
  blocks,
  onChange,
  onSelectPreset,
  onApplyGeneratedTemplate,
  onRegisterActions,
  templateName,
  diagramImage,
  diagramImageWidth,
  diagramImageHeight,
  diagramImageAlignment,
  defaultUnit = "mm",
  defaultTolerance = 0.01,
  decimalPlaces = 3,
  onDecimalPlacesChange,
  docNo,
  docDate,
  docRev,
  procedureReference,
  procedureNo,
  procedureName,
  procedureDate,
  procedureRev,
  acceptanceCriteriaDocNo,
  acceptanceCriteriaDate,
  acceptanceCriteriaRev,
  acceptanceCriteriaReference,
  hideCopilotInside = false,
  selectedBlockId: propSelectedBlockId,
  onSelectBlockId,
  selectedColumnId: propSelectedColId,
  onSelectColumnId,
}: CanvasTemplateEditorProps) {
  const [internalSelectedBlockId, setInternalSelectedBlockId] = useState<string | null>(() => blocks[0]?.id || null);
  const selectedBlockId = propSelectedBlockId !== undefined ? propSelectedBlockId : internalSelectedBlockId;
  const setSelectedBlockId = (id: string | null) => {
    setInternalSelectedBlockId(id);
    if (onSelectBlockId) onSelectBlockId(id);
  };

  const [internalSelectedColId, setInternalSelectedColId] = useState<string | null>(null);
  const selectedColumnId = propSelectedColId !== undefined ? propSelectedColId : internalSelectedColId;
  const setSelectedColumnId = (id: string | null) => {
    setInternalSelectedColId(id);
    if (onSelectColumnId) onSelectColumnId(id);
  };

  const [selectedChildTableId, setSelectedChildTableId] = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showTrialRun, setShowTrialRun] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showTableAuditModal, setShowTableAuditModal] = useState(false);
  const [auditTargetTable, setAuditTargetTable] = useState<TableGridBlock | null>(null);
  const [showAssistant, setShowAssistant] = useState(true);
  const [showPreSaveModal, setShowPreSaveModal] = useState(false);
  const [isBannerCollapsed, setIsBannerCollapsed] = useState(true);
  const [isToolboxCollapsed, setIsToolboxCollapsed] = useState(false);
  const [isAssistantDocked, setIsAssistantDocked] = useState(true);

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
  if (!activeTableBlock) {
    for (const blk of blocks) {
      if (blk.type === "table_grid") {
        activeTableBlock = blk as TableGridBlock;
        break;
      }
      if (blk.type === "split_row" && blk.children) {
        const first = blk.children.find((c) => c.type === "table_grid");
        if (first) {
          activeTableBlock = first as TableGridBlock;
          break;
        }
      }
    }
  }

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        openTrialRun: () => setShowTrialRun(true),
        openTableAudit: () => {
          if (activeTableBlock) {
            handleOpenTableAudit(activeTableBlock);
          } else {
            setShowTableAuditModal(true);
          }
        },
        openAiGenerator: () => setShowAiModal(true),
        toggleInspector: () => setShowInspector((prev) => !prev),
        toggleAssistant: () => {
          setShowAssistant((prev) => !prev);
          setIsAssistantDocked(true);
        },
      });
    }
  }, [onRegisterActions, activeTableBlock]);

  const markChanged = (newBlocks: CanvasBlock[]) => {
    onChange(newBlocks);
  };

  const handleOpenTableAudit = (table: TableGridBlock) => {
    setAuditTargetTable(table);
    setShowTableAuditModal(true);
  };

  const handleApplyTableFixes = (tableId: string, updatedColumns: CanvasColumnDef[]) => {
    const newBlocks = blocks.map((b) => {
      if (b.type === "table_grid" && b.id === tableId) {
        return { ...b, columns: updatedColumns };
      }
      if (b.type === "split_row" && b.children) {
        const newChildren = b.children.map((c) => {
          if (c.type === "table_grid" && c.id === tableId) {
            return { ...c, columns: updatedColumns };
          }
          return c;
        });
        return { ...b, children: newChildren as any };
      }
      return b;
    });
    markChanged(newBlocks);
    toast.success("AI audited formulas applied to table!");
  };

  const handleRestoreTableState = (
    tableId: string,
    previousState: {
      columns?: CanvasColumnDef[];
      tableSettings?: Partial<TableGridBlock>;
      rows?: CanvasRowData[];
    }
  ) => {
    const newBlocks = blocks.map((b) => {
      if (b.type === "table_grid" && b.id === tableId) {
        return {
          ...b,
          ...(previousState.columns ? { columns: previousState.columns } : {}),
          ...(previousState.tableSettings || {}),
          ...(previousState.rows ? { rows: previousState.rows } : {}),
        };
      }
      if (b.type === "split_row" && b.children) {
        const newChildren = b.children.map((c) => {
          if (c.type === "table_grid" && c.id === tableId) {
            return {
              ...c,
              ...(previousState.columns ? { columns: previousState.columns } : {}),
              ...(previousState.tableSettings || {}),
              ...(previousState.rows ? { rows: previousState.rows } : {}),
            };
          }
          return c;
        });
        return { ...b, children: newChildren as any };
      }
      return b;
    });
    markChanged(newBlocks);
  };

  const handleUpdateTableBlock = (tableId: string, updatedFields: Partial<TableGridBlock>) => {
    const newBlocks = blocks.map((b) => {
      if (b.type === "table_grid" && b.id === tableId) {
        return { ...b, ...updatedFields };
      }
      if (b.type === "split_row" && b.children) {
        const newChildren = b.children.map((c) => {
          if (c.type === "table_grid" && c.id === tableId) {
            return { ...c, ...updatedFields };
          }
          return c;
        });
        return { ...b, children: newChildren as any };
      }
      return b;
    });
    markChanged(newBlocks);
    toast.success("Updated table properties successfully");
  };

  const handleAddTableColumn = (tableId: string, newColumn: CanvasColumnDef) => {
    const newBlocks = blocks.map((b) => {
      if (b.type === "table_grid" && b.id === tableId) {
        return { ...b, columns: [...b.columns, newColumn] };
      }
      if (b.type === "split_row" && b.children) {
        const newChildren = b.children.map((c) => {
          if (c.type === "table_grid" && c.id === tableId) {
            return { ...c, columns: [...c.columns, newColumn] };
          }
          return c;
        });
        return { ...b, children: newChildren as any };
      }
      return b;
    });
    markChanged(newBlocks);
    toast.success(`Added column "${newColumn.label}" successfully`);
  };

  const handleDeleteTableColumn = (tableId: string, columnId: string) => {
    const newBlocks = blocks.map((b) => {
      if (b.type === "table_grid" && b.id === tableId) {
        return { ...b, columns: b.columns.filter((c) => c.id !== columnId) };
      }
      if (b.type === "split_row" && b.children) {
        const newChildren = b.children.map((c) => {
          if (c.type === "table_grid" && c.id === tableId) {
            return { ...c, columns: c.columns.filter((col) => col.id !== columnId) };
          }
          return c;
        });
        return { ...b, children: newChildren as any };
      }
      return b;
    });
    markChanged(newBlocks);
    toast.success("Removed column from table");
  };

  const handleAddTableBlock = (tableData?: Partial<TableGridBlock>) => {
    const newBlock: TableGridBlock = {
      id: tableData?.id || `table_${Date.now()}`,
      type: "table_grid",
      title: tableData?.title || "New Calibration Table",
      width: tableData?.width || "100%",
      unit: tableData?.unit || defaultUnit,
      tolerance: tableData?.tolerance || defaultTolerance,
      decimal_places: tableData?.decimal_places ?? decimalPlaces,
      columns: tableData?.columns || [
        { id: "point_number", label: "Sl.No.", type: "nominal", width: "8%" },
        { id: "nominal", label: "Std. Spec", type: "nominal", width: "22%" },
        { id: "reading", label: "Actual Reading", type: "reading", width: "25%" },
        { id: "deviation", label: "Deviation", type: "formula", formula: "reading - nominal", width: "25%" },
        { id: "status", label: "Judgement", type: "status", formula: "IF(ABS(deviation)<=tolerance,'PASS','FAIL')", width: "20%" },
      ],
      rows: tableData?.rows || [
        { point_number: 1, nominal: 10.0, unit: defaultUnit },
        { point_number: 2, nominal: 20.0, unit: defaultUnit },
        { point_number: 3, nominal: 50.0, unit: defaultUnit },
      ],
    };
    markChanged([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    setSelectedChildTableId(null);
    toast.success(`Created table "${newBlock.title}"`);
    return newBlock;
  };

  const handleDeleteTableBlock = (tableId: string) => {
    const newBlocks = blocks.filter((b) => b.id !== tableId);
    markChanged(newBlocks);
    if (selectedBlockId === tableId) {
      setSelectedBlockId(newBlocks[0]?.id || null);
    }
    toast.info("Deleted table block from template");
  };

  const handleUpdateTableRows = (tableId: string, updatedRows: CanvasRowData[]) => {
    const newBlocks = blocks.map((b) => {
      if (b.type === "table_grid" && b.id === tableId) {
        return { ...b, rows: updatedRows };
      }
      if (b.type === "split_row" && b.children) {
        const newChildren = b.children.map((c) => {
          if (c.type === "table_grid" && c.id === tableId) {
            return { ...c, rows: updatedRows };
          }
          return c;
        });
        return { ...b, children: newChildren as any };
      }
      return b;
    });
    markChanged(newBlocks);
    toast.success("Updated table rows successfully");
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

  // Canvas Viewport Width Mode: "fit" (100% full width), "wide" (1240px landscape sheet), "standard" (860px A4 portrait)
  const [canvasWidthMode, setCanvasWidthMode] = useState<"fit" | "wide" | "standard">("fit");
  
  // Interactive column resizer state for header drag-to-resize
  const [resizingCol, setResizingCol] = useState<{
    blockIndex: number;
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Draggable Inspector & Properties panel width (340px - 800px)
  const [inspectorWidth, setInspectorWidth] = useState<number>(460);
  const [isResizingInspector, setIsResizingInspector] = useState(false);
  const inspectorResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (!isResizingInspector) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!inspectorResizeRef.current) return;
      const delta = inspectorResizeRef.current.startX - e.clientX;
      const newWidth = Math.max(340, Math.min(800, Math.round(inspectorResizeRef.current.startWidth + delta)));
      setInspectorWidth(newWidth);
    };
    const onMouseUp = () => {
      setIsResizingInspector(false);
      inspectorResizeRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizingInspector]);

  // Global mouse listeners for real-time column width dragging
  useEffect(() => {
    if (!resizingCol) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingCol.startX;
      const newWidth = Math.max(65, Math.min(500, Math.round(resizingCol.startWidth + deltaX)));

      const block = blocks[resizingCol.blockIndex];
      if (block && block.type === "table_grid") {
        const updatedCols = block.columns.map((c) =>
          c.id === resizingCol.columnId ? { ...c, width: `${newWidth}px` } : c
        );
        updateBlock(resizingCol.blockIndex, { ...block, columns: updatedCols });
      }
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingCol, blocks]);

  const handleColResizeStart = (
    e: React.MouseEvent,
    blockIndex: number,
    columnId: string,
    currentWidth?: string | number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).closest("th");
    const initialWidth = th
      ? th.getBoundingClientRect().width
      : typeof currentWidth === "number"
      ? currentWidth
      : parseInt(currentWidth || "100") || 100;

    setResizingCol({
      blockIndex,
      columnId,
      startX: e.clientX,
      startWidth: initialWidth,
    });
  };

  const autoFitColumns = (blockIndex: number) => {
    const block = blocks[blockIndex];
    if (!block || block.type !== "table_grid") return;
    const updatedCols = block.columns.map((c) => {
      const id = c.id.toLowerCase();
      const label = (c.label || "").toLowerCase();
      let suggestedWidth = "110px";
      if (id === "point_number" || id === "sl_no" || id === "sino" || label.includes("sl.no") || label.includes("sl no") || label.includes("si no")) {
        suggestedWidth = "65px";
      } else if (label.includes("spec") || label.includes("condition") || label.includes("parameter") || label.includes("desc")) {
        suggestedWidth = "180px";
      } else if (label.includes("nominal") || id === "nominal") {
        suggestedWidth = "110px";
      } else if (label.includes("limit") || label.includes("tolerance") || label.includes("tol")) {
        suggestedWidth = "110px";
      } else if (label.includes("actual") || label.includes("reading") || label.includes("trial") || label.includes("bore") || label.includes("gauge")) {
        suggestedWidth = "105px";
      } else if (label.includes("deviation") || label.includes("average") || label.includes("error")) {
        suggestedWidth = "115px";
      } else if (label.includes("judge") || label.includes("status")) {
        suggestedWidth = "115px";
      }
      return { ...c, width: suggestedWidth };
    });
    updateBlock(blockIndex, { ...block, columns: updatedCols });
    toast.success("Applied intelligent auto-fit column widths!");
  };



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

  // Recalculates row formulas live when user edits any cell in builder table
  const handleTableCellChange = (
    blockIndex: number,
    rowIndex: number,
    colId: string,
    val: any
  ) => {
    const block = blocks[blockIndex] as TableGridBlock;
    if (!block || !block.rows) return;
    const newRows = [...block.rows];
    const currentRow = newRows[rowIndex] || {};
    const parsedNum = parseFloat(String(val));
    const numVal = !isNaN(parsedNum) ? parsedNum : undefined;
    const updatedRow = {
      ...currentRow,
      [colId]: val,
      ...(colId === "reading" ? { reading: numVal } : {}),
      ...(colId === "nominal" ? { nominal: numVal } : {}),
      ...(colId === "tolerance" ? { tolerance: numVal } : {}),
    };

    // Synchronize trial aliases across row for live formula evaluation
    const trialMatch = colId.match(/^(?:t|trial_|trial|reading_|reading|actual_|actual|observed_|observed|r|col_)?([1-9]|1[0-9]|20)$/i);
    if (trialMatch) {
      const idx = trialMatch[1];
      const aliases = [
        `t${idx}`, `trial_${idx}`, `trial${idx}`, `reading_${idx}`, `reading${idx}`,
        `actual_${idx}`, `actual${idx}`, `observed_${idx}`, `observed${idx}`, `r${idx}`, `col_${idx}`, idx
      ];
      aliases.forEach((a) => {
        updatedRow[a] = val;
      });
    }

    const tol = parseFloat(String(updatedRow.tolerance ?? block.tolerance ?? 0.02)) || 0.02;
    const dec = block.decimal_places ?? decimalPlaces ?? 3;
    const evaluatedRow = evaluateCanvasRowFormulas(updatedRow, block.columns, tol, dec);

    // CRITICAL: Ensure the active cell keeps the exact string the user is typing (e.g. "35.", "0.", "-")
    evaluatedRow[colId] = val;
    if (trialMatch) {
      const idx = trialMatch[1];
      const aliases = [
        `t${idx}`, `trial_${idx}`, `trial${idx}`, `reading_${idx}`, `reading${idx}`,
        `actual_${idx}`, `actual${idx}`, `observed_${idx}`, `observed${idx}`, `r${idx}`, `col_${idx}`, idx
      ];
      aliases.forEach((a) => {
        evaluatedRow[a] = val;
      });
    }

    newRows[rowIndex] = evaluatedRow;
    updateBlock(blockIndex, { ...block, rows: newRows });
  };

  const handleChildTableCellChange = (
    blockIndex: number,
    childIndex: number,
    rowIndex: number,
    colId: string,
    val: any
  ) => {
    const split = blocks[blockIndex] as SplitRowBlock;
    if (!split || !split.children) return;
    const child = split.children[childIndex] as TableGridBlock;
    if (!child || !child.rows) return;
    const newRows = [...child.rows];
    const currentRow = newRows[rowIndex] || {};
    const parsedNum = parseFloat(String(val));
    const numVal = !isNaN(parsedNum) ? parsedNum : undefined;
    const updatedRow = {
      ...currentRow,
      [colId]: val,
      ...(colId === "reading" ? { reading: numVal } : {}),
      ...(colId === "nominal" ? { nominal: numVal } : {}),
      ...(colId === "tolerance" ? { tolerance: numVal } : {}),
    };

    const trialMatch = colId.match(/^(?:t|trial_|trial|reading_|reading|actual_|actual|observed_|observed|r|col_)?([1-9]|1[0-9]|20)$/i);
    if (trialMatch) {
      const idx = trialMatch[1];
      const aliases = [
        `t${idx}`, `trial_${idx}`, `trial${idx}`, `reading_${idx}`, `reading${idx}`,
        `actual_${idx}`, `actual${idx}`, `observed_${idx}`, `observed${idx}`, `r${idx}`, `col_${idx}`, idx
      ];
      aliases.forEach((a) => {
        updatedRow[a] = val;
      });
    }

    const tol = parseFloat(String(updatedRow.tolerance ?? child.tolerance ?? 0.02)) || 0.02;
    const dec = child.decimal_places ?? decimalPlaces ?? 3;
    const evaluatedRow = evaluateCanvasRowFormulas(updatedRow, child.columns, tol, dec);

    evaluatedRow[colId] = val;
    if (trialMatch) {
      const idx = trialMatch[1];
      const aliases = [
        `t${idx}`, `trial_${idx}`, `trial${idx}`, `reading_${idx}`, `reading${idx}`,
        `actual_${idx}`, `actual${idx}`, `observed_${idx}`, `observed${idx}`, `r${idx}`, `col_${idx}`, idx
      ];
      aliases.forEach((a) => {
        evaluatedRow[a] = val;
      });
    }

    newRows[rowIndex] = evaluatedRow;
    const updatedChildren = split.children.map((c, i) => (i === childIndex ? { ...child, rows: newRows } : c));
    updateBlock(blockIndex, { ...split, children: updatedChildren });
  };

  // Helper to evaluate formula preview in builder with decimal formatting
  const evaluatePreviewCell = (
    row: CanvasRowData,
    col: CanvasColumnDef,
    tableDec: number = 3
  ): React.ReactNode => {
    const dec = col.decimal_places ?? col.decimalPrecision ?? tableDec ?? decimalPlaces ?? 3;
    const cellVal = row[col.id] !== undefined
      ? row[col.id]
      : col.type === "nominal"
      ? row.nominal
      : col.type === "text"
      ? row.description
      : col.type === "tolerance"
      ? row.tolerance
      : (col.type === "trial" || col.type === "reading")
      ? row.reading
      : undefined;

    const formatNumericVal = (val: any) => {
      if (val === undefined || val === null || val === "") return "-";
      if (typeof val === "number") return dec === 0 ? String(Math.round(val)) : val.toFixed(dec);
      const str = String(val).trim();
      const num = parseFloat(str);
      if (!isNaN(num) && /^[+-]?\d+(\.\d+)?$/.test(str)) {
        return dec === 0 ? String(Math.round(num)) : num.toFixed(dec);
      }
      return str;
    };

    if (col.type === "nominal") {
      return formatNumericVal(cellVal);
    }
    if (col.type === "text") {
      return cellVal !== undefined && cellVal !== null ? String(cellVal) : "-";
    }
    if (col.type === "tolerance") {
      if (cellVal !== undefined && cellVal !== null && cellVal !== "") {
        if (typeof cellVal === "number") {
          return cellVal >= 0 ? `±${cellVal.toFixed(dec)}` : cellVal.toFixed(dec);
        }
        const p = parseFloat(String(cellVal));
        if (!isNaN(p) && /^[+-]?\d+(\.\d+)?$/.test(String(cellVal).trim())) {
          return p >= 0 ? `±${p.toFixed(dec)}` : p.toFixed(dec);
        }
        return String(cellVal);
      }
      return row.tolerance ? `±${row.tolerance.toFixed(dec)}` : "-";
    }
    if (col.type === "trial" || col.type === "reading") {
      return formatNumericVal(cellVal);
    }
    if (col.type === "formula") {
      if (cellVal !== undefined && cellVal !== null && cellVal !== "") {
        return formatNumericVal(cellVal);
      }
      if (col.formula) {
        const tol = parseFloat(String(row.tolerance ?? 0.02)) || 0.02;
        const ctx = buildRowContext(row, [col], tol, dec);
        const evalRes = testEvaluateFormula(col.formula, ctx.valuesMap, dec);
        if (evalRes.success && evalRes.formatted) {
          return evalRes.formatted;
        }
      }
      return "-";
    }
    if (col.type === "status" || col.role === "JUDGEMENT" || col.label.toLowerCase().includes("judg")) {
      const statusVal = cellVal || row.status || row.judgement;
      if (statusVal) {
        const isPass = String(statusVal).trim().toUpperCase() === "PASS";
        const isFail = String(statusVal).trim().toUpperCase() === "FAIL";
        return (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold ${
            isPass
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              : isFail
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}>
            {statusVal}
          </span>
        );
      }
      if (col.formula) {
        const tol = parseFloat(String(row.tolerance ?? 0.02)) || 0.02;
        const ctx = buildRowContext(row, [col], tol, dec);
        const evalRes = testEvaluateFormula(col.formula, ctx.valuesMap, dec);
        if (evalRes.success && evalRes.formatted) {
          const isPass = String(evalRes.formatted).trim().toUpperCase() === "PASS";
          const isFail = String(evalRes.formatted).trim().toUpperCase() === "FAIL";
          return (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold ${
              isPass
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : isFail
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}>
              {evalRes.formatted}
            </span>
          );
        }
      }
      return "-";
    }
    if (cellVal !== undefined && cellVal !== null) {
      return formatNumericVal(cellVal);
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
    <div className="h-full w-full flex flex-col overflow-hidden bg-background">
      {/* Canvas Top Bar: Presets, Quick Actions, and AI Copilot Dock Toggle (Shown when standalone) */}
      {!hideCopilotInside && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-card shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Canvas Blocks ({blocks.length})</span>
            </span>
            <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 bg-muted">
              {canvasWidthMode === "fit" ? "Full Width (100%)" : canvasWidthMode === "wide" ? "Wide (1240px)" : "A4 Standard (860px)"}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Standard Metrology System Presets Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-medium gap-1.5 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg shadow-2xs"
                  title="Select Standard Metrology Template Preset"
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                  <span>Standard Presets</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-80 overflow-y-auto">
                {CANVAS_PRESETS.map((preset) => (
                  <DropdownMenuItem
                    key={preset.id}
                    onClick={() => {
                      if (onSelectPreset) {
                        onSelectPreset(preset);
                      } else {
                        markChanged(JSON.parse(JSON.stringify(preset.blocks)));
                        toast.success(`Loaded "${preset.name}" preset!`);
                      }
                    }}
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                  >
                    <span className="font-semibold text-xs text-foreground">{preset.name}</span>
                    <span className="text-xxs text-muted-foreground line-clamp-1">{preset.description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* AI Generator button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAiModal(true)}
              className="h-7 px-2.5 text-xs font-medium gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg shadow-2xs"
              title="AI Smart Template Generator"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>AI Smart Generate</span>
            </Button>

            {/* AI Copilot Antigravity Dock Toggle Button */}
            <Button
              type="button"
              variant={showAssistant ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setShowAssistant(!showAssistant);
                setIsAssistantDocked(true);
              }}
              className={`h-7 px-2.5 text-xs font-semibold gap-1.5 rounded-lg border transition-all ${
                showAssistant
                  ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800"
                  : "text-slate-700 dark:text-slate-300 hover:bg-muted"
              }`}
              title={showAssistant ? "Hide AI Copilot (Full Screen View)" : "Show AI Copilot Dock"}
            >
              {showAssistant ? <PanelRightClose className="w-3.5 h-3.5 text-indigo-600" /> : <PanelRight className="w-3.5 h-3.5 text-indigo-500" />}
              <span>{showAssistant ? "Hide Copilot" : "AI Copilot"}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main 3-Column Antigravity Workspace: Toolbox (Left) + Independent Center Scroll (Center) + Docked Copilot (Right) */}
      <div className="flex-1 flex flex-row min-h-0 w-full overflow-hidden relative">
        {/* MODULAR BLOCKS TOOLBOX (MATCHES USER DESIGN) */}
        {isToolboxCollapsed ? (
          <div className="w-11 shrink-0 h-full bg-card border-r border-slate-200 dark:border-slate-800 p-1.5 flex flex-col items-center gap-2 shadow-xs py-3 overflow-y-auto">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsToolboxCollapsed(false)}
              className="h-7 w-7 text-primary hover:bg-primary/10 rounded-lg"
              title="Expand Add Modular Blocks Panel"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="w-6 h-[1px] bg-border my-0.5" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={addTableBlock}
              className="h-8 w-8 text-blue-500 hover:bg-blue-500/10 rounded-lg"
              title="Add Data Table Grid"
            >
              <Table className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={addSplitRowBlock}
              className="h-8 w-8 text-indigo-500 hover:bg-indigo-500/10 rounded-lg"
              title="Add Side-by-Side (50/50)"
            >
              <SplitSquareVertical className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={addMatrixBlock}
              className="h-8 w-8 text-purple-500 hover:bg-purple-500/10 rounded-lg"
              title="Add Reference Matrix Table"
            >
              <Grid2X2 className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={addTextBlock}
              className="h-8 w-8 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"
              title="Add Note / Statement"
            >
              <FileText className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={addPageBreak}
              className="h-8 w-8 text-amber-500 hover:bg-amber-500/10 rounded-lg"
              title="Add Page Break"
            >
              <SeparatorHorizontal className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="w-[220px] xl:w-[250px] shrink-0 h-full border-r border-slate-200 dark:border-slate-800 bg-card/60 p-3 space-y-4 overflow-y-auto">
            {/* Add Modular Blocks Card matching user image */}
            <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-0.5">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 tracking-tight">
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  <span>Add Modular Blocks</span>
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsToolboxCollapsed(true)}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-md"
                  title="Collapse Modular Blocks Panel"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {/* 1. Data Table Grid */}
                <button
                  type="button"
                  onClick={addTableBlock}
                  className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-primary/5 hover:text-primary hover:border-primary/40 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all shadow-2xs group cursor-pointer"
                >
                  <Table className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform shrink-0" />
                  <span>+ Data Table Grid</span>
                </button>

                {/* 2. Side-by-Side (50/50) */}
                <button
                  type="button"
                  onClick={addSplitRowBlock}
                  className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/40 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all shadow-2xs group cursor-pointer"
                >
                  <SplitSquareVertical className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform shrink-0" />
                  <span>+ Side-by-Side (50/50)</span>
                </button>

                {/* 3. Reference Matrix */}
                <button
                  type="button"
                  onClick={addMatrixBlock}
                  className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-500/40 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all shadow-2xs group cursor-pointer"
                >
                  <Grid2X2 className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform shrink-0" />
                  <span>+ Reference Matrix</span>
                </button>

                {/* 4. Note / Statement */}
                <button
                  type="button"
                  onClick={addTextBlock}
                  className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/40 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all shadow-2xs group cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform shrink-0" />
                  <span>+ Note / Statement</span>
                </button>

                {/* 5. Page Break */}
                <button
                  type="button"
                  onClick={addPageBreak}
                  className="w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/40 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all shadow-2xs group cursor-pointer"
                >
                  <SeparatorHorizontal className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform shrink-0" />
                  <span>+ Page Break</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MIDDLE COLUMN: CALIBRATION DATA & CANVAS BLOCKS (Independent Scroll!) */}
        <div className="flex-1 h-full min-w-0 overflow-y-auto px-4 py-4 space-y-6 bg-slate-50/50 dark:bg-slate-950/30">
          {blocks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3 shadow-xs">
              <Table className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-foreground">Your Certificate Canvas is Empty</h4>
                <p className="text-tiny text-muted-foreground">
                  Click below to add a table, load a standard metrology preset, or use <strong>AI Smart Generate</strong> to build your template.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  onClick={addTableBlock}
                  className="text-xs font-semibold gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Calibration Table
                </Button>
                {/* Standard Presets dropdown button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs font-semibold gap-1.5 text-blue-600 border-blue-500/40 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                      Standard Presets
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-80 max-h-80 overflow-y-auto">
                    {CANVAS_PRESETS.map((preset) => (
                      <DropdownMenuItem
                        key={preset.id}
                        onClick={() => {
                          if (onSelectPreset) {
                            onSelectPreset(preset);
                          } else {
                            markChanged(JSON.parse(JSON.stringify(preset.blocks)));
                            toast.success(`Loaded "${preset.name}" preset!`);
                          }
                        }}
                        className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                      >
                        <span className="font-semibold text-xs text-foreground">{preset.name}</span>
                        <span className="text-xxs text-muted-foreground line-clamp-1">{preset.description}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAiModal(true)}
                  className="text-xs font-semibold gap-1.5 text-amber-600 border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Smart Generate
                </Button>
              </div>
            </div>
          ) : (
            blocks.map((block, index) => (
                <div
                  key={block.id}
                  onClick={() => {
                    setSelectedBlockId(block.id);
                  }}
                  style={{
                    marginTop: `${(block as any).marginTop !== undefined ? (block as any).marginTop : (index === 0 ? 6 : 0)}px`,
                    marginBottom: `${(block as any).marginBottom !== undefined ? (block as any).marginBottom : 10}px`,
                  }}
                  className={`relative group transition-all rounded-xl cursor-pointer border shadow-sm bg-white dark:bg-slate-900 ${
                    selectedBlockId === block.id
                      ? "border-primary ring-2 ring-primary/20 shadow-md"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
                  }`}
                >
                  {/* Floating Action Controls on Hover */}
                  <div className="absolute -top-3.5 right-4 z-30 hidden group-hover:flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1 rounded-full shadow-lg border border-slate-700 text-xs backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-100">
                    <span className="text-xxs font-mono text-amber-400 mr-1 uppercase font-bold tracking-wider">
                      {block.type === "table_grid" ? "TABLE" : block.type.replace("_", " ")}
                    </span>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(index, "up");
                      }}
                      className="p-1 hover:text-amber-400 disabled:opacity-30 rounded hover:bg-slate-800 transition-colors"
                      title="Move Up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === blocks.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(index, "down");
                      }}
                      className="p-1 hover:text-amber-400 disabled:opacity-30 rounded hover:bg-slate-800 transition-colors"
                      title="Move Down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateBlock(block, index);
                      }}
                      className="p-1 hover:text-emerald-400 rounded hover:bg-slate-800 transition-colors"
                      title="Duplicate Block"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBlock(index);
                      }}
                      className="p-1 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                      title="Delete Block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
                      <div className="rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                        <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 flex-wrap gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Table className="w-4 h-4 text-primary shrink-0" />
                              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                {block.title || "Calibration Data"}
                              </h3>
                            </div>
                            <p className="text-tiny text-muted-foreground pt-0.5">
                              Calibration Points and Readings
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700">
                              Unit: {block.unit || "mm"}
                            </Badge>
                            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                              Tolerance: {
                                (block as TableGridBlock).toleranceType === "mixed" ||
                                (block as TableGridBlock).toleranceType === "row_specific" ||
                                ((block as TableGridBlock).rows && (block as TableGridBlock).rows.some((r, i, arr) => r.tolerance !== arr[0]?.tolerance))
                                  ? "Row-specific"
                                  : `±${block.tolerance ?? "0.010"}`
                              }
                            </Badge>

                            {/* Table Print Orientation Toggle */}
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs shadow-2xs">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateBlock(index, { ...block, orientation: "vertical" });
                                  toast.success("Table layout set to Vertical (Standard Rows)");
                                }}
                                className={`px-2.5 py-0.5 rounded-full text-tiny font-semibold transition-all flex items-center gap-1 ${
                                  (block.orientation === "vertical" || (!block.orientation && effOrient === "vertical"))
                                    ? "bg-white dark:bg-slate-900 text-primary shadow-2xs"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                                title="Vertical print orientation (Standard Rows)"
                              >
                                <ArrowUpDown className="w-3 h-3" />
                                <span>Vertical</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateBlock(index, { ...block, orientation: "horizontal" });
                                  toast.success("Table layout set to Horizontal (Transposed Columns)");
                                }}
                                className={`px-2.5 py-0.5 rounded-full text-tiny font-semibold transition-all flex items-center gap-1 ${
                                  block.orientation === "horizontal"
                                    ? "bg-white dark:bg-slate-900 text-primary shadow-2xs"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                                title="Horizontal print orientation (Transposed Columns)"
                              >
                                <ArrowLeftRight className="w-3 h-3" />
                                <span>Horizontal</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* HORIZONTAL TRANSPOSED VIEW */}
                        {effOrient === "horizontal" ? (
                          <div className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-slate-400 dark:scrollbar-thumb-slate-600 hover:scrollbar-thumb-slate-500 scrollbar-track-slate-100 dark:scrollbar-track-slate-800">
                            <table className="w-full border-collapse text-xs text-center border-slate-300 dark:border-slate-700" style={{ tableLayout: 'auto' }}>
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b-2 border-slate-400 dark:border-slate-600 divide-x divide-slate-300 dark:divide-slate-700">
                                  <th className="py-2.5 px-3 text-left bg-slate-200 dark:bg-slate-750 font-bold w-40 min-w-[140px] text-slate-900 dark:text-white sticky left-0 z-20 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)] border-r-2 border-slate-400 dark:border-slate-600">
                                    Parameter / Sl no
                                  </th>
                                  {block.rows.map((r, rIdx) => (
                                    <th key={rIdx} className="py-2.5 px-2 font-bold min-w-[65px] text-slate-900 dark:text-white group/hcol">
                                      <div className="flex items-center justify-center gap-1">
                                        <span>{r.point_number ?? (rIdx + 1)}</span>
                                        {block.rows.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const newRows = block.rows.filter((_, i) => i !== rIdx);
                                              updateBlock(index, { ...block, rows: newRows });
                                            }}
                                            className="opacity-0 group-hover/hcol:opacity-100 p-0.5 text-slate-400 hover:text-rose-400 rounded transition-opacity"
                                            title={`Delete point ${rIdx + 1}`}
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-300 dark:divide-slate-700 font-mono">
                                {displayCols.map((col) => (
                                  <tr key={col.id} className="divide-x divide-slate-300 dark:divide-slate-700 hover:bg-indigo-50/20">
                                    <td className="py-2 px-3 text-left font-bold bg-slate-100/90 dark:bg-slate-800/80 text-xs font-sans text-slate-900 dark:text-slate-100 sticky left-0 z-10 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] border-r-2 border-slate-300 dark:border-slate-700">
                                      <div className="flex items-center justify-between">
                                        <span>{col.label}</span>
                                        {col.type === "formula" && (
                                          <span className="text-xxs text-primary bg-primary/10 px-1 rounded font-bold font-mono">(fx)</span>
                                        )}
                                      </div>
                                    </td>
                                    {block.rows.map((row, rIdx) => {
                                      if (col.type === "nominal") {
                                        const cellVal = row[col.id] !== undefined ? row[col.id] : (col.id === "nominal" ? row.nominal : "");
                                        return (
                                          <td key={rIdx} className="py-1 px-1.5 min-w-[65px]">
                                            <Input
                                              type="text"
                                              value={cellVal ?? ""}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                  handleTableCellChange(index, rIdx, col.id, v);
                                                }
                                              }}
                                              onBlur={(e) => {
                                                const raw = e.target.value.trim();
                                                if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                const parsed = parseFloat(raw);
                                                if (!isNaN(parsed)) {
                                                  const colDec = col.decimal_places ?? col.decimalPrecision ?? block.decimal_places ?? decimalPlaces ?? 3;
                                                  const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                  handleTableCellChange(index, rIdx, col.id, formatted);
                                                }
                                              }}
                                              className="h-7.5 text-xs text-center bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-md px-1.5 font-metrology font-bold hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-slate-100 shadow-2xs"
                                              placeholder="0"
                                            />
                                          </td>
                                        );
                                      }
                                      if (col.type === "text") {
                                        const cellVal = row[col.id] ?? (col.id === "description" ? row.description : "") ?? "";
                                        return (
                                          <td key={rIdx} className="py-1 px-1.5 min-w-[70px]">
                                            <Input
                                              value={cellVal}
                                              onChange={(e) => {
                                                const newRows = [...block.rows];
                                                newRows[rIdx] = {
                                                  ...newRows[rIdx],
                                                  [col.id]: e.target.value,
                                                  ...(col.id === "description" ? { description: e.target.value } : {}),
                                                };
                                                updateBlock(index, { ...block, rows: newRows });
                                              }}
                                              className="h-7.5 text-xs text-center bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-md px-1.5 font-sans font-medium hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-slate-100 shadow-2xs"
                                              placeholder={col.label || "Desc"}
                                            />
                                          </td>
                                        );
                                      }
                                      if (col.type === "reading" || col.type === "trial") {
                                        const cellVal = row[col.id] ?? (col.id === "reading" ? row.reading : "") ?? "";
                                        return (
                                          <td key={rIdx} className="py-1 px-1.5 min-w-[65px]">
                                            <Input
                                              value={cellVal}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                  handleTableCellChange(index, rIdx, col.id, v);
                                                }
                                              }}
                                              onBlur={(e) => {
                                                const raw = e.target.value.trim();
                                                if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                const parsed = parseFloat(raw);
                                                if (!isNaN(parsed)) {
                                                  const colDec = col.decimal_places ?? col.decimalPrecision ?? block.decimal_places ?? decimalPlaces ?? 3;
                                                  const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                  handleTableCellChange(index, rIdx, col.id, formatted);
                                                }
                                              }}
                                              className="h-7.5 text-xs text-center bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-md px-1.5 font-metrology font-medium hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-slate-100 shadow-2xs"
                                              placeholder="0.00"
                                            />
                                          </td>
                                        );
                                      }
                                      if (col.type === "tolerance") {
                                        const cellVal = row[col.id] ?? (col.id === "tolerance" ? row.tolerance : "") ?? "";
                                        return (
                                          <td key={rIdx} className="py-1 px-1.5 min-w-[65px]">
                                            <Input
                                              value={cellVal}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                  handleTableCellChange(index, rIdx, col.id, v);
                                                }
                                              }}
                                              onBlur={(e) => {
                                                const raw = e.target.value.trim();
                                                if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                const parsed = parseFloat(raw);
                                                if (!isNaN(parsed)) {
                                                  const colDec = col.decimal_places ?? col.decimalPrecision ?? block.decimal_places ?? decimalPlaces ?? 3;
                                                  const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                  handleTableCellChange(index, rIdx, col.id, formatted);
                                                }
                                              }}
                                              className="h-7.5 text-xs text-center bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-md px-1.5 font-metrology font-medium hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-slate-100 shadow-2xs"
                                              placeholder="±Tol"
                                            />
                                          </td>
                                        );
                                      }
                                      const evaluated = evaluatePreviewCell(row, col, block.decimal_places ?? decimalPlaces);
                                      const isJudgementCol = col.type === "status" || col.role === "JUDGEMENT" || col.label.toLowerCase().includes("judg");
                                      if (isJudgementCol && evaluated) {
                                        const isPass = String(evaluated).trim().toUpperCase() === "PASS";
                                        const isFail = String(evaluated).trim().toUpperCase() === "FAIL";
                                        return (
                                          <td key={rIdx} className="py-1 px-1.5 min-w-[65px]">
                                            {isPass ? (
                                              <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-700 shadow-2xs">
                                                PASS
                                              </span>
                                            ) : isFail ? (
                                              <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-400 dark:border-rose-700 shadow-2xs">
                                                FAIL
                                              </span>
                                            ) : (
                                              <span className="font-metrology text-xs text-slate-400">{evaluated}</span>
                                            )}
                                          </td>
                                        );
                                      }
                                      return (
                                        <td key={rIdx} className="py-1.5 px-2 min-w-[65px]">
                                          <span className="text-slate-900 dark:text-slate-100 font-metrology text-xs font-bold">
                                            {evaluated}
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
                          <div className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-slate-400 dark:scrollbar-thumb-slate-600 hover:scrollbar-thumb-slate-500 scrollbar-track-slate-100 dark:scrollbar-track-slate-800">
                            <table className="w-full border-collapse text-xs text-center border-border">
                              <thead>
                                <tr className="bg-muted/40 font-semibold border-b text-muted-foreground divide-x divide-border">
                                  {block.columns.map((col) => {
                                    const isPointNo = col.id === "point_number" || col.id === "sl_no" || col.id === "sino";
                                    return (
                                      <th
                                        key={col.id}
                                        style={{ width: col.width, minWidth: col.width || (isPointNo ? "60px" : "95px") }}
                                        className={`relative group/th py-2 px-3 font-semibold text-tiny uppercase tracking-wider select-none text-muted-foreground ${
                                          isPointNo
                                            ? "sticky left-0 z-20 bg-muted/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)] border-r border-border"
                                            : "bg-muted/40"
                                        }`}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          <span>{col.label}</span>
                                          {col.type === "formula" && (
                                            <span className="px-1 py-0.2 rounded text-2xs font-mono font-bold bg-primary/15 text-primary border border-primary/30">
                                              fx
                                            </span>
                                          )}
                                        </div>
                                        {/* Draggable Resizer Handle */}
                                        <div
                                          onMouseDown={(e) => handleColResizeStart(e, index, col.id, col.width)}
                                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-30 opacity-40 group-hover/th:opacity-100 transition-opacity flex items-center justify-center"
                                          title="Click & drag to resize column width"
                                        >
                                          <div className="w-[1.5px] h-3.5 bg-muted-foreground/50 group-hover/th:bg-primary group-hover/th:h-5 transition-all rounded" />
                                        </div>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {block.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="divide-x divide-border hover:bg-muted/20 transition-colors group/row">
                                    {block.columns.map((col) => {
                                      const isPointNo = col.id === "point_number" || col.id === "sl_no" || col.id === "sino";
                                      if (isPointNo) {
                                        return (
                                          <td
                                            key={col.id}
                                            style={{ width: col.width, minWidth: col.width || "60px" }}
                                            className="py-1.5 px-2 text-xs font-semibold text-muted-foreground sticky left-0 z-10 bg-card/90 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.06)] border-r border-border"
                                          >
                                            <div className="flex items-center justify-center gap-1">
                                              <span>{row.point_number ?? (rIdx + 1)}</span>
                                              {block.rows.length > 1 && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newRows = block.rows.filter((_, i) => i !== rIdx);
                                                    updateBlock(index, { ...block, rows: newRows });
                                                  }}
                                                  className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground hover:text-rose-500 rounded transition-opacity"
                                                  title={`Delete row ${rIdx + 1}`}
                                                >
                                                  <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        );
                                      }
                                      if (col.type === "nominal") {
                                        const cellVal = row[col.id] !== undefined ? row[col.id] : (col.id === "nominal" ? row.nominal : "");
                                        return (
                                          <td key={col.id} style={{ width: col.width, minWidth: col.width || "95px" }} className="py-1 px-1">
                                            <Input
                                              type="text"
                                              value={cellVal ?? ""}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                  handleTableCellChange(index, rIdx, col.id, v);
                                                }
                                              }}
                                              onBlur={(e) => {
                                                const raw = e.target.value.trim();
                                                if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                const parsed = parseFloat(raw);
                                                if (!isNaN(parsed)) {
                                                  const colDec = col.decimal_places ?? col.decimalPrecision ?? block.decimal_places ?? decimalPlaces ?? 3;
                                                  const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                  handleTableCellChange(index, rIdx, col.id, formatted);
                                                }
                                              }}
                                              className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold transition-colors"
                                              placeholder="0"
                                            />
                                          </td>
                                        );
                                      }
                                      if (col.type === "text") {
                                        const cellVal = row[col.id] ?? (col.id === "description" ? row.description : "") ?? "";
                                        return (
                                          <td key={col.id} style={{ width: col.width, minWidth: col.width || "100px" }} className="py-1 px-1">
                                            <Input
                                              value={cellVal}
                                              onChange={(e) => {
                                                const newRows = [...block.rows];
                                                newRows[rIdx] = {
                                                  ...newRows[rIdx],
                                                  [col.id]: e.target.value,
                                                  ...(col.id === "description" ? { description: e.target.value } : {}),
                                                };
                                                updateBlock(index, { ...block, rows: newRows });
                                              }}
                                              className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-sans text-slate-800 dark:text-slate-200 font-medium transition-colors"
                                              placeholder={col.label || "Value"}
                                            />
                                          </td>
                                        );
                                      }
                                      if (col.type === "reading" || col.type === "trial") {
                                        const cellVal = row[col.id] ?? (col.id === "reading" ? row.reading : "") ?? "";
                                        return (
                                          <td key={col.id} style={{ width: col.width, minWidth: col.width || "90px" }} className="py-1 px-1">
                                            <Input
                                              value={cellVal}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                  handleTableCellChange(index, rIdx, col.id, v);
                                                }
                                              }}
                                              onBlur={(e) => {
                                                const raw = e.target.value.trim();
                                                if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                const parsed = parseFloat(raw);
                                                if (!isNaN(parsed)) {
                                                  const colDec = col.decimal_places ?? col.decimalPrecision ?? block.decimal_places ?? decimalPlaces ?? 3;
                                                  const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                  handleTableCellChange(index, rIdx, col.id, formatted);
                                                }
                                              }}
                                              className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold transition-colors"
                                              placeholder="0.00"
                                            />
                                          </td>
                                        );
                                      }
                                      if (col.type === "tolerance") {
                                        const cellVal = row[col.id] ?? (col.id === "tolerance" ? row.tolerance : "") ?? "";
                                        return (
                                          <td key={col.id} style={{ width: col.width, minWidth: col.width || "90px" }} className="py-1 px-1">
                                            <Input
                                              value={cellVal}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                  handleTableCellChange(index, rIdx, col.id, v);
                                                }
                                              }}
                                              onBlur={(e) => {
                                                const raw = e.target.value.trim();
                                                if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                const parsed = parseFloat(raw);
                                                if (!isNaN(parsed)) {
                                                  const colDec = col.decimal_places ?? col.decimalPrecision ?? block.decimal_places ?? decimalPlaces ?? 3;
                                                  const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                  handleTableCellChange(index, rIdx, col.id, formatted);
                                                }
                                              }}
                                              className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold transition-colors"
                                              placeholder="±Tol"
                                            />
                                          </td>
                                        );
                                      }
                                      const evaluated = evaluatePreviewCell(row, col, block.decimal_places ?? decimalPlaces);
                                      const isJudgementCol = col.type === "status" || col.role === "JUDGEMENT" || col.label.toLowerCase().includes("judg");
                                      if (isJudgementCol && evaluated) {
                                        const isPass = String(evaluated).trim().toUpperCase() === "PASS";
                                        const isFail = String(evaluated).trim().toUpperCase() === "FAIL";
                                        return (
                                          <td key={col.id} style={{ width: col.width, minWidth: col.width || "95px" }} className="py-1.5 px-2">
                                            {isPass ? (
                                              <span className="inline-block px-2.5 py-0.5 rounded text-tiny font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                                PASS
                                              </span>
                                            ) : isFail ? (
                                              <span className="inline-block px-2.5 py-0.5 rounded text-tiny font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                                                FAIL
                                              </span>
                                            ) : (
                                              <span className="font-mono text-xs text-slate-400">{evaluated}</span>
                                            )}
                                          </td>
                                        );
                                      }
                                      return (
                                        <td key={col.id} style={{ width: col.width, minWidth: col.width || "95px" }} className="py-1.5 px-2">
                                          <span className="font-metrology text-xs font-semibold text-slate-800 dark:text-slate-200">
                                            {evaluated}
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
                        <div className="bg-slate-50/80 dark:bg-slate-900/60 p-2.5 flex items-center justify-between text-xs border-t border-slate-200 dark:border-slate-800">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newRow: CanvasRowData = {
                                point_number: block.rows.length + 1,
                                nominal: (block.rows[block.rows.length - 1]?.nominal || 0) + 10,
                                unit: block.unit || "mm",
                              };
                              updateBlock(index, { ...block, rows: [...block.rows, newRow] });
                            }}
                            className="h-8 px-4 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 border-dashed border-primary/40 rounded-lg gap-2 shadow-2xs transition-all flex items-center"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Point / Row</span>
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
                              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md font-medium"
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
                    <div className="space-y-2 p-2 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border-2 border-dashed border-indigo-400 shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400 font-bold px-1">
                        <span className="flex items-center gap-1.5">
                          <SplitSquareVertical className="w-3.5 h-3.5" />
                          Side-by-Side Split ({block.children.length} Columns)
                        </span>
                      </div>

                      <div className={`grid grid-cols-1 md:grid-cols-${block.children.length} gap-3 items-start`}>
                        {block.children.map((child, cIdx) => (
                          <div
                            key={child.id || cIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBlockId(block.id);
                              setSelectedChildTableId(child.id);
                              setShowInspector(true);
                            }}
                            className={`border-2 border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 flex flex-col shadow-2xs transition-all ${
                              selectedChildTableId === child.id ? "ring-2 ring-indigo-500 border-indigo-500" : "hover:border-indigo-300"
                            }`}
                          >
                            {child.type === "table_grid" && (() => {
                              const childEff = getEffectiveTableOrientation(child);
                              const childDisplayCols = (child.columns || []).filter(
                                (c) => c.id !== "point_number" && c.id !== "sl_no" && c.id !== "sino" && c.id !== "slno"
                              );
                              return (
                                <>
                                  <div className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 flex items-center justify-between border-b-2 border-slate-300 dark:border-slate-700">
                                    <span className="text-xs font-bold">{child.title}</span>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <span>Dec: {child.decimal_places ?? decimalPlaces}</span>
                                      <Badge variant="outline" className="text-2xs py-0 px-1 font-mono uppercase font-bold">
                                        {childEff}
                                      </Badge>
                                    </div>
                                  </div>
                                  {childEff === "horizontal" ? (
                                    <div className="overflow-x-auto scrollbar-thin">
                                      <table className="w-full border-collapse text-xs text-center border-slate-300 dark:border-slate-700">
                                        <thead>
                                          <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b-2 border-slate-400 dark:border-slate-600 divide-x divide-slate-300 dark:divide-slate-700">
                                            <th className="py-1 px-2 text-left bg-slate-200/80 font-bold sticky left-0 z-20">Sl no</th>
                                            {child.rows.map((r, rIdx) => (
                                              <th key={rIdx} className="py-1 px-2 font-bold">{r.point_number ?? (rIdx + 1)}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-300 dark:divide-slate-700 font-mono">
                                          {childDisplayCols.map((col) => (
                                            <tr key={col.id} className="divide-x divide-slate-300 dark:divide-slate-700 hover:bg-slate-50/50">
                                              <td className="py-1 px-2 text-left font-bold bg-slate-50 font-sans sticky left-0 z-10">{col.label}</td>
                                              {child.rows.map((row, rIdx) => (
                                                <td key={rIdx} className="py-1 px-1.5 font-bold text-slate-900 dark:text-slate-100">
                                                  {evaluatePreviewCell(row, col, child.decimal_places ?? decimalPlaces)}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto scrollbar-thin">
                                      <table className="w-full border-collapse text-xs text-center border-slate-300 dark:border-slate-700">
                                        <thead>
                                          <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b-2 border-slate-400 dark:border-slate-600 divide-x divide-slate-300 dark:divide-slate-700">
                                            {child.columns.map((col) => (
                                              <th key={col.id} className="py-1.5 px-2 font-bold">{col.label}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
                                          {child.rows.map((row, rIdx) => (
                                            <tr key={rIdx} className="divide-x divide-slate-300 dark:divide-slate-700 hover:bg-slate-50/50">
                                              {child.columns.map((col) => (
                                                <td key={col.id} className="py-1 px-2 font-mono font-bold text-slate-900 dark:text-slate-100">
                                                  {evaluatePreviewCell(row, col, child.decimal_places ?? decimalPlaces)}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
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
                    <div className="border-2 border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                      <div className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-slate-850 dark:to-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 flex items-center justify-between border-b-2 border-slate-300 dark:border-slate-700">
                        <Input
                          value={block.title}
                          onChange={(e) => {
                            const updated = { ...block, title: e.target.value };
                            updateBlock(index, updated);
                          }}
                          className="h-8 text-xs font-bold bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-md px-2.5 focus-visible:ring-2 focus-visible:ring-primary text-slate-900 dark:text-slate-100 shadow-2xs max-w-[320px]"
                          placeholder="Matrix Table Title"
                        />
                        <Badge variant="outline" className="text-xxs uppercase font-mono font-bold">
                          Matrix Table
                        </Badge>
                      </div>
                      <div className="overflow-x-auto scrollbar-thin">
                        <table className="w-full border-collapse text-xs text-center border-slate-300 dark:border-slate-700">
                          <thead>
                            {(block.headers || []).map((hRow, hIdx) => {
                              const cells: any[] = Array.isArray(hRow)
                                ? hRow
                                : (hRow && typeof hRow === "object")
                                  ? [hRow]
                                  : [{ text: String(hRow || "") }];
                              return (
                                <tr key={hIdx} className="bg-slate-100 dark:bg-slate-800 font-bold border-b-2 border-slate-300 dark:border-slate-700">
                                  {cells.map((cell: any, cIdx: number) => {
                                    const cellText = typeof cell === "object" && cell !== null ? (cell.text ?? "") : String(cell ?? "");
                                    const colSpan = typeof cell === "object" && cell !== null ? cell.colSpan : undefined;
                                    const rowSpan = typeof cell === "object" && cell !== null ? cell.rowSpan : undefined;
                                    return (
                                      <th key={cIdx} colSpan={colSpan} rowSpan={rowSpan} className="py-2 px-2.5 font-bold border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                                        {cellText}
                                      </th>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </thead>
                          <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
                            {(block.rows || []).map((r: any, rIdx: number) => {
                              const cells: any[] = Array.isArray(r)
                                ? r
                                : (r && typeof r === "object")
                                  ? Object.values(r)
                                  : [r];
                              return (
                                <tr key={rIdx} className="hover:bg-slate-50/50">
                                  {cells.map((val: any, cIdx: number) => (
                                    <td key={cIdx} className="py-1.5 px-2 font-mono text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                                      {typeof val === "object" && val !== null ? (val.text ?? JSON.stringify(val)) : String(val ?? "")}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 4. NOTE / CALLOUT */}
                  {block.type === "text_block" && (
                    <div className="p-3 border-2 border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-850 flex items-center gap-2.5 shadow-2xs">
                      <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                      <Input
                        value={block.content}
                        onChange={(e) => updateBlock(index, { ...block, content: e.target.value })}
                        className="h-8 text-xs bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-md px-2.5 focus-visible:ring-2 focus-visible:ring-primary font-medium text-slate-900 dark:text-slate-100 shadow-2xs"
                        placeholder="Enter statement or observation notes..."
                      />
                    </div>
                  )}

                  {/* 5. PAGE BREAK */}
                  {block.type === "page_break" && (
                    <div className="border-2 border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-lg text-center my-2 shadow-2xs">
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                        <Columns className="w-4 h-4" />
                        PAGE BREAK (Next content starts on new certificate sheet)
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Quick Add Modular Blocks Section at bottom of blocks */}
            <div className="pt-3 pb-2 border-t border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-tiny font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  <span>Add Modular Block to Canvas</span>
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTableBlock}
                  className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg border-dashed hover:bg-primary/5 hover:text-primary hover:border-primary/40 text-slate-800 dark:text-slate-200"
                  title="Add Data Table Grid"
                >
                  <Table className="w-3.5 h-3.5 text-blue-500" />
                  <span>+ Data Table Grid</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSplitRowBlock}
                  className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg border-dashed hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/40 text-slate-800 dark:text-slate-200"
                  title="Add Side-by-Side (50/50)"
                >
                  <SplitSquareVertical className="w-3.5 h-3.5 text-indigo-500" />
                  <span>+ Side-by-Side (50/50)</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMatrixBlock}
                  className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg border-dashed hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-500/40 text-slate-800 dark:text-slate-200"
                  title="Add Reference Matrix Table"
                >
                  <Grid2X2 className="w-3.5 h-3.5 text-purple-500" />
                  <span>+ Reference Matrix</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTextBlock}
                  className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg border-dashed hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/40 text-slate-800 dark:text-slate-200"
                  title="Add Note / Statement"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                  <span>+ Note / Statement</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPageBreak}
                  className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg border-dashed hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/40 text-slate-800 dark:text-slate-200"
                  title="Add Page Break"
                >
                  <SeparatorHorizontal className="w-3.5 h-3.5 text-amber-500" />
                  <span>+ Page Break</span>
                </Button>
              </div>
            </div>
          </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: DOCKED COPILOT (Only rendered when standalone)              */}
        {/* ========================================================================= */}
        {!hideCopilotInside && showAssistant && isAssistantDocked && (
          <div className="w-[420px] xl:w-[460px] 2xl:w-[500px] shrink-0 h-full flex flex-col border-l border-slate-200 dark:border-slate-800 bg-background z-20 shadow-md">
            <GaugemasterTemplateAssistant
              open={showAssistant}
              onClose={() => setShowAssistant(false)}
              templateName={templateName || "Visual Canvas Template"}
              instrumentType="Calibration Instrument"
              calibrationType="dimensional"
              blocks={blocks}
              selectedTable={auditTargetTable || activeTableBlock}
              selectedColumnId={selectedColumnId}
              onUpdateTableColumns={handleApplyTableFixes}
              onUpdateTableBlock={handleUpdateTableBlock}
              onAddTableColumn={handleAddTableColumn}
              onUpdateTableRows={handleUpdateTableRows}
              onRestoreTableState={handleRestoreTableState}
              onOpenTrialRun={() => setShowTrialRun(true)}
              onOpenTableAuditModal={() => {
                if (activeTableBlock) handleOpenTableAudit(activeTableBlock);
              }}
              onOpenPreSaveModal={() => setShowPreSaveModal(true)}
              onNavigateToColumn={(columnId) => setSelectedColumnId(columnId)}
              onNavigateToTable={(tableId) => setSelectedBlockId(tableId)}
              onDeleteTableColumn={handleDeleteTableColumn}
              onAddTableBlock={handleAddTableBlock}
              onDeleteTableBlock={handleDeleteTableBlock}
              docked={true}
              onToggleDock={() => setIsAssistantDocked(false)}
            />
          </div>
        )}
      </div>

      {/* FLOATING COPILOT (WHEN UNDOCKED / FLOATING) */}
      {!hideCopilotInside && showAssistant && !isAssistantDocked && (
        <GaugemasterTemplateAssistant
          open={showAssistant}
          onClose={() => setShowAssistant(false)}
          templateName={templateName || "Visual Canvas Template"}
          instrumentType="Calibration Instrument"
          calibrationType="dimensional"
          blocks={blocks}
          selectedTable={auditTargetTable || activeTableBlock}
          selectedColumnId={selectedColumnId}
          onUpdateTableColumns={handleApplyTableFixes}
          onUpdateTableBlock={handleUpdateTableBlock}
          onAddTableColumn={handleAddTableColumn}
          onUpdateTableRows={handleUpdateTableRows}
          onRestoreTableState={handleRestoreTableState}
          onOpenTrialRun={() => setShowTrialRun(true)}
          onOpenTableAuditModal={() => {
            if (activeTableBlock) handleOpenTableAudit(activeTableBlock);
          }}
          onOpenPreSaveModal={() => setShowPreSaveModal(true)}
          onNavigateToColumn={(columnId) => setSelectedColumnId(columnId)}
          onNavigateToTable={(tableId) => setSelectedBlockId(tableId)}
          onDeleteTableColumn={handleDeleteTableColumn}
          onAddTableBlock={handleAddTableBlock}
          onDeleteTableBlock={handleDeleteTableBlock}
          docked={false}
          onToggleDock={() => setIsAssistantDocked(true)}
        />
      )}

      {/* FLOATING ACTION PILL TRIGGER WHEN COPILOT IS CLOSED */}
      {!hideCopilotInside && !showAssistant && (
        <div className="fixed bottom-6 right-6 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Button
            type="button"
            onClick={() => {
              setShowAssistant(true);
              setIsAssistantDocked(true);
            }}
            className="h-11 px-4 gap-2.5 rounded-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-primary hover:to-indigo-600 text-white font-bold text-xs shadow-xl shadow-primary/25 border-2 border-indigo-500/40 hover:border-primary transition-all duration-300 hover:scale-105 cursor-pointer group"
            title="Open Gaugemaster Template Copilot"
          >
            <div className="relative">
              <Bot className="w-5 h-5 text-indigo-400 group-hover:text-white transition-colors" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <span>Template Copilot</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </Button>
        </div>
      )}

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
        docNo={docNo}
        docDate={docDate}
        docRev={docRev}
        procedureReference={procedureReference}
        procedureNo={procedureNo}
        procedureName={procedureName}
        procedureDate={procedureDate}
        procedureRev={procedureRev}
        acceptanceCriteriaDocNo={acceptanceCriteriaDocNo}
        acceptanceCriteriaDate={acceptanceCriteriaDate}
        acceptanceCriteriaRev={acceptanceCriteriaRev}
        acceptanceCriteriaReference={acceptanceCriteriaReference}
      />

      {/* MODAL: AI Calibration Table Audit & Repair */}
      <TableAuditModal
        open={showTableAuditModal}
        onOpenChange={setShowTableAuditModal}
        table={auditTargetTable || activeTableBlock}
        onApplyFixes={handleApplyTableFixes}
      />

      {/* MODAL: Pre-Save Template Quality Gate */}
      <PreSaveAuditModal
        open={showPreSaveModal}
        onOpenChange={setShowPreSaveModal}
        blocks={blocks}
        onConfirmSave={() => {
          toast.success("Pre-save audit passed! Template ready for production calibration.");
        }}
      />
    </div>
  );
}
