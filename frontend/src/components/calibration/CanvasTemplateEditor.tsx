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
  MatrixCell,
} from "@/types/template";
import {
  normalizeMatrixCell,
  computeMatrix2DGrid,
  computeHeaderGroups,
  updateMatrixCell,
  addMatrixColumn,
  removeMatrixColumn,
  addMatrixRow,
  removeMatrixRow,
  addMatrixHeaderRow,
  removeMatrixHeaderRow,
  clearMatrixRows,
  clearMatrixCell,
  getMatrixTotalCols,
  mergeMatrixCellAcrossCols,
  mergeMatrixCellDownRows,
  normalizeMatrixTableGeometry,
  createVernierCaliper7ColPreset,
  createCaliper5ColPreset,
  createBlankMatrixPreset,
  createIS2092DialGaugePreset,
} from "@/lib/matrixTableUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  GripVertical,
  Merge,
  Combine,
  MoreHorizontal,
  Minus,
  ClipboardCopy,
  ClipboardPaste,
  ArrowRightLeft,
  Pencil,
  ArrowDown,
  Calculator,
  Hash,
  Wrench,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { CANVAS_PRESETS, CanvasTemplatePreset } from "@/data/canvasPresets";
import { AiTemplateGeneratorModal } from "@/components/calibration/template-management/AiTemplateGeneratorModal";
import { TrialRunModal } from "@/components/calibration/template-management/TrialRunModal";
import { TableAuditModal } from "@/components/calibration/template-management/TableAuditModal";
import { PreSaveAuditModal } from "@/components/calibration/template-management/PreSaveAuditModal";
import { AddColumnModal } from "@/components/calibration/template-management/AddColumnModal";
import { MergeTablesModal } from "@/components/calibration/template-management/MergeTablesModal";
import { PasteValuesModal } from "@/components/calibration/template-management/PasteValuesModal";
import { CellFormulaModal } from "@/components/calibration/template-management/CellFormulaModal";
import { ManageHeaderGroupModal } from "@/components/calibration/template-management/ManageHeaderGroupModal";
import { GaugemasterTemplateAssistant } from "@/components/calibration/template-management/GaugemasterTemplateAssistant";
import { GeneratedTemplateResult } from "@/lib/geminiService";
import { JudgementCellControl } from "@/components/calibration/JudgementCellControl";
import {
  evaluateCanvasRowFormulas,
  buildRowContext,
  testEvaluateFormula,
  evaluateFormulaExpression,
  evaluateAllCanvasBlocks,
  ensureTableKeys,
  slugifyTableKey,
  buildGlobalTablesContext,
  canvasHasCrossTableFormulas,
  getExcelColumnLetter,
  parseToleranceValue,
} from "@/lib/formulaEngine";
import { parseSpecification } from "@/lib/specificationParser";
import {
  getEffectiveTableOrientation,
  getTableOrientationRecommendation,
} from "@/lib/tableLayoutOptimizer";
import { ColumnFormulaInspector } from "@/components/calibration/template-management/ColumnFormulaInspector";
import {
  applyPastedValuesToRows,
  copyColumnValuesToClipboard,
  mirrorSiblingTableSpecs,
  mergeTablesSideBySide,
  unmergeSplitRow,
} from "@/lib/tableClipboardHelper";
import { getCoveredCells } from "@/lib/tableSpanUtils";

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
  onApplyGeneratedTemplate?: (template: GeneratedTemplateResult, mode?: "append" | "replace") => void;
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
  onOpenTableConfig?: (tableId: string) => void;
  readOnly?: boolean;
}

export const formatNominalDisplay = (
  nominal: number | string | undefined | null,
  decimalPlaces?: number,
): string => {
  if (nominal === undefined || nominal === null || nominal === "") return "";
  if (typeof nominal === "string") {
    const trimmed = nominal.trim();
    if (!trimmed) return "";
    // If it's already a formatted string with decimals (e.g. "10.00", "10.000"), preserve exactly
    if (!isNaN(Number(trimmed)) && trimmed.includes(".")) {
      return trimmed;
    }
    // If it's a numeric string without decimals (e.g. "10") and decimalPlaces is specified
    if (!isNaN(Number(trimmed)) && typeof decimalPlaces === "number" && decimalPlaces > 0) {
      return Number(trimmed).toFixed(decimalPlaces);
    }
    return trimmed;
  }
  if (typeof nominal === "number") {
    if (isNaN(nominal)) return "";
    if (typeof decimalPlaces === "number" && decimalPlaces >= 0) {
      return nominal.toFixed(decimalPlaces);
    }
    return String(nominal);
  }
  return String(nominal);
};

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
  onOpenTableConfig,
  readOnly = false,
}: CanvasTemplateEditorProps) {
  const [internalSelectedBlockId, setInternalSelectedBlockId] = useState<
    string | null
  >(() => blocks[0]?.id || null);
  const selectedBlockId =
    propSelectedBlockId !== undefined
      ? propSelectedBlockId
      : internalSelectedBlockId;
  const setSelectedBlockId = (id: string | null) => {
    setInternalSelectedBlockId(id);
    if (onSelectBlockId) onSelectBlockId(id);
  };

  const [internalSelectedColId, setInternalSelectedColId] = useState<
    string | null
  >(null);
  const selectedColumnId =
    propSelectedColId !== undefined ? propSelectedColId : internalSelectedColId;
  const setSelectedColumnId = (id: string | null) => {
    setInternalSelectedColId(id);
    if (onSelectColumnId) onSelectColumnId(id);
  };

  const [selectedChildTableId, setSelectedChildTableId] = useState<
    string | null
  >(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showTrialRun, setShowTrialRun] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showTableAuditModal, setShowTableAuditModal] = useState(false);
  const [auditTargetTable, setAuditTargetTable] =
    useState<TableGridBlock | null>(null);
  const [showAssistant, setShowAssistant] = useState(true);
  const [showPreSaveModal, setShowPreSaveModal] = useState(false);
  const [isBannerCollapsed, setIsBannerCollapsed] = useState(true);
  const [isToolboxCollapsed, setIsToolboxCollapsed] = useState(false);
  const [isAssistantDocked, setIsAssistantDocked] = useState(true);
  const [showExcelCoordinates, setShowExcelCoordinates] = useState(true);

  // Add Column Modal State
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [addColumnTargetTable, setAddColumnTargetTable] = useState<TableGridBlock | null>(null);

  // Merge Tables Modal State
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceTable, setMergeSourceTable] = useState<TableGridBlock | null>(null);

  // Paste Column Values Modal State
  const [showPasteValuesModal, setShowPasteValuesModal] = useState(false);
  const [pasteTargetTable, setPasteTargetTable] = useState<{
    blockIdx: number;
    childIdx: number | null;
    table: TableGridBlock;
    colId?: string;
  } | null>(null);

  // Cell-Level Formula Editor State
  const [cellFormulaModalState, setCellFormulaModalState] = useState<{
    blockIndex: number;
    childIndex: number | null;
    rowIndex: number;
    colId: string;
    colLabel: string;
    initialFormula: string;
  } | null>(null);

  // Floating Cell Context Menu State for Merging / Unmerging
  const [cellContextMenu, setCellContextMenu] = useState<{
    x: number;
    y: number;
    blockIndex: number;
    childIndex: number | null;
    rowIndex: number;
    colId: string;
    colLabel: string;
    colIdx: number;
    totalCols: number;
    currentSpan: number; // colSpan
    maxRemaining: number; // maxRemainingCols
    totalRows: number;
    currentRowSpan: number; // rowSpan
    maxRemainingRows: number;
  } | null>(null);

  // Floating Context Menu State for Matrix Table Cells
  const [matrixCellContextMenu, setMatrixCellContextMenu] = useState<{
    x: number;
    y: number;
    blockIndex: number;
    isHeader: boolean;
    rowIndex: number;
    colIndex: number; // 2D grid column
    cellArrayIdx: number; // array index within the row
    currentCell: MatrixCell;
    totalCols: number;
    totalRows: number;
  } | null>(null);

  // Floating Context Menu State for Header Grouping in Data Tables
  const [headerGroupContextMenu, setHeaderGroupContextMenu] = useState<{
    x: number;
    y: number;
    blockIndex: number;
    childIndex: number | null;
    colId: string;
    colLabel: string;
    colIdx: number;
    totalCols: number;
    currentGroupName?: string;
    isGroupHeader?: boolean;
    groupSpan?: number;
  } | null>(null);

  // Modal State for Multi-Column Header Group Management
  const [manageHeaderGroupModalState, setManageHeaderGroupModalState] = useState<{
    blockIndex: number;
    childIndex: number | null;
    initialGroupName: string;
    columns: CanvasColumnDef[];
  } | null>(null);

  const handleOpenCellMenu = (
    e: React.MouseEvent,
    blockIndex: number,
    childIndex: number | null,
    rowIndex: number,
    colId: string,
    colLabel: string,
    colIdx: number,
    totalCols: number,
    currentSpan: number = 1,
    currentRowSpan: number = 1,
    totalRows?: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Defensively resolve totalRows from blocks if omitted or invalid (<= 1)
    let resolvedTotalRows = totalRows;
    if (!resolvedTotalRows || resolvedTotalRows <= 1) {
      const targetBlock = blocks[blockIndex];
      if (targetBlock) {
        if (childIndex !== null && "children" in targetBlock) {
          const childTable = (targetBlock as SplitRowBlock).children?.[childIndex] as any;
          if (childTable?.rows?.length) resolvedTotalRows = childTable.rows.length;
        } else if ("rows" in targetBlock) {
          if ((targetBlock as TableGridBlock).rows?.length) {
            resolvedTotalRows = (targetBlock as TableGridBlock).rows.length;
          }
        }
      }
    }
    const finalTotalRows = Math.max(1, resolvedTotalRows || 1);
    const maxRemaining = Math.max(1, totalCols - colIdx);
    const maxRemainingRows = Math.max(1, finalTotalRows - rowIndex);
    
    let menuX = e.clientX;
    let menuY = e.clientY;
    
    const estimatedWidth = 260;
    const estimatedHeight = 360;
    if (menuX + estimatedWidth > window.innerWidth) {
      menuX = window.innerWidth - estimatedWidth - 16;
    }
    if (menuY + estimatedHeight > window.innerHeight) {
      menuY = window.innerHeight - estimatedHeight - 16;
    }
    
    setCellContextMenu({
      x: Math.max(12, menuX),
      y: Math.max(12, menuY),
      blockIndex,
      childIndex,
      rowIndex,
      colId,
      colLabel,
      colIdx,
      totalCols,
      currentSpan,
      maxRemaining,
      totalRows: finalTotalRows,
      currentRowSpan,
      maxRemainingRows,
    });
  };

  const handleOpenMatrixCellMenu = (
    e: React.MouseEvent,
    blockIndex: number,
    isHeader: boolean,
    rowIndex: number,
    colIndex: number,
    cellArrayIdx: number,
    cell: MatrixCell,
    totalCols: number,
    totalRows: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    let menuX = e.clientX;
    let menuY = e.clientY;
    const estimatedWidth = 240;
    const estimatedHeight = 460;
    if (menuX + estimatedWidth > window.innerWidth) {
      menuX = window.innerWidth - estimatedWidth - 16;
    }
    if (menuY + estimatedHeight > window.innerHeight) {
      menuY = window.innerHeight - estimatedHeight - 16;
    }

    setMatrixCellContextMenu({
      x: Math.max(12, menuX),
      y: Math.max(12, menuY),
      blockIndex,
      isHeader,
      rowIndex,
      colIndex,
      cellArrayIdx,
      currentCell: cell,
      totalCols,
      totalRows,
    });
  };

  const handleOpenHeaderGroupMenu = (
    e: React.MouseEvent,
    blockIndex: number,
    childIndex: number | null,
    colId: string,
    colLabel: string,
    colIdx: number,
    totalCols: number,
    currentGroupName?: string,
    isGroupHeader: boolean = false,
    groupSpan?: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    let menuX = e.clientX;
    let menuY = e.clientY;
    const estimatedWidth = 270;
    const estimatedHeight = 340;
    if (menuX + estimatedWidth > window.innerWidth) {
      menuX = window.innerWidth - estimatedWidth - 16;
    }
    if (menuY + estimatedHeight > window.innerHeight) {
      menuY = window.innerHeight - estimatedHeight - 16;
    }

    setHeaderGroupContextMenu({
      x: Math.max(12, menuX),
      y: Math.max(12, menuY),
      blockIndex,
      childIndex,
      colId,
      colLabel,
      colIdx,
      totalCols,
      currentGroupName,
      isGroupHeader,
      groupSpan,
    });
  };

  useEffect(() => {
    if (!cellContextMenu && !matrixCellContextMenu && !headerGroupContextMenu) return;
    const handleClose = () => {
      setCellContextMenu(null);
      setMatrixCellContextMenu(null);
      setHeaderGroupContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCellContextMenu(null);
        setMatrixCellContextMenu(null);
        setHeaderGroupContextMenu(null);
      }
    };
    window.addEventListener("click", handleClose);
    window.addEventListener("contextmenu", handleClose);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("contextmenu", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cellContextMenu, matrixCellContextMenu, headerGroupContextMenu]);

  // Column Drag-and-Drop Reordering State
  const [draggedCol, setDraggedCol] = useState<{
    blockIdx: number;
    childIdx: number | null;
    colIdx: number;
  } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<{
    blockIdx: number;
    childIdx: number | null;
    colIdx: number;
  } | null>(null);

  const handleOpenAddColumnModal = (table: TableGridBlock) => {
    setAddColumnTargetTable(table);
    setShowAddColumnModal(true);
  };

  // Find currently selected block
  const selectedBlockIndex = blocks.findIndex((b) => b.id === selectedBlockId);
  const selectedBlock =
    selectedBlockIndex !== -1 ? blocks[selectedBlockIndex] : null;

  // Selected Table inside Split Row or Root Table
  let activeTableBlock: TableGridBlock | null = null;
  if (selectedBlock?.type === "table_grid") {
    activeTableBlock = selectedBlock as TableGridBlock;
  } else if (selectedBlock?.type === "split_row") {
    const split = selectedBlock as SplitRowBlock;
    activeTableBlock =
      (split.children.find(
        (c) => c.id === selectedChildTableId && c.type === "table_grid",
      ) as TableGridBlock) ||
      (split.children.find((c) => c.type === "table_grid") as TableGridBlock) ||
      null;
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
    if (readOnly) return;
    ensureTableKeys(newBlocks);
    onChange(newBlocks);
  };

  // Auto-assign persistent tableKeys to legacy templates without them
  useEffect(() => {
    if (!readOnly && Array.isArray(blocks) && blocks.length > 0) {
      let needsKeys = false;
      blocks.forEach((b) => {
        if (b.type === "table_grid" && !(b as TableGridBlock).tableKey) needsKeys = true;
        if (b.type === "split_row" && Array.isArray((b as SplitRowBlock).children)) {
          (b as SplitRowBlock).children.forEach((c) => {
            if (c && c.type === "table_grid" && !c.tableKey) needsKeys = true;
          });
        }
      });
      if (needsKeys) {
        const cloned = JSON.parse(JSON.stringify(blocks));
        ensureTableKeys(cloned);
        markChanged(cloned);
      }
    }
  }, [blocks, readOnly]);

  const handleApplyCellFormula = (
    blockIndex: number,
    childIndex: number | null,
    rowIndex: number,
    colId: string,
    formula: string,
  ) => {
    const updated = JSON.parse(JSON.stringify(blocks));
    let targetTbl: TableGridBlock;
    if (childIndex !== null) {
      targetTbl = updated[blockIndex]?.children?.[childIndex];
    } else {
      targetTbl = updated[blockIndex];
    }
    if (!targetTbl || !targetTbl.rows || !targetTbl.rows[rowIndex]) return;

    const row = targetTbl.rows[rowIndex];
    if (!row.cellFormulas) row.cellFormulas = {};
    row.cellFormulas[colId] = formula;

    const evaluatedBlocks = evaluateAllCanvasBlocks(updated, { forceFull: true });
    markChanged(evaluatedBlocks);
  };

  const handleClearCellFormula = (
    blockIndex: number,
    childIndex: number | null,
    rowIndex: number,
    colId: string,
  ) => {
    const updated = JSON.parse(JSON.stringify(blocks));
    let targetTbl: TableGridBlock;
    if (childIndex !== null) {
      targetTbl = updated[blockIndex]?.children?.[childIndex];
    } else {
      targetTbl = updated[blockIndex];
    }
    if (!targetTbl || !targetTbl.rows || !targetTbl.rows[rowIndex]) return;

    const row = targetTbl.rows[rowIndex];
    if (row.cellFormulas) {
      delete row.cellFormulas[colId];
      if (Object.keys(row.cellFormulas).length === 0) {
        delete row.cellFormulas;
      }
    }

    const evaluatedBlocks = evaluateAllCanvasBlocks(updated, { forceFull: true });
    markChanged(evaluatedBlocks);
  };

  const handleUpdateTableKey = (
    blockIndex: number,
    childIndex: number | null,
    newKey: string,
  ) => {
    const cleanKey = slugifyTableKey(newKey);
    if (!cleanKey) {
      toast.error("Please enter a valid table key");
      return;
    }
    const updated = JSON.parse(JSON.stringify(blocks));
    let targetTbl: TableGridBlock;
    if (childIndex !== null) {
      targetTbl = updated[blockIndex]?.children?.[childIndex];
    } else {
      targetTbl = updated[blockIndex];
    }
    if (!targetTbl) return;
    targetTbl.tableKey = cleanKey;
    ensureTableKeys(updated);
    const evaluatedBlocks = evaluateAllCanvasBlocks(updated, { forceFull: true });
    markChanged(evaluatedBlocks);
    toast.success(`Table key set to #${cleanKey}`);
  };

  const handleOpenTableAudit = (table: TableGridBlock) => {
    setAuditTargetTable(table);
    setShowTableAuditModal(true);
  };

  const handleApplyTableFixes = (
    tableId: string,
    updatedColumns: CanvasColumnDef[],
  ) => {
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
    },
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
              ...(previousState.columns
                ? { columns: previousState.columns }
                : {}),
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

  const handleUpdateTableBlock = (
    tableId: string,
    updatedFields: Partial<TableGridBlock>,
  ) => {
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

  const handleAddTableColumn = (
    tableId: string,
    newColumn: CanvasColumnDef,
  ) => {
    const newBlocks = blocks.map((b) => {
      if (b.type === "table_grid" && b.id === tableId) {
        const updatedCols = [...b.columns, newColumn];
        const isStatusCol =
          newColumn.type === "status" ||
          newColumn.role === "JUDGEMENT" ||
          /judg|status|verdict/i.test(newColumn.id) ||
          /judg|status|verdict/i.test(newColumn.label || "");
        const updatedRows = (b.rows || []).map((row) => {
          const baseRow = isStatusCol
            ? { ...row, [newColumn.id]: row[newColumn.id] || row.judgement || row.status || "OK" }
            : row;
          return evaluateCanvasRowFormulas(
            baseRow,
            updatedCols,
            b.tolerance ?? defaultTolerance,
            b.decimal_places ?? decimalPlaces,
            b.nominal,
          );
        });
        return { ...b, columns: updatedCols, rows: updatedRows };
      }
      if (b.type === "split_row" && b.children) {
        const newChildren = b.children.map((c) => {
          if (c.type === "table_grid" && c.id === tableId) {
            const updatedCols = [...c.columns, newColumn];
            const isStatusCol =
              newColumn.type === "status" ||
              newColumn.role === "JUDGEMENT" ||
              /judg|status|verdict/i.test(newColumn.id) ||
              /judg|status|verdict/i.test(newColumn.label || "");
            const updatedRows = (c.rows || []).map((row) => {
              const baseRow = isStatusCol
                ? { ...row, [newColumn.id]: row[newColumn.id] || row.judgement || row.status || "OK" }
                : row;
              return evaluateCanvasRowFormulas(
                baseRow,
                updatedCols,
                c.tolerance ?? defaultTolerance,
                c.decimal_places ?? decimalPlaces,
                c.nominal,
              );
            });
            return { ...c, columns: updatedCols, rows: updatedRows };
          }
          return c;
        });
        return { ...b, children: newChildren as any };
      }
      return b;
    });
    markChanged(newBlocks);
    if (onSelectColumnId) {
      onSelectColumnId(newColumn.id);
    }
  };

  const handleUpdateTableNominal = (
    blockIndex: number,
    childIndex: number | null,
    newNominalStr: string,
  ) => {
    const rawVal = newNominalStr.trim();
    let parsedNom: string | undefined = undefined;
    if (rawVal !== "") {
      const cleanNumMatch = rawVal.match(/^[+-]?\d+(?:\.\d+)?/);
      if (cleanNumMatch) {
        parsedNom = cleanNumMatch[0];
      } else {
        parsedNom = rawVal;
      }
    }

    const block = blocks[blockIndex];
    if (!block) return;

    if (childIndex === null) {
      if (block.type !== "table_grid") return;
      const tol = block.tolerance ?? defaultTolerance ?? 0.02;
      const dec = block.decimal_places ?? decimalPlaces ?? 3;
      const reEvaluatedRows = (block.rows || []).map((row) =>
        evaluateCanvasRowFormulas(row, block.columns, tol, dec, parsedNom)
      );
      const updatedBlock = {
        ...block,
        nominal: parsedNom,
        rows: reEvaluatedRows,
      };
      const newBlocks = [...blocks];
      newBlocks[blockIndex] = updatedBlock;
      markChanged(newBlocks);
      toast.success(`Updated Table Nominal to ${rawVal || "Not Set"}`);
    } else {
      if (block.type !== "split_row" || !block.children) return;
      const child = block.children[childIndex];
      if (!child || child.type !== "table_grid") return;
      const tol = child.tolerance ?? defaultTolerance ?? 0.02;
      const dec = child.decimal_places ?? decimalPlaces ?? 3;
      const reEvaluatedRows = (child.rows || []).map((row) =>
        evaluateCanvasRowFormulas(row, child.columns, tol, dec, parsedNom)
      );
      const newChildren = [...block.children];
      newChildren[childIndex] = {
        ...child,
        nominal: parsedNom,
        rows: reEvaluatedRows,
      };
      const newBlocks = [...blocks];
      newBlocks[blockIndex] = { ...block, children: newChildren as any };
      markChanged(newBlocks);
      toast.success(`Updated Section Nominal to ${rawVal || "Not Set"}`);
    }
  };

  const handleUpdateTableTolerance = (
    blockIndex: number,
    childIndex: number | null,
    newTolVal: number | string,
  ) => {
    const rawVal = String(newTolVal ?? "").trim().replace(/^[±+-]/, "").trim();
    const parsedTol = parseFloat(rawVal);
    if (isNaN(parsedTol)) return;

    const block = blocks[blockIndex];
    if (!block) return;

    if (childIndex === null) {
      if (block.type !== "table_grid") return;
      const dec = block.decimal_places ?? decimalPlaces ?? 3;
      const hasTolCol = block.columns?.some((c) => c && (c.type === "tolerance" || c.id === "tolerance"));
      const reEvaluatedRows = (block.rows || []).map((row, rIdx) => {
        const updatedRow = {
          ...row,
          ...(!hasTolCol ? { tolerance: parsedTol } : {}),
        };
        return evaluateCanvasRowFormulas(updatedRow, block.columns, parsedTol, dec, (block as TableGridBlock).nominal, undefined, block.rows, rIdx);
      });
      const updatedBlock = {
        ...block,
        tolerance: parsedTol,
        rows: reEvaluatedRows,
      };
      const newBlocks = [...blocks];
      newBlocks[blockIndex] = updatedBlock;
      markChanged(newBlocks);
      toast.success(`Updated Table Tolerance to ±${parsedTol}`);
    } else {
      if (block.type !== "split_row" || !block.children) return;
      const child = block.children[childIndex];
      if (!child || child.type !== "table_grid") return;
      const dec = child.decimal_places ?? decimalPlaces ?? 3;
      const hasTolCol = child.columns?.some((c) => c && (c.type === "tolerance" || c.id === "tolerance"));
      const reEvaluatedRows = (child.rows || []).map((row, rIdx) => {
        const updatedRow = {
          ...row,
          ...(!hasTolCol ? { tolerance: parsedTol } : {}),
        };
        return evaluateCanvasRowFormulas(updatedRow, child.columns, parsedTol, dec, (child as TableGridBlock).nominal, undefined, child.rows, rIdx);
      });
      const newChildren = [...block.children];
      newChildren[childIndex] = {
        ...child,
        tolerance: parsedTol,
        rows: reEvaluatedRows,
      };
      const newBlocks = [...blocks];
      newBlocks[blockIndex] = { ...block, children: newChildren as any };
      markChanged(newBlocks);
      toast.success(`Updated Section Tolerance to ±${parsedTol}`);
    }
  };

  const handleDeleteTableColumn = (tableId: string, columnId: string) => {
    const newBlocks = blocks.map((b) => {
      if (b.type === "table_grid" && b.id === tableId) {
        return { ...b, columns: b.columns.filter((c) => c.id !== columnId) };
      }
      if (b.type === "split_row" && b.children) {
        const newChildren = b.children.map((c) => {
          if (c.type === "table_grid" && c.id === tableId) {
            return {
              ...c,
              columns: c.columns.filter((col) => col.id !== columnId),
            };
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
        {
          id: "reading",
          label: "Actual Reading",
          type: "reading",
          width: "25%",
        },
        {
          id: "deviation",
          label: "Deviation",
          type: "formula",
          formula: "reading - nominal",
          width: "25%",
        },
        {
          id: "status",
          label: "Judgement",
          type: "status",
          formula: "IF(ABS(deviation)<=tolerance,'PASS','FAIL')",
          width: "20%",
        },
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

  const handleUpdateTableRows = (
    tableId: string,
    updatedRows: CanvasRowData[],
  ) => {
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
        {
          id: "reading",
          label: "Actual Reading",
          type: "reading",
          width: "25%",
        },
        {
          id: "error",
          label: "Error",
          type: "formula",
          formula: "reading - nominal",
          width: "25%",
        },
        {
          id: "status",
          label: "Judgement",
          type: "status",
          formula: "IF(ABS(error)<=tolerance,'PASS','FAIL')",
          width: "20%",
        },
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
            {
              id: "error",
              label: "Error",
              type: "formula",
              formula: "reading - nominal",
              width: "35%",
            },
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
            {
              point_number: 1,
              description: "Sample Face A",
              unit: defaultUnit,
            },
            {
              point_number: 2,
              description: "Sample Face B",
              unit: defaultUnit,
            },
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
    const preset = createVernierCaliper7ColPreset();
    const newBlock: MatrixTableBlock = {
      id: `matrix_${Date.now()}`,
      type: "matrix_table",
      title: preset.title || "Acceptance Criteria Reference Matrix",
      width: "100%",
      headers: (preset.headers as any) || [],
      rows: (preset.rows as any) || [],
      footerNote: preset.footerNote,
    };
    markChanged([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    setSelectedChildTableId(null);
    toast.success("Added Acceptance Criteria Matrix table (7-Col Caliper Standard)");
  };

  const addTextBlock = () => {
    const newBlock: TextBlock = {
      id: `text_${Date.now()}`,
      type: "text_block",
      content:
        "All measuring faces and jaws are verified free from dents, corrosion, and physical damage.",
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
  const [canvasWidthMode, setCanvasWidthMode] = useState<
    "fit" | "wide" | "standard"
  >("fit");

  // Interactive column resizer state for header drag-to-resize (both vertical and horizontal tables)
  const [resizingCol, setResizingCol] = useState<{
    blockIndex: number;
    childIndex?: number | null;
    targetType: "vertical_col" | "horizontal_first_col" | "horizontal_data_col";
    columnId?: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Draggable Inspector & Properties panel width (340px - 800px)
  const [inspectorWidth, setInspectorWidth] = useState<number>(460);
  const [isResizingInspector, setIsResizingInspector] = useState(false);
  const inspectorResizeRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    if (!isResizingInspector) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!inspectorResizeRef.current) return;
      const delta = inspectorResizeRef.current.startX - e.clientX;
      const newWidth = Math.max(
        340,
        Math.min(
          800,
          Math.round(inspectorResizeRef.current.startWidth + delta),
        ),
      );
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

  // Global mouse listeners for real-time column width dragging (vertical & horizontal)
  useEffect(() => {
    if (!resizingCol) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingCol.startX;
      const targetType = resizingCol.targetType || "vertical_col";
      const block = blocks[resizingCol.blockIndex];
      if (!block) return;

      if (targetType === "horizontal_first_col") {
        const newWidth = Math.max(
          60,
          Math.min(450, Math.round(resizingCol.startWidth + deltaX)),
        );
        if (
          resizingCol.childIndex !== null &&
          resizingCol.childIndex !== undefined &&
          block.type === "split_row" &&
          Array.isArray(block.children)
        ) {
          const newChildren = block.children.map((child: any, cIdx: number) => {
            if (cIdx === resizingCol.childIndex && child?.type === "table_grid") {
              const updatedCols = (child.columns || []).map((c: any, i: number) =>
                i === 0 ? { ...c, width: `${newWidth}px` } : c,
              );
              return {
                ...child,
                firstColWidth: newWidth,
                parameterWidth: newWidth,
                columns: updatedCols,
              };
            }
            return child;
          });
          updateBlock(resizingCol.blockIndex, {
            ...block,
            children: newChildren as any,
          });
        } else if (block.type === "table_grid") {
          const updatedCols = (block.columns || []).map((c, i) =>
            i === 0 ? { ...c, width: `${newWidth}px` } : c,
          );
          updateBlock(resizingCol.blockIndex, {
            ...block,
            firstColWidth: newWidth,
            parameterWidth: newWidth,
            columns: updatedCols,
          });
        }
      } else if (targetType === "horizontal_data_col") {
        const newWidth = Math.max(
          35,
          Math.min(250, Math.round(resizingCol.startWidth + deltaX)),
        );
        if (
          resizingCol.childIndex !== null &&
          resizingCol.childIndex !== undefined &&
          block.type === "split_row" &&
          Array.isArray(block.children)
        ) {
          const newChildren = block.children.map((child: any, cIdx: number) => {
            if (cIdx === resizingCol.childIndex && child?.type === "table_grid") {
              return {
                ...child,
                dataColWidth: newWidth,
              };
            }
            return child;
          });
          updateBlock(resizingCol.blockIndex, {
            ...block,
            children: newChildren as any,
          });
        } else if (block.type === "table_grid") {
          updateBlock(resizingCol.blockIndex, {
            ...block,
            dataColWidth: newWidth,
          });
        }
      } else {
        // Vertical column width resize
        const newWidth = Math.max(
          20,
          Math.min(500, Math.round(resizingCol.startWidth + deltaX)),
        );
        if (
          resizingCol.childIndex !== null &&
          resizingCol.childIndex !== undefined &&
          block.type === "split_row" &&
          Array.isArray(block.children)
        ) {
          const newChildren = block.children.map((child: any, cIdx: number) => {
            if (cIdx === resizingCol.childIndex && child?.type === "table_grid") {
              const updatedCols = (child.columns || []).map((c: any) =>
                c.id === resizingCol.columnId ? { ...c, width: `${newWidth}px` } : c,
              );
              return { ...child, columns: updatedCols };
            }
            return child;
          });
          updateBlock(resizingCol.blockIndex, {
            ...block,
            children: newChildren as any,
          });
        } else if (block.type === "table_grid") {
          const updatedCols = (block.columns || []).map((c) =>
            c.id === resizingCol.columnId ? { ...c, width: `${newWidth}px` } : c,
          );
          updateBlock(resizingCol.blockIndex, { ...block, columns: updatedCols });
        }
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
    columnIdOrTarget: string,
    currentWidth?: string | number,
    childIndex: number | null = null,
    explicitTargetType?: "vertical_col" | "horizontal_first_col" | "horizontal_data_col",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).closest("th");
    const targetType: "vertical_col" | "horizontal_first_col" | "horizontal_data_col" =
      explicitTargetType ||
      (columnIdOrTarget === "horizontal_first_col"
        ? "horizontal_first_col"
        : columnIdOrTarget === "horizontal_data_col"
          ? "horizontal_data_col"
          : "vertical_col");

    const defaultFallback =
      targetType === "horizontal_data_col"
        ? 65
        : targetType === "horizontal_first_col"
          ? 140
          : 100;

    const initialWidth = th
      ? th.getBoundingClientRect().width
      : typeof currentWidth === "number"
        ? currentWidth
        : parseInt(String(currentWidth || defaultFallback)) || defaultFallback;

    setResizingCol({
      blockIndex,
      childIndex,
      targetType,
      columnId: columnIdOrTarget,
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
      if (
        id === "point_number" ||
        id === "sl_no" ||
        id === "sino" ||
        label.includes("sl.no") ||
        label.includes("sl no") ||
        label.includes("si no")
      ) {
        suggestedWidth = "65px";
      } else if (
        label.includes("spec") ||
        label.includes("condition") ||
        label.includes("parameter") ||
        label.includes("desc")
      ) {
        suggestedWidth = "180px";
      } else if (label.includes("nominal") || id === "nominal") {
        suggestedWidth = "110px";
      } else if (
        label.includes("limit") ||
        label.includes("tolerance") ||
        label.includes("tol")
      ) {
        suggestedWidth = "110px";
      } else if (
        label.includes("actual") ||
        label.includes("reading") ||
        label.includes("trial") ||
        label.includes("bore") ||
        label.includes("gauge")
      ) {
        suggestedWidth = "105px";
      } else if (
        label.includes("deviation") ||
        label.includes("average") ||
        label.includes("error")
      ) {
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
      const updatedChildren = split.children.map((c) =>
        c.id === updatedTbl.id ? updatedTbl : c,
      );
      updateBlock(selectedBlockIndex, { ...split, children: updatedChildren });
    }
  };

  // Recalculates row formulas live when user edits any cell in builder table
  const handleTableCellChange = (
    blockIndex: number,
    rowIndex: number,
    colId: string,
    val: any,
  ) => {
    const block = blocks[blockIndex] as TableGridBlock;
    if (!block || !block.rows) return;
    const newRows = [...block.rows];
    const currentRow = newRows[rowIndex] || {};
    const targetCol = block.columns?.find(
      (c) => c && (c.id === colId || c.key === colId),
    );
    const isReadingCol =
      colId === "reading" ||
      targetCol?.type === "reading" ||
      targetCol?.role === "READING" ||
      colId === "observed_value" ||
      /^(actual|observed|reading)/i.test(colId);

    const isNominalCol =
      colId === "nominal" ||
      targetCol?.type === "nominal" ||
      targetCol?.role === "NOMINAL" ||
      targetCol?.role === "SPECIFICATION" ||
      colId === "interval";

    const isTolCol =
      colId === "tolerance" ||
      targetCol?.type === "tolerance" ||
      targetCol?.role === "TOLERANCE" ||
      colId === "tol";

    const isBlank = val === "" || val === null || val === undefined;
    const parsedNum = parseFloat(String(val));
    const numVal = !isNaN(parsedNum) ? parsedNum : undefined;

    const updatedRow: CanvasRowData = {
      ...currentRow,
      [colId]: val,
      ...(isReadingCol ? (isBlank ? { reading: undefined } : { reading: numVal }) : {}),
      ...(isNominalCol ? { nominal: val } : {}),
      ...(isTolCol ? { tolerance: parseToleranceValue(val) ?? numVal } : {}),
      ...(/judg|status|verdict/i.test(colId) ? { status: val, judgement: val } : {}),
    };
    if (isReadingCol && isBlank) {
      delete updatedRow.reading;
      delete updatedRow.actual;
      delete updatedRow.actual_dimension;
      delete updatedRow.observed_value;
      updatedRow[colId] = "";
    }

    // Synchronize trial aliases across row for live formula evaluation
    const trialMatch = colId.match(
      /^(?:t|trial_|trial|reading_|reading|actual_|actual|observed_|observed|r|col_)?([1-9]|1[0-9]|20)$/i,
    );
    if (trialMatch) {
      const idx = trialMatch[1];
      const aliases = [
        `t${idx}`,
        `trial_${idx}`,
        `trial${idx}`,
        `reading_${idx}`,
        `reading${idx}`,
        `actual_${idx}`,
        `actual${idx}`,
        `observed_${idx}`,
        `observed${idx}`,
        `r${idx}`,
        `col_${idx}`,
        idx,
      ];
      aliases.forEach((a) => {
        updatedRow[a] = val;
      });
    }

    const parsedRowTol = parseToleranceValue(updatedRow.tolerance);
    const tol =
      parsedRowTol !== undefined
        ? parsedRowTol
        : parseFloat(String(block.tolerance ?? 0.02)) || 0.02;
    const dec = block.decimal_places ?? decimalPlaces ?? 3;

    // If editing a specification / required_dimension / nominal, dynamically parse nominal & tolerance limits
    if (
      colId === "required_dimension" ||
      colId === "specification" ||
      colId === "description" ||
      colId === "nominal" ||
      /spec|dimension/i.test(colId)
    ) {
      const specText = String(val ?? "").trim();
      const parsed = parseSpecification(specText, block.unit || "mm", tol, dec);
      if (parsed.isValid) {
        updatedRow.nominal = parsed.nominal;
        updatedRow.lower_tolerance = parsed.lowerTolerance;
        updatedRow.upper_tolerance = parsed.upperTolerance;
        updatedRow.lowerTolerance = parsed.lowerTolerance;
        updatedRow.upperTolerance = parsed.upperTolerance;
        updatedRow.lower_limit = parsed.lowerLimit;
        updatedRow.upper_limit = parsed.upperLimit;
        updatedRow.lowerLimit = parsed.lowerLimit;
        updatedRow.upperLimit = parsed.upperLimit;
        if (parsed.isMaxLimit) {
          updatedRow.isMaxLimit = true;
          updatedRow.tolerance = parsed.upperTolerance;
        } else if (parsed.isMinLimit) {
          updatedRow.isMinLimit = true;
          updatedRow.tolerance = parsed.nominal;
        }
      }
    }

    const hasCrossTable = canvasHasCrossTableFormulas(blocks);
    const globalContext = hasCrossTable ? buildGlobalTablesContext(blocks) : undefined;
    const evaluatedRow = evaluateCanvasRowFormulas(
      updatedRow,
      block.columns,
      tol,
      dec,
      block.nominal,
      globalContext,
    );

    // CRITICAL: Ensure the active cell keeps the exact string the user is typing (e.g. "35.", "0.", "-")
    evaluatedRow[colId] = val;
    if (trialMatch) {
      const idx = trialMatch[1];
      const aliases = [
        `t${idx}`,
        `trial_${idx}`,
        `trial${idx}`,
        `reading_${idx}`,
        `reading${idx}`,
        `actual_${idx}`,
        `actual${idx}`,
        `observed_${idx}`,
        `observed${idx}`,
        `r${idx}`,
        `col_${idx}`,
        idx,
      ];
      aliases.forEach((a) => {
        evaluatedRow[a] = val;
      });
    }

    newRows[rowIndex] = evaluatedRow;
    const updatedBlocks = [...blocks];
    updatedBlocks[blockIndex] = { ...block, rows: newRows };

    // FAST-PATH: If there are no cross-table formulas anywhere on the canvas,
    // avoid calling evaluateAllCanvasBlocks completely! (0ms lag, smooth 60fps typing)
    if (!hasCrossTable) {
      markChanged(updatedBlocks);
      return;
    }

    // TARGETED RE-EVALUATION: Only evaluate dependent tables/rows
    const fullyEvaluated = evaluateAllCanvasBlocks(updatedBlocks, {
      changedBlockIndex: blockIndex,
      changedRowIndex: rowIndex,
    });
    const targetBlock = fullyEvaluated[blockIndex] as TableGridBlock;
    if (targetBlock && targetBlock.rows && targetBlock.rows[rowIndex]) {
      targetBlock.rows[rowIndex][colId] = val;
      if (trialMatch) {
        const idx = trialMatch[1];
        const aliases = [
          `t${idx}`,
          `trial_${idx}`,
          `trial${idx}`,
          `reading_${idx}`,
          `reading${idx}`,
          `actual_${idx}`,
          `actual${idx}`,
          `observed_${idx}`,
          `observed${idx}`,
          `r${idx}`,
          `col_${idx}`,
          idx,
        ];
        aliases.forEach((a) => {
          targetBlock.rows[rowIndex][a] = val;
        });
      }
    }
    markChanged(fullyEvaluated);
  };

  const handleChildTableCellChange = (
    blockIndex: number,
    childIndex: number,
    rowIndex: number,
    colId: string,
    val: any,
  ) => {
    const split = blocks[blockIndex] as SplitRowBlock;
    if (!split || !split.children) return;
    const child = split.children[childIndex] as TableGridBlock;
    if (!child || !child.rows) return;
    const newRows = [...child.rows];
    const currentRow = newRows[rowIndex] || {};
    const targetCol = child.columns?.find(
      (c) => c && (c.id === colId || c.key === colId),
    );
    const isReadingCol =
      colId === "reading" ||
      targetCol?.type === "reading" ||
      targetCol?.role === "READING" ||
      colId === "observed_value" ||
      /^(actual|observed|reading)/i.test(colId);

    const isNominalCol =
      colId === "nominal" ||
      targetCol?.type === "nominal" ||
      targetCol?.role === "NOMINAL" ||
      targetCol?.role === "SPECIFICATION" ||
      colId === "interval";

    const isTolCol =
      colId === "tolerance" ||
      targetCol?.type === "tolerance" ||
      targetCol?.role === "TOLERANCE" ||
      colId === "tol";

    const isBlank = val === "" || val === null || val === undefined;
    const parsedNum = parseFloat(String(val));
    const numVal = !isNaN(parsedNum) ? parsedNum : undefined;

    const updatedRow: CanvasRowData = {
      ...currentRow,
      [colId]: val,
      ...(isReadingCol ? (isBlank ? { reading: undefined } : { reading: numVal }) : {}),
      ...(isNominalCol ? { nominal: val } : {}),
      ...(isTolCol ? { tolerance: parseToleranceValue(val) ?? numVal } : {}),
      ...(/judg|status|verdict/i.test(colId) ? { status: val, judgement: val } : {}),
    };
    if (isReadingCol && isBlank) {
      delete updatedRow.reading;
      delete updatedRow.actual;
      delete updatedRow.actual_dimension;
      delete updatedRow.observed_value;
      updatedRow[colId] = "";
    }

    const trialMatch = colId.match(
      /^(?:t|trial_|trial|reading_|reading|actual_|actual|observed_|observed|r|col_)?([1-9]|1[0-9]|20)$/i,
    );
    if (trialMatch) {
      const idx = trialMatch[1];
      const aliases = [
        `t${idx}`,
        `trial_${idx}`,
        `trial${idx}`,
        `reading_${idx}`,
        `reading${idx}`,
        `actual_${idx}`,
        `actual${idx}`,
        `observed_${idx}`,
        `observed${idx}`,
        `r${idx}`,
        `col_${idx}`,
        idx,
      ];
      aliases.forEach((a) => {
        updatedRow[a] = val;
      });
    }

    const parsedRowTol = parseToleranceValue(updatedRow.tolerance);
    const tol =
      parsedRowTol !== undefined
        ? parsedRowTol
        : parseFloat(String(child.tolerance ?? 0.02)) || 0.02;
    const dec = child.decimal_places ?? decimalPlaces ?? 3;

    // If editing a specification / required_dimension / nominal, dynamically parse nominal & tolerance limits
    if (
      colId === "required_dimension" ||
      colId === "specification" ||
      colId === "description" ||
      colId === "nominal" ||
      /spec|dimension/i.test(colId)
    ) {
      const specText = String(val ?? "").trim();
      const parsed = parseSpecification(specText, child.unit || "mm", tol, dec);
      if (parsed.isValid) {
        updatedRow.nominal = parsed.nominal;
        updatedRow.lower_tolerance = parsed.lowerTolerance;
        updatedRow.upper_tolerance = parsed.upperTolerance;
        updatedRow.lowerTolerance = parsed.lowerTolerance;
        updatedRow.upperTolerance = parsed.upperTolerance;
        updatedRow.lower_limit = parsed.lowerLimit;
        updatedRow.upper_limit = parsed.upperLimit;
        updatedRow.lowerLimit = parsed.lowerLimit;
        updatedRow.upperLimit = parsed.upperLimit;
        if (parsed.isMaxLimit) {
          updatedRow.isMaxLimit = true;
          updatedRow.tolerance = parsed.upperTolerance;
        } else if (parsed.isMinLimit) {
          updatedRow.isMinLimit = true;
          updatedRow.tolerance = parsed.nominal;
        }
      }
    }

    const hasCrossTable = canvasHasCrossTableFormulas(blocks);
    const globalContext = hasCrossTable ? buildGlobalTablesContext(blocks) : undefined;
    const evaluatedRow = evaluateCanvasRowFormulas(
      updatedRow,
      child.columns,
      tol,
      dec,
      child.nominal,
      globalContext,
    );

    evaluatedRow[colId] = val;
    if (trialMatch) {
      const idx = trialMatch[1];
      const aliases = [
        `t${idx}`,
        `trial_${idx}`,
        `trial${idx}`,
        `reading_${idx}`,
        `reading${idx}`,
        `actual_${idx}`,
        `actual${idx}`,
        `observed_${idx}`,
        `observed${idx}`,
        `r${idx}`,
        `col_${idx}`,
        idx,
      ];
      aliases.forEach((a) => {
        evaluatedRow[a] = val;
      });
    }

    newRows[rowIndex] = evaluatedRow;
    const updatedChildren = split.children.map((c, i) =>
      i === childIndex ? { ...child, rows: newRows } : c,
    );
    const updatedBlocks = [...blocks];
    updatedBlocks[blockIndex] = { ...split, children: updatedChildren };

    // FAST-PATH: If there are no cross-table formulas anywhere on the canvas,
    // avoid calling evaluateAllCanvasBlocks completely! (0ms lag, smooth 60fps typing)
    if (!hasCrossTable) {
      markChanged(updatedBlocks);
      return;
    }

    // TARGETED RE-EVALUATION: Only evaluate dependent tables/rows
    const fullyEvaluated = evaluateAllCanvasBlocks(updatedBlocks, {
      changedBlockIndex: blockIndex,
      changedChildIndex: childIndex,
      changedRowIndex: rowIndex,
    });
    const targetSplit = fullyEvaluated[blockIndex] as SplitRowBlock;
    const targetChild = targetSplit?.children?.[childIndex] as TableGridBlock;
    if (targetChild && targetChild.rows && targetChild.rows[rowIndex]) {
      targetChild.rows[rowIndex][colId] = val;
      if (trialMatch) {
        const idx = trialMatch[1];
        const aliases = [
          `t${idx}`,
          `trial_${idx}`,
          `trial${idx}`,
          `reading_${idx}`,
          `reading${idx}`,
          `actual_${idx}`,
          `actual${idx}`,
          `observed_${idx}`,
          `observed${idx}`,
          `r${idx}`,
          `col_${idx}`,
          idx,
        ];
        aliases.forEach((a) => {
          targetChild.rows[rowIndex][a] = val;
        });
      }
    }
    markChanged(fullyEvaluated);
  };

  const handleToggleMergeRow = (
    blockIndex: number,
    childIndex: number | null,
    rowIndex: number,
  ) => {
    if (childIndex !== null) {
      const split = blocks[blockIndex] as SplitRowBlock;
      if (!split || !split.children) return;
      const child = split.children[childIndex] as TableGridBlock;
      if (!child || !child.rows) return;
      const newRows = [...child.rows];
      const cur = newRows[rowIndex] || {};
      const isCurrentlyMerged = !!(cur.is_merged || cur.isMerged);
      const updatedRow = {
        ...cur,
        is_merged: !isCurrentlyMerged,
        isMerged: !isCurrentlyMerged,
        merged_text: !isCurrentlyMerged
          ? (cur.merged_text || cur.description || cur.required_dimension || "All the jaws are free from dent and damages")
          : undefined,
      };
      newRows[rowIndex] = updatedRow;
      const updatedChildren = split.children.map((c, i) =>
        i === childIndex ? { ...child, rows: newRows } : c,
      );
      updateBlock(blockIndex, { ...split, children: updatedChildren });
      toast.success(
        !isCurrentlyMerged ? `Row ${rowIndex + 1} merged across all columns` : `Row ${rowIndex + 1} unmerged`,
      );
    } else {
      const block = blocks[blockIndex] as TableGridBlock;
      if (!block || !block.rows) return;
      const newRows = [...block.rows];
      const cur = newRows[rowIndex] || {};
      const isCurrentlyMerged = !!(cur.is_merged || cur.isMerged);
      const updatedRow = {
        ...cur,
        is_merged: !isCurrentlyMerged,
        isMerged: !isCurrentlyMerged,
        merged_text: !isCurrentlyMerged
          ? (cur.merged_text || cur.description || cur.required_dimension || "All the jaws are free from dent and damages")
          : undefined,
      };
      newRows[rowIndex] = updatedRow;
      updateBlock(blockIndex, { ...block, rows: newRows });
      toast.success(
        !isCurrentlyMerged ? `Row ${rowIndex + 1} merged across all columns` : `Row ${rowIndex + 1} unmerged`,
      );
    }
  };

  const handleSetCellColSpan = (
    blockIndex: number,
    childIndex: number | null,
    rowIndex: number,
    colId: string,
    span: number,
  ) => {
    const updateRows = (rows: CanvasRowData[]): CanvasRowData[] => {
      const newRows = [...rows];
      const cur = { ...newRows[rowIndex] };
      const currentSpans = { ...(cur.cellSpans || {}) };
      const currentCell = { ...(currentSpans[colId] || {}) };
      if (span <= 1) {
        delete currentCell.colSpan;
      } else {
        currentCell.colSpan = span;
      }
      if (!currentCell.colSpan && !currentCell.rowSpan) {
        delete currentSpans[colId];
      } else {
        currentSpans[colId] = currentCell;
      }
      cur.cellSpans = Object.keys(currentSpans).length > 0 ? currentSpans : undefined;
      newRows[rowIndex] = cur;
      return newRows;
    };

    if (childIndex !== null) {
      const split = blocks[blockIndex] as SplitRowBlock;
      if (!split || !split.children) return;
      const child = split.children[childIndex] as TableGridBlock;
      if (!child || !child.rows) return;
      const newRows = updateRows(child.rows);
      const updatedChildren = split.children.map((c, i) =>
        i === childIndex ? { ...child, rows: newRows } : c,
      );
      updateBlock(blockIndex, { ...split, children: updatedChildren });
    } else {
      const block = blocks[blockIndex] as TableGridBlock;
      if (!block || !block.rows) return;
      const newRows = updateRows(block.rows);
      updateBlock(blockIndex, { ...block, rows: newRows });
    }

    toast.success(
      span > 1
        ? `Merged ${span} columns horizontally on row ${rowIndex + 1}`
        : `Reset horizontal column merge on row ${rowIndex + 1}`,
    );
  };

  const handleSetCellRowSpan = (
    blockIndex: number,
    childIndex: number | null,
    rowIndex: number,
    colId: string,
    span: number,
  ) => {
    const updateRows = (rows: CanvasRowData[]): CanvasRowData[] => {
      const newRows = [...rows];
      const cur = { ...newRows[rowIndex] };
      const currentSpans = { ...(cur.cellSpans || {}) };
      const currentCell = { ...(currentSpans[colId] || {}) };
      if (span <= 1) {
        delete currentCell.rowSpan;
      } else {
        currentCell.rowSpan = span;
      }
      if (!currentCell.colSpan && !currentCell.rowSpan) {
        delete currentSpans[colId];
      } else {
        currentSpans[colId] = currentCell;
      }
      cur.cellSpans = Object.keys(currentSpans).length > 0 ? currentSpans : undefined;
      newRows[rowIndex] = cur;
      return newRows;
    };

    if (childIndex !== null) {
      const split = blocks[blockIndex] as SplitRowBlock;
      if (!split || !split.children) return;
      const child = split.children[childIndex] as TableGridBlock;
      if (!child || !child.rows) return;
      const newRows = updateRows(child.rows);
      const updatedChildren = split.children.map((c, i) =>
        i === childIndex ? { ...child, rows: newRows } : c,
      );
      updateBlock(blockIndex, { ...split, children: updatedChildren });
    } else {
      const block = blocks[blockIndex] as TableGridBlock;
      if (!block || !block.rows) return;
      const newRows = updateRows(block.rows);
      updateBlock(blockIndex, { ...block, rows: newRows });
    }

    toast.success(
      span > 1
        ? `Merged ${span} rows vertically down column`
        : `Reset vertical row merge on row ${rowIndex + 1}`,
    );
  };

  const handleResetCellSpans = (
    blockIndex: number,
    childIndex: number | null,
    rowIndex: number,
    colId: string,
  ) => {
    const updateRows = (rows: CanvasRowData[]): CanvasRowData[] => {
      const newRows = [...rows];
      const cur = { ...newRows[rowIndex] };
      const currentSpans = { ...(cur.cellSpans || {}) };
      delete currentSpans[colId];
      cur.cellSpans = Object.keys(currentSpans).length > 0 ? currentSpans : undefined;
      newRows[rowIndex] = cur;
      return newRows;
    };

    if (childIndex !== null) {
      const split = blocks[blockIndex] as SplitRowBlock;
      if (!split || !split.children) return;
      const child = split.children[childIndex] as TableGridBlock;
      if (!child || !child.rows) return;
      const newRows = updateRows(child.rows);
      const updatedChildren = split.children.map((c, i) =>
        i === childIndex ? { ...child, rows: newRows } : c,
      );
      updateBlock(blockIndex, { ...split, children: updatedChildren });
    } else {
      const block = blocks[blockIndex] as TableGridBlock;
      if (!block || !block.rows) return;
      const newRows = updateRows(block.rows);
      updateBlock(blockIndex, { ...block, rows: newRows });
    }

    toast.success(`Unmerged cell on row ${rowIndex + 1}`);
  };

  // --- MATRIX TABLE HANDLERS ---
  const handleMatrixCellTextChange = (
    blockIndex: number,
    isHeader: boolean,
    rIdx: number,
    cIdx: number,
    text: string,
  ) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = updateMatrixCell(block, isHeader, rIdx, cIdx, { text });
    updateBlock(blockIndex, updated);
  };

  const handleSetMatrixCellColSpan = (
    blockIndex: number,
    isHeader: boolean,
    rIdx: number,
    cIdx: number,
    span: number,
  ) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = mergeMatrixCellAcrossCols(block, isHeader, rIdx, cIdx, span);
    updateBlock(blockIndex, updated);
    toast.success(span > 1 ? `Merged across ${span} columns` : "Reset horizontal column merge");
  };

  const handleSetMatrixCellRowSpan = (
    blockIndex: number,
    isHeader: boolean,
    rIdx: number,
    cIdx: number,
    span: number,
  ) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = mergeMatrixCellDownRows(block, isHeader, rIdx, cIdx, span);
    updateBlock(blockIndex, updated);
    toast.success(span > 1 ? `Merged down ${span} rows` : "Reset vertical row merge");
  };

  const handleNormalizeMatrixTableBtn = (blockIndex: number) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = normalizeMatrixTableGeometry(block);
    updateBlock(blockIndex, updated);
    toast.success("Aligned table geometry across all header tiers and data rows");
  };

  const handleSetMatrixCellAlign = (
    blockIndex: number,
    isHeader: boolean,
    rIdx: number,
    cIdx: number,
    align: "left" | "center" | "right",
  ) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = updateMatrixCell(block, isHeader, rIdx, cIdx, { align });
    updateBlock(blockIndex, updated);
  };

  const handleAddMatrixColumnBtn = (blockIndex: number) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = addMatrixColumn(block);
    updateBlock(blockIndex, updated);
    toast.success("Added column to matrix table");
  };

  const handleRemoveMatrixColumnBtn = (blockIndex: number, colIndex?: number) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = removeMatrixColumn(block, colIndex);
    updateBlock(blockIndex, updated);
    toast.success(
      colIndex !== undefined
        ? `Removed column ${colIndex + 1} from matrix table`
        : "Removed last column from matrix table"
    );
  };

  const handleAddMatrixRowBtn = (blockIndex: number) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = addMatrixRow(block);
    updateBlock(blockIndex, updated);
    toast.success("Added data row to matrix table");
  };

  const handleRemoveMatrixRowBtn = (blockIndex: number, rowIndex?: number) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = removeMatrixRow(block, rowIndex);
    updateBlock(blockIndex, updated);
    toast.success(
      rowIndex !== undefined
        ? `Removed row ${rowIndex + 1} from matrix table`
        : "Removed last data row from matrix table"
    );
  };

  const handleClearMatrixAllRows = (blockIndex: number) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = clearMatrixRows(block);
    updateBlock(blockIndex, updated);
    toast.success("Cleared all data rows from matrix table");
  };

  const handleClearMatrixSpecificCell = (
    blockIndex: number,
    isHeader: boolean,
    rIdx: number,
    cIdx: number
  ) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = clearMatrixCell(block, isHeader, rIdx, cIdx);
    updateBlock(blockIndex, updated);
    toast.success("Cleared cell content");
  };

  const handleAddMatrixHeaderRowBtn = (blockIndex: number) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = addMatrixHeaderRow(block);
    updateBlock(blockIndex, updated);
    toast.success("Added header tier to matrix table");
  };

  const handleRemoveMatrixHeaderRowBtn = (blockIndex: number, targetHIdx?: number) => {
    const block = blocks[blockIndex] as MatrixTableBlock;
    if (!block || block.type !== "matrix_table") return;
    const updated = removeMatrixHeaderRow(block, targetHIdx);
    updateBlock(blockIndex, updated);
    toast.success(
      targetHIdx !== undefined
        ? `Removed header tier ${targetHIdx + 1} from matrix table`
        : "Removed last header tier from matrix table"
    );
  };

  // --- TABLE COLUMN & HEADER GROUPING HELPERS ---
  const updateTableColumns = (
    blockIndex: number,
    childIndex: number | null,
    updater: (cols: CanvasColumnDef[]) => CanvasColumnDef[],
  ) => {
    if (childIndex !== null) {
      const split = blocks[blockIndex] as SplitRowBlock;
      if (!split || !split.children) return;
      const child = split.children[childIndex] as TableGridBlock;
      if (!child || !child.columns) return;
      const newCols = updater(child.columns);
      const newChildren = split.children.map((c, i) =>
        i === childIndex ? { ...child, columns: newCols } : c,
      );
      updateBlock(blockIndex, { ...split, children: newChildren as any });
    } else {
      const block = blocks[blockIndex] as TableGridBlock;
      if (!block || !block.columns) return;
      const newCols = updater(block.columns);
      updateBlock(blockIndex, { ...block, columns: newCols });
    }
  };

  const getTableColumns = (
    blockIndex: number,
    childIndex: number | null,
  ): CanvasColumnDef[] => {
    if (childIndex !== null) {
      const split = blocks[blockIndex] as SplitRowBlock;
      if (!split || !split.children) return [];
      const child = split.children[childIndex] as TableGridBlock;
      return child?.columns || [];
    } else {
      const block = blocks[blockIndex] as TableGridBlock;
      return block?.columns || [];
    }
  };

  const handleMergeHeaderWithNext = (
    blockIndex: number,
    childIndex: number | null,
    colIdx: number,
    customGroupName?: string,
  ) => {
    updateTableColumns(blockIndex, childIndex, (cols) => {
      if (colIdx >= cols.length - 1 && !cols[colIdx]?.groupName) return cols;
      const cur = cols[colIdx];
      const group = customGroupName || cur?.groupName;

      if (group) {
        // Current column or super-header already belongs to a group; extend it to include the next column
        const groupIndices = cols
          .map((c, i) => (c.groupName === group ? i : -1))
          .filter((i) => i !== -1);
        const maxIdx = Math.max(...groupIndices);
        if (maxIdx < cols.length - 1) {
          const newCols = [...cols];
          newCols[maxIdx + 1] = { ...newCols[maxIdx + 1], groupName: group };
          return newCols;
        }
        return cols;
      }

      // Neither was grouped yet; merge colIdx and colIdx + 1
      const next = cols[colIdx + 1];
      const finalGroup = customGroupName || next?.groupName || "GROUP " + (colIdx + 1);
      const newCols = [...cols];
      newCols[colIdx] = { ...cur, groupName: finalGroup };
      if (colIdx + 1 < cols.length) {
        newCols[colIdx + 1] = { ...next, groupName: finalGroup };
      }
      return newCols;
    });

    toast.success("Merged column header into group");
  };

  const handleMergeHeaderWithPrev = (
    blockIndex: number,
    childIndex: number | null,
    colIdx: number,
  ) => {
    if (colIdx <= 0) return;
    updateTableColumns(blockIndex, childIndex, (cols) => {
      if (colIdx <= 0 || colIdx >= cols.length) return cols;
      const cur = cols[colIdx];
      const prev = cols[colIdx - 1];
      const group = cur.groupName || prev.groupName || `GROUP ${colIdx}`;
      const newCols = [...cols];
      newCols[colIdx - 1] = { ...prev, groupName: group };
      newCols[colIdx] = { ...cur, groupName: group };
      return newCols;
    });

    toast.success("Merged column header with previous column");
  };

  const handleJoinAdjacentGroup = (
    blockIndex: number,
    childIndex: number | null,
    colId: string,
    targetGroupName: string,
  ) => {
    updateTableColumns(blockIndex, childIndex, (cols) => {
      return cols.map((c) =>
        c.id === colId ? { ...c, groupName: targetGroupName } : c,
      );
    });

    toast.success(`Added column to group "${targetGroupName}"`);
  };

  const handleExtendGroup = (
    blockIndex: number,
    childIndex: number | null,
    groupName: string,
    direction: "left" | "right",
  ) => {
    updateTableColumns(blockIndex, childIndex, (cols) => {
      const groupIndices = cols
        .map((c, i) => (c.groupName === groupName ? i : -1))
        .filter((i) => i !== -1);
      if (groupIndices.length === 0) return cols;

      const newCols = [...cols];
      if (direction === "right") {
        const maxIdx = Math.max(...groupIndices);
        if (maxIdx + 1 < cols.length) {
          newCols[maxIdx + 1] = { ...newCols[maxIdx + 1], groupName };
        }
      } else {
        const minIdx = Math.min(...groupIndices);
        if (minIdx - 1 >= 0) {
          newCols[minIdx - 1] = { ...newCols[minIdx - 1], groupName };
        }
      }
      return newCols;
    });

    toast.success(`Extended header group "${groupName}"`);
  };

  const handleRemoveColumnFromGroup = (
    blockIndex: number,
    childIndex: number | null,
    colId: string,
  ) => {
    updateTableColumns(blockIndex, childIndex, (cols) => {
      return cols.map((c) =>
        c.id === colId ? { ...c, groupName: undefined } : c,
      );
    });

    toast.success("Removed column from header group");
  };

  const handleSetHeaderGroupName = (
    blockIndex: number,
    childIndex: number | null,
    colId: string,
    groupName: string,
  ) => {
    const trimmed = groupName.trim();
    updateTableColumns(blockIndex, childIndex, (cols) => {
      const targetCol = cols.find((c) => c.id === colId);
      const oldGroup = targetCol?.groupName;
      return cols.map((c) => {
        if (c.id === colId || (oldGroup && c.groupName === oldGroup)) {
          return { ...c, groupName: trimmed || undefined };
        }
        return c;
      });
    });

    toast.success(`Updated header group to "${trimmed}"`);
  };

  const handleUnmergeHeader = (
    blockIndex: number,
    childIndex: number | null,
    colId: string,
  ) => {
    updateTableColumns(blockIndex, childIndex, (cols) => {
      return cols.map((c) => (c.id === colId ? { ...c, groupName: undefined } : c));
    });

    toast.success("Unmerged column header");
  };

  const handleUnmergeGroup = (
    blockIndex: number,
    childIndex: number | null,
    groupName: string,
  ) => {
    updateTableColumns(blockIndex, childIndex, (cols) => {
      return cols.map((c) =>
        c.groupName === groupName ? { ...c, groupName: undefined } : c,
      );
    });

    toast.success(`Unmerged header group "${groupName}"`);
  };

  const handleApplyGroupColumns = (
    blockIndex: number,
    childIndex: number | null,
    groupName: string,
    selectedColIds: string[],
    oldGroupName?: string,
  ) => {
    const trimmedGroup = groupName.trim();
    const idSet = new Set(selectedColIds);
    updateTableColumns(blockIndex, childIndex, (cols) => {
      return cols.map((col) => {
        // If col was in the old group and is not in selected set, clear its group
        if (oldGroupName && col.groupName === oldGroupName && !idSet.has(col.id)) {
          return { ...col, groupName: undefined };
        }
        // If col is in selected set, assign new groupName
        if (idSet.has(col.id)) {
          return { ...col, groupName: trimmedGroup };
        }
        return col;
      });
    });

    toast.success(`Updated header group "${trimmedGroup}" (${selectedColIds.length} columns)`);
  };

  const handleAddMergedStatementRow = (
    blockIndex: number,
    childIndex: number | null,
  ) => {
    if (childIndex !== null) {
      const split = blocks[blockIndex] as SplitRowBlock;
      if (!split || !split.children) return;
      const child = split.children[childIndex] as TableGridBlock;
      if (!child || !child.rows) return;
      const newRows = [...child.rows];
      const newPointNum = newRows.length + 1;
      const newRow: CanvasRowData = {
        point_number: newPointNum,
        is_merged: true,
        isMerged: true,
        merged_text: "All the jaws are free from dent and damages",
        description: "All the jaws are free from dent and damages",
      };
      newRows.push(newRow);
      const updatedChildren = split.children.map((c, i) =>
        i === childIndex ? { ...child, rows: newRows } : c,
      );
      updateBlock(blockIndex, { ...split, children: updatedChildren });
      toast.success("Added merged statement row");
    } else {
      const block = blocks[blockIndex] as TableGridBlock;
      if (!block || !block.rows) return;
      const newRows = [...block.rows];
      const newPointNum = newRows.length + 1;
      const newRow: CanvasRowData = {
        point_number: newPointNum,
        is_merged: true,
        isMerged: true,
        merged_text: "All the jaws are free from dent and damages",
        description: "All the jaws are free from dent and damages",
      };
      newRows.push(newRow);
      updateBlock(blockIndex, { ...block, rows: newRows });
      toast.success("Added merged statement row");
    }
  };

  const handleReorderColumns = (
    blockIndex: number,
    childIndex: number | null,
    fromIdx: number,
    toIdx: number,
  ) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    if (childIndex !== null) {
      const split = blocks[blockIndex] as SplitRowBlock;
      if (!split || !split.children) return;
      const child = split.children[childIndex] as TableGridBlock;
      if (!child || !child.columns || fromIdx >= child.columns.length || toIdx >= child.columns.length) return;
      const newCols = [...child.columns];
      const [moved] = newCols.splice(fromIdx, 1);
      newCols.splice(toIdx, 0, moved);
      const updatedChildren = split.children.map((c, i) =>
        i === childIndex ? { ...child, columns: newCols } : c,
      );
      updateBlock(blockIndex, { ...split, children: updatedChildren });
      toast.success(`Moved column "${moved.label || moved.id}" to position ${toIdx + 1}`);
    } else {
      const block = blocks[blockIndex] as TableGridBlock;
      if (!block || !block.columns || fromIdx >= block.columns.length || toIdx >= block.columns.length) return;
      const newCols = [...block.columns];
      const [moved] = newCols.splice(fromIdx, 1);
      newCols.splice(toIdx, 0, moved);
      updateBlock(blockIndex, { ...block, columns: newCols });
      toast.success(`Moved column "${moved.label || moved.id}" to position ${toIdx + 1}`);
    }
  };

  // Table Merging & Unmerging Handlers
  const handleOpenMergeModal = (table: TableGridBlock) => {
    setMergeSourceTable(table);
    setShowMergeModal(true);
  };

  const handleExecuteMerge = (tableAId: string, tableBId: string) => {
    const newBlocks = mergeTablesSideBySide(blocks, tableAId, tableBId);
    markChanged(newBlocks);
    toast.success("Merged tables into Side-by-Side (50/50) split!");
  };

  const handleUnmergeSplitRow = (splitRowId: string) => {
    const newBlocks = unmergeSplitRow(blocks, splitRowId);
    markChanged(newBlocks);
    toast.success("Separated side-by-side section back into standalone individual tables.");
  };

  // Column Value Copy / Paste Handlers
  const handleOpenPasteModal = (
    blockIdx: number,
    childIdx: number | null,
    table: TableGridBlock,
    colId?: string
  ) => {
    setPasteTargetTable({ blockIdx, childIdx, table, colId });
    setShowPasteValuesModal(true);
  };

  const handleApplyModalPaste = (colId: string, text: string, autoExpand: boolean) => {
    if (!pasteTargetTable) return;
    const { blockIdx, childIdx, table } = pasteTargetTable;
    // Always resolve current block from blocks array to guarantee up-to-date data
    const currentTable =
      childIdx !== null
        ? ((blocks[blockIdx] as SplitRowBlock)?.children?.[childIdx] as TableGridBlock) || table
        : (blocks[blockIdx] as TableGridBlock) || table;

    const res = applyPastedValuesToRows({
      rows: currentTable.rows || [],
      columns: currentTable.columns || [],
      colId,
      startRowIndex: 0,
      clipboardText: text,
      unit: currentTable.unit || defaultUnit,
      defaultTolerance: currentTable.tolerance ?? defaultTolerance,
            decimalPlaces: currentTable.decimal_places ?? decimalPlaces,
      autoExpand,
      tableNominal: currentTable.nominal,
    });

    if (childIdx !== null) {
      const split = blocks[blockIdx] as SplitRowBlock;
      if (!split || !split.children) return;
      const updatedChildren = split.children.map((c, i) =>
        i === childIdx ? { ...c, rows: res.updatedRows } : c
      );
      updateBlock(blockIdx, { ...split, children: updatedChildren as any });
    } else {
      updateBlock(blockIdx, { ...currentTable, rows: res.updatedRows });
    }

    const colLabel = currentTable.columns?.find((c) => c.id === colId)?.label || colId;
    toast.success(
      `✓ Pasted ${res.pastedCount} values into "${colLabel}"${
        res.addedRowCount > 0 ? ` (auto-added ${res.addedRowCount} rows)` : ""
      }`
    );
  };

  const handleCellPaste = (
    e: React.ClipboardEvent,
    blockIdx: number,
    childIdx: number | null,
    startRowIndex: number,
    colId: string
  ) => {
    const clipText = e.clipboardData?.getData("text");
    if (!clipText) return;

    // Check if multi-line or multi-value paste (contains newline, carriage return, or tab)
    if (clipText.includes("\n") || clipText.includes("\r") || clipText.includes("\t")) {
      e.preventDefault();
      e.stopPropagation();

      const table =
        childIdx !== null
          ? ((blocks[blockIdx] as SplitRowBlock)?.children?.[childIdx] as TableGridBlock)
          : (blocks[blockIdx] as TableGridBlock);

      if (!table || !table.rows) return;

      const res = applyPastedValuesToRows({
        rows: table.rows,
        columns: table.columns || [],
        colId,
        startRowIndex,
        clipboardText: clipText,
        unit: table.unit || defaultUnit,
        defaultTolerance: table.tolerance ?? defaultTolerance,
        decimalPlaces: table.decimal_places ?? decimalPlaces,
        autoExpand: true,
        tableNominal: table.nominal,
      });

      if (childIdx !== null) {
        const split = blocks[blockIdx] as SplitRowBlock;
        if (!split || !split.children) return;
        const updatedChildren = split.children.map((c, i) =>
          i === childIdx ? { ...c, rows: res.updatedRows } : c
        );
        updateBlock(blockIdx, { ...split, children: updatedChildren as any });
      } else {
        updateBlock(blockIdx, { ...table, rows: res.updatedRows });
      }

      const colLabel = table.columns?.find((c) => c.id === colId)?.label || colId;
      toast.success(
        `✓ Pasted ${res.pastedCount} values into "${colLabel}"${
          res.addedRowCount > 0 ? ` (auto-added ${res.addedRowCount} rows)` : ""
        }`
      );
    }
  };

  const handleCopyColumn = async (table: TableGridBlock, colId: string, colLabel: string) => {
    const res = await copyColumnValuesToClipboard(table.rows || [], colId);
    if (res.success) {
      toast.success(`Copied ${res.count} values from "${colLabel}" to clipboard`);
    } else {
      toast.error(`Could not copy values to clipboard`);
    }
  };

  const handleMirrorSibling = (blockIdx: number, targetChildIdx: number) => {
    const split = blocks[blockIdx] as SplitRowBlock;
    if (!split || !split.children || split.children.length < 2) return;

    const sourceChildIdx = targetChildIdx === 0 ? 1 : 0;
    const sourceChild = split.children[sourceChildIdx] as TableGridBlock;
    const targetChild = split.children[targetChildIdx] as TableGridBlock;

    if (!sourceChild || !targetChild || !sourceChild.rows) return;

    const res = mirrorSiblingTableSpecs(
      sourceChild.rows,
      targetChild.rows || [],
      targetChild.columns,
      targetChild.tolerance ?? defaultTolerance,
      targetChild.decimal_places ?? decimalPlaces,
      targetChild.unit || defaultUnit
    );

    const updatedChildren = split.children.map((c, i) =>
      i === targetChildIdx ? { ...targetChild, rows: res.updatedRows } : c
    );

    updateBlock(blockIdx, { ...split, children: updatedChildren as any });
    toast.success(
      `✓ Copied ${res.count} specification values from "${sourceChild.title || 'Left Table'}" into "${targetChild.title || 'Right Table'}"!`
    );
  };

  // Helper to evaluate formula preview in builder with decimal formatting
  const evaluatePreviewCell = (
    row: CanvasRowData,
    col: CanvasColumnDef,
    tableDec: number = 3,
    tableColumns?: CanvasColumnDef[],
    tableNominal?: number | string,
    rowIndex: number = 0,
    allRows?: CanvasRowData[],
    tableTolerance?: number,
  ): React.ReactNode => {
    const dec =
      col.decimal_places ??
      col.decimalPrecision ??
      tableDec ??
      decimalPlaces ??
      3;
    const cellVal =
      row[col.id] !== undefined
        ? row[col.id]
        : col.type === "nominal"
          ? row.nominal
          : col.type === "text"
            ? row.description
            : col.type === "tolerance"
              ? row.tolerance
              : col.type === "trial" || col.type === "reading"
                ? row.reading
                : undefined;

    const formatNumericVal = (val: any) => {
      if (val === undefined || val === null || val === "") return "-";
      if (typeof val === "number")
        return dec === 0 ? String(Math.round(val)) : val.toFixed(dec);
      const str = String(val).trim();
      const num = parseFloat(str);
      if (!isNaN(num) && /^[+-]?\d+(\.\d+)?$/.test(str)) {
        return dec === 0 ? String(Math.round(num)) : num.toFixed(dec);
      }
      return str;
    };

    const evalFormulaWithContext = (fStr: string) => {
      const hasTolCol = tableColumns?.some((c) => c && (c.type === "tolerance" || c.id === "tolerance" || c.id === "tol"));
      const tolColObj = tableColumns?.find((c) => c && (c.type === "tolerance" || c.id === "tolerance" || c.id === "tol"));
      const parsedRowTol = tolColObj ? parseToleranceValue(row[tolColObj.id]) : parseToleranceValue(row.tolerance);
      const tol = (hasTolCol && parsedRowTol !== undefined)
        ? parsedRowTol
        : (typeof tableTolerance === "number" && !isNaN(tableTolerance))
          ? tableTolerance
          : (parsedRowTol ?? 0.02);
      const effectiveCols = tableColumns && tableColumns.length > 0 ? tableColumns : [col];
      const ctx = buildRowContext(row, effectiveCols, tol, dec, 0, tableNominal, rowIndex, allRows);
      if (fStr.includes(".") || fStr.includes("!")) {
        const globalContext = buildGlobalTablesContext(blocks);
        Object.assign(ctx.valuesMap, globalContext);
        Object.assign(ctx.rawValuesMap, globalContext);
      }
      return evaluateFormulaExpression(fStr, ctx, dec);
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
          return cellVal >= 0
            ? `±${cellVal.toFixed(dec)}`
            : cellVal.toFixed(dec);
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
      if (row.cellFormulas?.[col.id]) {
        const evalRes = evalFormulaWithContext(row.cellFormulas[col.id]);
        if (evalRes.success && evalRes.formatted) {
          return evalRes.formatted;
        }
      }
      return formatNumericVal(cellVal);
    }
    if (col.type === "formula") {
      if (row.cellFormulas?.[col.id]) {
        const evalRes = evalFormulaWithContext(row.cellFormulas[col.id]);
        if (evalRes.success && evalRes.formatted) {
          return evalRes.formatted;
        }
      }
      if (cellVal !== undefined && cellVal !== null && cellVal !== "") {
        return formatNumericVal(cellVal);
      }
      if (col.formula) {
        const evalRes = evalFormulaWithContext(col.formula);
        if (evalRes.success && evalRes.formatted) {
          return evalRes.formatted;
        }
      }
      return "-";
    }
    if (
      col.type === "status" ||
      col.role === "JUDGEMENT" ||
      col.label.toLowerCase().includes("judg")
    ) {
      const renderStatusBadge = (val: string) => {
        const upper = String(val).trim().toUpperCase();
        const isPass = upper === "PASS" || upper === "OK";
        const isFail = upper === "FAIL" || upper === "NOT OK" || upper === "REJECT";
        const isNormal = upper === "NORMAL";
        return (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold ${
              isPass
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : isFail
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                  : isNormal
                    ? "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
            }`}
          >
            {val}
          </span>
        );
      };

      // 1. Check custom cell formula on this specific row first! (CellFormulaModal)
      if (row.cellFormulas?.[col.id]) {
        const evalRes = evalFormulaWithContext(row.cellFormulas[col.id]);
        if (evalRes.success && evalRes.formatted) {
          return evalRes.formatted === "-" ? "-" : renderStatusBadge(evalRes.formatted);
        }
      }

      // 2. Use pre-computed status value from evaluateCanvasRowFormulas (instant 0ms render)
      const precomputed = cellVal ?? row[col.id];
      if (precomputed !== undefined && precomputed !== null && precomputed !== "") {
        if (precomputed === "-") return "-";
        return renderStatusBadge(precomputed);
      }

      // 3. Fallback: dynamically evaluate column formula if not yet computed (e.g. initial load)
      if (col.formula) {
        const evalRes = evalFormulaWithContext(col.formula);
        if (evalRes.success && evalRes.formatted) {
          return evalRes.formatted === "-" ? "-" : renderStatusBadge(evalRes.formatted);
        }
      }

      // 4. Fallback for manual Pass/Fail selection (no formula)
      const manualVal = row.status || row.judgement;
      if (!col.formula && manualVal && manualVal !== "-") {
        return renderStatusBadge(manualVal);
      }

      return "-";
    }
    if (cellVal !== undefined && cellVal !== null) {
      return formatNumericVal(cellVal);
    }
    return "-";
  };

  const handleApplyAiGenerated = (
    result: GeneratedTemplateResult,
    mode: "append" | "replace" = "append",
  ) => {
    if (onApplyGeneratedTemplate) {
      onApplyGeneratedTemplate(result, mode);
      return;
    }
    if (result.blocks && result.blocks.length > 0) {
      if (mode === "append" && blocks && blocks.length > 0) {
        const uniqueNewBlocks = result.blocks.map((b, idx) => {
          const newId = `${b.type || "block"}_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
          if (b.type === "split_row" && Array.isArray((b as any).children)) {
            return {
              ...b,
              id: newId,
              children: (b as any).children.map((c: any, cIdx: number) => ({
                ...c,
                id: `${c.type || "tbl"}_${Date.now()}_${idx}_${cIdx}_${Math.random().toString(36).substring(2, 6)}`,
              })),
            };
          }
          return { ...b, id: newId };
        });
        const combined = ensureTableKeys([...blocks, ...uniqueNewBlocks]);
        const evaluated = evaluateAllCanvasBlocks(combined, { forceFull: true });
        markChanged(evaluated);
        setSelectedBlockId(uniqueNewBlocks[0]?.id || null);
        toast.success(
          `Added ${result.blocks.length} block(s) without removing existing tables! Total: ${combined.length} blocks.`,
        );
      } else {
        markChanged(result.blocks);
        setSelectedBlockId(result.blocks[0]?.id || null);
        toast.success(
          `Loaded "${result.name}" with ${result.blocks.length} blocks!`,
        );
      }
    }
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
            <Badge
              variant="outline"
              className="text-[10px] font-mono py-0 px-1.5 bg-muted"
            >
              {canvasWidthMode === "fit"
                ? "Full Width (100%)"
                : canvasWidthMode === "wide"
                  ? "Wide (1240px)"
                  : "A4 Standard (860px)"}
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
              <DropdownMenuContent
                align="end"
                className="w-80 max-h-80 overflow-y-auto"
              >
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
                    <span className="font-semibold text-xs text-foreground">
                      {preset.name}
                    </span>
                    <span className="text-xxs text-muted-foreground line-clamp-1">
                      {preset.description}
                    </span>
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
              title={
                showAssistant
                  ? "Hide AI Copilot (Full Screen View)"
                  : "Show AI Copilot Dock"
              }
            >
              {showAssistant ? (
                <PanelRightClose className="w-3.5 h-3.5 text-indigo-600" />
              ) : (
                <PanelRight className="w-3.5 h-3.5 text-indigo-500" />
              )}
              <span>{showAssistant ? "Hide Copilot" : "AI Copilot"}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main 3-Column Antigravity Workspace: Toolbox (Left) + Independent Center Scroll (Center) + Docked Copilot (Right) */}
      <div className="flex-1 flex flex-row min-h-0 w-full overflow-hidden relative">
        {/* MODULAR BLOCKS TOOLBOX (MATCHES USER DESIGN) */}
        {!readOnly && (isToolboxCollapsed ? (
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
        ))}

        {/* MIDDLE COLUMN: CALIBRATION DATA & CANVAS BLOCKS (Independent Scroll!) */}
        <div className="flex-1 h-full min-w-0 overflow-y-auto px-4 py-4 space-y-6 bg-slate-50/50 dark:bg-slate-950/30">
          <fieldset disabled={readOnly} className="contents border-0 p-0 m-0">
          {blocks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3 shadow-xs">
              <Table className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-foreground">
                  Your Certificate Canvas is Empty
                </h4>
                <p className="text-tiny text-muted-foreground">
                  Click below to add a table, load a standard metrology preset,
                  or use <strong>AI Smart Generate</strong> to build your
                  template.
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
                  <DropdownMenuContent
                    align="center"
                    className="w-80 max-h-80 overflow-y-auto"
                  >
                    {CANVAS_PRESETS.map((preset) => (
                      <DropdownMenuItem
                        key={preset.id}
                        onClick={() => {
                          if (onSelectPreset) {
                            onSelectPreset(preset);
                          } else {
                            markChanged(
                              JSON.parse(JSON.stringify(preset.blocks)),
                            );
                            toast.success(`Loaded "${preset.name}" preset!`);
                          }
                        }}
                        className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                      >
                        <span className="font-semibold text-xs text-foreground">
                          {preset.name}
                        </span>
                        <span className="text-xxs text-muted-foreground line-clamp-1">
                          {preset.description}
                        </span>
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
                  marginTop: `${(block as any).marginTop !== undefined ? (block as any).marginTop : index === 0 ? 6 : 0}px`,
                  marginBottom: `${(block as any).marginBottom !== undefined ? (block as any).marginBottom : 10}px`,
                }}
                className={`relative group transition-all rounded-xl cursor-pointer border shadow-sm bg-white dark:bg-slate-900 ${
                  selectedBlockId === block.id
                    ? "border-primary ring-2 ring-primary/20 shadow-md"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
                }`}
              >
                {/* Floating Action Controls on Hover */}
                {!readOnly && (
                  <div className="absolute -top-3.5 right-4 z-30 hidden group-hover:flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1 rounded-full shadow-lg border border-slate-700 text-xs backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-100">
                    <span className="text-xxs font-mono text-amber-400 mr-1 uppercase font-bold tracking-wider">
                      {block.type === "table_grid"
                        ? "TABLE"
                        : block.type.replace("_", " ")}
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
                    {block.type === "table_grid" &&
                      blocks.filter((b) => b.type === "table_grid").length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenMergeModal(block as TableGridBlock);
                          }}
                          className="p-1 hover:text-indigo-400 rounded hover:bg-slate-800 transition-colors"
                          title="Merge Side-by-Side (50/50) with another table"
                        >
                          <SplitSquareVertical className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                )}

                {/* 1. TABLE GRID BLOCK */}
                {block.type === "table_grid" &&
                  (() => {
                    const effOrient = getEffectiveTableOrientation(
                      block as TableGridBlock,
                    );
                    const isAuto =
                      !block.orientation || block.orientation === "auto";
                    const displayCols = (block.columns || []).filter(
                      (c) =>
                        c.id !== "point_number" &&
                        c.id !== "sl_no" &&
                        c.id !== "sino" &&
                        c.id !== "slno",
                    );

                    return (
                      <div
                        className="rounded-xl overflow-hidden bg-white dark:bg-slate-900"
                      >
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
                            {/* Table Access Key Badge with Popover Quick-Editor */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border transition-all cursor-pointer bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800 shadow-2xs font-mono"
                                  title="Table key for cross-table formula access (e.g. tableKey.columnKey)"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-purple-500 font-bold">#</span>
                                  <span>{(block as TableGridBlock).tableKey || slugifyTableKey(block.title || `table_${index + 1}`)}</span>
                                  <Pencil className="w-2.5 h-2.5 opacity-60 hover:opacity-100 ml-0.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="center" className="w-72 p-3 shadow-lg z-50">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                      <Hash className="w-3.5 h-3.5 text-purple-600" />
                                      Cross-Table Key
                                    </h4>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      Formula ID
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-tight">
                                    Unique identifier used in formulas from other tables (e.g. <code className="bg-muted px-1 py-0.2 rounded font-mono text-[10px]">{`=${(block as TableGridBlock).tableKey || slugifyTableKey(block.title || "table")}.error`}</code>).
                                  </p>
                                  <div className="flex items-center gap-1.5 pt-1">
                                    <Input
                                      type="text"
                                      placeholder="e.g. clockwise"
                                      defaultValue={(block as TableGridBlock).tableKey || slugifyTableKey(block.title || `table_${index + 1}`)}
                                      id={`table-key-input-${block.id}`}
                                      className="h-8 text-xs font-mono"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          const val = (e.currentTarget as HTMLInputElement).value;
                                          handleUpdateTableKey(index, null, val);
                                          document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                        }
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      className="h-8 px-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white"
                                      onClick={() => {
                                        const input = document.getElementById(`table-key-input-${block.id}`) as HTMLInputElement;
                                        if (input) {
                                          handleUpdateTableKey(index, null, input.value);
                                        }
                                        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                      }}
                                    >
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>

                            <Badge
                              variant="outline"
                              className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                            >
                              Unit: {block.unit || "mm"}
                            </Badge>

                            {/* Master Table Nominal Badge with Popover Quick-Editor */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border transition-all cursor-pointer bg-amber-50/80 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800 shadow-2xs"
                                  title="Click to set or change master Nominal / Standard value for this table"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="font-medium text-amber-700 dark:text-amber-400">Nominal:</span>
                                  <span className="font-bold">
                                    {(() => {
                                      const formatted = formatNominalDisplay(
                                        (block as TableGridBlock).nominal,
                                        (block as TableGridBlock).decimal_places ?? decimalPlaces
                                      );
                                      return formatted ? `${formatted} ${block.unit || "mm"}` : "Not Set";
                                    })()}
                                  </span>
                                  <Pencil className="w-3 h-3 opacity-60 hover:opacity-100 ml-0.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="center" className="w-64 p-3 shadow-lg z-50">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                      Table Master Nominal
                                    </h4>
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                      {block.unit || "mm"}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-tight">
                                    Master nominal size applied to rows without a dedicated nominal column (e.g. Standard Pins).
                                  </p>
                                  <div className="flex items-center gap-1.5 pt-1">
                                    <Input
                                      type="text"
                                      placeholder="e.g. 10.0000"
                                      defaultValue={formatNominalDisplay(
                                        (block as TableGridBlock).nominal,
                                        (block as TableGridBlock).decimal_places ?? decimalPlaces
                                      )}
                                      id={`nominal-input-${block.id}`}
                                      className="h-8 text-xs font-mono"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          const val = (e.currentTarget as HTMLInputElement).value;
                                          handleUpdateTableNominal(index, null, val);
                                          document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                        }
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      className="h-8 px-2.5 text-xs font-bold"
                                      onClick={(e) => {
                                        const input = document.getElementById(`nominal-input-${block.id}`) as HTMLInputElement;
                                        if (input) {
                                          handleUpdateTableNominal(index, null, input.value);
                                        }
                                        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                      }}
                                    >
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>

                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer"
                                  title="Click to edit Table Tolerance"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>
                                    Tolerance:{" "}
                                    {(block as TableGridBlock).toleranceType ===
                                      "mixed" ||
                                    (block as TableGridBlock).toleranceType ===
                                      "row_specific" ||
                                    ((block as TableGridBlock).rows &&
                                      (block as TableGridBlock).rows.some(
                                        (r, i, arr) =>
                                          r.tolerance !== arr[0]?.tolerance,
                                      ))
                                      ? "Row-specific"
                                      : `±${block.tolerance ?? "0.010"}`}
                                  </span>
                                  <Pencil className="w-3 h-3 opacity-60 hover:opacity-100 ml-0.5" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="center" className="w-64 p-3 shadow-lg z-50">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                      Table Master Tolerance
                                    </h4>
                                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                      ±{block.unit || "mm"}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-tight">
                                    Master tolerance applied to rows without individual tolerance specifications.
                                  </p>
                                  <div className="flex items-center gap-1.5 pt-1">
                                    <Input
                                      type="number"
                                      step="any"
                                      placeholder="e.g. 0.003"
                                      defaultValue={block.tolerance ?? 0.01}
                                      id={`tolerance-input-${block.id}`}
                                      className="h-8 text-xs font-mono"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          const val = (e.currentTarget as HTMLInputElement).value;
                                          handleUpdateTableTolerance(index, null, val);
                                          document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                        }
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      className="h-8 px-2.5 text-xs font-bold"
                                      onClick={(e) => {
                                        const input = document.getElementById(`tolerance-input-${block.id}`) as HTMLInputElement;
                                        if (input) {
                                          handleUpdateTableTolerance(index, null, input.value);
                                        }
                                        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                      }}
                                    >
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                            <Badge
                              variant="outline"
                              className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                            >
                              Decimal Places:{" "}
                              {block.decimal_places ?? decimalPlaces ?? 3}
                            </Badge>

                            {onOpenTableConfig && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenTableConfig(block.id);
                                }}
                                className="h-7 text-xs font-semibold gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border-primary/30"
                                title="Open Table Configuration & Column Architecture"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Configure Table</span>
                              </Button>
                            )}

                            {/* Toggle Excel Coordinate Grid */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowExcelCoordinates(!showExcelCoordinates);
                              }}
                              className={`h-7 text-xs font-semibold gap-1.5 transition-all ${
                                showExcelCoordinates
                                  ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 hover:bg-purple-100"
                                  : "text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                              title={showExcelCoordinates ? "Hide Excel Coordinates (A, B, C...)" : "Show Excel Coordinates (A, B, C...)"}
                            >
                              <Table className="w-3.5 h-3.5 text-purple-600" />
                              <span>{showExcelCoordinates ? "Grid: A, B, C" : "Grid: Off"}</span>
                            </Button>

                            {/* Consolidated Table Options Dropdown (Merge Side-by-Side + Values / Copy / Paste) */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 text-xs font-semibold gap-1.5 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Table actions: Merge side-by-side, Copy / Paste column values"
                                >
                                  <MoreHorizontal className="w-3.5 h-3.5 text-primary" />
                                  <span>Table Options</span>
                                  <ChevronDown className="w-3 h-3 opacity-60" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-60 max-h-80 overflow-y-auto">
                                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                                  Grid View
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowExcelCoordinates(!showExcelCoordinates);
                                  }}
                                  className="text-xs cursor-pointer gap-2 font-medium"
                                >
                                  <Table className="w-3.5 h-3.5 text-purple-600" />
                                  <span>{showExcelCoordinates ? "Hide Excel Coordinates (A, B, C...)" : "Show Excel Coordinates (A, B, C...)"}</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />

                                {blocks.filter((b, i) => i !== index && b.type === "table_grid").length > 0 && (
                                  <>
                                    <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                                      Layout Actions
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenMergeModal(block as TableGridBlock);
                                      }}
                                      className="text-xs cursor-pointer gap-2 font-medium text-indigo-700 dark:text-indigo-300 focus:text-indigo-800"
                                    >
                                      <SplitSquareVertical className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                      <span>Merge Side-by-Side (50/50)...</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}

                                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                                  Data & Values
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => handleOpenPasteModal(index, null, block as TableGridBlock, "nominal")}
                                  className="text-xs cursor-pointer gap-2 font-medium text-primary focus:text-primary"
                                >
                                  <ClipboardPaste className="w-3.5 h-3.5 text-primary" />
                                  <span>Paste Values into Column...</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                                  Copy Column to Clipboard
                                </DropdownMenuLabel>
                                {(block.columns || [])
                                  .filter((col) => col && col.id !== "point_number" && col.id !== "sl_no")
                                  .map((col) => (
                                    <DropdownMenuItem
                                      key={col.id}
                                      onClick={() => handleCopyColumn(block as TableGridBlock, col.id, col.label || col.id)}
                                      className="text-xs cursor-pointer gap-2"
                                    >
                                      <ClipboardCopy className="w-3.5 h-3.5 text-slate-500" />
                                      <span className="truncate">Copy "{col.label || col.id}"</span>
                                    </DropdownMenuItem>
                                  ))}
                                {(block.columns || []).some((col) => col.id === "point_number" || col.id === "sl_no") && (
                                  <DropdownMenuItem
                                    onClick={() => handleCopyColumn(block as TableGridBlock, "point_number", "Sl No / Points")}
                                    className="text-xs cursor-pointer gap-2 text-muted-foreground"
                                  >
                                    <ClipboardCopy className="w-3.5 h-3.5" />
                                    <span>Copy Points / Sl.No.</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Table Print Orientation Toggle */}
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs shadow-2xs">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateBlock(index, {
                                    ...block,
                                    orientation: "vertical",
                                  });
                                  toast.success(
                                    "Table layout set to Vertical (Standard Rows)",
                                  );
                                }}
                                className={`px-2.5 py-0.5 rounded-full text-tiny font-semibold transition-all flex items-center gap-1 ${
                                  block.orientation === "vertical" ||
                                  (!block.orientation &&
                                    effOrient === "vertical")
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
                                  updateBlock(index, {
                                    ...block,
                                    orientation: "horizontal",
                                  });
                                  toast.success(
                                    "Table layout set to Horizontal (Transposed Columns)",
                                  );
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
                        {effOrient === "horizontal" ? (() => {
                          const hFirstColWidth =
                            typeof block.firstColWidth === "number" && block.firstColWidth > 0
                              ? block.firstColWidth
                              : typeof block.firstColWidth === "string" && parseInt(block.firstColWidth) > 0
                                ? parseInt(block.firstColWidth)
                                : typeof block.parameterWidth === "number" && block.parameterWidth > 0
                                  ? block.parameterWidth
                                  : typeof block.columns?.[0]?.width === "number" && block.columns[0].width > 0
                                    ? block.columns[0].width
                                    : typeof block.columns?.[0]?.width === "string" && parseInt(block.columns[0].width) > 0
                                      ? parseInt(block.columns[0].width)
                                      : 160;

                          const hDataColWidth =
                            typeof block.dataColWidth === "number" && block.dataColWidth > 0
                              ? block.dataColWidth
                              : typeof block.dataColWidth === "string" && parseInt(block.dataColWidth) > 0
                                ? parseInt(block.dataColWidth)
                                : 65;

                          return (
                          <div className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-slate-400 dark:scrollbar-thumb-slate-600 hover:scrollbar-thumb-slate-500 scrollbar-track-slate-100 dark:scrollbar-track-slate-800">
                            <table
                              className="w-full border-collapse text-xs text-center border-slate-300 dark:border-slate-700"
                              style={{ tableLayout: "auto" }}
                            >
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b-2 border-slate-400 dark:border-slate-600 divide-x divide-slate-300 dark:divide-slate-700">
                                  <th
                                    style={{
                                      width: `${hFirstColWidth}px`,
                                      minWidth: `${hFirstColWidth}px`,
                                      maxWidth: `${hFirstColWidth}px`,
                                    }}
                                    className={`group/hth py-2.5 px-2 bg-slate-200 dark:bg-slate-750 font-bold text-slate-900 dark:text-white sticky left-0 z-20 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)] border-r-2 border-slate-400 dark:border-slate-600 select-none overflow-hidden ${
                                      block.columns?.[0]?.align === "left" ? "text-left" : block.columns?.[0]?.align === "right" ? "text-right" : "text-center"
                                    }`}
                                  >
                                    <div className={`flex items-center ${
                                      block.columns?.[0]?.align === "left" ? "justify-between" : block.columns?.[0]?.align === "right" ? "justify-end" : "justify-center"
                                    } gap-1`}>
                                      <span className="whitespace-nowrap truncate">Parameter / Sl no</span>
                                      <span className="text-[10px] font-mono font-normal opacity-0 group-hover/hth:opacity-100 text-slate-500 dark:text-slate-400">
                                        {hFirstColWidth}px
                                      </span>
                                    </div>
                                    {/* Draggable Resizer Handle */}
                                    <div
                                      onMouseDown={(e) =>
                                        handleColResizeStart(
                                          e,
                                          index,
                                          "horizontal_first_col",
                                          hFirstColWidth,
                                          null,
                                        )
                                      }
                                      className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-30 opacity-40 group-hover/hth:opacity-100 transition-opacity flex items-center justify-center"
                                      title="Click & drag to resize Parameter column width"
                                    >
                                      <div className="w-[1.5px] h-3.5 bg-muted-foreground/50 group-hover/hth:bg-primary group-hover/hth:h-5 transition-all rounded" />
                                    </div>
                                  </th>
                                  {block.rows.map((r, rIdx) => (
                                    <th
                                      key={rIdx}
                                      style={{
                                        width: `${hDataColWidth}px`,
                                        minWidth: `${hDataColWidth}px`,
                                      }}
                                      className="relative group/hcol py-2.5 px-2 font-bold text-slate-900 dark:text-white select-none"
                                    >
                                      <div className="flex items-center justify-center gap-1">
                                        {showExcelCoordinates && (
                                          <span
                                            className="inline-block px-1 py-0.2 rounded text-[9px] font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800"
                                            title={`Data Row ${rIdx + 1}`}
                                          >
                                            {`R${rIdx + 1}`}
                                          </span>
                                        )}
                                        <span>
                                          {r.point_number ?? rIdx + 1}
                                        </span>
                                        {block.rows.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const newRows = block.rows.filter(
                                                (_, i) => i !== rIdx,
                                              );
                                              updateBlock(index, {
                                                ...block,
                                                rows: newRows,
                                              });
                                            }}
                                            className="opacity-0 group-hover/hcol:opacity-100 p-0.5 text-slate-400 hover:text-rose-400 rounded transition-opacity"
                                            title={`Delete point ${rIdx + 1}`}
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                          </button>
                                        )}
                                      </div>
                                      {/* Draggable Resizer Handle */}
                                      <div
                                        onMouseDown={(e) =>
                                          handleColResizeStart(
                                            e,
                                            index,
                                            "horizontal_data_col",
                                            hDataColWidth,
                                            null,
                                          )
                                        }
                                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-30 opacity-40 group-hover/hcol:opacity-100 transition-opacity flex items-center justify-center"
                                        title="Click & drag to resize Point columns width"
                                      >
                                        <div className="w-[1.5px] h-3.5 bg-muted-foreground/50 group-hover/hcol:bg-primary group-hover/hcol:h-5 transition-all rounded" />
                                      </div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-300 dark:divide-slate-700 font-mono">
                                {displayCols.map((col, cIdx) => (
                                  <tr
                                    key={col.id}
                                    className="divide-x divide-slate-300 dark:divide-slate-700 hover:bg-indigo-50/20"
                                  >
                                    <td
                                      style={{
                                        width: `${hFirstColWidth}px`,
                                        minWidth: `${hFirstColWidth}px`,
                                        maxWidth: `${hFirstColWidth}px`,
                                      }}
                                      className={`py-2 px-2 font-bold bg-slate-100/90 dark:bg-slate-800/80 text-xs font-sans text-slate-900 dark:text-slate-100 sticky left-0 z-10 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] border-r-2 border-slate-300 dark:border-slate-700 overflow-hidden ${
                                        col.align === "left" ? "text-left" : col.align === "right" ? "text-right" : "text-center"
                                      }`}
                                    >
                                      <div className={`flex items-center ${
                                        col.align === "left" ? "justify-between" : col.align === "right" ? "justify-end" : "justify-center"
                                      }`}>
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                          {showExcelCoordinates && (
                                            <span
                                              className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 shrink-0 shadow-2xs"
                                              title={`Excel Column ${getExcelColumnLetter(block.columns.findIndex((c) => c.id === col.id))}`}
                                            >
                                              {getExcelColumnLetter(block.columns.findIndex((c) => c.id === col.id))}
                                            </span>
                                          )}
                                          <span className="truncate block" title={col.label}>{col.label}</span>
                                        </div>
                                        {col.type === "formula" && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onOpenTableConfig?.(block.id);
                                            }}
                                            className="text-xxs text-primary bg-primary/10 hover:bg-primary/20 px-1 py-0.5 rounded font-bold font-mono ml-1 shrink-0 cursor-pointer border border-primary/30 transition-colors"
                                            title={col.formula ? `Column Formula: ${col.formula}\nClick to configure in Table Configuration` : "Configure Column Formula"}
                                          >
                                            (fx)
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    {block.rows.map((row, rIdx) => {
                                      const hasCustomCellFormula = Boolean(row.cellFormulas?.[col.id]);
                                      const actualColIdx = block.columns.findIndex((c) => c.id === col.id);
                                      const targetColIdx = actualColIdx >= 0 ? actualColIdx : cIdx;

                                      if (col.type === "nominal") {
                                        const cellVal =
                                          row[col.id] !== undefined
                                            ? row[col.id]
                                            : col.id === "nominal"
                                              ? row.nominal
                                              : "";
                                        return (
                                          <td
                                            key={rIdx}
                                            style={{
                                              width: `${hDataColWidth}px`,
                                              minWidth: `${hDataColWidth}px`,
                                            }}
                                            onContextMenu={(e) =>
                                              handleOpenCellMenu(
                                                e,
                                                index,
                                                null,
                                                rIdx,
                                                col.id,
                                                col.label || col.id,
                                                targetColIdx,
                                                block.columns.length,
                                                1,
                                                1,
                                                block.rows.length,
                                              )
                                            }
                                            className="py-1 px-1.5 relative group/cell"
                                          >
                                            <div className="relative w-full">
                                              <Input
                                                type="text"
                                                value={cellVal ?? ""}
                                                onChange={(e) => {
                                                  const v = e.target.value;
                                                  if (
                                                    v === "" ||
                                                    /^[+-]?\d*\.?\d*$/.test(v)
                                                  ) {
                                                    handleTableCellChange(
                                                      index,
                                                      rIdx,
                                                      col.id,
                                                      v,
                                                    );
                                                  }
                                                }}
                                                onBlur={(e) => {
                                                  const raw =
                                                    e.target.value.trim();
                                                  if (
                                                    raw === "" ||
                                                    raw === "-" ||
                                                    raw === "+" ||
                                                    raw === "."
                                                  )
                                                    return;
                                                  const parsed = parseFloat(raw);
                                                  if (!isNaN(parsed)) {
                                                    const colDec =
                                                      col.decimal_places ??
                                                      col.decimalPrecision ??
                                                      block.decimal_places ??
                                                      decimalPlaces ??
                                                      3;
                                                    const formatted =
                                                      colDec === 0
                                                        ? String(
                                                            Math.round(parsed),
                                                          )
                                                        : parsed.toFixed(colDec);
                                                    handleTableCellChange(
                                                      index,
                                                      rIdx,
                                                      col.id,
                                                      formatted,
                                                    );
                                                  }
                                                }}
                                                className="h-7.5 text-xs text-center bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-md px-1.5 font-metrology font-bold hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-slate-100 shadow-2xs"
                                                placeholder="0"
                                              />
                                            </div>

                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenCellMenu(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                  col.label || col.id,
                                                  targetColIdx,
                                                  block.columns.length,
                                                  1,
                                                  1,
                                                  block.rows.length,
                                                )
                                              }
                                              className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                              title="Formula & Cell options (or right-click)"
                                            >
                                              <MoreHorizontal className="w-2.5 h-2.5" />
                                            </button>
                                          </td>
                                        );
                                      }
                                      if (col.type === "text") {
                                        const cellVal =
                                          row[col.id] ??
                                          (col.id === "description"
                                            ? row.description
                                            : "") ??
                                          "";
                                        return (
                                          <td
                                            key={rIdx}
                                            style={{
                                              width: `${hDataColWidth}px`,
                                              minWidth: `${hDataColWidth}px`,
                                            }}
                                            onContextMenu={(e) =>
                                              handleOpenCellMenu(
                                                e,
                                                index,
                                                null,
                                                rIdx,
                                                col.id,
                                                col.label || col.id,
                                                targetColIdx,
                                                block.columns.length,
                                                1,
                                                1,
                                                block.rows.length,
                                              )
                                            }
                                            className="py-1 px-1.5 relative group/cell"
                                          >
                                            <Input
                                              value={cellVal}
                                              onChange={(e) => {
                                                const isSpecCol =
                                                  col.id === "required_dimension" ||
                                                  col.id === "specification" ||
                                                  col.id === "description" ||
                                                  col.id === "nominal" ||
                                                  /spec|dimension/i.test(col.id || col.label || "");
                                                if (isSpecCol) {
                                                  handleTableCellChange(
                                                    index,
                                                    rIdx,
                                                    col.id,
                                                    e.target.value,
                                                  );
                                                } else {
                                                  const newRows = [...block.rows];
                                                  newRows[rIdx] = {
                                                    ...newRows[rIdx],
                                                    [col.id]: e.target.value,
                                                    ...(col.id === "description"
                                                      ? {
                                                          description:
                                                            e.target.value,
                                                        }
                                                      : {}),
                                                  };
                                                  updateBlock(index, {
                                                    ...block,
                                                    rows: newRows,
                                                  });
                                                }
                                              }}
                                              className="h-7.5 text-xs text-center bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-md px-1.5 font-sans font-medium hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-slate-100 shadow-2xs"
                                              placeholder={col.label || "Desc"}
                                            />

                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenCellMenu(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                  col.label || col.id,
                                                  targetColIdx,
                                                  block.columns.length,
                                                  1,
                                                  1,
                                                  block.rows.length,
                                                )
                                              }
                                              className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                              title="Formula & Cell options (or right-click)"
                                            >
                                              <MoreHorizontal className="w-2.5 h-2.5" />
                                            </button>
                                          </td>
                                        );
                                      }
                                      if (
                                        col.type === "reading" ||
                                        col.type === "trial"
                                      ) {
                                        const cellVal =
                                          row[col.id] ??
                                          (col.id === "reading"
                                            ? row.reading
                                            : "") ??
                                          "";
                                        return (
                                          <td
                                            key={rIdx}
                                            style={{
                                              width: `${hDataColWidth}px`,
                                              minWidth: `${hDataColWidth}px`,
                                            }}
                                            onContextMenu={(e) =>
                                              handleOpenCellMenu(
                                                e,
                                                index,
                                                null,
                                                rIdx,
                                                col.id,
                                                col.label || col.id,
                                                targetColIdx,
                                                block.columns.length,
                                                1,
                                                1,
                                                block.rows.length,
                                              )
                                            }
                                            className="py-1 px-1.5 relative group/cell"
                                          >
                                            <div className="flex items-center justify-center gap-1">
                                              {hasCustomCellFormula && (
                                                <span
                                                  className="text-[9px] px-1 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono rounded font-bold cursor-pointer hover:bg-purple-200"
                                                  title={`Custom formula: ${row.cellFormulas[col.id]}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCellFormulaModalState({
                                                      blockIndex: index,
                                                      childIndex: null,
                                                      rowIndex: rIdx,
                                                      colId: col.id,
                                                      colLabel: col.label || col.id,
                                                      initialFormula: row.cellFormulas[col.id] || "",
                                                    });
                                                  }}
                                                >
                                                  fx
                                                </span>
                                              )}
                                              <Input
                                                value={cellVal}
                                                onChange={(e) => {
                                                  const v = e.target.value;
                                                  if (
                                                    v === "" ||
                                                    /^[+-]?\d*\.?\d*$/.test(v)
                                                  ) {
                                                    handleTableCellChange(
                                                      index,
                                                      rIdx,
                                                      col.id,
                                                      v,
                                                    );
                                                  }
                                                }}
                                                onBlur={(e) => {
                                                  const raw =
                                                    e.target.value.trim();
                                                  if (
                                                    raw === "" ||
                                                    raw === "-" ||
                                                    raw === "+" ||
                                                    raw === "."
                                                  )
                                                    return;
                                                  const parsed = parseFloat(raw);
                                                  if (!isNaN(parsed)) {
                                                    const colDec =
                                                      col.decimal_places ??
                                                      col.decimalPrecision ??
                                                      block.decimal_places ??
                                                      decimalPlaces ??
                                                      3;
                                                    const formatted =
                                                      colDec === 0
                                                        ? String(
                                                            Math.round(parsed),
                                                          )
                                                        : parsed.toFixed(colDec);
                                                    handleTableCellChange(
                                                      index,
                                                      rIdx,
                                                      col.id,
                                                      formatted,
                                                    );
                                                  }
                                                }}
                                                className="h-7.5 text-xs text-center bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-md px-1.5 font-metrology font-medium hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-slate-100 shadow-2xs"
                                                placeholder="0.00"
                                              />
                                            </div>

                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenCellMenu(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                  col.label || col.id,
                                                  targetColIdx,
                                                  block.columns.length,
                                                  1,
                                                  1,
                                                  block.rows.length,
                                                )
                                              }
                                              className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                              title="Formula & Cell options (or right-click)"
                                            >
                                              <MoreHorizontal className="w-2.5 h-2.5" />
                                            </button>
                                          </td>
                                        );
                                      }
                                      if (col.type === "tolerance") {
                                        const cellVal =
                                          row[col.id] ??
                                          (col.id === "tolerance"
                                            ? row.tolerance
                                            : "") ??
                                          "";
                                        return (
                                          <td
                                            key={rIdx}
                                            style={{
                                              width: `${hDataColWidth}px`,
                                              minWidth: `${hDataColWidth}px`,
                                            }}
                                            onContextMenu={(e) =>
                                              handleOpenCellMenu(
                                                e,
                                                index,
                                                null,
                                                rIdx,
                                                col.id,
                                                col.label || col.id,
                                                targetColIdx,
                                                block.columns.length,
                                                1,
                                                1,
                                                block.rows.length,
                                              )
                                            }
                                            className="py-1 px-1.5 relative group/cell"
                                          >
                                            <Input
                                              value={cellVal}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                if (
                                                  v === "" ||
                                                  /^[+-]?\d*\.?\d*$/.test(v)
                                                ) {
                                                  handleTableCellChange(
                                                    index,
                                                    rIdx,
                                                    col.id,
                                                    v,
                                                  );
                                                }
                                              }}
                                              onBlur={(e) => {
                                                const raw =
                                                  e.target.value.trim();
                                                if (
                                                  raw === "" ||
                                                  raw === "-" ||
                                                  raw === "+" ||
                                                  raw === "."
                                                )
                                                  return;
                                                const parsed = parseFloat(raw);
                                                if (!isNaN(parsed)) {
                                                  const colDec =
                                                    col.decimal_places ??
                                                    col.decimalPrecision ??
                                                    block.decimal_places ??
                                                    decimalPlaces ??
                                                    3;
                                                  const formatted =
                                                    colDec === 0
                                                      ? String(
                                                          Math.round(parsed),
                                                        )
                                                      : parsed.toFixed(colDec);
                                                  handleTableCellChange(
                                                    index,
                                                    rIdx,
                                                    col.id,
                                                    formatted,
                                                  );
                                                }
                                              }}
                                              className="h-7.5 text-xs text-center bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-md px-1.5 font-metrology font-medium hover:border-primary/60 focus:border-primary focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-slate-100 shadow-2xs"
                                              placeholder="±Tol"
                                            />

                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenCellMenu(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                  col.label || col.id,
                                                  targetColIdx,
                                                  block.columns.length,
                                                  1,
                                                  1,
                                                  block.rows.length,
                                                )
                                              }
                                              className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                              title="Formula & Cell options (or right-click)"
                                            >
                                              <MoreHorizontal className="w-2.5 h-2.5" />
                                            </button>
                                          </td>
                                        );
                                      }
                                      const isManualJudge =
                                        !hasCustomCellFormula &&
                                        (Boolean(col.isManualJudgement) ||
                                          (col as any).judgementMode === "manual" ||
                                          ((col.type === "status" || col.role === "JUDGEMENT" || col.label?.toLowerCase().includes("judg")) && !col.formula));

                                      if (isManualJudge) {
                                        const cellVal = row[col.id] ?? row.status ?? row.judgement ?? "OK";
                                        return (
                                          <td
                                            key={rIdx}
                                            style={{
                                              width: `${hDataColWidth}px`,
                                              minWidth: `${hDataColWidth}px`,
                                            }}
                                            onContextMenu={(e) =>
                                              handleOpenCellMenu(
                                                e,
                                                index,
                                                null,
                                                rIdx,
                                                col.id,
                                                col.label || col.id,
                                                targetColIdx,
                                                block.columns.length,
                                                1,
                                                1,
                                                block.rows.length,
                                              )
                                            }
                                            className="py-1 px-1.5 relative group/cell"
                                          >
                                            <JudgementCellControl
                                              value={cellVal}
                                              onChange={(newVal) => {
                                                handleTableCellChange(index, rIdx, col.id, newVal);
                                              }}
                                            />

                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenCellMenu(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                  col.label || col.id,
                                                  targetColIdx,
                                                  block.columns.length,
                                                  1,
                                                  1,
                                                  block.rows.length,
                                                )
                                              }
                                              className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                              title="Formula & Cell options (or right-click)"
                                            >
                                              <MoreHorizontal className="w-2.5 h-2.5" />
                                            </button>
                                          </td>
                                        );
                                      }
                                      const evaluated = evaluatePreviewCell(
                                        row,
                                        col,
                                        block.decimal_places ?? decimalPlaces,
                                        block.columns,
                                        (block as TableGridBlock).nominal,
                                        rIdx,
                                        block.rows,
                                        (block as TableGridBlock).tolerance,
                                      );
                                      const isJudgementCol =
                                        col.type === "status" ||
                                        col.role === "JUDGEMENT" ||
                                        col.label
                                          .toLowerCase()
                                          .includes("judg");
                                      if (isJudgementCol && evaluated) {
                                        const isPass =
                                          String(evaluated)
                                            .trim()
                                            .toUpperCase() === "PASS";
                                        const isFail =
                                          String(evaluated)
                                            .trim()
                                            .toUpperCase() === "FAIL";
                                        return (
                                          <td
                                            key={rIdx}
                                            style={{
                                              width: `${hDataColWidth}px`,
                                              minWidth: `${hDataColWidth}px`,
                                            }}
                                            onContextMenu={(e) =>
                                              handleOpenCellMenu(
                                                e,
                                                index,
                                                null,
                                                rIdx,
                                                col.id,
                                                col.label || col.id,
                                                targetColIdx,
                                                block.columns.length,
                                                1,
                                                1,
                                                block.rows.length,
                                              )
                                            }
                                            className="py-1 px-1.5 relative group/cell"
                                          >
                                            <div className="flex items-center justify-center gap-1">
                                              {hasCustomCellFormula && (
                                                <span
                                                  className="text-[9px] px-1 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono rounded font-bold cursor-pointer hover:bg-purple-200"
                                                  title={`Custom formula: ${row.cellFormulas[col.id]}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCellFormulaModalState({
                                                      blockIndex: index,
                                                      childIndex: null,
                                                      rowIndex: rIdx,
                                                      colId: col.id,
                                                      colLabel: col.label || col.id,
                                                      initialFormula: row.cellFormulas[col.id] || "",
                                                    });
                                                  }}
                                                >
                                                  fx
                                                </span>
                                              )}
                                              {typeof evaluated === "object" ? (
                                                evaluated
                                              ) : (
                                                (() => {
                                                  const strVal = String(evaluated).trim().toUpperCase();
                                                  const isPassStr = strVal === "PASS" || strVal === "OK";
                                                  const isFailStr = strVal === "FAIL" || strVal === "NOT OK" || strVal === "REJECT";
                                                  return isPassStr ? (
                                                    <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-700 shadow-2xs">
                                                      PASS
                                                    </span>
                                                  ) : isFailStr ? (
                                                    <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-400 dark:border-rose-700 shadow-2xs">
                                                      FAIL
                                                    </span>
                                                  ) : (
                                                    <span className="font-metrology text-xs text-slate-400">
                                                      {evaluated}
                                                    </span>
                                                  );
                                                })()
                                              )}
                                            </div>

                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenCellMenu(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                  col.label || col.id,
                                                  targetColIdx,
                                                  block.columns.length,
                                                  1,
                                                  1,
                                                  block.rows.length,
                                                )
                                              }
                                              className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                              title="Formula & Cell options (or right-click)"
                                            >
                                              <MoreHorizontal className="w-2.5 h-2.5" />
                                            </button>
                                          </td>
                                        );
                                      }
                                      return (
                                        <td
                                          key={rIdx}
                                          style={{
                                            width: `${hDataColWidth}px`,
                                            minWidth: `${hDataColWidth}px`,
                                          }}
                                          onContextMenu={(e) =>
                                            handleOpenCellMenu(
                                              e,
                                              index,
                                              null,
                                              rIdx,
                                              col.id,
                                              col.label || col.id,
                                              targetColIdx,
                                              block.columns.length,
                                              1,
                                              1,
                                              block.rows.length,
                                            )
                                          }
                                          className="py-1.5 px-2 relative group/cell"
                                        >
                                          <div className="flex items-center justify-center gap-1">
                                            {hasCustomCellFormula && (
                                              <span
                                                className="text-[9px] px-1 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono rounded font-bold cursor-pointer hover:bg-purple-200"
                                                title={`Custom formula: ${row.cellFormulas[col.id]}`}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setCellFormulaModalState({
                                                    blockIndex: index,
                                                    childIndex: null,
                                                    rowIndex: rIdx,
                                                    colId: col.id,
                                                    colLabel: col.label || col.id,
                                                    initialFormula: row.cellFormulas[col.id] || "",
                                                  });
                                                }}
                                              >
                                                fx
                                              </span>
                                            )}
                                            <span className="text-slate-900 dark:text-slate-100 font-metrology text-xs font-bold">
                                              {evaluated}
                                            </span>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={(e) =>
                                              handleOpenCellMenu(
                                                e,
                                                index,
                                                null,
                                                rIdx,
                                                col.id,
                                                col.label || col.id,
                                                targetColIdx,
                                                block.columns.length,
                                                1,
                                                1,
                                                block.rows.length,
                                              )
                                            }
                                            className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                            title="Formula & Cell options (or right-click)"
                                          >
                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                          </button>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          );
                        })() : (
                          /* VERTICAL STANDARD VIEW */
                          <div className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-slate-400 dark:scrollbar-thumb-slate-600 hover:scrollbar-thumb-slate-500 scrollbar-track-slate-100 dark:scrollbar-track-slate-800">
                            <table className="w-full border-collapse text-xs text-center border-border">
                              <thead>
                                {(() => {
                                  const renderTh = (col: CanvasColumnDef, colIdx: number, rowSpan: number = 1) => {
                                    const isPointNo =
                                      col.id === "point_number" ||
                                      col.id === "sl_no" ||
                                      col.id === "sino";
                                    const isDragTarget =
                                      dragOverCol &&
                                      dragOverCol.blockIdx === index &&
                                      dragOverCol.childIdx === null &&
                                      dragOverCol.colIdx === colIdx;

                                    return (
                                      <th
                                        key={col.id}
                                        rowSpan={rowSpan > 1 ? rowSpan : undefined}
                                        draggable={!isPointNo}
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData("text/plain", String(colIdx));
                                          setDraggedCol({ blockIdx: index, childIdx: null, colIdx });
                                        }}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          if (draggedCol && draggedCol.blockIdx === index && draggedCol.childIdx === null) {
                                            setDragOverCol({ blockIdx: index, childIdx: null, colIdx });
                                          }
                                        }}
                                        onDragLeave={() => {
                                          setDragOverCol(null);
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          if (
                                            draggedCol &&
                                            draggedCol.blockIdx === index &&
                                            draggedCol.childIdx === null &&
                                            draggedCol.colIdx !== colIdx
                                          ) {
                                            handleReorderColumns(index, null, draggedCol.colIdx, colIdx);
                                          }
                                          setDraggedCol(null);
                                          setDragOverCol(null);
                                        }}
                                        onContextMenu={(e) => {
                                          if (!isPointNo) {
                                            handleOpenHeaderGroupMenu(
                                              e,
                                              index,
                                              null,
                                              col.id,
                                              col.label || col.id,
                                              colIdx,
                                              block.columns.length,
                                              col.groupName,
                                            );
                                          }
                                        }}
                                        style={{
                                          width: col.width,
                                          minWidth:
                                            col.width ||
                                            (isPointNo ? "60px" : "95px"),
                                        }}
                                        className={`relative group/th py-2 px-2.5 font-semibold text-tiny uppercase tracking-wider select-none text-muted-foreground transition-all ${
                                          isPointNo
                                            ? "sticky left-0 z-20 bg-muted/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.08)] border-r border-border"
                                            : "bg-muted/40"
                                        } ${isDragTarget ? "bg-primary/20 ring-2 ring-primary/40" : ""}`}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          {!isPointNo && (
                                            <GripVertical className="w-2.5 h-2.5 opacity-0 group-hover/th:opacity-60 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
                                          )}
                                          <span>{col.label}</span>
                                          {col.type === "formula" && (
                                            <span className="px-1 py-0.2 rounded text-2xs font-mono font-bold bg-primary/15 text-primary border border-primary/30">
                                              fx
                                            </span>
                                          )}
                                          {!isPointNo && (
                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenHeaderGroupMenu(
                                                  e,
                                                  index,
                                                  null,
                                                  col.id,
                                                  col.label || col.id,
                                                  colIdx,
                                                  block.columns.length,
                                                  col.groupName,
                                                )
                                              }
                                              className={`opacity-0 group-hover/th:opacity-100 p-0.5 rounded text-xxs transition-opacity cursor-pointer ${
                                                col.groupName
                                                  ? "text-indigo-600 dark:text-indigo-400 opacity-100 font-bold"
                                                  : "text-slate-400 hover:text-indigo-600"
                                              }`}
                                              title={
                                                col.groupName
                                                  ? `Group: ${col.groupName} (Right-click or click to edit/unmerge)`
                                                  : "Merge header with next column / Create super-header"
                                              }
                                            >
                                              <Columns className="w-2.5 h-2.5" />
                                            </button>
                                          )}
                                          {!isPointNo && colIdx > (block.columns.some((c) => c.id === "point_number" || c.id === "sl_no") ? 1 : 0) && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleReorderColumns(index, null, colIdx, colIdx - 1);
                                              }}
                                              className="opacity-0 group-hover/th:opacity-100 p-0.5 hover:text-primary rounded text-xxs transition-opacity"
                                              title="Move column left"
                                            >
                                              <ChevronLeft className="w-2.5 h-2.5" />
                                            </button>
                                          )}
                                          {!isPointNo && colIdx < block.columns.length - 1 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleReorderColumns(index, null, colIdx, colIdx + 1);
                                              }}
                                              className="opacity-0 group-hover/th:opacity-100 p-0.5 hover:text-primary rounded text-xxs transition-opacity"
                                              title="Move column right"
                                            >
                                              <ChevronRight className="w-2.5 h-2.5" />
                                            </button>
                                          )}
                                          {!isPointNo && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleCopyColumn(block as TableGridBlock, col.id, col.label || col.id);
                                              }}
                                              className="opacity-0 group-hover/th:opacity-100 p-0.5 hover:text-primary rounded text-xxs transition-opacity text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                              title={`Copy all values from "${col.label || col.id}"`}
                                            >
                                              <ClipboardCopy className="w-2.5 h-2.5" />
                                            </button>
                                          )}
                                          {!isPointNo && col.type !== "formula" && col.type !== "status" && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenPasteModal(index, null, block as TableGridBlock, col.id);
                                              }}
                                              className="opacity-0 group-hover/th:opacity-100 p-0.5 hover:text-primary rounded text-xxs transition-opacity text-primary"
                                              title={`Paste values into "${col.label || col.id}"`}
                                            >
                                              <ClipboardPaste className="w-2.5 h-2.5" />
                                            </button>
                                          )}
                                        </div>
                                        {/* Draggable Resizer Handle */}
                                        <div
                                          onMouseDown={(e) =>
                                            handleColResizeStart(
                                              e,
                                              index,
                                              col.id,
                                              col.width,
                                            )
                                          }
                                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-30 opacity-40 group-hover/th:opacity-100 transition-opacity flex items-center justify-center"
                                          title="Click & drag to resize column width"
                                        >
                                          <div className="w-[1.5px] h-3.5 bg-muted-foreground/50 group-hover/th:bg-primary group-hover/th:h-5 transition-all rounded" />
                                        </div>
                                      </th>
                                    );
                                  };

                                  const headerGroups = computeHeaderGroups(block.columns || []);

                                  const renderExcelCoordinateRow = () => {
                                    if (!showExcelCoordinates) return null;
                                    return (
                                      <tr className="bg-slate-100/90 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 font-mono text-[11px] font-bold border-b border-border divide-x divide-border select-none">
                                        {block.columns.map((col, cIdx) => (
                                          <th
                                            key={`excel_col_${col.id || cIdx}`}
                                            style={{
                                              width: col.width,
                                              minWidth:
                                                col.width ||
                                                (col.id === "point_number" || col.id === "sl_no" || col.id === "sino"
                                                  ? "60px"
                                                  : "95px"),
                                            }}
                                            className="py-1 px-1 text-center font-mono font-bold tracking-wider bg-slate-150 dark:bg-slate-850 hover:bg-purple-100/60 dark:hover:bg-purple-950/40 text-slate-600 dark:text-slate-300 transition-colors"
                                            title={`Excel Column ${getExcelColumnLetter(cIdx)} (${col.label || col.id})`}
                                          >
                                            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold font-mono text-purple-700 dark:text-purple-300 bg-purple-50/90 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 shadow-2xs">
                                              {getExcelColumnLetter(cIdx)}
                                            </span>
                                          </th>
                                        ))}
                                      </tr>
                                    );
                                  };

                                  if (!headerGroups.hasGroups) {
                                    return (
                                      <>
                                        {renderExcelCoordinateRow()}
                                        <tr className="bg-muted/40 font-semibold border-b text-muted-foreground divide-x divide-border">
                                          {block.columns.map((col, colIdx) => renderTh(col, colIdx, 1))}
                                        </tr>
                                      </>
                                    );
                                  }

                                  return (
                                    <>
                                      {renderExcelCoordinateRow()}
                                      <tr className="bg-slate-100 dark:bg-slate-800/90 font-bold border-b border-border text-slate-800 dark:text-slate-200 divide-x divide-border">
                                        {headerGroups.topRow.map((topItem, topIdx) => {
                                          if (topItem.type === "group") {
                                            const firstCol = topItem.columns[0];
                                            const firstColIdx = block.columns.findIndex((c) => c.id === firstCol.id);
                                            return (
                                              <th
                                                key={`grp_${topIdx}`}
                                                colSpan={topItem.colSpan}
                                                onContextMenu={(e) =>
                                                  handleOpenHeaderGroupMenu(
                                                    e,
                                                    index,
                                                    null,
                                                    firstCol.id,
                                                    topItem.groupName || "",
                                                    firstColIdx,
                                                    block.columns.length,
                                                    topItem.groupName,
                                                    true,
                                                    topItem.colSpan,
                                                  )
                                                }
                                                className="py-1 px-2 text-center text-xs font-bold uppercase tracking-wider bg-slate-200/80 dark:bg-slate-750 text-slate-800 dark:text-slate-200 border-b border-border relative group/grp"
                                              >
                                                <div className="flex items-center justify-center gap-1.5">
                                                  <span className="truncate max-w-[200px]">{topItem.groupName}</span>
                                                  <button
                                                    type="button"
                                                    onClick={(e) =>
                                                      handleOpenHeaderGroupMenu(
                                                        e,
                                                        index,
                                                        null,
                                                        firstCol.id,
                                                        topItem.groupName || "",
                                                        firstColIdx,
                                                        block.columns.length,
                                                        topItem.groupName,
                                                        true,
                                                        topItem.colSpan,
                                                      )
                                                    }
                                                    className="opacity-0 group-hover/grp:opacity-100 p-0.5 hover:text-indigo-600 rounded text-xxs transition-opacity cursor-pointer"
                                                    title="Group Header Options (Edit / Unmerge)"
                                                  >
                                                    <MoreHorizontal className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              </th>
                                            );
                                          }
                                          const col = topItem.columns[0];
                                          const colIdx = block.columns.findIndex((c) => c.id === col.id);
                                          return renderTh(col, colIdx, 2);
                                        })}
                                      </tr>
                                      <tr className="bg-muted/40 font-semibold border-b text-muted-foreground divide-x divide-border">
                                        {headerGroups.subRowColumns.map((col) => {
                                          const colIdx = block.columns.findIndex((c) => c.id === col.id);
                                          return renderTh(col, colIdx, 1);
                                        })}
                                      </tr>
                                    </>
                                  );
                                })()}
                              </thead>
                              <tbody className="divide-y divide-border">
                                {(() => {
                                  const coveredCells = getCoveredCells(block.rows, block.columns);
                                  return block.rows.map((row, rIdx) => {
                                  if (row.is_merged || row.isMerged) {
                                    const isPointNoCol = block.columns.find(
                                      (c) =>
                                        c.id === "point_number" ||
                                        c.id === "sl_no" ||
                                        c.id === "sino",
                                    );
                                    const statementVal =
                                      row.statement ??
                                      row.merged_text ??
                                      row.description ??
                                      row.nominal ??
                                      "";
                                    return (
                                      <tr
                                        key={rIdx}
                                        className="divide-x divide-border bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/40 dark:hover:bg-amber-900/30 transition-colors group/row"
                                      >
                                        <td
                                          style={{
                                            width: isPointNoCol?.width,
                                            minWidth:
                                              isPointNoCol?.width || "60px",
                                          }}
                                          className="py-1.5 px-2 text-xs font-semibold text-muted-foreground sticky left-0 z-10 bg-amber-100/60 dark:bg-amber-950/60 border-r border-border"
                                        >
                                          <div className="flex items-center justify-center gap-1">
                                            <span>
                                              {row.point_number ?? rIdx + 1}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleMergeRow(
                                                  index,
                                                  null,
                                                  rIdx,
                                                );
                                              }}
                                              className="p-0.5 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 rounded transition-opacity"
                                              title="Unmerge row back to normal columns"
                                            >
                                              <Merge className="w-2.5 h-2.5 rotate-180" />
                                            </button>
                                            {block.rows.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const newRows =
                                                    block.rows.filter(
                                                      (_, i) => i !== rIdx,
                                                    );
                                                  updateBlock(index, {
                                                    ...block,
                                                    rows: newRows,
                                                  });
                                                }}
                                                className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground hover:text-rose-500 rounded transition-opacity"
                                                title={`Delete row ${rIdx + 1}`}
                                              >
                                                <Trash2 className="w-2.5 h-2.5" />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                        <td
                                          colSpan={Math.max(
                                            1,
                                            block.columns.length - 1,
                                          )}
                                          className="py-1 px-2.5"
                                        >
                                          <div className="flex items-center gap-2">
                                            <Badge
                                              variant="outline"
                                              className="shrink-0 text-2xs py-0 px-1.5 font-bold bg-amber-100/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                                            >
                                              Merged Statement
                                            </Badge>
                                            <Input
                                              type="text"
                                              value={statementVal}
                                              onChange={(e) => {
                                                const newRows = [...block.rows];
                                                newRows[rIdx] = {
                                                  ...newRows[rIdx],
                                                  statement: e.target.value,
                                                  merged_text: e.target.value,
                                                  description: e.target.value,
                                                };
                                                updateBlock(index, {
                                                  ...block,
                                                  rows: newRows,
                                                });
                                              }}
                                              className="h-7 w-full text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded px-2 font-medium text-slate-800 dark:text-slate-100"
                                              placeholder='e.g., "All the jaws are free from dent and damages"'
                                            />
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  }

                                  return (
                                    <tr
                                      key={rIdx}
                                      className="divide-x divide-border hover:bg-muted/20 transition-colors group/row"
                                    >
                                      {block.columns.map((col, cIdx) => {
                                        if (coveredCells.has(`${rIdx}_${col.id}`)) {
                                          return null;
                                        }
                                        const spanInfo = row.cellSpans?.[col.id];
                                        const span = spanInfo?.colSpan || 1;
                                        const rSpan = spanInfo?.rowSpan || 1;
                                        const isMergedCell = span > 1 || rSpan > 1;

                                        const isPointNo =
                                          col.id === "point_number" ||
                                          col.id === "sl_no" ||
                                          col.id === "sino";
                                        if (isPointNo) {
                                          return (
                                            <td
                                              key={col.id}
                                              colSpan={span > 1 ? span : undefined}
                                              rowSpan={rSpan > 1 ? rSpan : undefined}
                                              style={{
                                                width: col.width,
                                                minWidth:
                                                  col.width || "60px",
                                              }}
                                              className="py-1.5 px-2 text-xs font-semibold text-muted-foreground sticky left-0 z-10 bg-card/90 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.06)] border-r border-border"
                                            >
                                              <div className="flex items-center justify-center gap-1">
                                                <span>
                                                  {row.point_number ?? rIdx + 1}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleMergeRow(
                                                      index,
                                                      null,
                                                      rIdx,
                                                    );
                                                  }}
                                                  className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground hover:text-amber-600 rounded transition-opacity"
                                                  title="Merge row across all columns for statement/notes"
                                                >
                                                  <Merge className="w-2.5 h-2.5" />
                                                </button>
                                                {block.rows.length > 1 && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const newRows =
                                                        block.rows.filter(
                                                          (_, i) => i !== rIdx,
                                                        );
                                                      updateBlock(index, {
                                                        ...block,
                                                        rows: newRows,
                                                      });
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

                                        // MERGED CELL (span > 1 || rSpan > 1)
                                        if (isMergedCell) {
                                          const cellVal = row[col.id] !== undefined ? row[col.id] : (col.id === "nominal" ? row.nominal : "") ?? "";
                                          const borderClass = (span > 1 && rSpan > 1)
                                            ? "border-2 border-dashed border-purple-500/80 bg-purple-50/50 dark:bg-purple-950/20"
                                            : span > 1
                                            ? "border-2 border-dashed border-amber-400/80 bg-amber-50/50 dark:bg-amber-950/20"
                                            : "border-2 border-dashed border-indigo-400/80 bg-indigo-50/50 dark:bg-indigo-950/20";

                                          return (
                                            <td
                                              key={col.id}
                                              colSpan={span > 1 ? span : undefined}
                                              rowSpan={rSpan > 1 ? rSpan : undefined}
                                              onContextMenu={(e) =>
                                                handleOpenCellMenu(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                  col.label || col.id,
                                                  cIdx,
                                                  block.columns.length,
                                                  span,
                                                  rSpan,
                                                  block.rows.length,
                                                )
                                              }
                                              className={`py-1 px-1.5 align-middle relative group/cell ${borderClass}`}
                                            >
                                              {/* Action buttons pinned to top right so they never squeeze inputs */}
                                              <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-40 group-hover/cell:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-slate-900/80 rounded px-0.5 shadow-xs">
                                                <button
                                                  type="button"
                                                  onClick={(e) =>
                                                    handleOpenCellMenu(
                                                      e,
                                                      index,
                                                      null,
                                                      rIdx,
                                                      col.id,
                                                      col.label || col.id,
                                                      cIdx,
                                                      block.columns.length,
                                                      span,
                                                      rSpan,
                                                      block.rows.length,
                                                    )
                                                  }
                                                  className="p-0.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded transition-colors"
                                                  title="Cell merge menu (or right-click)"
                                                >
                                                  <MoreHorizontal className="w-3 h-3" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleResetCellSpans(index, null, rIdx, col.id)}
                                                  className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                                                  title="Unmerge cells back to normal individual cells"
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </div>

                                              <div className={`w-full flex ${rSpan > 1 ? "flex-col items-center justify-center gap-1.5 py-1" : "items-center gap-1.5 pr-12"}`}>
                                                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-center">
                                                  {span > 1 && (
                                                    <Badge
                                                      variant="outline"
                                                      className="shrink-0 text-[10px] py-0 px-1 font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                                                      title={`Merged across ${span} columns`}
                                                    >
                                                      {span} Cols
                                                    </Badge>
                                                  )}
                                                  {rSpan > 1 && (
                                                    <Badge
                                                      variant="outline"
                                                      className="shrink-0 text-[10px] py-0 px-1 font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700"
                                                      title={`Merged down ${rSpan} rows`}
                                                    >
                                                      {rSpan} Rows
                                                    </Badge>
                                                  )}
                                                </div>
                                                <Input
                                                  type="text"
                                                  value={cellVal ?? ""}
                                                  onPaste={(e) =>
                                                    handleCellPaste(
                                                      e,
                                                      index,
                                                      null,
                                                      rIdx,
                                                      col.id,
                                                    )
                                                  }
                                                  onChange={(e) => {
                                                    handleTableCellChange(
                                                      index,
                                                      rIdx,
                                                      col.id,
                                                      e.target.value,
                                                    );
                                                  }}
                                                  onBlur={(e) => {
                                                    const raw = e.target.value.trim();
                                                    if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                    const parsed = parseFloat(raw);
                                                    if (!isNaN(parsed) && (col.type === "reading" || col.type === "trial" || col.type === "nominal")) {
                                                      const colDec =
                                                        col.decimal_places ??
                                                        col.decimalPrecision ??
                                                        block.decimal_places ??
                                                        decimalPlaces ??
                                                        3;
                                                      const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                      handleTableCellChange(index, rIdx, col.id, formatted);
                                                    }
                                                  }}
                                                  className={`h-7 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-primary rounded px-2 ${
                                                    rSpan > 1 ? "w-full text-center" : "flex-1 min-w-[50px] text-center"
                                                  }`}
                                                  placeholder={col.type === "reading" || col.type === "trial" ? "0.00" : (col.label || "Value")}
                                                />
                                              </div>
                                            </td>
                                          );
                                        }
                                        if (col.type === "nominal") {
                                          const cellVal =
                                            row[col.id] !== undefined
                                              ? row[col.id]
                                              : col.id === "nominal"
                                                ? row.nominal
                                                : "";
                                          return (
                                            <td
                                              key={col.id}
                                              style={{
                                                width: col.width,
                                                minWidth: col.width || "95px",
                                              }}
                                               onContextMenu={(e) => handleOpenCellMenu(e, index, null, rIdx, col.id, col.label || col.id, cIdx, block.columns.length, 1, 1, block.rows.length)}
                                               className="py-1 px-1 relative group/cell"
                                            >
                                               {row.cellFormulas?.[col.id] && (
                                                 <span
                                                   className="absolute top-0.5 left-0.5 px-1 py-0.2 text-[8px] font-mono font-bold bg-purple-100 dark:bg-purple-900/70 text-purple-700 dark:text-purple-300 rounded pointer-events-none z-10"
                                                   title={`Formula: ${row.cellFormulas[col.id]}`}
                                                 >
                                                   fx
                                                 </span>
                                               )}
                                               {(cIdx < block.columns.length - 1 || rIdx < block.rows.length - 1) && (
                                                  <button
                                                   type="button"
                                                   onClick={(e) =>
                                                      handleOpenCellMenu(
                                                        e,
                                                        index,
                                                        null,
                                                        rIdx,
                                                        col.id,
                                                        col.label || col.id,
                                                        cIdx,
                                                        block.columns.length,
                                                        1,
                                                        1,
                                                        block.rows.length,
                                                      )
                                                    }
                                                   className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-300 rounded-[3px] transition-all z-10"
                                                   title="Merge options (or right-click)"
                                                 >
                                                   <MoreHorizontal className="w-2.5 h-2.5" />
                                                 </button>
                                               )}
                                            <Input
                                              type="text"
                                              value={cellVal ?? ""}
                                              onPaste={(e) =>
                                                handleCellPaste(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                )
                                              }
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                if (
                                                  v === "" ||
                                                  /^[+-]?\d*\.?\d*$/.test(v)
                                                ) {
                                                  handleTableCellChange(
                                                    index,
                                                    rIdx,
                                                    col.id,
                                                    v,
                                                  );
                                                }
                                              }}
                                              onBlur={(e) => {
                                                const raw =
                                                  e.target.value.trim();
                                                if (
                                                  raw === "" ||
                                                  raw === "-" ||
                                                  raw === "+" ||
                                                  raw === "."
                                                )
                                                  return;
                                                const parsed = parseFloat(raw);
                                                if (!isNaN(parsed)) {
                                                  const colDec =
                                                    col.decimal_places ??
                                                    col.decimalPrecision ??
                                                    block.decimal_places ??
                                                    decimalPlaces ??
                                                    3;
                                                  const formatted =
                                                    colDec === 0
                                                      ? String(
                                                          Math.round(parsed),
                                                        )
                                                      : parsed.toFixed(colDec);
                                                  handleTableCellChange(
                                                    index,
                                                    rIdx,
                                                    col.id,
                                                    formatted,
                                                  );
                                                }
                                              }}
                                              className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold transition-colors"
                                              placeholder="0"
                                            />
                                          </td>
                                        );
                                      }
                                      if (col.type === "text") {
                                        const cellVal =
                                          row[col.id] ??
                                          (col.id === "description"
                                            ? row.description
                                            : "") ??
                                          "";
                                        return (
                                          <td
                                            key={col.id}
                                            style={{
                                              width: col.width,
                                              minWidth: col.width || "100px",
                                            }}
                                             onContextMenu={(e) => handleOpenCellMenu(e, index, null, rIdx, col.id, col.label || col.id, cIdx, block.columns.length, 1, 1, block.rows.length)}
                                             className="py-1 px-1 relative group/cell"
                                          >
                                            <Input
                                              value={cellVal}
                                              onPaste={(e) =>
                                                handleCellPaste(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                )
                                              }
                                              onChange={(e) => {
                                                const isSpecCol =
                                                  col.id === "required_dimension" ||
                                                  col.id === "specification" ||
                                                  col.id === "description" ||
                                                  col.id === "nominal" ||
                                                  /spec|dimension/i.test(col.id || col.label || "");
                                                if (isSpecCol) {
                                                  handleTableCellChange(
                                                    index,
                                                    rIdx,
                                                    col.id,
                                                    e.target.value,
                                                  );
                                                } else {
                                                  const newRows = [...block.rows];
                                                  newRows[rIdx] = {
                                                    ...newRows[rIdx],
                                                    [col.id]: e.target.value,
                                                    ...(col.id === "description"
                                                      ? {
                                                          description:
                                                            e.target.value,
                                                        }
                                                      : {}),
                                                  };
                                                  updateBlock(index, {
                                                    ...block,
                                                    rows: newRows,
                                                  });
                                                }
                                              }}
                                              className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-sans text-slate-800 dark:text-slate-200 font-medium transition-colors"
                                              placeholder={col.label || "Value"}
                                            />
                                                {(cIdx < block.columns.length - 1 || rIdx < block.rows.length - 1) && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) =>
                                                      handleOpenCellMenu(
                                                        e,
                                                        index,
                                                        null,
                                                        rIdx,
                                                        col.id,
                                                        col.label || col.id,
                                                        cIdx,
                                                        block.columns.length,
                                                        1,
                                                        1,
                                                        block.rows.length,
                                                      )
                                                    }
                                                    className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-300 rounded-[3px] transition-all z-10"
                                                    title="Merge options (or right-click)"
                                                  >
                                                    <MoreHorizontal className="w-2.5 h-2.5" />
                                                  </button>
                                                )}
                                          </td>
                                        );
                                      }
                                      if (
                                        col.type === "reading" ||
                                        col.type === "trial"
                                      ) {
                                        const cellVal =
                                          row[col.id] ??
                                          (col.id === "reading"
                                            ? row.reading
                                            : "") ??
                                          "";
                                        return (
                                          <td
                                            key={col.id}
                                            style={{
                                              width: col.width,
                                              minWidth: col.width || "90px",
                                            }}
                                             onContextMenu={(e) => handleOpenCellMenu(e, index, null, rIdx, col.id, col.label || col.id, cIdx, block.columns.length, 1, 1, block.rows.length)}
                                             className="py-1 px-1 relative group/cell"
                                          >
                                            <Input
                                              value={cellVal}
                                              onPaste={(e) =>
                                                handleCellPaste(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                )
                                              }
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                if (
                                                  v === "" ||
                                                  /^[+-]?\d*\.?\d*$/.test(v)
                                                ) {
                                                  handleTableCellChange(
                                                    index,
                                                    rIdx,
                                                    col.id,
                                                    v,
                                                  );
                                                }
                                              }}
                                              onBlur={(e) => {
                                                const raw =
                                                  e.target.value.trim();
                                                if (
                                                  raw === "" ||
                                                  raw === "-" ||
                                                  raw === "+" ||
                                                  raw === "."
                                                )
                                                  return;
                                                const parsed = parseFloat(raw);
                                                if (!isNaN(parsed)) {
                                                  const colDec =
                                                    col.decimal_places ??
                                                    col.decimalPrecision ??
                                                    block.decimal_places ??
                                                    decimalPlaces ??
                                                    3;
                                                  const formatted =
                                                    colDec === 0
                                                      ? String(
                                                          Math.round(parsed),
                                                        )
                                                      : parsed.toFixed(colDec);
                                                  handleTableCellChange(
                                                    index,
                                                    rIdx,
                                                    col.id,
                                                    formatted,
                                                  );
                                                }
                                              }}
                                              className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold transition-colors"
                                              placeholder="0.00"
                                            />
                                               {(cIdx < block.columns.length - 1 || rIdx < block.rows.length - 1) && (
                                                  <button
                                                   type="button"
                                                   onClick={(e) =>
                                                      handleOpenCellMenu(
                                                        e,
                                                        index,
                                                        null,
                                                        rIdx,
                                                        col.id,
                                                        col.label || col.id,
                                                        cIdx,
                                                        block.columns.length,
                                                        1,
                                                        1,
                                                        block.rows.length,
                                                      )
                                                    }
                                                   className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-300 rounded-[3px] transition-all z-10"
                                                   title="Merge options (or right-click)"
                                                 >
                                                   <MoreHorizontal className="w-2.5 h-2.5" />
                                                 </button>
                                               )}
                                          </td>
                                        );
                                      }
                                      if (col.type === "tolerance") {
                                        const cellVal =
                                          row[col.id] ??
                                          (col.id === "tolerance"
                                            ? row.tolerance
                                            : "") ??
                                          "";
                                        return (
                                          <td
                                            key={col.id}
                                            style={{
                                              width: col.width,
                                              minWidth: col.width || "90px",
                                            }}
                                             onContextMenu={(e) => handleOpenCellMenu(e, index, null, rIdx, col.id, col.label || col.id, cIdx, block.columns.length, 1, 1, block.rows.length)}
                                             className="py-1 px-1 relative group/cell"
                                          >
                                            <Input
                                              value={cellVal}
                                              onPaste={(e) =>
                                                handleCellPaste(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                )
                                              }
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                if (
                                                  v === "" ||
                                                  /^[+-]?\d*\.?\d*$/.test(v)
                                                ) {
                                                  handleTableCellChange(
                                                    index,
                                                    rIdx,
                                                    col.id,
                                                    v,
                                                  );
                                                }
                                              }}
                                              onBlur={(e) => {
                                                const raw =
                                                  e.target.value.trim();
                                                if (
                                                  raw === "" ||
                                                  raw === "-" ||
                                                  raw === "+" ||
                                                  raw === "."
                                                )
                                                  return;
                                                const parsed = parseFloat(raw);
                                                if (!isNaN(parsed)) {
                                                  const colDec =
                                                    col.decimal_places ??
                                                    col.decimalPrecision ??
                                                    block.decimal_places ??
                                                    decimalPlaces ??
                                                    3;
                                                  const formatted =
                                                    colDec === 0
                                                      ? String(
                                                          Math.round(parsed),
                                                        )
                                                      : parsed.toFixed(colDec);
                                                  handleTableCellChange(
                                                    index,
                                                    rIdx,
                                                    col.id,
                                                    formatted,
                                                  );
                                                }
                                              }}
                                              className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold transition-colors"
                                              placeholder="±Tol"
                                            />
                                               {(cIdx < block.columns.length - 1 || rIdx < block.rows.length - 1) && (
                                                  <button
                                                   type="button"
                                                   onClick={(e) =>
                                                      handleOpenCellMenu(
                                                        e,
                                                        index,
                                                        null,
                                                        rIdx,
                                                        col.id,
                                                        col.label || col.id,
                                                        cIdx,
                                                        block.columns.length,
                                                        1,
                                                        1,
                                                        block.rows.length,
                                                      )
                                                    }
                                                   className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-300 rounded-[3px] transition-all z-10"
                                                   title="Merge options (or right-click)"
                                                 >
                                                   <MoreHorizontal className="w-2.5 h-2.5" />
                                                 </button>
                                               )}
                                          </td>
                                        );
                                      }
                                      const hasCustomCellFormula = Boolean(row.cellFormulas?.[col.id]);
                                      const isManualJudge =
                                        !hasCustomCellFormula &&
                                        (Boolean(col.isManualJudgement) ||
                                        (col as any).judgementMode === "manual" ||
                                        ((col.type === "status" || col.role === "JUDGEMENT" || col.label?.toLowerCase().includes("judg")) && !col.formula));

                                      if (isManualJudge) {
                                        const cellVal = row[col.id] ?? row.status ?? row.judgement ?? "OK";
                                        return (
                                          <td
                                            key={col.id}
                                            style={{
                                              width: col.width,
                                              minWidth: col.width || "95px",
                                            }}
                                            onContextMenu={(e) =>
                                              handleOpenCellMenu(
                                                e,
                                                index,
                                                null,
                                                rIdx,
                                                col.id,
                                                col.label || col.id,
                                                cIdx,
                                                block.columns.length,
                                                1,
                                                1,
                                                block.rows.length,
                                              )
                                            }
                                            className="py-1 px-1 relative group/cell"
                                          >
                                            <JudgementCellControl
                                              value={cellVal}
                                              onChange={(newVal) => {
                                                handleTableCellChange(index, rIdx, col.id, newVal);
                                              }}
                                            />
                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenCellMenu(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                  col.label || col.id,
                                                  cIdx,
                                                  block.columns.length,
                                                  1,
                                                  1,
                                                  block.rows.length,
                                                )
                                              }
                                              className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                              title="Formula & Cell options (or right-click)"
                                            >
                                              <MoreHorizontal className="w-2.5 h-2.5" />
                                            </button>
                                          </td>
                                        );
                                      }
                                      const evaluated = evaluatePreviewCell(
                                        row,
                                        col,
                                        block.decimal_places ?? decimalPlaces,
                                        block.columns,
                                        (block as TableGridBlock).nominal,
                                        rIdx,
                                        block.rows,
                                        (block as TableGridBlock).tolerance,
                                      );
                                      const isJudgementCol =
                                        col.type === "status" ||
                                        col.role === "JUDGEMENT" ||
                                        col.label
                                          .toLowerCase()
                                          .includes("judg");
                                      if (isJudgementCol && evaluated) {
                                        return (
                                          <td
                                            key={col.id}
                                            style={{
                                              width: col.width,
                                              minWidth: col.width || "95px",
                                            }}
                                            onContextMenu={(e) =>
                                              handleOpenCellMenu(
                                                e,
                                                index,
                                                null,
                                                rIdx,
                                                col.id,
                                                col.label || col.id,
                                                cIdx,
                                                block.columns.length,
                                                1,
                                                1,
                                                block.rows.length,
                                              )
                                            }
                                            className="py-1.5 px-2 text-center relative group/cell"
                                          >
                                            <div className="flex items-center justify-center gap-1">
                                              {hasCustomCellFormula && (
                                                <span
                                                  className="text-[9px] px-1 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono rounded font-bold cursor-pointer hover:bg-purple-200"
                                                  title={`Custom formula: ${row.cellFormulas[col.id]}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCellFormulaModalState({
                                                      blockIndex: index,
                                                      childIndex: null,
                                                      rowIndex: rIdx,
                                                      colId: col.id,
                                                      colLabel: col.label || col.id,
                                                      initialFormula: row.cellFormulas[col.id] || "",
                                                    });
                                                  }}
                                                >
                                                  fx
                                                </span>
                                              )}
                                              {typeof evaluated === "object" ? (
                                                evaluated
                                              ) : (
                                                (() => {
                                                  const strVal = String(evaluated).trim().toUpperCase();
                                                  const isPass = strVal === "PASS" || strVal === "OK";
                                                  const isFail = strVal === "FAIL" || strVal === "NOT OK" || strVal === "REJECT";
                                                  return isPass ? (
                                                    <span className="inline-block px-2.5 py-0.5 rounded text-tiny font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                                      PASS
                                                    </span>
                                                  ) : isFail ? (
                                                    <span className="inline-block px-2.5 py-0.5 rounded text-tiny font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                                                      FAIL
                                                    </span>
                                                  ) : (
                                                    <span className="font-mono text-xs text-slate-400">
                                                      {evaluated}
                                                    </span>
                                                  );
                                                })()
                                              )}
                                            </div>

                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenCellMenu(
                                                  e,
                                                  index,
                                                  null,
                                                  rIdx,
                                                  col.id,
                                                  col.label || col.id,
                                                  cIdx,
                                                  block.columns.length,
                                                  1,
                                                  1,
                                                  block.rows.length,
                                                )
                                              }
                                              className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                              title="Formula & Cell options (or right-click)"
                                            >
                                              <MoreHorizontal className="w-2.5 h-2.5" />
                                            </button>
                                          </td>
                                        );
                                      }
                                      return (
                                        <td
                                          key={col.id}
                                          style={{
                                            width: col.width,
                                            minWidth: col.width || "95px",
                                          }}
                                          onContextMenu={(e) =>
                                            handleOpenCellMenu(
                                              e,
                                              index,
                                              null,
                                              rIdx,
                                              col.id,
                                              col.label || col.id,
                                              cIdx,
                                              block.columns.length,
                                              1,
                                              1,
                                              block.rows.length,
                                            )
                                          }
                                          className="py-1.5 px-2 relative group/cell"
                                        >
                                          <div className="flex items-center gap-1">
                                            {hasCustomCellFormula && (
                                              <span
                                                className="text-[9px] px-1 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono rounded font-bold cursor-pointer hover:bg-purple-200"
                                                title={`Custom formula: ${row.cellFormulas[col.id]}`}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setCellFormulaModalState({
                                                    blockIndex: index,
                                                    childIndex: null,
                                                    rowIndex: rIdx,
                                                    colId: col.id,
                                                    colLabel: col.label || col.id,
                                                    initialFormula: row.cellFormulas[col.id] || "",
                                                  });
                                                }}
                                              >
                                                fx
                                              </span>
                                            )}
                                            <span className="font-metrology text-xs font-semibold text-slate-800 dark:text-slate-200">
                                              {evaluated}
                                            </span>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={(e) =>
                                              handleOpenCellMenu(
                                                e,
                                                index,
                                                null,
                                                rIdx,
                                                col.id,
                                                col.label || col.id,
                                                cIdx,
                                                block.columns.length,
                                                1,
                                                1,
                                                block.rows.length,
                                              )
                                            }
                                            className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                            title="Formula & Cell options (or right-click)"
                                          >
                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                          </button>
                                        </td>
                                      );
                                    })}
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                            </table>
                          </div>
                        )}

                        {/* Add Row & Column Controls */}
                        {!readOnly && (
                          <div className="bg-slate-50/80 dark:bg-slate-900/60 p-2.5 flex items-center justify-between text-xs border-t border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const paramRows = block.rows.filter(
                                    (r) => !r.is_merged && !r.isMerged,
                                  );
                                  const lastParamRow =
                                    paramRows[paramRows.length - 1];
                                  const isSpecTable = block.columns.some(
                                    (c) =>
                                      c &&
                                      (c.id === "specification" ||
                                        c.id === "required_dimension" ||
                                        /spec/i.test(c.label || c.id)),
                                  );
                                  const lastNominal =
                                    typeof lastParamRow?.nominal === "number"
                                      ? lastParamRow.nominal
                                      : parseFloat(
                                          String(lastParamRow?.nominal || 0),
                                        );
                                  const newNominal = isSpecTable
                                    ? 0
                                    : isNaN(lastNominal) || lastNominal === 0
                                      ? 0
                                      : lastNominal + 10;

                                  const newRow: CanvasRowData = {
                                    point_number: block.rows.length + 1,
                                    nominal: newNominal,
                                    unit: block.unit || "mm",
                                    tolerance: block.tolerance ?? 0.02,
                                  };

                                  block.columns.forEach((col) => {
                                    if (col.type === "text") {
                                      if (col.id === "deviation" || /deviation/i.test(col.label || col.id)) {
                                        newRow[col.id] = "-";
                                      } else if (col.id === "actual_dimension" || col.id === "actual") {
                                        newRow[col.id] = "";
                                      }
                                    }
                                    if (col.type === "status" && (Boolean(col.isManualJudgement) || (col as any).judgementMode === "manual" || !col.formula)) {
                                      newRow[col.id] = "OK";
                                    }
                                  });
                                  const tol =
                                    parseFloat(
                                      String(block.tolerance ?? 0.02),
                                    ) || 0.02;
                                  const dec =
                                    block.decimal_places ??
                                    decimalPlaces ??
                                    3;
                                  const evaluatedRow =
                                    evaluateCanvasRowFormulas(
                                      newRow,
                                      block.columns,
                                      tol,
                                      dec,
                                      (block as TableGridBlock).nominal,
                                    );
                                  updateBlock(index, {
                                    ...block,
                                    rows: [...block.rows, evaluatedRow],
                                  });
                                }}
                                className="h-8 px-4 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 border-dashed border-primary/40 rounded-lg gap-2 shadow-2xs transition-all flex items-center"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Add Point / Row</span>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAddColumnModal(block)}
                                className="h-8 px-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-dashed border-indigo-400/60 rounded-lg gap-2 shadow-2xs transition-all flex items-center"
                                title="Add custom column to this table"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Add Column</span>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddMergedStatementRow(index, null)}
                                className="h-8 px-3.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-dashed border-amber-400/60 rounded-lg gap-2 shadow-2xs transition-all flex items-center"
                                title="Add a merged statement row across all columns (e.g. visual observation notes)"
                              >
                                <Merge className="w-3.5 h-3.5" />
                                <span>Add Statement Row</span>
                              </Button>
                            </div>
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
                        )}
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnmergeSplitRow(block.id);
                        }}
                        className="h-6 px-2 text-2xs font-semibold gap-1 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-950/60 rounded cursor-pointer"
                        title="Separate side-by-side section back into standalone individual tables"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Unmerge to Separate Tables</span>
                      </Button>
                    </div>

                    <div
                      className={`grid grid-cols-1 md:grid-cols-${block.children.length} gap-3 items-start`}
                    >
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
                            selectedChildTableId === child.id
                              ? "ring-2 ring-indigo-500 border-indigo-500"
                              : "hover:border-indigo-300"
                          }`}
                        >
                          {child.type === "table_grid" &&
                            (() => {
                              const childEff =
                                getEffectiveTableOrientation(child);
                              const childDisplayCols = (
                                child.columns || []
                              ).filter(
                                (c) =>
                                  c.id !== "point_number" &&
                                  c.id !== "sl_no" &&
                                  c.id !== "sino" &&
                                  c.id !== "slno",
                              );
                              return (
                                <>
                                  <div className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 flex items-center justify-between border-b-2 border-slate-300 dark:border-slate-700 flex-wrap gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <Table className="w-3.5 h-3.5 text-primary shrink-0" />
                                      <span className="text-xs font-bold">
                                        {child.title || "Section Table"}
                                      </span>
                                      {/* Split Child Table Access Key Badge with Popover */}
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button
                                            type="button"
                                            className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800 shadow-2xs font-mono ml-1"
                                            title="Click to rename table key for cross-table formula access"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <span className="text-purple-500 font-bold">#</span>
                                            <span>{child.tableKey || slugifyTableKey(child.title || `table_${index + 1}_${cIdx + 1}`)}</span>
                                            <Pencil className="w-2.5 h-2.5 opacity-60 hover:opacity-100 ml-0.5" />
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent align="center" className="w-72 p-3 shadow-lg z-50">
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                                <Hash className="w-3.5 h-3.5 text-purple-600" />
                                                Cross-Table Key
                                              </h4>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground leading-tight">
                                              Identifier used to reference this section in formulas from other tables.
                                            </p>
                                            <div className="flex items-center gap-1.5 pt-1">
                                              <Input
                                                type="text"
                                                placeholder="e.g. clockwise"
                                                defaultValue={child.tableKey || slugifyTableKey(child.title || `table_${index + 1}_${cIdx + 1}`)}
                                                id={`child-key-input-${child.id}`}
                                                className="h-8 text-xs font-mono"
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") {
                                                    const val = (e.currentTarget as HTMLInputElement).value;
                                                    handleUpdateTableKey(index, cIdx, val);
                                                    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                                  }
                                                }}
                                              />
                                              <Button
                                                size="sm"
                                                className="h-8 px-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white"
                                                onClick={() => {
                                                  const input = document.getElementById(`child-key-input-${child.id}`) as HTMLInputElement;
                                                  if (input) {
                                                    handleUpdateTableKey(index, cIdx, input.value);
                                                  }
                                                  document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                                }}
                                              >
                                                Save
                                              </Button>
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                                      {block.children.length > 1 && cIdx > 0 && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMirrorSibling(index, cIdx);
                                          }}
                                          className="h-6 px-2 text-2xs font-bold gap-1 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 rounded"
                                          title="Copy specification/nominal values from the left section table"
                                        >
                                          <Copy className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                          <span>Copy Specs from Left</span>
                                        </Button>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-6 px-1.5 text-2xs font-semibold gap-1 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded"
                                            title="Copy or paste column values for this section"
                                          >
                                            <MoreHorizontal className="w-3 h-3 text-primary" />
                                            <span>Table Options</span>
                                            <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                         <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                                           <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                                             Grid View
                                           </DropdownMenuLabel>
                                           <DropdownMenuItem
                                             onClick={(e) => {
                                               e.stopPropagation();
                                               setShowExcelCoordinates(!showExcelCoordinates);
                                             }}
                                             className="text-xs cursor-pointer gap-2 font-medium"
                                           >
                                             <Table className="w-3.5 h-3.5 text-purple-600" />
                                             <span>{showExcelCoordinates ? "Hide Excel Coordinates" : "Show Excel Coordinates"}</span>
                                           </DropdownMenuItem>
                                           <DropdownMenuSeparator />

                                           <DropdownMenuItem
                                             onClick={() => handleOpenPasteModal(index, cIdx, child, "nominal")}
                                             className="text-xs cursor-pointer gap-2 font-medium text-primary focus:text-primary"
                                           >
                                             <ClipboardPaste className="w-3.5 h-3.5 text-primary" />
                                             <span>Paste Values into Column...</span>
                                           </DropdownMenuItem>
                                           <DropdownMenuSeparator />
                                           <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                                             Copy Column to Clipboard
                                           </DropdownMenuLabel>
                                           {(child.columns || [])
                                             .filter((col) => col && col.id !== "point_number" && col.id !== "sl_no")
                                             .map((col) => (
                                               <DropdownMenuItem
                                                 key={col.id}
                                                 onClick={() => handleCopyColumn(child, col.id, col.label || col.id)}
                                                 className="text-xs cursor-pointer gap-2"
                                               >
                                                 <ClipboardCopy className="w-3.5 h-3.5 text-slate-500" />
                                                 <span className="truncate">Copy "{col.label || col.id}"</span>
                                               </DropdownMenuItem>
                                             ))}
                                           {(child.columns || []).some((col) => col.id === "point_number" || col.id === "sl_no") && (
                                             <DropdownMenuItem
                                               onClick={() => handleCopyColumn(child, "point_number", "Sl No / Points")}
                                               className="text-xs cursor-pointer gap-2 text-muted-foreground"
                                             >
                                               <ClipboardCopy className="w-3.5 h-3.5" />
                                               <span>Copy Points / Sl.No.</span>
                                             </DropdownMenuItem>
                                           )}
                                         </DropdownMenuContent>
                                      </DropdownMenu>
                                      {onOpenTableConfig && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedBlockId(block.id);
                                            setSelectedChildTableId(child.id);
                                            onOpenTableConfig(child.id);
                                          }}
                                          className="h-6 px-2 text-2xs font-bold gap-1 text-slate-700 dark:text-slate-200 hover:text-primary hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded border-slate-300 dark:border-slate-600"
                                          title="Open Table Configuration tab for this section"
                                        >
                                          <Settings2 className="w-3 h-3 text-primary" />
                                          <span>Configure Table</span>
                                        </Button>
                                      )}
                                                                            <Badge
                                        variant="outline"
                                        className="text-2xs py-0 px-1 font-semibold bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                      >
                                        Unit: {child.unit || defaultUnit || "mm"}
                                      </Badge>
                                      {/* Section Master Nominal Popover Quick-Editor */}
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button
                                            type="button"
                                            className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer bg-amber-50/80 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800 shadow-2xs"
                                            title="Click to set or change master Nominal for this section"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <span className="font-medium text-amber-700 dark:text-amber-400">Nom:</span>
                                            <span className="font-bold">
                                              {(() => {
                                                const formatted = formatNominalDisplay(
                                                  child.nominal,
                                                  child.decimal_places ?? decimalPlaces
                                                );
                                                return formatted ? `${formatted} ${child.unit || defaultUnit || "mm"}` : "Not Set";
                                              })()}
                                            </span>
                                            <Pencil className="w-2.5 h-2.5 opacity-60 hover:opacity-100 ml-0.5" />
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent align="center" className="w-64 p-3 shadow-lg z-50">
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                                Section Master Nominal
                                              </h4>
                                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                                {child.unit || defaultUnit || "mm"}
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground leading-tight">
                                              Master nominal size applied to rows in this section without a dedicated nominal column.
                                            </p>
                                            <div className="flex items-center gap-1.5 pt-1">
                                              <Input
                                                type="text"
                                                placeholder="e.g. 10.0000"
                                                defaultValue={formatNominalDisplay(
                                                  child.nominal,
                                                  child.decimal_places ?? decimalPlaces
                                                )}
                                                id={`nominal-input-${child.id}`}
                                                className="h-8 text-xs font-mono"
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") {
                                                    const val = (e.currentTarget as HTMLInputElement).value;
                                                    handleUpdateTableNominal(index, cIdx, val);
                                                    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                                  }
                                                }}
                                              />
                                              <Button
                                                size="sm"
                                                className="h-8 px-2.5 text-xs font-bold"
                                                onClick={(e) => {
                                                  const input = document.getElementById(`nominal-input-${child.id}`) as HTMLInputElement;
                                                  if (input) {
                                                    handleUpdateTableNominal(index, cIdx, input.value);
                                                  }
                                                  document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                                }}
                                              >
                                                Save
                                              </Button>
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button
                                            type="button"
                                            className="inline-flex items-center gap-0.5 text-2xs py-0 px-1 font-semibold rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer"
                                            title="Click to edit Section Tolerance"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <span>Tol: ±{child.tolerance ?? defaultTolerance ?? "0.010"}</span>
                                            <Pencil className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent align="center" className="w-60 p-2.5 shadow-lg z-50">
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                                Section Master Tolerance
                                              </h4>
                                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                                ±{child.unit || "mm"}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 pt-1">
                                              <Input
                                                type="number"
                                                step="any"
                                                placeholder="e.g. 0.003"
                                                defaultValue={child.tolerance ?? 0.01}
                                                id={`tolerance-input-${child.id}`}
                                                className="h-7 text-xs font-mono"
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") {
                                                    const val = (e.currentTarget as HTMLInputElement).value;
                                                    handleUpdateTableTolerance(index, cIdx, val);
                                                    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                                  }
                                                }}
                                              />
                                              <Button
                                                size="sm"
                                                className="h-7 px-2 text-xs font-bold"
                                                onClick={(e) => {
                                                  const input = document.getElementById(`tolerance-input-${child.id}`) as HTMLInputElement;
                                                  if (input) {
                                                    handleUpdateTableTolerance(index, cIdx, input.value);
                                                  }
                                                  document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                                                }}
                                              >
                                                Save
                                              </Button>
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                      <Badge
                                        variant="outline"
                                        className="text-2xs py-0 px-1 font-semibold bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                      >
                                        Dec: {child.decimal_places ?? decimalPlaces}
                                      </Badge>

                                      {/* Child Table Orientation Toggle */}
                                      <div className="flex items-center bg-slate-200/80 dark:bg-slate-700/80 p-0.5 rounded-full border border-slate-300 dark:border-slate-600 text-xs">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const newChildren = block.children.map((c, i) =>
                                              i === cIdx && c.type === "table_grid"
                                                ? { ...c, orientation: "vertical" }
                                                : c,
                                            );
                                            updateBlock(index, { ...block, children: newChildren as any });
                                            toast.success(`${child.title || "Section"} set to Vertical layout`);
                                          }}
                                          className={`px-1.5 py-0.2 rounded-full text-2xs font-semibold transition-all flex items-center gap-0.5 ${
                                            childEff === "vertical"
                                              ? "bg-white dark:bg-slate-900 text-primary shadow-2xs"
                                              : "text-muted-foreground hover:text-foreground"
                                          }`}
                                          title="Vertical layout (Standard Rows)"
                                        >
                                          <ArrowUpDown className="w-2.5 h-2.5" />
                                          <span>Vertical</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const newChildren = block.children.map((c, i) =>
                                              i === cIdx && c.type === "table_grid"
                                                ? { ...c, orientation: "horizontal" }
                                                : c,
                                            );
                                            updateBlock(index, { ...block, children: newChildren as any });
                                            toast.success(`${child.title || "Section"} set to Horizontal layout`);
                                          }}
                                          className={`px-1.5 py-0.2 rounded-full text-2xs font-semibold transition-all flex items-center gap-0.5 ${
                                            childEff === "horizontal"
                                              ? "bg-white dark:bg-slate-900 text-primary shadow-2xs"
                                              : "text-muted-foreground hover:text-foreground"
                                          }`}
                                          title="Horizontal layout (Transposed Columns)"
                                        >
                                          <ArrowLeftRight className="w-2.5 h-2.5" />
                                          <span>Horizontal</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  {childEff === "horizontal" ? (
                                    (() => {
                                      const childFirstColWidth =
                                        typeof child.firstColWidth === "number"
                                          ? child.firstColWidth
                                          : parseInt(String(child.firstColWidth || child.parameterWidth || child.columns?.[0]?.width || "160")) || 160;

                                      const childDataColWidth =
                                        typeof child.dataColWidth === "number"
                                          ? child.dataColWidth
                                          : parseInt(String(child.dataColWidth || "65")) || 65;

                                      return (
                                        <div className="overflow-x-auto scrollbar-thin">
                                          <table className="w-full border-collapse text-xs text-center border-slate-300 dark:border-slate-700">
                                            <thead>
                                              <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b-2 border-slate-400 dark:border-slate-600 divide-x divide-slate-300 dark:divide-slate-700">
                                                <th
                                                  style={{
                                                    width: `${childFirstColWidth}px`,
                                                    minWidth: `${childFirstColWidth}px`,
                                                    maxWidth: `${childFirstColWidth}px`,
                                                  }}
                                                  className={`group/chth py-1.5 px-2 bg-slate-200/90 dark:bg-slate-750 font-bold sticky left-0 z-20 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)] border-r-2 border-slate-300 dark:border-slate-700 select-none overflow-hidden ${
                                                    child.columns?.[0]?.align === "left" ? "text-left" : child.columns?.[0]?.align === "right" ? "text-right" : "text-center"
                                                  }`}
                                                >
                                                  <div className={`flex items-center ${
                                                    child.columns?.[0]?.align === "left" ? "justify-between" : child.columns?.[0]?.align === "right" ? "justify-end" : "justify-center"
                                                  } gap-1`}>
                                                    <span className="whitespace-nowrap truncate">Parameter / Sl no</span>
                                                    <span className="text-[9px] font-mono font-normal opacity-0 group-hover/chth:opacity-100 text-slate-500 dark:text-slate-400">
                                                      {childFirstColWidth}px
                                                    </span>
                                                  </div>
                                                  {/* Draggable Resizer Handle */}
                                                  <div
                                                    onMouseDown={(e) =>
                                                      handleColResizeStart(
                                                        e,
                                                        index,
                                                        "horizontal_first_col",
                                                        childFirstColWidth,
                                                        cIdx,
                                                      )
                                                    }
                                                    className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-30 opacity-40 group-hover/chth:opacity-100 transition-opacity flex items-center justify-center"
                                                    title="Click & drag to resize Parameter column width"
                                                  >
                                                    <div className="w-[1.5px] h-3 bg-muted-foreground/50 group-hover/chth:bg-primary group-hover/chth:h-4.5 transition-all rounded" />
                                                  </div>
                                                </th>
                                                {child.rows.map((r, rIdx) => (
                                                  <th
                                                    key={rIdx}
                                                    style={{
                                                      width: `${childDataColWidth}px`,
                                                      minWidth: `${childDataColWidth}px`,
                                                    }}
                                                    className="relative group/chcol py-1.5 px-1 font-bold text-slate-900 dark:text-white select-none"
                                                  >
                                                    <div className="flex items-center justify-center gap-1">
                                                      {showExcelCoordinates && (
                                                        <span
                                                          className="inline-block px-1 py-0.2 rounded text-[9px] font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800"
                                                          title={`Data Row ${rIdx + 1}`}
                                                        >
                                                          {`R${rIdx + 1}`}
                                                        </span>
                                                      )}
                                                      <span>{r.point_number ?? rIdx + 1}</span>
                                                    </div>
                                                    {/* Draggable Resizer Handle */}
                                                    <div
                                                      onMouseDown={(e) =>
                                                        handleColResizeStart(
                                                          e,
                                                          index,
                                                          "horizontal_data_col",
                                                          childDataColWidth,
                                                          cIdx,
                                                        )
                                                      }
                                                      className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 z-30 opacity-40 group-hover/chcol:opacity-100 transition-opacity flex items-center justify-center"
                                                      title="Click & drag to resize Point columns width"
                                                    >
                                                      <div className="w-[1.5px] h-3 bg-muted-foreground/50 group-hover/chcol:bg-primary group-hover/chcol:h-4.5 transition-all rounded" />
                                                    </div>
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-300 dark:divide-slate-700 font-mono">
                                              {childDisplayCols.map((col, colDefIdx) => (
                                                <tr
                                                  key={col.id}
                                                  className="divide-x divide-slate-300 dark:divide-slate-700 hover:bg-slate-50/50"
                                                >
                                                  <td
                                                    style={{
                                                      width: `${childFirstColWidth}px`,
                                                      minWidth: `${childFirstColWidth}px`,
                                                      maxWidth: `${childFirstColWidth}px`,
                                                    }}
                                                    className={`py-1 px-2 font-bold bg-slate-50 dark:bg-slate-800 font-sans sticky left-0 z-10 whitespace-nowrap shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] border-r-2 border-slate-300 dark:border-slate-700 overflow-hidden ${
                                                      col.align === "left" ? "text-left" : col.align === "right" ? "text-right" : "text-center"
                                                    }`}
                                                  >
                                                    <div className={`flex items-center ${
                                                      col.align === "left" ? "justify-between" : col.align === "right" ? "justify-end" : "justify-center"
                                                    } gap-1`}>
                                                      <div className="flex items-center gap-1.5 overflow-hidden">
                                                        {showExcelCoordinates && (
                                                          <span
                                                            className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 shrink-0 shadow-2xs"
                                                            title={`Excel Column ${getExcelColumnLetter(child.columns.findIndex((c) => c.id === col.id))}`}
                                                          >
                                                            {getExcelColumnLetter(child.columns.findIndex((c) => c.id === col.id))}
                                                          </span>
                                                        )}
                                                        <span className="truncate block" title={col.label}>{col.label}</span>
                                                      </div>
                                                      {col.type === "formula" && (
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            onOpenTableConfig?.(child.id);
                                                          }}
                                                          className="text-xxs text-primary bg-primary/10 hover:bg-primary/20 px-1 py-0.5 rounded font-bold font-mono ml-1 shrink-0 cursor-pointer border border-primary/30 transition-colors"
                                                          title={col.formula ? `Column Formula: ${col.formula}\nClick to configure in Table Configuration` : "Configure Column Formula"}
                                                        >
                                                          (fx)
                                                        </button>
                                                      )}
                                                    </div>
                                                  </td>
                                                  {child.rows.map((row, rIdx) => {
                                                    const hasCustomCellFormula = Boolean(row.cellFormulas?.[col.id]);
                                                    const actualColIdx = child.columns.findIndex((c) => c.id === col.id);
                                                    const targetColIdx = actualColIdx >= 0 ? actualColIdx : colDefIdx;

                                                    if (col.type === "nominal") {
                                                      const cellVal =
                                                        row[col.id] !== undefined
                                                          ? row[col.id]
                                                          : (col.id === "nominal" ? row.nominal : "") ?? "";
                                                      return (
                                                        <td
                                                          key={rIdx}
                                                          style={{
                                                            width: `${childDataColWidth}px`,
                                                            minWidth: `${childDataColWidth}px`,
                                                          }}
                                                          onContextMenu={(e) =>
                                                            handleOpenCellMenu(
                                                              e,
                                                              index,
                                                              cIdx,
                                                              rIdx,
                                                              col.id,
                                                              col.label || col.id,
                                                              targetColIdx,
                                                              child.columns.length,
                                                              1,
                                                              1,
                                                              child.rows.length,
                                                            )
                                                          }
                                                          className="py-1 px-1 relative group/cell"
                                                        >
                                                          <Input
                                                            value={cellVal}
                                                            onChange={(e) => {
                                                              const v = e.target.value;
                                                              if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                                handleChildTableCellChange(index, cIdx, rIdx, col.id, v);
                                                              }
                                                            }}
                                                            onBlur={(e) => {
                                                              const raw = e.target.value.trim();
                                                              if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                              const parsed = parseFloat(raw);
                                                              if (!isNaN(parsed)) {
                                                                const colDec =
                                                                  col.decimal_places ??
                                                                  col.decimalPrecision ??
                                                                  child.decimal_places ??
                                                                  decimalPlaces ??
                                                                  3;
                                                                const formatted =
                                                                  colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                                handleChildTableCellChange(index, cIdx, rIdx, col.id, formatted);
                                                              }
                                                            }}
                                                            className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold"
                                                            placeholder="0.00"
                                                          />

                                                          <button
                                                            type="button"
                                                            onClick={(e) =>
                                                              handleOpenCellMenu(
                                                                e,
                                                                index,
                                                                cIdx,
                                                                rIdx,
                                                                col.id,
                                                                col.label || col.id,
                                                                targetColIdx,
                                                                child.columns.length,
                                                                1,
                                                                1,
                                                                child.rows.length,
                                                              )
                                                            }
                                                            className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                                            title="Formula & Cell options (or right-click)"
                                                          >
                                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                                          </button>
                                                        </td>
                                                      );
                                                    }
                                                    if (col.type === "text") {
                                                      const cellVal =
                                                        row[col.id] !== undefined
                                                          ? row[col.id]
                                                          : (col.id === "description" ? row.description : "") ?? "";
                                                      return (
                                                        <td
                                                          key={rIdx}
                                                          style={{
                                                            width: `${childDataColWidth}px`,
                                                            minWidth: `${childDataColWidth}px`,
                                                          }}
                                                          onContextMenu={(e) =>
                                                            handleOpenCellMenu(
                                                              e,
                                                              index,
                                                              cIdx,
                                                              rIdx,
                                                              col.id,
                                                              col.label || col.id,
                                                              targetColIdx,
                                                              child.columns.length,
                                                              1,
                                                              1,
                                                              child.rows.length,
                                                            )
                                                          }
                                                          className="py-1 px-1 relative group/cell"
                                                        >
                                                          <Input
                                                            value={cellVal}
                                                            onChange={(e) => {
                                                              handleChildTableCellChange(index, cIdx, rIdx, col.id, e.target.value);
                                                            }}
                                                            className="h-7 w-full text-xs text-left bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-sans text-slate-800 dark:text-slate-200 font-medium"
                                                            placeholder="Text..."
                                                          />

                                                          <button
                                                            type="button"
                                                            onClick={(e) =>
                                                              handleOpenCellMenu(
                                                                e,
                                                                index,
                                                                cIdx,
                                                                rIdx,
                                                                col.id,
                                                                col.label || col.id,
                                                                targetColIdx,
                                                                child.columns.length,
                                                                1,
                                                                1,
                                                                child.rows.length,
                                                              )
                                                            }
                                                            className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                                            title="Formula & Cell options (or right-click)"
                                                          >
                                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                                          </button>
                                                        </td>
                                                      );
                                                    }
                                                    if (col.type === "reading" || col.type === "trial") {
                                                      const cellVal =
                                                        row[col.id] !== undefined
                                                          ? row[col.id]
                                                          : (col.id === "reading" ? row.reading : "") ?? "";
                                                      return (
                                                        <td
                                                          key={rIdx}
                                                          style={{
                                                            width: `${childDataColWidth}px`,
                                                            minWidth: `${childDataColWidth}px`,
                                                          }}
                                                          onContextMenu={(e) =>
                                                            handleOpenCellMenu(
                                                              e,
                                                              index,
                                                              cIdx,
                                                              rIdx,
                                                              col.id,
                                                              col.label || col.id,
                                                              targetColIdx,
                                                              child.columns.length,
                                                              1,
                                                              1,
                                                              child.rows.length,
                                                            )
                                                          }
                                                          className="py-1 px-1 relative group/cell"
                                                        >
                                                          <div className="flex items-center justify-center gap-1">
                                                            {hasCustomCellFormula && (
                                                              <span
                                                                className="text-[9px] px-1 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono rounded font-bold cursor-pointer hover:bg-purple-200"
                                                                title={`Custom formula: ${row.cellFormulas[col.id]}`}
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  setCellFormulaModalState({
                                                                    blockIndex: index,
                                                                    childIndex: cIdx,
                                                                    rowIndex: rIdx,
                                                                    colId: col.id,
                                                                    colLabel: col.label || col.id,
                                                                    initialFormula: row.cellFormulas[col.id] || "",
                                                                  });
                                                                }}
                                                              >
                                                                fx
                                                              </span>
                                                            )}
                                                            <Input
                                                              value={cellVal}
                                                              onChange={(e) => {
                                                                const v = e.target.value;
                                                                if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                                  handleChildTableCellChange(index, cIdx, rIdx, col.id, v);
                                                                }
                                                              }}
                                                              onBlur={(e) => {
                                                                const raw = e.target.value.trim();
                                                                if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                                const parsed = parseFloat(raw);
                                                                if (!isNaN(parsed)) {
                                                                  const colDec =
                                                                    col.decimal_places ??
                                                                    col.decimalPrecision ??
                                                                    child.decimal_places ??
                                                                    decimalPlaces ??
                                                                    3;
                                                                  const formatted =
                                                                    colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                                  handleChildTableCellChange(index, cIdx, rIdx, col.id, formatted);
                                                                }
                                                              }}
                                                              className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold"
                                                              placeholder="0.00"
                                                            />
                                                          </div>

                                                          <button
                                                            type="button"
                                                            onClick={(e) =>
                                                              handleOpenCellMenu(
                                                                e,
                                                                index,
                                                                cIdx,
                                                                rIdx,
                                                                col.id,
                                                                col.label || col.id,
                                                                targetColIdx,
                                                                child.columns.length,
                                                                1,
                                                                1,
                                                                child.rows.length,
                                                              )
                                                            }
                                                            className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                                            title="Formula & Cell options (or right-click)"
                                                          >
                                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                                          </button>
                                                        </td>
                                                      );
                                                    }
                                                    if (col.type === "tolerance") {
                                                      const cellVal =
                                                        row[col.id] !== undefined
                                                          ? row[col.id]
                                                          : (col.id === "tolerance" ? row.tolerance : "") ?? "";
                                                      return (
                                                        <td
                                                          key={rIdx}
                                                          style={{
                                                            width: `${childDataColWidth}px`,
                                                            minWidth: `${childDataColWidth}px`,
                                                          }}
                                                          onContextMenu={(e) =>
                                                            handleOpenCellMenu(
                                                              e,
                                                              index,
                                                              cIdx,
                                                              rIdx,
                                                              col.id,
                                                              col.label || col.id,
                                                              targetColIdx,
                                                              child.columns.length,
                                                              1,
                                                              1,
                                                              child.rows.length,
                                                            )
                                                          }
                                                          className="py-1 px-1 relative group/cell"
                                                        >
                                                          <Input
                                                            value={cellVal}
                                                            onChange={(e) => {
                                                              const v = e.target.value;
                                                              if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                                handleChildTableCellChange(index, cIdx, rIdx, col.id, v);
                                                              }
                                                            }}
                                                            onBlur={(e) => {
                                                              const raw = e.target.value.trim();
                                                              if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                              const parsed = parseFloat(raw);
                                                              if (!isNaN(parsed)) {
                                                                const colDec =
                                                                  col.decimal_places ??
                                                                  col.decimalPrecision ??
                                                                  child.decimal_places ??
                                                                  decimalPlaces ??
                                                                  3;
                                                                const formatted =
                                                                  colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                                handleChildTableCellChange(index, cIdx, rIdx, col.id, formatted);
                                                              }
                                                            }}
                                                            className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold"
                                                            placeholder="±Tol"
                                                          />

                                                          <button
                                                            type="button"
                                                            onClick={(e) =>
                                                              handleOpenCellMenu(
                                                                e,
                                                                index,
                                                                cIdx,
                                                                rIdx,
                                                                col.id,
                                                                col.label || col.id,
                                                                targetColIdx,
                                                                child.columns.length,
                                                                1,
                                                                1,
                                                                child.rows.length,
                                                              )
                                                            }
                                                            className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                                            title="Formula & Cell options (or right-click)"
                                                          >
                                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                                          </button>
                                                        </td>
                                                      );
                                                    }
                                                    const isManualJudge =
                                                      !hasCustomCellFormula &&
                                                      (Boolean(col.isManualJudgement) ||
                                                        (col as any).judgementMode === "manual" ||
                                                        ((col.type === "status" || col.role === "JUDGEMENT" || col.label?.toLowerCase().includes("judg")) && !col.formula));

                                                    if (isManualJudge) {
                                                      const cellVal = row[col.id] ?? row.status ?? row.judgement ?? "OK";
                                                      return (
                                                        <td
                                                          key={rIdx}
                                                          style={{
                                                            width: `${childDataColWidth}px`,
                                                            minWidth: `${childDataColWidth}px`,
                                                          }}
                                                          onContextMenu={(e) =>
                                                            handleOpenCellMenu(
                                                              e,
                                                              index,
                                                              cIdx,
                                                              rIdx,
                                                              col.id,
                                                              col.label || col.id,
                                                              targetColIdx,
                                                              child.columns.length,
                                                              1,
                                                              1,
                                                              child.rows.length,
                                                            )
                                                          }
                                                          className="py-1 px-1.5 text-center relative group/cell"
                                                        >
                                                          <JudgementCellControl
                                                            value={cellVal}
                                                            onChange={(newVal) => {
                                                              handleChildTableCellChange(index, cIdx, rIdx, col.id, newVal);
                                                            }}
                                                          />

                                                          <button
                                                            type="button"
                                                            onClick={(e) =>
                                                              handleOpenCellMenu(
                                                                e,
                                                                index,
                                                                cIdx,
                                                                rIdx,
                                                                col.id,
                                                                col.label || col.id,
                                                                targetColIdx,
                                                                child.columns.length,
                                                                1,
                                                                1,
                                                                child.rows.length,
                                                              )
                                                            }
                                                            className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                                            title="Formula & Cell options (or right-click)"
                                                          >
                                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                                          </button>
                                                        </td>
                                                      );
                                                    }
                                                    const evaluated = evaluatePreviewCell(
                                                      row,
                                                      col,
                                                      child.decimal_places ?? decimalPlaces,
                                                      child.columns,
                                                      (child as TableGridBlock).nominal,
                                                      rIdx,
                                                      child.rows,
                                                      (child as TableGridBlock).tolerance,
                                                    );
                                                    const isJudgementCol =
                                                      col.type === "status" ||
                                                      col.role === "JUDGEMENT" ||
                                                      col.label.toLowerCase().includes("judg");

                                                    if (isJudgementCol && evaluated) {
                                                      const isPass = String(evaluated).trim().toUpperCase() === "PASS";
                                                      const isFail = String(evaluated).trim().toUpperCase() === "FAIL";
                                                      return (
                                                        <td
                                                          key={rIdx}
                                                          style={{
                                                            width: `${childDataColWidth}px`,
                                                            minWidth: `${childDataColWidth}px`,
                                                          }}
                                                          onContextMenu={(e) =>
                                                            handleOpenCellMenu(
                                                              e,
                                                              index,
                                                              cIdx,
                                                              rIdx,
                                                              col.id,
                                                              col.label || col.id,
                                                              targetColIdx,
                                                              child.columns.length,
                                                              1,
                                                              1,
                                                              child.rows.length,
                                                            )
                                                          }
                                                          className="py-1 px-1.5 text-center relative group/cell"
                                                        >
                                                          <div className="flex items-center justify-center gap-1">
                                                            {hasCustomCellFormula && (
                                                              <span
                                                                className="text-[9px] px-1 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono rounded font-bold cursor-pointer hover:bg-purple-200"
                                                                title={`Custom formula: ${row.cellFormulas[col.id]}`}
                                                                onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  setCellFormulaModalState({
                                                                    blockIndex: index,
                                                                    childIndex: cIdx,
                                                                    rowIndex: rIdx,
                                                                    colId: col.id,
                                                                    colLabel: col.label || col.id,
                                                                    initialFormula: row.cellFormulas[col.id] || "",
                                                                  });
                                                                }}
                                                              >
                                                                fx
                                                              </span>
                                                            )}
                                                            {typeof evaluated === "object" ? (
                                                              evaluated
                                                            ) : (
                                                              (() => {
                                                                const strVal = String(evaluated).trim().toUpperCase();
                                                                const isPassStr = strVal === "PASS" || strVal === "OK";
                                                                const isFailStr = strVal === "FAIL" || strVal === "NOT OK" || strVal === "REJECT";
                                                                return isPassStr ? (
                                                                  <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-700">
                                                                    PASS
                                                                  </span>
                                                                ) : isFailStr ? (
                                                                  <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-400 dark:border-rose-700">
                                                                    FAIL
                                                                  </span>
                                                                ) : (
                                                                  <span className="font-metrology text-xs text-slate-400">
                                                                    {evaluated}
                                                                  </span>
                                                                );
                                                              })()
                                                            )}
                                                          </div>

                                                          <button
                                                            type="button"
                                                            onClick={(e) =>
                                                              handleOpenCellMenu(
                                                                e,
                                                                index,
                                                                cIdx,
                                                                rIdx,
                                                                col.id,
                                                                col.label || col.id,
                                                                targetColIdx,
                                                                child.columns.length,
                                                                1,
                                                                1,
                                                                child.rows.length,
                                                              )
                                                            }
                                                            className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                                            title="Formula & Cell options (or right-click)"
                                                          >
                                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                                          </button>
                                                        </td>
                                                      );
                                                    }
                                                    return (
                                                      <td
                                                        key={rIdx}
                                                        style={{
                                                          width: `${childDataColWidth}px`,
                                                          minWidth: `${childDataColWidth}px`,
                                                        }}
                                                        onContextMenu={(e) =>
                                                          handleOpenCellMenu(
                                                            e,
                                                            index,
                                                            cIdx,
                                                            rIdx,
                                                            col.id,
                                                            col.label || col.id,
                                                            targetColIdx,
                                                            child.columns.length,
                                                            1,
                                                            1,
                                                            child.rows.length,
                                                          )
                                                        }
                                                        className="py-1 px-1.5 font-bold text-slate-900 dark:text-slate-100 text-center text-xs relative group/cell"
                                                      >
                                                        <div className="flex items-center justify-center gap-1">
                                                          {hasCustomCellFormula && (
                                                            <span
                                                              className="text-[9px] px-1 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono rounded font-bold cursor-pointer hover:bg-purple-200"
                                                              title={`Custom formula: ${row.cellFormulas[col.id]}`}
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCellFormulaModalState({
                                                                  blockIndex: index,
                                                                  childIndex: cIdx,
                                                                  rowIndex: rIdx,
                                                                  colId: col.id,
                                                                  colLabel: col.label || col.id,
                                                                  initialFormula: row.cellFormulas[col.id] || "",
                                                                });
                                                              }}
                                                            >
                                                              fx
                                                            </span>
                                                          )}
                                                          <span>{evaluated}</span>
                                                        </div>

                                                        <button
                                                          type="button"
                                                          onClick={(e) =>
                                                            handleOpenCellMenu(
                                                              e,
                                                              index,
                                                              cIdx,
                                                              rIdx,
                                                              col.id,
                                                              col.label || col.id,
                                                              targetColIdx,
                                                              child.columns.length,
                                                              1,
                                                              1,
                                                              child.rows.length,
                                                            )
                                                          }
                                                          className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                                          title="Formula & Cell options (or right-click)"
                                                        >
                                                          <MoreHorizontal className="w-2.5 h-2.5" />
                                                        </button>
                                                      </td>
                                                    );
                                                  })}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <div className="overflow-x-auto scrollbar-thin">
                                      <table className="w-full border-collapse text-xs text-center border-slate-300 dark:border-slate-700">
                                        <thead>
                                          {(() => {
                                            const renderChildTh = (col: CanvasColumnDef, colIdx: number, rowSpan: number = 1) => {
                                              const isPointNo =
                                                col.id === "point_number" ||
                                                col.id === "sl_no" ||
                                                col.id === "sino";
                                              const isDragTarget =
                                                dragOverCol &&
                                                dragOverCol.blockIdx === index &&
                                                dragOverCol.childIdx === cIdx &&
                                                dragOverCol.colIdx === colIdx;

                                              return (
                                                <th
                                                  key={col.id}
                                                  rowSpan={rowSpan > 1 ? rowSpan : undefined}
                                                  draggable={!isPointNo}
                                                  onDragStart={() => {
                                                    if (!isPointNo) {
                                                      setDraggedCol({
                                                        blockIdx: index,
                                                        childIdx: cIdx,
                                                        colIdx,
                                                      });
                                                    }
                                                  }}
                                                  onDragOver={(e) => {
                                                    e.preventDefault();
                                                    if (
                                                      draggedCol &&
                                                      draggedCol.blockIdx === index &&
                                                      draggedCol.childIdx === cIdx
                                                    ) {
                                                      setDragOverCol({
                                                        blockIdx: index,
                                                        childIdx: cIdx,
                                                        colIdx,
                                                      });
                                                    }
                                                  }}
                                                  onDragLeave={() => {
                                                    setDragOverCol(null);
                                                  }}
                                                  onDrop={(e) => {
                                                    e.preventDefault();
                                                    if (
                                                      draggedCol &&
                                                      draggedCol.blockIdx === index &&
                                                      draggedCol.childIdx === cIdx &&
                                                      draggedCol.colIdx !== colIdx
                                                    ) {
                                                      handleReorderColumns(
                                                        index,
                                                        cIdx,
                                                        draggedCol.colIdx,
                                                        colIdx,
                                                      );
                                                    }
                                                    setDraggedCol(null);
                                                    setDragOverCol(null);
                                                  }}
                                                  onContextMenu={(e) => {
                                                    if (!isPointNo) {
                                                      handleOpenHeaderGroupMenu(
                                                        e,
                                                        index,
                                                        cIdx,
                                                        col.id,
                                                        col.label || col.id,
                                                        colIdx,
                                                        child.columns.length,
                                                        col.groupName,
                                                      );
                                                    }
                                                  }}
                                                  style={{
                                                    width: col.width,
                                                    minWidth:
                                                      col.width ||
                                                      (isPointNo ? "55px" : "80px"),
                                                  }}
                                                  className={`relative group/th py-1.5 px-2 font-bold text-xs select-none transition-all ${
                                                    isDragTarget
                                                      ? "bg-primary/20 ring-2 ring-primary/40"
                                                      : ""
                                                  }`}
                                                >
                                                  <div className="flex items-center justify-center gap-1">
                                                    {!isPointNo && (
                                                      <GripVertical className="w-2.5 h-2.5 opacity-0 group-hover/th:opacity-60 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
                                                    )}
                                                    <span>{col.label}</span>
                                                    {col.type === "formula" && (
                                                      <span className="px-1 py-0.2 rounded text-2xs font-mono font-bold bg-primary/15 text-primary border border-primary/30">
                                                        fx
                                                      </span>
                                                    )}
                                                    {!isPointNo && (
                                                      <button
                                                        type="button"
                                                        onClick={(e) =>
                                                          handleOpenHeaderGroupMenu(
                                                            e,
                                                            index,
                                                            cIdx,
                                                            col.id,
                                                            col.label || col.id,
                                                            colIdx,
                                                            child.columns.length,
                                                            col.groupName,
                                                          )
                                                        }
                                                        className={`opacity-0 group-hover/th:opacity-100 p-0.5 rounded text-xxs transition-opacity cursor-pointer ${
                                                          col.groupName
                                                            ? "text-indigo-600 dark:text-indigo-400 opacity-100 font-bold"
                                                            : "text-slate-400 hover:text-indigo-600"
                                                        }`}
                                                        title={
                                                          col.groupName
                                                            ? `Group: ${col.groupName} (Right-click or click to edit/unmerge)`
                                                            : "Merge header with next column / Create super-header"
                                                        }
                                                      >
                                                        <Columns className="w-2.5 h-2.5" />
                                                      </button>
                                                    )}
                                                    {!isPointNo &&
                                                      colIdx >
                                                        (child.columns.some(
                                                          (c) =>
                                                            c.id ===
                                                              "point_number" ||
                                                            c.id === "sl_no",
                                                        )
                                                          ? 1
                                                          : 0) && (
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleReorderColumns(
                                                              index,
                                                              cIdx,
                                                              colIdx,
                                                              colIdx - 1,
                                                            );
                                                          }}
                                                          className="opacity-0 group-hover/th:opacity-100 p-0.5 hover:text-primary rounded text-xxs transition-opacity"
                                                          title="Move column left"
                                                        >
                                                          <ChevronLeft className="w-2.5 h-2.5" />
                                                        </button>
                                                      )}
                                                    {!isPointNo &&
                                                      colIdx <
                                                        child.columns.length - 1 && (
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleReorderColumns(
                                                              index,
                                                              cIdx,
                                                              colIdx,
                                                              colIdx + 1,
                                                            );
                                                          }}
                                                          className="opacity-0 group-hover/th:opacity-100 p-0.5 hover:text-primary rounded text-xxs transition-opacity"
                                                          title="Move column right"
                                                        >
                                                          <ChevronRight className="w-2.5 h-2.5" />
                                                        </button>
                                                      )}
                                                    {!isPointNo && (
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleCopyColumn(child, col.id, col.label || col.id);
                                                        }}
                                                        className="opacity-0 group-hover/th:opacity-100 p-0.5 hover:text-primary rounded text-xxs transition-opacity text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                                        title={`Copy all values from "${col.label || col.id}"`}
                                                      >
                                                        <ClipboardCopy className="w-2.5 h-2.5" />
                                                      </button>
                                                    )}
                                                    {!isPointNo && col.type !== "formula" && col.type !== "status" && (
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleOpenPasteModal(index, cIdx, child, col.id);
                                                        }}
                                                        className="opacity-0 group-hover/th:opacity-100 p-0.5 hover:text-primary rounded text-xxs transition-opacity text-primary"
                                                        title={`Paste values into "${col.label || col.id}"`}
                                                      >
                                                        <ClipboardPaste className="w-2.5 h-2.5" />
                                                      </button>
                                                    )}
                                                  </div>
                                                </th>
                                              );
                                            };

                                            const headerGroups = computeHeaderGroups(child.columns || []);

                                            const renderChildExcelCoordinateRow = () => {
                                              if (!showExcelCoordinates) return null;
                                              return (
                                                <tr className="bg-slate-100/90 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 font-mono text-[11px] font-bold border-b border-border divide-x divide-border select-none">
                                                  {child.columns.map((col, colIdx) => (
                                                    <th
                                                      key={`child_excel_col_${col.id || colIdx}`}
                                                      style={{
                                                        width: col.width,
                                                        minWidth:
                                                          col.width ||
                                                          (col.id === "point_number" || col.id === "sl_no" || col.id === "sino"
                                                            ? "60px"
                                                            : "95px"),
                                                      }}
                                                      className="py-1 px-1 text-center font-mono font-bold tracking-wider bg-slate-150 dark:bg-slate-850 hover:bg-purple-100/60 dark:hover:bg-purple-950/40 text-slate-600 dark:text-slate-300 transition-colors"
                                                      title={`Excel Column ${getExcelColumnLetter(colIdx)} (${col.label || col.id})`}
                                                    >
                                                      <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold font-mono text-purple-700 dark:text-purple-300 bg-purple-50/90 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 shadow-2xs">
                                                        {getExcelColumnLetter(colIdx)}
                                                      </span>
                                                    </th>
                                                  ))}
                                                </tr>
                                              );
                                            };

                                            if (!headerGroups.hasGroups) {
                                              return (
                                                <>
                                                  {renderChildExcelCoordinateRow()}
                                                  <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b-2 border-slate-400 dark:border-slate-600 divide-x divide-slate-300 dark:divide-slate-700">
                                                    {child.columns.map((col, colIdx) => renderChildTh(col, colIdx, 1))}
                                                  </tr>
                                                </>
                                              );
                                            }

                                            return (
                                              <>
                                                {renderChildExcelCoordinateRow()}
                                                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-300 dark:border-slate-700 divide-x divide-slate-300 dark:divide-slate-700">
                                                  {headerGroups.topRow.map((topItem, topIdx) => {
                                                    if (topItem.type === "group") {
                                                      const firstCol = topItem.columns[0];
                                                      const firstColIdx = child.columns.findIndex((c) => c.id === firstCol.id);
                                                      return (
                                                        <th
                                                          key={`child_grp_${topIdx}`}
                                                          colSpan={topItem.colSpan}
                                                          onContextMenu={(e) =>
                                                            handleOpenHeaderGroupMenu(
                                                              e,
                                                              index,
                                                              cIdx,
                                                              firstCol.id,
                                                              topItem.groupName || "",
                                                              firstColIdx,
                                                              child.columns.length,
                                                              topItem.groupName,
                                                              true,
                                                              topItem.colSpan,
                                                            )
                                                          }
                                                          className="py-1 px-2 text-center text-xs font-bold uppercase tracking-wider bg-slate-200/80 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-b border-slate-300 dark:border-slate-600 relative group/grp"
                                                        >
                                                          <div className="flex items-center justify-center gap-1.5">
                                                            <span className="truncate max-w-[150px]">{topItem.groupName}</span>
                                                            <button
                                                              type="button"
                                                              onClick={(e) =>
                                                                handleOpenHeaderGroupMenu(
                                                                  e,
                                                                  index,
                                                                  cIdx,
                                                                  firstCol.id,
                                                                  topItem.groupName || "",
                                                                  firstColIdx,
                                                                  child.columns.length,
                                                                  topItem.groupName,
                                                                  true,
                                                                  topItem.colSpan,
                                                                )
                                                              }
                                                              className="opacity-0 group-hover/grp:opacity-100 p-0.5 hover:text-indigo-600 rounded text-xxs transition-opacity cursor-pointer"
                                                              title="Group Header Options (Edit / Unmerge)"
                                                            >
                                                              <MoreHorizontal className="w-3 h-3" />
                                                            </button>
                                                          </div>
                                                        </th>
                                                      );
                                                    }
                                                    const col = topItem.columns[0];
                                                    const colIdx = child.columns.findIndex((c) => c.id === col.id);
                                                    return renderChildTh(col, colIdx, 2);
                                                  })}
                                                </tr>
                                                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b-2 border-slate-400 dark:border-slate-600 divide-x divide-slate-300 dark:divide-slate-700">
                                                  {headerGroups.subRowColumns.map((col) => {
                                                    const colIdx = child.columns.findIndex((c) => c.id === col.id);
                                                    return renderChildTh(col, colIdx, 1);
                                                  })}
                                                </tr>
                                              </>
                                            );
                                          })()}
                                        </thead>
                                        <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
                                          {(() => {
                                            const coveredCells = getCoveredCells(child.rows, child.columns);
                                            return child.rows.map((row, rIdx) => {
                                            if (row.is_merged || row.isMerged) {
                                              const isPointNoCol =
                                                child.columns.find(
                                                  (c) =>
                                                    c.id === "point_number" ||
                                                    c.id === "sl_no" ||
                                                    c.id === "sino",
                                                );
                                              const statementVal =
                                                row.statement ??
                                                row.merged_text ??
                                                row.description ??
                                                row.nominal ??
                                                "";
                                              return (
                                                <tr
                                                  key={rIdx}
                                                  className="divide-x divide-slate-300 dark:divide-slate-700 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/40 dark:hover:bg-amber-900/30 transition-colors group/row"
                                                >
                                                  <td
                                                    style={{
                                                      width: isPointNoCol?.width,
                                                      minWidth:
                                                        isPointNoCol?.width ||
                                                        "55px",
                                                    }}
                                                    className="py-1 px-1.5 font-bold text-slate-700 dark:text-slate-300 text-xs text-center bg-amber-100/50 dark:bg-amber-950/40"
                                                  >
                                                    <div className="flex items-center justify-center gap-1">
                                                      <span>
                                                        {row.point_number ??
                                                          rIdx + 1}
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleToggleMergeRow(
                                                            index,
                                                            cIdx,
                                                            rIdx,
                                                          );
                                                        }}
                                                        className="p-0.5 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 rounded transition-opacity"
                                                        title="Unmerge row back to normal columns"
                                                      >
                                                        <Merge className="w-2.5 h-2.5 rotate-180" />
                                                      </button>
                                                      {child.rows.length > 1 && (
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            const newRows =
                                                              child.rows.filter(
                                                                (_, i) =>
                                                                  i !== rIdx,
                                                              );
                                                            const newChildren =
                                                              block.children.map(
                                                                (c, i) =>
                                                                  i === cIdx &&
                                                                  c.type ===
                                                                    "table_grid"
                                                                    ? {
                                                                        ...c,
                                                                        rows: newRows,
                                                                      }
                                                                    : c,
                                                              );
                                                            updateBlock(index, {
                                                              ...block,
                                                              children:
                                                                newChildren as any,
                                                            });
                                                          }}
                                                          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground hover:text-rose-500 rounded transition-opacity"
                                                          title={`Delete row ${rIdx + 1}`}
                                                        >
                                                          <Trash2 className="w-2.5 h-2.5" />
                                                        </button>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td
                                                    colSpan={Math.max(
                                                      1,
                                                      child.columns.length - 1,
                                                    )}
                                                    className="py-1 px-2 text-left"
                                                  >
                                                    <div className="flex items-center gap-2">
                                                      <Badge
                                                        variant="outline"
                                                        className="shrink-0 text-2xs py-0 px-1 font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                                                      >
                                                        Merged Statement
                                                      </Badge>
                                                      <Input
                                                        type="text"
                                                        value={statementVal}
                                                        onChange={(e) => {
                                                          const newRows = [
                                                            ...child.rows,
                                                          ];
                                                          newRows[rIdx] = {
                                                            ...newRows[rIdx],
                                                            statement:
                                                              e.target.value,
                                                            merged_text:
                                                              e.target.value,
                                                            description:
                                                              e.target.value,
                                                          };
                                                          const newChildren =
                                                            block.children.map(
                                                              (c, i) =>
                                                                i === cIdx &&
                                                                c.type ===
                                                                  "table_grid"
                                                                  ? {
                                                                      ...c,
                                                                      rows: newRows,
                                                                    }
                                                                  : c,
                                                            );
                                                          updateBlock(index, {
                                                            ...block,
                                                            children:
                                                              newChildren as any,
                                                          });
                                                        }}
                                                        className="h-7 w-full text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded px-2 font-medium text-slate-800 dark:text-slate-100"
                                                        placeholder='e.g., "All the jaws are free from dent and damages"'
                                                      />
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            }

                                            return (
                                              <tr
                                                key={rIdx}
                                                className="divide-x divide-slate-300 dark:divide-slate-700 hover:bg-slate-50/50 group/row"
                                              >
                                                {child.columns.map((col, colIdx) => {
                                                  if (coveredCells.has(`${rIdx}_${col.id}`)) {
                                                    return null;
                                                  }
                                                  const spanInfo = row.cellSpans?.[col.id];
                                                  const span = spanInfo?.colSpan || 1;
                                                  const rSpan = spanInfo?.rowSpan || 1;
                                                  const isMergedCell = span > 1 || rSpan > 1;

                                                  const isPointNo =
                                                    col.id === "point_number" ||
                                                    col.id === "sl_no" ||
                                                    col.id === "sino";
                                                  if (isPointNo) {
                                                    return (
                                                      <td
                                                        key={col.id}
                                                        colSpan={span > 1 ? span : undefined}
                                                        rowSpan={rSpan > 1 ? rSpan : undefined}
                                                        className="py-1 px-1.5 font-bold text-slate-700 dark:text-slate-300 text-xs text-center"
                                                      >
                                                        <div className="flex items-center justify-center gap-1">
                                                          <span>
                                                            {row.point_number ??
                                                              row[col.id] ??
                                                              rIdx + 1}
                                                          </span>
                                                          <button
                                                            type="button"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleToggleMergeRow(
                                                                index,
                                                                cIdx,
                                                                rIdx,
                                                              );
                                                            }}
                                                            className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground hover:text-amber-600 rounded transition-opacity"
                                                            title="Merge row across all columns for statement/notes"
                                                          >
                                                            <Merge className="w-2.5 h-2.5" />
                                                          </button>
                                                          {child.rows.length >
                                                            1 && (
                                                            <button
                                                              type="button"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newRows =
                                                                  child.rows.filter(
                                                                    (_, i) =>
                                                                      i !==
                                                                      rIdx,
                                                                  );
                                                                const newChildren =
                                                                  block.children.map(
                                                                    (c, i) =>
                                                                      i ===
                                                                        cIdx &&
                                                                      c.type ===
                                                                        "table_grid"
                                                                        ? {
                                                                            ...c,
                                                                            rows: newRows,
                                                                          }
                                                                        : c,
                                                                  );
                                                                updateBlock(
                                                                  index,
                                                                  {
                                                                    ...block,
                                                                    children:
                                                                      newChildren as any,
                                                                  },
                                                                );
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

                                                  // MERGED CELL (span > 1 || rSpan > 1)
                                                  if (isMergedCell) {
                                                    const cellVal = row[col.id] !== undefined ? row[col.id] : (col.id === "nominal" ? row.nominal : "") ?? "";
                                                    const borderClass = (span > 1 && rSpan > 1)
                                                      ? "border-2 border-dashed border-purple-500/80 bg-purple-50/50 dark:bg-purple-950/20"
                                                      : span > 1
                                                      ? "border-2 border-dashed border-amber-400/80 bg-amber-50/50 dark:bg-amber-950/20"
                                                      : "border-2 border-dashed border-indigo-400/80 bg-indigo-50/50 dark:bg-indigo-950/20";
                                                    return (
                                                      <td
                                                        key={col.id}
                                                        colSpan={span > 1 ? span : undefined}
                                                        rowSpan={rSpan > 1 ? rSpan : undefined}
                                                        onContextMenu={(e) =>
                                                          handleOpenCellMenu(
                                                            e,
                                                            index,
                                                            cIdx,
                                                            rIdx,
                                                            col.id,
                                                            col.label || col.id,
                                                            colIdx,
                                                            child.columns.length,
                                                            span,
                                                            rSpan,
                                                            child.rows.length,
                                                          )
                                                        }
                                                        className={`py-1 px-1.5 align-middle relative group/cell ${borderClass}`}
                                                      >
                                                        {/* Action buttons pinned to top right so they never squeeze inputs */}
                                                        <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-40 group-hover/cell:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-slate-900/80 rounded px-0.5 shadow-xs">
                                                          <button
                                                            type="button"
                                                            onClick={(e) =>
                                                              handleOpenCellMenu(
                                                                e,
                                                                index,
                                                                cIdx,
                                                                rIdx,
                                                                col.id,
                                                                col.label || col.id,
                                                                colIdx,
                                                                child.columns.length,
                                                                span,
                                                                rSpan,
                                                                child.rows.length,
                                                              )
                                                            }
                                                            className="p-0.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded transition-colors"
                                                            title="Cell merge menu (or right-click)"
                                                          >
                                                            <MoreHorizontal className="w-3 h-3" />
                                                          </button>
                                                          <button
                                                            type="button"
                                                            onClick={() => handleResetCellSpans(index, cIdx, rIdx, col.id)}
                                                            className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                                                            title="Unmerge cells back to normal individual cells"
                                                            >
                                                            <X className="w-3 h-3" />
                                                          </button>
                                                        </div>

                                                        <div className={`w-full flex ${rSpan > 1 ? "flex-col items-center justify-center gap-1.5 py-1" : "items-center gap-1.5 pr-12"}`}>
                                                          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-center">
                                                            {span > 1 && (
                                                              <Badge
                                                                variant="outline"
                                                                className="shrink-0 text-[10px] py-0 px-1 font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                                                                title={`Merged across ${span} columns`}
                                                              >
                                                                {span} Cols
                                                              </Badge>
                                                            )}
                                                            {rSpan > 1 && (
                                                              <Badge
                                                                variant="outline"
                                                                className="shrink-0 text-[10px] py-0 px-1 font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700"
                                                                title={`Merged down ${rSpan} rows`}
                                                              >
                                                                {rSpan} Rows
                                                              </Badge>
                                                            )}
                                                          </div>
                                                          <Input
                                                            type="text"
                                                            value={cellVal ?? ""}
                                                            onChange={(e) => {
                                                              handleChildTableCellChange(
                                                                index,
                                                                cIdx,
                                                                rIdx,
                                                                col.id,
                                                                e.target.value,
                                                              );
                                                            }}
                                                            onBlur={(e) => {
                                                              const raw = e.target.value.trim();
                                                              if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                              const parsed = parseFloat(raw);
                                                              if (!isNaN(parsed) && (col.type === "reading" || col.type === "trial" || col.type === "nominal")) {
                                                                const colDec =
                                                                  col.decimal_places ??
                                                                  col.decimalPrecision ??
                                                                  child.decimal_places ??
                                                                  decimalPlaces ??
                                                                  3;
                                                                const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                                handleChildTableCellChange(index, cIdx, rIdx, col.id, formatted);
                                                              }
                                                            }}
                                                            className={`h-7 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-primary rounded px-2 ${
                                                              rSpan > 1 ? "w-full text-center" : "flex-1 min-w-[50px] text-center"
                                                            }`}
                                                            placeholder={col.type === "reading" || col.type === "trial" ? "0.00" : (col.label || "Value")}
                                                          />
                                                        </div>
                                                      </td>
                                                    );
                                                  }
                                                if (col.type === "nominal") {
                                                  const cellVal =
                                                    row[col.id] !== undefined
                                                      ? row[col.id]
                                                      : (col.id === "nominal" ? row.nominal : "") ?? "";
                                                  return (
                                                    <td
                                                      key={col.id}
                                                      style={{ width: col.width, minWidth: col.width || "70px" }}
                                                       onContextMenu={(e) => handleOpenCellMenu(e, index, cIdx, rIdx, col.id, col.label || col.id, colIdx, child.columns.length, 1, 1, child.rows.length)}
                                                       className="py-1 px-1 relative group/cell"
                                                      >
                                                         {row.cellFormulas?.[col.id] && (
                                                           <span
                                                             className="absolute top-0.5 left-0.5 px-1 py-0.2 text-[8px] font-mono font-bold bg-purple-100 dark:bg-purple-900/70 text-purple-700 dark:text-purple-300 rounded pointer-events-none z-10"
                                                             title={`Formula: ${row.cellFormulas[col.id]}`}
                                                           >
                                                             fx
                                                           </span>
                                                         )}
                                                         {(colIdx < child.columns.length - 1 || rIdx < child.rows.length - 1) && (
                                                           <button
                                                             type="button"
                                                             onClick={(e) =>
                                                               handleOpenCellMenu(
                                                                 e,
                                                                 index,
                                                                 cIdx,
                                                                 rIdx,
                                                                 col.id,
                                                                 col.label || col.id,
                                                                 colIdx,
                                                                 child.columns.length,
                                                                 1,
                                                                 1,
                                                                 child.rows.length,
                                                               )
                                                             }
                                                             className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-300 rounded-[3px] transition-all z-10"
                                                             title="Merge options (or right-click)"
                                                           >
                                                             <MoreHorizontal className="w-2.5 h-2.5" />
                                                           </button>
                                                         )}
                                                      <Input
                                                        value={cellVal}
                                                        onPaste={(e) =>
                                                          handleCellPaste(
                                                            e,
                                                            index,
                                                            cIdx,
                                                            rIdx,
                                                            col.id,
                                                          )
                                                        }
                                                        onChange={(e) => {
                                                          const v = e.target.value;
                                                          if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                            handleChildTableCellChange(index, cIdx, rIdx, col.id, v);
                                                          }
                                                        }}
                                                        onBlur={(e) => {
                                                          const raw = e.target.value.trim();
                                                          if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                          const parsed = parseFloat(raw);
                                                          if (!isNaN(parsed)) {
                                                            const colDec =
                                                              col.decimal_places ??
                                                              col.decimalPrecision ??
                                                              child.decimal_places ??
                                                              decimalPlaces ??
                                                              3;
                                                            const formatted =
                                                              colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                            handleChildTableCellChange(index, cIdx, rIdx, col.id, formatted);
                                                          }
                                                        }}
                                                        className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold transition-colors"
                                                        placeholder="0.00"
                                                      />
                                                    </td>
                                                  );
                                                }

                                                if (col.type === "text") {
                                                  const cellVal =
                                                    row[col.id] !== undefined
                                                      ? row[col.id]
                                                      : (col.id === "description" ? row.description : "") ?? "";
                                                  return (
                                                    <td
                                                      key={col.id}
                                                      style={{ width: col.width, minWidth: col.width || "90px" }}
                                                       onContextMenu={(e) => handleOpenCellMenu(e, index, cIdx, rIdx, col.id, col.label || col.id, colIdx, child.columns.length, 1, 1, child.rows.length)}
                                                       className="py-1 px-1 relative group/cell"
                                                    >
                                                      <Input
                                                        value={cellVal}
                                                        onPaste={(e) =>
                                                          handleCellPaste(
                                                            e,
                                                            index,
                                                            cIdx,
                                                            rIdx,
                                                            col.id,
                                                          )
                                                        }
                                                        onChange={(e) => {
                                                          handleChildTableCellChange(index, cIdx, rIdx, col.id, e.target.value);
                                                        }}
                                                        className="h-7 w-full text-xs text-left bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-sans text-slate-800 dark:text-slate-200 font-medium transition-colors"
                                                        placeholder="Text..."
                                                      />
                                                        {(colIdx < child.columns.length - 1 || rIdx < child.rows.length - 1) && (
                                                           <button
                                                            type="button"
                                                            onClick={(e) =>
                                                               handleOpenCellMenu(
                                                                 e,
                                                                 index,
                                                                 cIdx,
                                                                 rIdx,
                                                                 col.id,
                                                                 col.label || col.id,
                                                                 colIdx,
                                                                 child.columns.length,
                                                                 1,
                                                                 1,
                                                                 child.rows.length,
                                                               )
                                                             }
                                                            className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-300 rounded-[3px] transition-all z-10"
                                                            title="Merge options (or right-click)"
                                                          >
                                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                                          </button>
                                                        )}
                                                    </td>
                                                  );
                                                }

                                                if (col.type === "reading" || col.type === "trial") {
                                                  const cellVal =
                                                    row[col.id] !== undefined
                                                      ? row[col.id]
                                                      : (col.id === "reading" ? row.reading : "") ?? "";
                                                  return (
                                                    <td
                                                      key={col.id}
                                                      style={{ width: col.width, minWidth: col.width || "70px" }}
                                                       onContextMenu={(e) => handleOpenCellMenu(e, index, cIdx, rIdx, col.id, col.label || col.id, colIdx, child.columns.length, 1, 1, child.rows.length)}
                                                       className="py-1 px-1 relative group/cell"
                                                    >
                                                      <Input
                                                        value={cellVal}
                                                        onPaste={(e) =>
                                                          handleCellPaste(
                                                            e,
                                                            index,
                                                            cIdx,
                                                            rIdx,
                                                            col.id,
                                                          )
                                                        }
                                                        onChange={(e) => {
                                                          const v = e.target.value;
                                                          if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                            handleChildTableCellChange(index, cIdx, rIdx, col.id, v);
                                                          }
                                                        }}
                                                        onBlur={(e) => {
                                                          const raw = e.target.value.trim();
                                                          if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                          const parsed = parseFloat(raw);
                                                          if (!isNaN(parsed)) {
                                                            const colDec =
                                                              col.decimal_places ??
                                                              col.decimalPrecision ??
                                                              child.decimal_places ??
                                                              decimalPlaces ??
                                                              3;
                                                            const formatted =
                                                              colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                            handleChildTableCellChange(index, cIdx, rIdx, col.id, formatted);
                                                          }
                                                        }}
                                                        className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold transition-colors"
                                                        placeholder="0.00"
                                                      />
                                                        {(colIdx < child.columns.length - 1 || rIdx < child.rows.length - 1) && (
                                                           <button
                                                            type="button"
                                                            onClick={(e) =>
                                                               handleOpenCellMenu(
                                                                 e,
                                                                 index,
                                                                 cIdx,
                                                                 rIdx,
                                                                 col.id,
                                                                 col.label || col.id,
                                                                 colIdx,
                                                                 child.columns.length,
                                                                 1,
                                                                 1,
                                                                 child.rows.length,
                                                               )
                                                             }
                                                            className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-300 rounded-[3px] transition-all z-10"
                                                            title="Merge options (or right-click)"
                                                          >
                                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                                          </button>
                                                        )}
                                                    </td>
                                                  );
                                                }

                                                if (col.type === "tolerance") {
                                                  const cellVal =
                                                    row[col.id] !== undefined
                                                      ? row[col.id]
                                                      : (col.id === "tolerance" ? row.tolerance : "") ?? "";
                                                  return (
                                                    <td
                                                      key={col.id}
                                                      style={{ width: col.width, minWidth: col.width || "70px" }}
                                                       onContextMenu={(e) => handleOpenCellMenu(e, index, cIdx, rIdx, col.id, col.label || col.id, colIdx, child.columns.length, 1, 1, child.rows.length)}
                                                       className="py-1 px-1 relative group/cell"
                                                    >
                                                      <Input
                                                        value={cellVal}
                                                        onPaste={(e) =>
                                                          handleCellPaste(
                                                            e,
                                                            index,
                                                            cIdx,
                                                            rIdx,
                                                            col.id,
                                                          )
                                                        }
                                                        onChange={(e) => {
                                                          const v = e.target.value;
                                                          if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                                            handleChildTableCellChange(index, cIdx, rIdx, col.id, v);
                                                          }
                                                        }}
                                                        onBlur={(e) => {
                                                          const raw = e.target.value.trim();
                                                          if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                                          const parsed = parseFloat(raw);
                                                          if (!isNaN(parsed)) {
                                                            const colDec =
                                                              col.decimal_places ??
                                                              col.decimalPrecision ??
                                                              child.decimal_places ??
                                                              decimalPlaces ??
                                                              3;
                                                            const formatted =
                                                              colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                                            handleChildTableCellChange(index, cIdx, rIdx, col.id, formatted);
                                                          }
                                                        }}
                                                        className="h-7 w-full text-xs text-center bg-transparent border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 font-metrology text-slate-800 dark:text-slate-200 font-semibold transition-colors"
                                                        placeholder="±Tol"
                                                      />
                                                        {(colIdx < child.columns.length - 1 || rIdx < child.rows.length - 1) && (
                                                           <button
                                                            type="button"
                                                            onClick={(e) =>
                                                               handleOpenCellMenu(
                                                                 e,
                                                                 index,
                                                                 cIdx,
                                                                 rIdx,
                                                                 col.id,
                                                                 col.label || col.id,
                                                                 colIdx,
                                                                 child.columns.length,
                                                                 1,
                                                                 1,
                                                                 child.rows.length,
                                                               )
                                                             }
                                                            className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-300 rounded-[3px] transition-all z-10"
                                                            title="Merge options (or right-click)"
                                                          >
                                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                                          </button>
                                                        )}
                                                    </td>
                                                  );
                                                }

                                                  const hasCustomCellFormula = Boolean(row.cellFormulas?.[col.id]);
                                                  const isManualJudge =
                                                    !hasCustomCellFormula &&
                                                    (Boolean(col.isManualJudgement) ||
                                                    (col as any).judgementMode === "manual" ||
                                                    ((col.type === "status" || col.role === "JUDGEMENT" || col.label?.toLowerCase().includes("judg")) && !col.formula));

                                                  if (isManualJudge) {
                                                    const cellVal = row[col.id] ?? row.status ?? row.judgement ?? "OK";
                                                    return (
                                                      <td
                                                        key={col.id}
                                                        style={{ width: col.width, minWidth: col.width || "75px" }}
                                                        onContextMenu={(e) =>
                                                          handleOpenCellMenu(
                                                            e,
                                                            index,
                                                            cIdx,
                                                            rIdx,
                                                            col.id,
                                                            col.label || col.id,
                                                            colIdx,
                                                            child.columns.length,
                                                            1,
                                                            1,
                                                            child.rows.length,
                                                          )
                                                        }
                                                        className="py-1 px-1 text-center relative group/cell"
                                                      >
                                                        <JudgementCellControl
                                                          value={cellVal}
                                                          onChange={(newVal) => {
                                                            handleChildTableCellChange(index, cIdx, rIdx, col.id, newVal);
                                                          }}
                                                        />
                                                        <button
                                                          type="button"
                                                          onClick={(e) =>
                                                            handleOpenCellMenu(
                                                              e,
                                                              index,
                                                              cIdx,
                                                              rIdx,
                                                              col.id,
                                                              col.label || col.id,
                                                              colIdx,
                                                              child.columns.length,
                                                              1,
                                                              1,
                                                              child.rows.length,
                                                            )
                                                          }
                                                          className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                                          title="Formula & Cell options (or right-click)"
                                                        >
                                                          <MoreHorizontal className="w-2.5 h-2.5" />
                                                        </button>
                                                      </td>
                                                    );
                                                  }

                                                  const evaluated = evaluatePreviewCell(
                                                    row,
                                                    col,
                                                    child.decimal_places ?? decimalPlaces,
                                                    child.columns,
                                                    (child as TableGridBlock).nominal,
                                                    rIdx,
                                                    child.rows,
                                                    (child as TableGridBlock).tolerance,
                                                  );
                                                  const isJudgementCol =
                                                    col.type === "status" ||
                                                    col.role === "JUDGEMENT" ||
                                                    col.label.toLowerCase().includes("judg");

                                                  if (isJudgementCol && evaluated) {
                                                    return (
                                                      <td
                                                        key={col.id}
                                                        style={{ width: col.width, minWidth: col.width || "75px" }}
                                                        onContextMenu={(e) =>
                                                          handleOpenCellMenu(
                                                            e,
                                                            index,
                                                            cIdx,
                                                            rIdx,
                                                            col.id,
                                                            col.label || col.id,
                                                            colIdx,
                                                            child.columns.length,
                                                            1,
                                                            1,
                                                            child.rows.length,
                                                          )
                                                        }
                                                        className="py-1.5 px-2 text-center relative group/cell"
                                                      >
                                                        <div className="flex items-center justify-center gap-1">
                                                          {hasCustomCellFormula && (
                                                            <span
                                                              className="text-[9px] px-1 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono rounded font-bold cursor-pointer hover:bg-purple-200"
                                                              title={`Custom formula: ${row.cellFormulas[col.id]}`}
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCellFormulaModalState({
                                                                  blockIndex: index,
                                                                  childIndex: cIdx,
                                                                  rowIndex: rIdx,
                                                                  colId: col.id,
                                                                  colLabel: col.label || col.id,
                                                                  initialFormula: row.cellFormulas[col.id] || "",
                                                                });
                                                              }}
                                                            >
                                                              fx
                                                            </span>
                                                          )}
                                                          {typeof evaluated === "object" ? (
                                                            evaluated
                                                          ) : (
                                                            (() => {
                                                              const strVal = String(evaluated).trim().toUpperCase();
                                                              const isPass = strVal === "PASS" || strVal === "OK";
                                                              const isFail = strVal === "FAIL" || strVal === "NOT OK" || strVal === "REJECT";
                                                              return isPass ? (
                                                                <span className="inline-block px-2.5 py-0.5 rounded text-tiny font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                                                  PASS
                                                                </span>
                                                              ) : isFail ? (
                                                                <span className="inline-block px-2.5 py-0.5 rounded text-tiny font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                                                                  FAIL
                                                                </span>
                                                              ) : (
                                                                <span className="font-mono text-xs text-slate-400">
                                                                  {evaluated}
                                                                </span>
                                                              );
                                                            })()
                                                          )}
                                                        </div>

                                                        <button
                                                          type="button"
                                                          onClick={(e) =>
                                                            handleOpenCellMenu(
                                                              e,
                                                              index,
                                                              cIdx,
                                                              rIdx,
                                                              col.id,
                                                              col.label || col.id,
                                                              colIdx,
                                                              child.columns.length,
                                                              1,
                                                              1,
                                                              child.rows.length,
                                                            )
                                                          }
                                                          className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                                          title="Formula & Cell options (or right-click)"
                                                        >
                                                          <MoreHorizontal className="w-2.5 h-2.5" />
                                                        </button>
                                                      </td>
                                                    );
                                                  }

                                                  return (
                                                    <td
                                                      key={col.id}
                                                      style={{ width: col.width, minWidth: col.width || "70px" }}
                                                      onContextMenu={(e) =>
                                                        handleOpenCellMenu(
                                                          e,
                                                          index,
                                                          cIdx,
                                                          rIdx,
                                                          col.id,
                                                          col.label || col.id,
                                                          colIdx,
                                                          child.columns.length,
                                                          1,
                                                          1,
                                                          child.rows.length,
                                                        )
                                                      }
                                                      className="py-1 px-2 font-mono font-bold text-slate-900 dark:text-slate-100 text-center text-xs relative group/cell"
                                                    >
                                                      <div className="flex items-center justify-center gap-1">
                                                        {hasCustomCellFormula && (
                                                          <span
                                                            className="text-[9px] px-1 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono rounded font-bold cursor-pointer hover:bg-purple-200"
                                                            title={`Custom formula: ${row.cellFormulas[col.id]}`}
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setCellFormulaModalState({
                                                                blockIndex: index,
                                                                childIndex: cIdx,
                                                                rowIndex: rIdx,
                                                                colId: col.id,
                                                                colLabel: col.label || col.id,
                                                                initialFormula: row.cellFormulas[col.id] || "",
                                                              });
                                                            }}
                                                          >
                                                            fx
                                                          </span>
                                                        )}
                                                        <span>{evaluated}</span>
                                                      </div>

                                                      <button
                                                        type="button"
                                                        onClick={(e) =>
                                                          handleOpenCellMenu(
                                                            e,
                                                            index,
                                                            cIdx,
                                                            rIdx,
                                                            col.id,
                                                            col.label || col.id,
                                                            colIdx,
                                                            child.columns.length,
                                                            1,
                                                            1,
                                                            child.rows.length,
                                                          )
                                                        }
                                                        className="opacity-0 group-hover/cell:opacity-40 hover:!opacity-100 absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center p-0 text-slate-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 dark:hover:text-purple-300 rounded-[3px] transition-all z-10"
                                                        title="Formula & Cell options (or right-click)"
                                                      >
                                                        <MoreHorizontal className="w-2.5 h-2.5" />
                                                      </button>
                                                    </td>
                                                  );
                                              })}
                                            </tr>
                                          );
                                        });
                                      })()}
                                    </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* Child Table Row & Column Controls */}
                                <div className="bg-slate-50/80 dark:bg-slate-900/60 p-2 flex items-center justify-between text-xs border-t border-slate-200 dark:border-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newPointNum = child.rows.length + 1;
                                        const paramRows = child.rows.filter(
                                          (r) => !r.is_merged && !r.isMerged,
                                        );
                                        const lastParamRow =
                                          paramRows[paramRows.length - 1];
                                        const isSpecTable = child.columns.some(
                                          (c) =>
                                            c &&
                                            (c.id === "specification" ||
                                              c.id === "required_dimension" ||
                                              /spec/i.test(c.label || c.id)),
                                        );
                                        const lastNominal =
                                          typeof lastParamRow?.nominal === "number"
                                            ? lastParamRow.nominal
                                            : parseFloat(
                                                String(lastParamRow?.nominal || 0),
                                              );
                                        const newNominal = isSpecTable
                                          ? 0
                                          : isNaN(lastNominal) || lastNominal === 0
                                            ? 0
                                            : lastNominal + 10;

                                        const rawRow: CanvasRowData = {
                                          point_number: newPointNum,
                                          nominal: newNominal,
                                          unit: child.unit || "mm",
                                          tolerance: child.tolerance ?? 0.02,
                                        };
                                        const tol = parseFloat(String(child.tolerance ?? 0.02)) || 0.02;
                                        const dec = child.decimal_places ?? decimalPlaces ?? 3;
                                        const evaluatedNewRow = evaluateCanvasRowFormulas(rawRow, child.columns, tol, dec, child.nominal);
                                        const newChildren = block.children.map((c, i) =>
                                          i === cIdx && c.type === "table_grid"
                                            ? { ...c, rows: [...c.rows, evaluatedNewRow] }
                                            : c,
                                        );
                                        updateBlock(index, { ...block, children: newChildren as any });
                                      }}
                                      className="h-7 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 border-dashed border-primary/40 rounded-md gap-1 flex items-center"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add Row</span>
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenAddColumnModal(child);
                                      }}
                                      className="h-7 px-2.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 border-dashed border-indigo-400/50 rounded-md gap-1 flex items-center"
                                      title="Add column to this side-by-side table"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add Column</span>
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddMergedStatementRow(index, cIdx);
                                      }}
                                      className="h-7 px-2 text-2xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-dashed border-amber-400/60 rounded-md gap-1 flex items-center"
                                      title="Add a merged statement row across all columns for observations or notes"
                                    >
                                      <Merge className="w-3 h-3" />
                                      <span>Add Statement Row</span>
                                    </Button>
                                  </div>
                                    {child.rows.length > 1 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newRows = child.rows.slice(0, -1);
                                          const newChildren = block.children.map((c, i) =>
                                            i === cIdx && c.type === "table_grid"
                                              ? { ...c, rows: newRows }
                                              : c,
                                          );
                                          updateBlock(index, { ...block, children: newChildren as any });
                                        }}
                                        className="h-6 px-2 text-2xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md font-medium"
                                      >
                                        Remove Last
                                      </Button>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. MATRIX TABLE */}
                {block.type === "matrix_table" && (() => {
                  const matrix = block as MatrixTableBlock;
                  const totalCols = getMatrixTotalCols(matrix);
                  const { coveredCells: coveredHeaders } = computeMatrix2DGrid(matrix.headers || [], totalCols);
                  const { coveredCells: coveredRows } = computeMatrix2DGrid(matrix.rows || [], totalCols);

                  return (
                    <div className="border-2 border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                      {/* Top Bar: Title, Badge, Controls */}
                      <div className="bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-slate-850 dark:to-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 flex items-center justify-between border-b-2 border-slate-300 dark:border-slate-700 flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input
                            value={matrix.title}
                            onChange={(e) => {
                              const updated = { ...matrix, title: e.target.value };
                              updateBlock(index, updated);
                            }}
                            className="h-8 text-xs font-bold bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-md px-2.5 focus-visible:ring-2 focus-visible:ring-primary text-slate-900 dark:text-slate-100 shadow-2xs w-64 max-w-full"
                            placeholder="Matrix Table Title"
                          />
                          <Badge
                            variant="outline"
                            className="text-xxs uppercase font-mono font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                          >
                            Matrix Table ({totalCols} Cols)
                          </Badge>
                        </div>

                        {/* Matrix Table Toolbar: Add/Remove Column, Row, Header Tier, Width */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Column Controls */}
                          <div className="flex items-center bg-white dark:bg-slate-950 rounded-md border border-slate-300 dark:border-slate-700 p-0.5 shadow-2xs">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddMatrixColumnBtn(index);
                              }}
                              className="h-6 px-2 text-2xs font-semibold text-primary gap-1"
                              title="Add column to matrix table"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Col</span>
                            </Button>
                            {totalCols > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveMatrixColumnBtn(index);
                                }}
                                className="h-6 px-1 text-2xs text-muted-foreground hover:text-destructive"
                                title="Remove last column"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>

                          {/* Data Row Controls */}
                          <div className="flex items-center bg-white dark:bg-slate-950 rounded-md border border-slate-300 dark:border-slate-700 p-0.5 shadow-2xs">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddMatrixRowBtn(index);
                              }}
                              className="h-6 px-2 text-2xs font-semibold text-emerald-600 dark:text-emerald-400 gap-1"
                              title="Add data row to matrix table"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Row</span>
                            </Button>
                            {(matrix.rows || []).length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveMatrixRowBtn(index);
                                }}
                                className="h-6 px-1 text-2xs text-muted-foreground hover:text-destructive"
                                title="Remove last row"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>

                          {/* Header Tier Controls */}
                          <div className="flex items-center bg-white dark:bg-slate-950 rounded-md border border-slate-300 dark:border-slate-700 p-0.5 shadow-2xs">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddMatrixHeaderRowBtn(index);
                              }}
                              className="h-6 px-2 text-2xs font-semibold text-indigo-600 dark:text-indigo-400 gap-1"
                              title="Add header tier to matrix table"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Tier</span>
                            </Button>
                            {(matrix.headers || []).length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveMatrixHeaderRowBtn(index);
                                }}
                                className="h-6 px-1 text-2xs text-muted-foreground hover:text-destructive"
                                title="Remove last header tier"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>

                          {/* Clear All Rows */}
                          {(matrix.rows || []).length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Clear all data rows from this matrix table?")) {
                                  handleClearMatrixAllRows(index);
                                }
                              }}
                              className="h-6 px-1.5 text-2xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 rounded gap-1"
                              title="Clear all data rows"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Clear Rows</span>
                            </Button>
                          )}

                          {/* Width Toggle: 100% vs 50% */}
                          <div className="flex items-center bg-white dark:bg-slate-950 p-0.5 rounded-md border border-slate-300 dark:border-slate-700 text-2xs shadow-2xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateBlock(index, { ...matrix, width: "100%" });
                              }}
                              className={`px-2 py-0.5 rounded text-2xs font-semibold transition-all ${
                                !matrix.width || matrix.width === "100%"
                                  ? "bg-primary text-white shadow-2xs"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              title="Full width (100%)"
                            >
                              100%
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateBlock(index, { ...matrix, width: "50%" });
                              }}
                              className={`px-2 py-0.5 rounded text-2xs font-semibold transition-all ${
                                matrix.width === "50%"
                                  ? "bg-primary text-white shadow-2xs"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              title="Half width (50%)"
                            >
                              50%
                            </button>
                          </div>

                          {/* Preset Buttons & Geometry Healing */}
                          <div className="flex items-center gap-1 bg-white dark:bg-slate-950 p-0.5 rounded-md border border-slate-300 dark:border-slate-700 shadow-2xs">
                            {/* IS 3651 (7-Col Caliper) Preset */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    "Load standard 7-Column Vernier Caliper Acceptance Criteria Matrix (0.01mm, 0.02mm, 0.05mm least counts)? This will configure standard grouped MPE headers and length rows."
                                  )
                                ) {
                                  const preset = createVernierCaliper7ColPreset();
                                  updateBlock(index, { ...matrix, ...preset });
                                  toast.success("Loaded 7-Column Caliper Acceptance Criteria Matrix");
                                }
                              }}
                              className="h-6 px-1.5 text-2xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1"
                              title="Load 7-Column Vernier Caliper Matrix (0.01, 0.02, 0.05 mm MPE)"
                            >
                              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>7-Col Caliper</span>
                            </Button>

                            {/* 5-Col Caliper Preset */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    "Load standard 5-Column Acceptance Criteria Matrix (0.01mm & 0.02mm least counts)?"
                                  )
                                ) {
                                  const preset = createCaliper5ColPreset();
                                  updateBlock(index, { ...matrix, ...preset });
                                  toast.success("Loaded 5-Column Caliper Matrix");
                                }
                              }}
                              className="h-6 px-1.5 text-2xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 gap-1"
                              title="Load 5-Column Caliper Matrix (0.01, 0.02 mm MPE)"
                            >
                              <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              <span>5-Col</span>
                            </Button>

                            {/* Load IS 2092 Dial Gauge Reference Preset */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    "Load IS 2092:1983 Dial Gauge Limits of Error preset? This will populate the exact 3-column reference matrix with grouped headers and 6 standard test rows."
                                  )
                                ) {
                                  const preset = createIS2092DialGaugePreset();
                                  updateBlock(index, { ...matrix, ...preset });
                                  toast.success("Loaded IS 2092 Dial Gauge Reference Matrix");
                                }
                              }}
                              className="h-6 px-1.5 text-2xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 gap-1"
                              title="Load IS 2092:1983 Dial Gauge Reference Matrix (Grouped Headers + 6 Standard Test Rows)"
                            >
                              <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              <span>IS 2092</span>
                            </Button>

                            {/* Align & Heal Table Geometry */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNormalizeMatrixTableBtn(index);
                              }}
                              className="h-6 px-1.5 text-2xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 gap-1"
                              title="Fix & Align Columns: removes empty phantom columns and synchronizes all header tiers and rows"
                            >
                              <Wrench className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>Align Table</span>
                            </Button>
                          </div>

                          {/* Direct Delete Table Button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Are you sure you want to delete this Matrix Table block completely?")) {
                                deleteBlock(index);
                              }
                            }}
                            className="h-6 px-2 text-2xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded gap-1"
                            title="Delete entire matrix table block"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Table</span>
                          </Button>
                        </div>
                      </div>

                      {/* Interactive WYSIWYG Matrix Table */}
                      <div className="overflow-x-auto scrollbar-thin">
                        <table className="w-full border-collapse text-xs text-center border-slate-300 dark:border-slate-700">
                          <thead>
                            {(matrix.headers || []).map((hRow, hIdx) => {
                              const cells: any[] = Array.isArray(hRow) ? hRow : [hRow];
                              let colPointer = 0;
                              return (
                                <tr
                                  key={hIdx}
                                  className="bg-slate-100 dark:bg-slate-800 font-bold border-b-2 border-slate-300 dark:border-slate-700"
                                >
                                  {cells.map((rawCell: any, cIdx: number) => {
                                    while (colPointer < totalCols && coveredHeaders.has(`${hIdx}_${colPointer}`)) {
                                      colPointer++;
                                    }
                                    const actualCol = colPointer;
                                    const cell = normalizeMatrixCell(rawCell);
                                    colPointer += (cell.colSpan || 1);

                                    if (actualCol >= totalCols || coveredHeaders.has(`${hIdx}_${actualCol}`)) {
                                      return null;
                                    }

                                    const isMerged = (cell.colSpan || 1) > 1 || (cell.rowSpan || 1) > 1;

                                    return (
                                      <th
                                        key={cIdx}
                                        colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                                        rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                                        onContextMenu={(e) =>
                                          handleOpenMatrixCellMenu(e, index, true, hIdx, actualCol, cIdx, cell, totalCols, matrix.headers.length)
                                        }
                                        className="py-1 px-1 font-bold border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 relative group/mth align-middle"
                                      >
                                        <div className="flex items-center gap-1">
                                          <Input
                                            value={cell.text}
                                            onChange={(e) =>
                                              handleMatrixCellTextChange(index, true, hIdx, cIdx, e.target.value)
                                            }
                                            className="h-7 text-xs font-bold text-center bg-transparent border-0 hover:bg-slate-200/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 min-w-[50px] w-full"
                                            placeholder="Header"
                                          />
                                          <div className="opacity-0 group-hover/mth:opacity-100 absolute top-0.5 right-0.5 flex items-center gap-0.5 bg-white/90 dark:bg-slate-900/90 rounded px-0.5 shadow-2xs z-10">
                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleOpenMatrixCellMenu(e, index, true, hIdx, actualCol, cIdx, cell, totalCols, matrix.headers.length)
                                              }
                                              className="p-0.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100 rounded"
                                              title="Cell merge / alignment options (or right click)"
                                            >
                                              <MoreHorizontal className="w-3 h-3" />
                                            </button>
                                            {isMerged && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  handleSetMatrixCellColSpan(index, true, hIdx, cIdx, 1);
                                                  handleSetMatrixCellRowSpan(index, true, hIdx, cIdx, 1);
                                                }}
                                                className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                                                title="Unmerge cell"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            )}
                                            {totalCols > 1 && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRemoveMatrixColumnBtn(index, actualCol);
                                                }}
                                                className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                                                title={`Delete column ${actualCol + 1}`}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </th>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </thead>
                          <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
                            {(matrix.rows || []).length === 0 ? (
                              <tr>
                                <td
                                  colSpan={totalCols}
                                  className="py-6 px-4 text-center text-xs text-muted-foreground bg-slate-50/50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700"
                                >
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <span className="font-medium text-slate-600 dark:text-slate-400">
                                      No data rows in this matrix table
                                    </span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAddMatrixRowBtn(index)}
                                      className="h-6 px-2.5 text-2xs font-semibold text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-1"
                                    >
                                      <Plus className="w-3 h-3" />
                                      Add First Row
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              (matrix.rows || []).map((r: any, rIdx: number) => {
                                const cells: any[] = Array.isArray(r) ? r : [r];
                                let colPointer = 0;
                                return (
                                  <tr key={rIdx} className="hover:bg-slate-50/50">
                                    {cells.map((rawVal: any, cIdx: number) => {
                                      while (colPointer < totalCols && coveredRows.has(`${rIdx}_${colPointer}`)) {
                                        colPointer++;
                                      }
                                      const actualCol = colPointer;
                                      const cell = normalizeMatrixCell(rawVal);
                                      colPointer += (cell.colSpan || 1);

                                      if (actualCol >= totalCols || coveredRows.has(`${rIdx}_${actualCol}`)) {
                                        return null;
                                      }

                                      const isMerged = (cell.colSpan || 1) > 1 || (cell.rowSpan || 1) > 1;

                                      return (
                                        <td
                                          key={cIdx}
                                          colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                                          rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                                          style={{ textAlign: cell.align || "center" }}
                                          onContextMenu={(e) =>
                                            handleOpenMatrixCellMenu(e, index, false, rIdx, actualCol, cIdx, cell, totalCols, matrix.rows.length)
                                          }
                                          className="py-1 px-1 font-mono text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 relative group/mtd align-middle"
                                        >
                                          <div className="flex items-center gap-1">
                                            <Input
                                              value={cell.text}
                                              onChange={(e) =>
                                                handleMatrixCellTextChange(index, false, rIdx, cIdx, e.target.value)
                                              }
                                              className={`h-7 text-xs font-mono font-semibold bg-transparent border-0 hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-1 min-w-[50px] w-full text-${cell.align || "center"}`}
                                              placeholder="-"
                                            />
                                            <div className="opacity-0 group-hover/mtd:opacity-100 absolute top-0.5 right-0.5 flex items-center gap-0.5 bg-white/90 dark:bg-slate-900/90 rounded px-0.5 shadow-2xs z-10">
                                              <button
                                                type="button"
                                                onClick={(e) =>
                                                  handleOpenMatrixCellMenu(e, index, false, rIdx, actualCol, cIdx, cell, totalCols, matrix.rows.length)
                                                }
                                                className="p-0.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100 rounded"
                                                title="Cell merge / alignment options (or right click)"
                                              >
                                                <MoreHorizontal className="w-3 h-3" />
                                              </button>
                                              {isMerged && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    handleSetMatrixCellColSpan(index, false, rIdx, cIdx, 1);
                                                    handleSetMatrixCellRowSpan(index, false, rIdx, cIdx, 1);
                                                  }}
                                                  className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                                                  title="Unmerge cell"
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRemoveMatrixRowBtn(index, rIdx);
                                                }}
                                                className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                                                title={`Delete row ${rIdx + 1}`}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer Note Input */}
                      <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850">
                        <Input
                          value={matrix.footerNote || ""}
                          onChange={(e) =>
                            updateBlock(index, { ...matrix, footerNote: e.target.value })
                          }
                          className="h-7 text-xs bg-transparent border-0 hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-primary rounded px-2 text-muted-foreground italic placeholder:text-muted-foreground/60"
                          placeholder="Optional Footer Note / Standard Reference for Matrix Table (e.g. As Per ISO 17025 / AE/CAL-SOP/01)"
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* 4. NOTE / CALLOUT */}
                {block.type === "text_block" && (
                  <div className="p-3 border-2 border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-850 flex items-center gap-2.5 shadow-2xs">
                    <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                    <Input
                      value={block.content}
                      onChange={(e) =>
                        updateBlock(index, {
                          ...block,
                          content: e.target.value,
                        })
                      }
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
          {!readOnly && (
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
          )}
          </fieldset>
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
        existingBlocksCount={blocks.length}
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
          toast.success(
            "Pre-save audit passed! Template ready for production calibration.",
          );
        }}
      />

      {/* MODAL: Add Column Modal */}
      <AddColumnModal
        open={showAddColumnModal}
        onOpenChange={setShowAddColumnModal}
        targetTable={addColumnTargetTable || activeTableBlock}
        globalDecimalPlaces={decimalPlaces}
        onAddColumn={handleAddTableColumn}
      />

      {/* MODAL: Merge Tables Side-by-Side (50/50 Split) */}
      <MergeTablesModal
        open={showMergeModal}
        onOpenChange={setShowMergeModal}
        sourceTable={mergeSourceTable}
        availableTables={
          blocks.filter(
            (b) => b.type === "table_grid" && b.id !== mergeSourceTable?.id
          ) as TableGridBlock[]
        }
        onMerge={handleExecuteMerge}
      />

      {/* MODAL: Paste Column Values */}
      <PasteValuesModal
        open={showPasteValuesModal}
        onOpenChange={setShowPasteValuesModal}
        tableTitle={pasteTargetTable?.table?.title}
        columns={pasteTargetTable?.table?.columns || []}
        rowsCount={pasteTargetTable?.table?.rows?.length || 0}
        initialColId={pasteTargetTable?.colId}
        onApplyPaste={handleApplyModalPaste}
      />

      {/* Floating Cell Context Menu for Merging / Unmerging */}
      {cellContextMenu && (
        <div
          className="fixed z-50 min-w-[220px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-1 text-slate-900 dark:text-slate-100 shadow-xl shadow-slate-900/10 dark:shadow-black/40 backdrop-blur-md animate-in fade-in-50 zoom-in-95 font-sans select-none"
          style={{
            top: `${cellContextMenu.y}px`,
            left: `${cellContextMenu.x}px`,
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <Table className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate max-w-[130px] font-semibold text-slate-800 dark:text-slate-100">
                {cellContextMenu.colLabel || "Cell"}
              </span>
            </div>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
              Row {cellContextMenu.rowIndex + 1}
            </span>
          </div>

          {/* SECTION 1: HORIZONTAL MERGE (ACROSS COLUMNS) */}
          <div className="px-2.5 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ArrowRightLeft className="w-3 h-3" />
              Horizontal Merge (Cols)
            </span>
            {cellContextMenu.currentSpan > 1 && (
              <span className="text-[10px] font-mono px-1 py-0.2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded font-bold">
                {cellContextMenu.currentSpan} Cols Active
              </span>
            )}
          </div>
          <div className="py-0.5 px-1 flex flex-col gap-0.5">
            {cellContextMenu.currentSpan <= 1 ? (
              cellContextMenu.colIdx < cellContextMenu.totalCols - 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleSetCellColSpan(
                        cellContextMenu.blockIndex,
                        cellContextMenu.childIndex,
                        cellContextMenu.rowIndex,
                        cellContextMenu.colId,
                        2,
                      );
                      setCellContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-amber-50 hover:text-amber-900 dark:hover:bg-amber-950/60 dark:hover:text-amber-200 transition-colors font-medium group cursor-pointer"
                  >
                    <Merge className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                    <span className="flex-1">Merge with Next Column</span>
                    <span className="text-[10px] font-mono px-1 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded font-bold">
                      2 Cols
                    </span>
                  </button>

                  {cellContextMenu.maxRemaining >= 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSetCellColSpan(
                          cellContextMenu.blockIndex,
                          cellContextMenu.childIndex,
                          cellContextMenu.rowIndex,
                          cellContextMenu.colId,
                          3,
                        );
                        setCellContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-amber-50 hover:text-amber-900 dark:hover:bg-amber-950/60 dark:hover:text-amber-200 transition-colors font-medium group cursor-pointer"
                    >
                      <Merge className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="flex-1">Merge 3 Columns</span>
                      <span className="text-[10px] font-mono px-1 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded font-bold">
                        3 Cols
                      </span>
                    </button>
                  )}

                  {cellContextMenu.maxRemaining > 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSetCellColSpan(
                          cellContextMenu.blockIndex,
                          cellContextMenu.childIndex,
                          cellContextMenu.rowIndex,
                          cellContextMenu.colId,
                          cellContextMenu.maxRemaining,
                        );
                        setCellContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-amber-50 hover:text-amber-900 dark:hover:bg-amber-950/60 dark:hover:text-amber-200 transition-colors font-medium group cursor-pointer"
                    >
                      <Combine className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="flex-1">Merge to End of Row</span>
                      <span className="text-[10px] font-mono px-1 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded font-bold">
                        {cellContextMenu.maxRemaining} Cols
                      </span>
                    </button>
                  )}
                </>
              ) : (
                <div className="px-2.5 py-1 text-[11px] text-slate-400 dark:text-slate-500 italic">
                  Last column cannot be merged right
                </div>
              )
            ) : (
              <div className="flex items-center gap-1 px-1 py-0.5">
                {cellContextMenu.currentSpan < cellContextMenu.maxRemaining && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSetCellColSpan(
                        cellContextMenu.blockIndex,
                        cellContextMenu.childIndex,
                        cellContextMenu.rowIndex,
                        cellContextMenu.colId,
                        cellContextMenu.currentSpan + 1,
                      );
                      setCellContextMenu(null);
                    }}
                    className="flex-1 px-1.5 py-1 text-xs text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 hover:bg-amber-200/60 rounded text-center font-bold"
                  >
                    +1 Col
                  </button>
                )}
                {cellContextMenu.currentSpan > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSetCellColSpan(
                        cellContextMenu.blockIndex,
                        cellContextMenu.childIndex,
                        cellContextMenu.rowIndex,
                        cellContextMenu.colId,
                        cellContextMenu.currentSpan - 1,
                      );
                      setCellContextMenu(null);
                    }}
                    className="flex-1 px-1.5 py-1 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded text-center font-bold"
                  >
                    -1 Col
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleSetCellColSpan(
                      cellContextMenu.blockIndex,
                      cellContextMenu.childIndex,
                      cellContextMenu.rowIndex,
                      cellContextMenu.colId,
                      1,
                    );
                    setCellContextMenu(null);
                  }}
                  className="flex-1 px-1.5 py-1 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded text-center font-semibold"
                >
                  Reset Col
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />

          {/* SECTION 2: VERTICAL MERGE (DOWN ROWS) */}
          <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ArrowDown className="w-3 h-3" />
              Vertical Merge (Rows)
            </span>
            {cellContextMenu.currentRowSpan > 1 && (
              <span className="text-[10px] font-mono px-1 py-0.2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 rounded font-bold">
                {cellContextMenu.currentRowSpan} Rows Active
              </span>
            )}
          </div>
          <div className="py-0.5 px-1 flex flex-col gap-0.5">
            {cellContextMenu.currentRowSpan <= 1 ? (
              cellContextMenu.rowIndex < cellContextMenu.totalRows - 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleSetCellRowSpan(
                        cellContextMenu.blockIndex,
                        cellContextMenu.childIndex,
                        cellContextMenu.rowIndex,
                        cellContextMenu.colId,
                        2,
                      );
                      setCellContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-indigo-50 hover:text-indigo-900 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200 transition-colors font-medium group cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
                    <span className="flex-1">Merge with Row Below</span>
                    <span className="text-[10px] font-mono px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 rounded font-bold">
                      2 Rows
                    </span>
                  </button>

                  {cellContextMenu.maxRemainingRows >= 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSetCellRowSpan(
                          cellContextMenu.blockIndex,
                          cellContextMenu.childIndex,
                          cellContextMenu.rowIndex,
                          cellContextMenu.colId,
                          3,
                        );
                        setCellContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-indigo-50 hover:text-indigo-900 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200 transition-colors font-medium group cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="flex-1">Merge 3 Rows</span>
                      <span className="text-[10px] font-mono px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 rounded font-bold">
                        3 Rows
                      </span>
                    </button>
                  )}

                  {cellContextMenu.maxRemainingRows > 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSetCellRowSpan(
                          cellContextMenu.blockIndex,
                          cellContextMenu.childIndex,
                          cellContextMenu.rowIndex,
                          cellContextMenu.colId,
                          cellContextMenu.maxRemainingRows,
                        );
                        setCellContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-indigo-50 hover:text-indigo-900 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200 transition-colors font-medium group cursor-pointer"
                    >
                      <Combine className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
                      <span className="flex-1">Merge to Bottom of Column</span>
                      <span className="text-[10px] font-mono px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 rounded font-bold">
                        {cellContextMenu.maxRemainingRows} Rows
                      </span>
                    </button>
                  )}
                </>
              ) : (
                <div className="px-2.5 py-1 text-[11px] text-slate-400 dark:text-slate-500 italic">
                  Last row cannot be merged down
                </div>
              )
            ) : (
              <div className="flex items-center gap-1 px-1 py-0.5">
                {cellContextMenu.currentRowSpan < cellContextMenu.maxRemainingRows && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSetCellRowSpan(
                        cellContextMenu.blockIndex,
                        cellContextMenu.childIndex,
                        cellContextMenu.rowIndex,
                        cellContextMenu.colId,
                        cellContextMenu.currentRowSpan + 1,
                      );
                      setCellContextMenu(null);
                    }}
                    className="flex-1 px-1.5 py-1 text-xs text-indigo-800 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/40 hover:bg-indigo-200/60 rounded text-center font-bold"
                  >
                    +1 Row
                  </button>
                )}
                {cellContextMenu.currentRowSpan > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSetCellRowSpan(
                        cellContextMenu.blockIndex,
                        cellContextMenu.childIndex,
                        cellContextMenu.rowIndex,
                        cellContextMenu.colId,
                        cellContextMenu.currentRowSpan - 1,
                      );
                      setCellContextMenu(null);
                    }}
                    className="flex-1 px-1.5 py-1 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded text-center font-bold"
                  >
                    -1 Row
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleSetCellRowSpan(
                      cellContextMenu.blockIndex,
                      cellContextMenu.childIndex,
                      cellContextMenu.rowIndex,
                      cellContextMenu.colId,
                      1,
                    );
                    setCellContextMenu(null);
                  }}
                  className="flex-1 px-1.5 py-1 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded text-center font-semibold"
                >
                  Reset Row
                </button>
              </div>
            )}
          </div>

          {/* SECTION: FORMULA & CALCULATIONS */}
          {(() => {
            const targetBlock = blocks[cellContextMenu.blockIndex];
            let targetTbl: TableGridBlock | null = null;
            if (cellContextMenu.childIndex !== null && targetBlock?.type === "split_row") {
              targetTbl = (targetBlock as SplitRowBlock).children?.[cellContextMenu.childIndex] as TableGridBlock;
            } else if (targetBlock?.type === "table_grid") {
              targetTbl = targetBlock as TableGridBlock;
            }
            const currentCellFormula = targetTbl?.rows?.[cellContextMenu.rowIndex]?.cellFormulas?.[cellContextMenu.colId];

            return (
              <>
                <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />
                <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calculator className="w-3 h-3" />
                    Formula & Calculations
                  </span>
                  {currentCellFormula && (
                    <span className="text-[10px] font-mono px-1 py-0.2 bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 rounded font-bold">
                      fx Active
                    </span>
                  )}
                </div>
                <div className="py-0.5 px-1 flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCellFormulaModalState({
                        blockIndex: cellContextMenu.blockIndex,
                        childIndex: cellContextMenu.childIndex,
                        rowIndex: cellContextMenu.rowIndex,
                        colId: cellContextMenu.colId,
                        colLabel: cellContextMenu.colLabel,
                        initialFormula: currentCellFormula || "",
                      });
                      setCellContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-purple-50 hover:text-purple-900 dark:hover:bg-purple-950/60 dark:hover:text-purple-200 transition-colors font-medium group cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
                    <span className="flex-1">{currentCellFormula ? "Edit Cell Formula" : "Set Cell Formula / Cross-Table..."}</span>
                    <span className="text-[10px] font-mono px-1 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 rounded font-bold">
                      fx
                    </span>
                  </button>

                  {currentCellFormula && (
                    <button
                      type="button"
                      onClick={() => {
                        handleClearCellFormula(
                          cellContextMenu.blockIndex,
                          cellContextMenu.childIndex,
                          cellContextMenu.rowIndex,
                          cellContextMenu.colId,
                        );
                        setCellContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left text-rose-600 dark:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors font-medium cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="flex-1">Clear Formula (Allow Manual Input)</span>
                    </button>
                  )}
                </div>
              </>
            );
          })()}

          {/* SECTION 3: UNMERGE ALL */}
          {(cellContextMenu.currentSpan > 1 || cellContextMenu.currentRowSpan > 1) && (
            <>
              <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />
              <div className="px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    handleResetCellSpans(
                      cellContextMenu.blockIndex,
                      cellContextMenu.childIndex,
                      cellContextMenu.rowIndex,
                      cellContextMenu.colId,
                    );
                    setCellContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left text-rose-600 dark:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors font-semibold group cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform shrink-0" />
                  <span className="flex-1">Unmerge All (Reset Cell)</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded font-bold">
                    Reset
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Context Menu for Matrix Table Cells */}
      {matrixCellContextMenu && (
        <div
          className="fixed z-50 min-w-[220px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-1 text-slate-900 dark:text-slate-100 shadow-xl shadow-slate-900/10 dark:shadow-black/40 backdrop-blur-md animate-in fade-in-50 zoom-in-95 font-sans select-none"
          style={{
            top: `${matrixCellContextMenu.y}px`,
            left: `${matrixCellContextMenu.x}px`,
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
            <span className="truncate max-w-[130px] font-semibold text-slate-800 dark:text-slate-100">
              {matrixCellContextMenu.isHeader ? "Header Cell" : "Data Cell"}
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
              R{matrixCellContextMenu.rowIndex + 1} : C{matrixCellContextMenu.colIndex + 1}
            </span>
          </div>

          {/* HORIZONTAL MERGE */}
          <div className="px-2.5 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center justify-between">
            <span>Horizontal Merge (Cols)</span>
            {(matrixCellContextMenu.currentCell.colSpan || 1) > 1 && (
              <span className="text-[10px] font-mono px-1 py-0.2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded font-bold">
                {matrixCellContextMenu.currentCell.colSpan} Cols Active
              </span>
            )}
          </div>
          <div className="py-0.5 px-1 flex flex-col gap-0.5">
            {Array.from(
              {
                length: Math.max(
                  0,
                  matrixCellContextMenu.totalCols - matrixCellContextMenu.colIndex - 1
                ),
              },
              (_, i) => i + 2
            ).map((span) => (
                <button
                  key={span}
                  type="button"
                  onClick={() => {
                    handleSetMatrixCellColSpan(
                      matrixCellContextMenu.blockIndex,
                      matrixCellContextMenu.isHeader,
                      matrixCellContextMenu.rowIndex,
                      matrixCellContextMenu.cellArrayIdx,
                      span,
                    );
                    setMatrixCellContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs rounded hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors font-medium text-left"
                >
                  <span>Merge across {span} columns</span>
                  <span className="text-[10px] font-mono px-1 bg-amber-100 dark:bg-amber-900/60 rounded font-bold text-amber-800 dark:text-amber-200">
                    {span} Cols
                  </span>
                </button>
              ))}
            {(matrixCellContextMenu.currentCell.colSpan || 1) > 1 && (
              <button
                type="button"
                onClick={() => {
                  handleSetMatrixCellColSpan(
                    matrixCellContextMenu.blockIndex,
                    matrixCellContextMenu.isHeader,
                    matrixCellContextMenu.rowIndex,
                    matrixCellContextMenu.cellArrayIdx,
                    1,
                  );
                  setMatrixCellContextMenu(null);
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors font-medium text-left"
              >
                <X className="w-3 h-3" />
                <span>Reset Horizontal Merge</span>
              </button>
            )}
          </div>

          {/* VERTICAL MERGE */}
          <div className="px-2.5 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-1">
            <span>Vertical Merge (Rows)</span>
            {(matrixCellContextMenu.currentCell.rowSpan || 1) > 1 && (
              <span className="text-[10px] font-mono px-1 py-0.2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 rounded font-bold">
                {matrixCellContextMenu.currentCell.rowSpan} Rows Active
              </span>
            )}
          </div>
          <div className="py-0.5 px-1 flex flex-col gap-0.5">
            {Array.from(
              {
                length: Math.max(
                  0,
                  matrixCellContextMenu.totalRows - matrixCellContextMenu.rowIndex - 1
                ),
              },
              (_, i) => i + 2
            ).map((span) => (
                <button
                  key={span}
                  type="button"
                  onClick={() => {
                    handleSetMatrixCellRowSpan(
                      matrixCellContextMenu.blockIndex,
                      matrixCellContextMenu.isHeader,
                      matrixCellContextMenu.rowIndex,
                      matrixCellContextMenu.cellArrayIdx,
                      span,
                    );
                    setMatrixCellContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors font-medium text-left"
                >
                  <span>Merge down {span} rows</span>
                  <span className="text-[10px] font-mono px-1 bg-indigo-100 dark:bg-indigo-900/60 rounded font-bold text-indigo-800 dark:text-indigo-200">
                    {span} Rows
                  </span>
                </button>
              ))}
            {(matrixCellContextMenu.currentCell.rowSpan || 1) > 1 && (
              <button
                type="button"
                onClick={() => {
                  handleSetMatrixCellRowSpan(
                    matrixCellContextMenu.blockIndex,
                    matrixCellContextMenu.isHeader,
                    matrixCellContextMenu.rowIndex,
                    matrixCellContextMenu.cellArrayIdx,
                    1,
                  );
                  setMatrixCellContextMenu(null);
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors font-medium text-left"
              >
                <X className="w-3 h-3" />
                <span>Reset Vertical Merge</span>
              </button>
            )}
          </div>

          {/* ALIGNMENT */}
          <div className="px-2.5 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-t border-slate-100 dark:border-slate-800 mt-1">
            Text Alignment
          </div>
          <div className="p-1 flex items-center gap-1">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => {
                  handleSetMatrixCellAlign(
                    matrixCellContextMenu.blockIndex,
                    matrixCellContextMenu.isHeader,
                    matrixCellContextMenu.rowIndex,
                    matrixCellContextMenu.cellArrayIdx,
                    align,
                  );
                  setMatrixCellContextMenu(null);
                }}
                className={`flex-1 py-1 text-xs capitalize rounded border font-medium transition-colors ${
                  (matrixCellContextMenu.currentCell.align || "center") === align
                    ? "bg-primary text-white border-primary"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                }`}
              >
                {align}
              </button>
            ))}
          </div>

          {/* CELL & STRUCTURE ACTIONS */}
          <div className="px-2.5 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-t border-slate-100 dark:border-slate-800 mt-1">
            Cell & Structure Actions
          </div>
          <div className="py-0.5 px-1 flex flex-col gap-0.5">
            {/* Clear Cell Content */}
            <button
              type="button"
              onClick={() => {
                handleClearMatrixSpecificCell(
                  matrixCellContextMenu.blockIndex,
                  matrixCellContextMenu.isHeader,
                  matrixCellContextMenu.rowIndex,
                  matrixCellContextMenu.cellArrayIdx,
                );
                setMatrixCellContextMenu(null);
              }}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors font-medium text-left"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Clear Cell Content</span>
            </button>

            {/* If Header Cell & >1 tiers: Delete Header Tier */}
            {matrixCellContextMenu.isHeader && matrixCellContextMenu.totalRows > 1 && (
              <button
                type="button"
                onClick={() => {
                  handleRemoveMatrixHeaderRowBtn(
                    matrixCellContextMenu.blockIndex,
                    matrixCellContextMenu.rowIndex,
                  );
                  setMatrixCellContextMenu(null);
                }}
                className="w-full flex items-center justify-between px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors font-medium text-left"
              >
                <div className="flex items-center gap-1.5">
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Header Tier {matrixCellContextMenu.rowIndex + 1}</span>
                </div>
                <span className="text-[10px] font-mono px-1 bg-rose-100 dark:bg-rose-900/60 rounded font-bold text-rose-800 dark:text-rose-200">
                  Tier {matrixCellContextMenu.rowIndex + 1}
                </span>
              </button>
            )}

            {/* If Data Cell: Delete This Row */}
            {!matrixCellContextMenu.isHeader && (
              <button
                type="button"
                onClick={() => {
                  handleRemoveMatrixRowBtn(
                    matrixCellContextMenu.blockIndex,
                    matrixCellContextMenu.rowIndex,
                  );
                  setMatrixCellContextMenu(null);
                }}
                className="w-full flex items-center justify-between px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors font-medium text-left"
              >
                <div className="flex items-center gap-1.5">
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Row {matrixCellContextMenu.rowIndex + 1}</span>
                </div>
                <span className="text-[10px] font-mono px-1 bg-rose-100 dark:bg-rose-900/60 rounded font-bold text-rose-800 dark:text-rose-200">
                  R{matrixCellContextMenu.rowIndex + 1}
                </span>
              </button>
            )}

            {/* Delete This Column (if totalCols > 1) */}
            {matrixCellContextMenu.totalCols > 1 ? (
              <button
                type="button"
                onClick={() => {
                  handleRemoveMatrixColumnBtn(
                    matrixCellContextMenu.blockIndex,
                    matrixCellContextMenu.colIndex,
                  );
                  setMatrixCellContextMenu(null);
                }}
                className="w-full flex items-center justify-between px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors font-medium text-left"
              >
                <div className="flex items-center gap-1.5">
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Column {matrixCellContextMenu.colIndex + 1}</span>
                </div>
                <span className="text-[10px] font-mono px-1 bg-rose-100 dark:bg-rose-900/60 rounded font-bold text-rose-800 dark:text-rose-200">
                  C{matrixCellContextMenu.colIndex + 1}
                </span>
              </button>
            ) : (
              <div className="px-2 py-1 text-[11px] text-muted-foreground italic">
                (Min 1 column preserved)
              </div>
            )}

            {/* Clear All Rows if data rows exist */}
            {!matrixCellContextMenu.isHeader && matrixCellContextMenu.totalRows > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Are you sure you want to clear all data rows from this matrix table?")) {
                    handleClearMatrixAllRows(matrixCellContextMenu.blockIndex);
                  }
                  setMatrixCellContextMenu(null);
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition-colors font-medium text-left"
              >
                <RotateCcw className="w-3 h-3 text-amber-600" />
                <span>Clear All Data Rows ({matrixCellContextMenu.totalRows})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Context Menu for Header Grouping in Data Tables */}
      {headerGroupContextMenu && (() => {
        const currentCols = getTableColumns(
          headerGroupContextMenu.blockIndex,
          headerGroupContextMenu.childIndex
        );
        const colIdx = headerGroupContextMenu.colIdx;
        const curCol = currentCols[colIdx];
        const prevCol = colIdx > 0 ? currentCols[colIdx - 1] : null;
        const nextCol = colIdx < currentCols.length - 1 ? currentCols[colIdx + 1] : null;
        const isGroupHeader = Boolean(headerGroupContextMenu.isGroupHeader);
        const currentGroupName = headerGroupContextMenu.currentGroupName;

        // Group columns calculation
        const groupCols = currentGroupName
          ? currentCols.filter((c) => c.groupName === currentGroupName)
          : [];
        const groupIndices = currentGroupName
          ? currentCols
              .map((c, i) => (c.groupName === currentGroupName ? i : -1))
              .filter((i) => i !== -1)
          : [];
        const minGroupIdx = groupIndices.length > 0 ? Math.min(...groupIndices) : colIdx;
        const maxGroupIdx = groupIndices.length > 0 ? Math.max(...groupIndices) : colIdx;
        const canExtendRight = maxGroupIdx < currentCols.length - 1;
        const canExtendLeft = minGroupIdx > 0;
        const rightExtendCol = canExtendRight ? currentCols[maxGroupIdx + 1] : null;
        const leftExtendCol = canExtendLeft ? currentCols[minGroupIdx - 1] : null;

        return (
          <div
            className="fixed z-50 min-w-[250px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-1 text-slate-900 dark:text-slate-100 shadow-xl shadow-slate-900/10 dark:shadow-black/40 backdrop-blur-md animate-in fade-in-50 zoom-in-95 font-sans select-none text-xs"
            style={{
              top: `${headerGroupContextMenu.y}px`,
              left: `${headerGroupContextMenu.x}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
          >
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
              <span className="truncate max-w-[160px] font-semibold text-slate-800 dark:text-slate-100">
                {isGroupHeader ? `Group: ${currentGroupName}` : `Header: ${headerGroupContextMenu.colLabel}`}
              </span>
              {currentGroupName && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold">
                  {groupCols.length} cols
                </span>
              )}
            </div>

            <div className="p-1 flex flex-col gap-0.5">
              {/* Option: Join Left Group (e.g. JUDGEMENT joining OBSERVATIONS) */}
              {!currentGroupName && prevCol?.groupName && (
                <button
                  type="button"
                  onClick={() => {
                    handleJoinAdjacentGroup(
                      headerGroupContextMenu.blockIndex,
                      headerGroupContextMenu.childIndex,
                      headerGroupContextMenu.colId,
                      prevCol.groupName!
                    );
                    setHeaderGroupContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 dark:bg-indigo-950/50 dark:hover:bg-indigo-950/80 dark:text-indigo-200 transition-colors font-medium cursor-pointer"
                >
                  <Combine className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">Join Left Group ({prevCol.groupName})</span>
                </button>
              )}

              {/* Option: Join Right Group */}
              {!currentGroupName && nextCol?.groupName && (
                <button
                  type="button"
                  onClick={() => {
                    handleJoinAdjacentGroup(
                      headerGroupContextMenu.blockIndex,
                      headerGroupContextMenu.childIndex,
                      headerGroupContextMenu.colId,
                      nextCol.groupName!
                    );
                    setHeaderGroupContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 dark:bg-indigo-950/50 dark:hover:bg-indigo-950/80 dark:text-indigo-200 transition-colors font-medium cursor-pointer"
                >
                  <Combine className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">Join Right Group ({nextCol.groupName})</span>
                </button>
              )}

              {/* Extend Group Right (when group exists) */}
              {currentGroupName && canExtendRight && rightExtendCol && (
                <button
                  type="button"
                  onClick={() => {
                    handleExtendGroup(
                      headerGroupContextMenu.blockIndex,
                      headerGroupContextMenu.childIndex,
                      currentGroupName,
                      "right"
                    );
                    setHeaderGroupContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-indigo-50 hover:text-indigo-900 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200 transition-colors font-medium cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">Extend Right (+ {rightExtendCol.label || rightExtendCol.id})</span>
                </button>
              )}

              {/* Extend Group Left (when group exists) */}
              {currentGroupName && canExtendLeft && leftExtendCol && (
                <button
                  type="button"
                  onClick={() => {
                    handleExtendGroup(
                      headerGroupContextMenu.blockIndex,
                      headerGroupContextMenu.childIndex,
                      currentGroupName,
                      "left"
                    );
                    setHeaderGroupContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-indigo-50 hover:text-indigo-900 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200 transition-colors font-medium cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">Extend Left (+ {leftExtendCol.label || leftExtendCol.id})</span>
                </button>
              )}

              {/* Merge with Next Column */}
              {!currentGroupName && colIdx < headerGroupContextMenu.totalCols - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    handleMergeHeaderWithNext(
                      headerGroupContextMenu.blockIndex,
                      headerGroupContextMenu.childIndex,
                      colIdx,
                    );
                    setHeaderGroupContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-indigo-50 hover:text-indigo-900 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200 transition-colors font-medium cursor-pointer"
                >
                  <Columns className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">Merge with Next ({nextCol?.label || "Next"})</span>
                </button>
              )}

              {/* Merge with Previous Column */}
              {!currentGroupName && colIdx > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleMergeHeaderWithPrev(
                      headerGroupContextMenu.blockIndex,
                      headerGroupContextMenu.childIndex,
                      colIdx,
                    );
                    setHeaderGroupContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-indigo-50 hover:text-indigo-900 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200 transition-colors font-medium cursor-pointer"
                >
                  <Columns className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">Merge with Prev ({prevCol?.label || "Prev"})</span>
                </button>
              )}

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              {/* Open Multi-Column Group Manager Modal */}
              <button
                type="button"
                onClick={() => {
                  setManageHeaderGroupModalState({
                    blockIndex: headerGroupContextMenu.blockIndex,
                    childIndex: headerGroupContextMenu.childIndex,
                    initialGroupName: currentGroupName || "OBSERVATIONS",
                    columns: currentCols,
                  });
                  setHeaderGroupContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-primary/10 text-primary transition-colors font-semibold cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Manage Group Columns (3+ cols)...</span>
              </button>

              {/* Rename Header Group */}
              {currentGroupName && (
                <button
                  type="button"
                  onClick={() => {
                    const title = prompt(
                      "Enter Super-Header / Group Name (e.g. OBSERVATIONS, TOLERANCE):",
                      currentGroupName
                    );
                    if (title !== null && title.trim()) {
                      handleSetHeaderGroupName(
                        headerGroupContextMenu.blockIndex,
                        headerGroupContextMenu.childIndex,
                        headerGroupContextMenu.colId,
                        title.trim(),
                      );
                    }
                    setHeaderGroupContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Rename Group Name</span>
                </button>
              )}

              {/* Remove single column from group (if not clicking super-header) */}
              {currentGroupName && !isGroupHeader && (
                <button
                  type="button"
                  onClick={() => {
                    handleRemoveColumnFromGroup(
                      headerGroupContextMenu.blockIndex,
                      headerGroupContextMenu.childIndex,
                      headerGroupContextMenu.colId,
                    );
                    setHeaderGroupContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md transition-colors font-medium cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5 shrink-0" />
                  <span>Remove Column from Group</span>
                </button>
              )}

              {/* Unmerge Entire Group */}
              {currentGroupName && (
                <button
                  type="button"
                  onClick={() => {
                    handleUnmergeGroup(
                      headerGroupContextMenu.blockIndex,
                      headerGroupContextMenu.childIndex,
                      currentGroupName,
                    );
                    setHeaderGroupContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors font-medium cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                  <span>Unmerge Entire Group</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* MODAL: Multi-Column Header Group Manager */}
      {manageHeaderGroupModalState && (
        <ManageHeaderGroupModal
          open={Boolean(manageHeaderGroupModalState)}
          onOpenChange={(open) => {
            if (!open) setManageHeaderGroupModalState(null);
          }}
          initialGroupName={manageHeaderGroupModalState.initialGroupName}
          columns={manageHeaderGroupModalState.columns}
          onApply={(groupName, selectedColIds) => {
            handleApplyGroupColumns(
              manageHeaderGroupModalState.blockIndex,
              manageHeaderGroupModalState.childIndex,
              groupName,
              selectedColIds,
              manageHeaderGroupModalState.initialGroupName,
            );
            setManageHeaderGroupModalState(null);
          }}
          onUnmerge={() => {
            if (manageHeaderGroupModalState.initialGroupName) {
              handleUnmergeGroup(
                manageHeaderGroupModalState.blockIndex,
                manageHeaderGroupModalState.childIndex,
                manageHeaderGroupModalState.initialGroupName,
              );
            }
            setManageHeaderGroupModalState(null);
          }}
        />
      )}

      {/* MODAL: Cell Formula Modal */}
      {cellFormulaModalState && (
        <CellFormulaModal
          open={Boolean(cellFormulaModalState)}
          onOpenChange={(open) => {
            if (!open) setCellFormulaModalState(null);
          }}
          blockIndex={cellFormulaModalState.blockIndex}
          childIndex={cellFormulaModalState.childIndex}
          rowIndex={cellFormulaModalState.rowIndex}
          colId={cellFormulaModalState.colId}
          colLabel={cellFormulaModalState.colLabel}
          initialFormula={cellFormulaModalState.initialFormula}
          blocks={blocks}
          decimalPlaces={decimalPlaces}
          onApplyFormula={handleApplyCellFormula}
          onClearFormula={handleClearCellFormula}
        />
      )}
    </div>
  );
}
