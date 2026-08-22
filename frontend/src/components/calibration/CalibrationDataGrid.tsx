import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CalibrationPoint, CalibrationTypeConfig } from "@/types/calibration";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Columns, Calculator, X, Sparkles, GripVertical, ChevronLeft, ChevronRight, Edit, Eye, EyeOff, Check, AlertTriangle, Settings2, Maximize2, Minimize2, Sliders, RotateCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CustomColumn,
  evaluateFormulaValue,
  FORMULA_VARIABLE_SUGGESTIONS,
  getExcelColumnLetter,
  validateFormulaSyntax,
} from "@/lib/formulaEngine";

export type { CustomColumn };

interface CalibrationDataGridProps {
  typeConfig: CalibrationTypeConfig;
  points: CalibrationPoint[];
  onPointsChange: (points: CalibrationPoint[]) => void;
  unit: string;
  onUnitChange: (unit: string) => void;
  tolerance: number;
  onToleranceChange: (tolerance: number) => void;
  initialCustomColumns?: CustomColumn[];
  initialStandardColumnConfigs?: Record<string, CustomColumn>;
  initialColumnOrder?: string[];
  initialHiddenColumns?: string[];
  onCustomColumnsChange?: (columns: CustomColumn[]) => void;
  onStandardColumnConfigsChange?: (configs: Record<string, CustomColumn>) => void;
  onColumnOrderChange?: (order: string[]) => void;
  onHiddenColumnsChange?: (hidden: string[]) => void;
  acceptanceCriteria?: {
    enabled?: boolean;
    value?: number;
    type?: "percentage" | "absolute";
  };
  onAcceptanceCriteriaChange?: (config: { enabled?: boolean; value?: number; type?: "percentage" | "absolute" }) => void;
  initialStatusRuleType?: "default" | "custom_formula";
  initialStatusFormula?: string;
  onStatusRuleChange?: (ruleType: "default" | "custom_formula", formula: string) => void;
  initialDecimalPlaces?: number;
  onDecimalPlacesChange?: (dp: number) => void;
  initialIsFullscreen?: boolean;
  onFullscreenToggle?: (isFullscreen: boolean) => void;
}

const ALL_STANDARD_COLUMNS = [
  { id: "description", label: "Description" },
  { id: "nominal", label: "Nominal Value" },
  { id: "tolerance", label: "Tolerance (±)" },
  { id: "ascending_reading", label: "Actual / Ascending" },
  { id: "descending_reading", label: "Descending Reading" },
  { id: "error", label: "Error" },
  { id: "status", label: "Status" },
];

/**
 * Dynamic data entry grid powered by TanStack Virtual & HyperFormula.
 */
export function CalibrationDataGrid({
  typeConfig,
  points,
  onPointsChange,
  unit,
  onUnitChange,
  tolerance,
  onToleranceChange,
  initialCustomColumns = [],
  initialStandardColumnConfigs = {},
  initialColumnOrder = [],
  initialHiddenColumns = [],
  onCustomColumnsChange,
  onStandardColumnConfigsChange,
  onColumnOrderChange,
  onHiddenColumnsChange,
  acceptanceCriteria,
  onAcceptanceCriteriaChange,
  initialStatusRuleType = "default",
  initialStatusFormula = "",
  onStatusRuleChange,
  initialDecimalPlaces = 4,
  onDecimalPlacesChange,
  initialIsFullscreen = false,
  onFullscreenToggle,
}: CalibrationDataGridProps) {
  const hasDescending = typeConfig.columns.some((c) => c.key === "descending_reading");

  // Full Window View State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(initialIsFullscreen);

  useEffect(() => {
    if (initialIsFullscreen !== undefined) {
      setIsFullscreen(initialIsFullscreen);
    }
  }, [initialIsFullscreen]);

  const toggleFullscreen = (val?: boolean) => {
    const nextVal = val !== undefined ? val : !isFullscreen;
    setIsFullscreen(nextVal);
    if (onFullscreenToggle) onFullscreenToggle(nextVal);
  };

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        toggleFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  // Raw input strings for decimal inputs
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [rawTolerance, setRawTolerance] = useState<string | null>(null);
  const [decimalPlaces, setDecimalPlaces] = useState<number>(initialDecimalPlaces);

  // Dynamic custom columns & hidden columns state
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(initialCustomColumns);
  const [standardColumnConfigs, setStandardColumnConfigs] = useState<Record<string, CustomColumn>>(initialStandardColumnConfigs);
  const [columnOrder, setColumnOrder] = useState<string[]>(initialColumnOrder);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(initialHiddenColumns);

  // Status Rule & Formula state
  const [statusRuleType, setStatusRuleType] = useState<"default" | "custom_formula">(initialStatusRuleType);
  const [statusFormula, setStatusFormula] = useState<string>(initialStatusFormula);
  const [isEditStatusOpen, setIsEditStatusOpen] = useState(false);
  const [editStatusFormula, setEditStatusFormula] = useState<string>(initialStatusFormula);
  const [editStatusRuleType, setEditStatusRuleType] = useState<"default" | "custom_formula">(initialStatusRuleType);

  // Parent container ref for TanStack Virtualizer
  const parentRef = useRef<HTMLDivElement>(null);

  // Sync initial props if changed externally (e.g. when template is loaded)
  useEffect(() => {
    setCustomColumns(initialCustomColumns || []);
  }, [initialCustomColumns]);

  useEffect(() => {
    setStandardColumnConfigs(initialStandardColumnConfigs || {});
  }, [initialStandardColumnConfigs]);

  useEffect(() => {
    setColumnOrder(initialColumnOrder || []);
  }, [initialColumnOrder]);

  useEffect(() => {
    setHiddenColumns(initialHiddenColumns || []);
  }, [initialHiddenColumns]);

  useEffect(() => {
    setStatusRuleType(initialStatusRuleType);
    setEditStatusRuleType(initialStatusRuleType);
  }, [initialStatusRuleType]);

  useEffect(() => {
    setStatusFormula(initialStatusFormula);
    setEditStatusFormula(initialStatusFormula);
  }, [initialStatusFormula]);

  // Auto-recalculate formula columns and status for all initial points on mount/load
  useEffect(() => {
    if (!points || points.length === 0) return;
    let needsUpdate = false;
    const updated = points.map((pt) => {
      const copy = { ...pt };
      const nom = parseNum(copy.nominal);
      const asc = parseNum(copy.ascending_reading);
      const desc = copy.descending_reading !== undefined ? parseNum(copy.descending_reading) : undefined;

      const errConfig = standardColumnConfigs["error"];
      if (errConfig?.type === "formula" && errConfig.customFormula?.trim()) {
        const accVal = acceptanceCriteria?.enabled ? (acceptanceCriteria.value ?? 0) : 0;
        const activeOrder = getActiveColumnOrder();
        const calcVal = evaluateFormulaValue(errConfig, copy, hasDescending, customColumns, activeOrder, tolerance, accVal);
        const parsed = parseFloat(calcVal.replace("%", ""));
        copy.error = isNaN(parsed) ? 0 : parsed;
      } else if (hasDescending && desc !== undefined) {
        const avg = (asc + desc) / 2;
        copy.error = parseFloat((avg - nom).toFixed(6));
      } else {
        copy.error = parseFloat((asc - nom).toFixed(6));
      }

      copy.unit = unit;

      if (customColumns.length > 0) {
        const currentFields = copy.customFields || {};
        const computedFields: Record<string, any> = { ...currentFields };
        customColumns.forEach((col) => {
          if (col.type === "formula") {
            const accVal = acceptanceCriteria?.enabled ? (acceptanceCriteria.value ?? 0) : 0;
            const activeOrder = getActiveColumnOrder();
            // Provide the latest computed custom fields so subsequent formula columns can read preceding formula results
            copy.customFields = computedFields;
            const val = evaluateFormulaValue(col, copy, hasDescending, customColumns, activeOrder, tolerance, accVal);
            computedFields[col.id] = { name: col.name, value: val };
          } else {
            let existing = currentFields[col.id];
            if (existing === undefined && col.name) {
              existing = currentFields[col.name];
            }
            const val = typeof existing === "object" && existing !== null && "value" in existing ? existing.value : existing;
            computedFields[col.id] = { name: col.name, value: val ?? "" };
          }
          copy.customFields = computedFields;
        });
        copy.customFields = computedFields;
      }

      const newStatus = computePointStatus(copy);
      if (newStatus !== copy.status || JSON.stringify(copy.customFields) !== JSON.stringify(pt.customFields)) {
        copy.status = newStatus;
        needsUpdate = true;
      }
      return copy;
    });

    if (needsUpdate) {
      onPointsChange(updated);
    }
  }, [initialCustomColumns, initialStatusFormula, initialStatusRuleType]);

  // Helper to dynamically check if a column key belongs to a numeric or formula column
  const isNumericOrFormulaColumnKey = (key: string): boolean => {
    if (key.includes("_custom_")) {
      const colId = key.split("_custom_")[1];
      const customCol = customColumns.find((c) => c.id === colId);
      if (customCol) {
        return customCol.type === "number" || customCol.type === "formula";
      }
    } else {
      const parts = key.split("_");
      const field = parts.slice(1).join("_");
      const config = standardColumnConfigs[field];
      if (config) {
        return config.type === "number" || config.type === "formula";
      }
      if (["nominal", "tolerance", "ascending_reading", "descending_reading", "error"].includes(field)) {
        return true;
      }
    }
    return false;
  };

  // Helper to resolve specific column decimal places (or fallback to global template decimalPlaces)
  const getColumnDecimalPlaces = (colKeyOrId: string): number => {
    const stdConfig = standardColumnConfigs[colKeyOrId];
    // Allow 0 (no decimal) explicitly set at column level
    if (stdConfig && stdConfig.decimalPlaces !== undefined && stdConfig.decimalPlaces >= 0) {
      return stdConfig.decimalPlaces;
    }
    const customCol = customColumns.find((c) => c.id === colKeyOrId);
    if (customCol && customCol.decimalPlaces !== undefined && customCol.decimalPlaces >= 0) {
      return customCol.decimalPlaces;
    }
    return decimalPlaces;
  };

  // Whenever decimalPlaces setting changes, dynamically re-format all numeric & formula raw inputs
  useEffect(() => {
    setRawInputs((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        if (!isNumericOrFormulaColumnKey(key)) return;
        const val = updated[key];
        if (val !== undefined && val !== null && val.trim() !== "") {
          const parsed = parseFloat(val);
          if (!isNaN(parsed)) {
            // Extract column ID from key (e.g. "0_nominal" -> "nominal", "0_custom_123" -> "123")
            const colId = key.includes("_custom_") ? key.split("_custom_")[1] : key.split("_").slice(1).join("_");
            const colDec = getColumnDecimalPlaces(colId);
            updated[key] = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
          }
        }
      });
      return updated;
    });
  }, [decimalPlaces, customColumns, standardColumnConfigs]);

  // TanStack Virtualizer for high-performance rendering of large point sets
  const rowVirtualizer = useVirtualizer({
    count: points.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Row height estimate in px
    overscan: 8,
  });

  // Drag and drop state
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  // Dialog state for adding new columns
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<"text" | "number" | "formula">("text");
  const [newColUnit, setNewColUnit] = useState("");
  const [newColGroup, setNewColGroup] = useState("");
  const [newColDecimalPlaces, setNewColDecimalPlaces] = useState<number | undefined>(undefined);
  const [newColPlacement, setNewColPlacement] = useState<"after_actual" | "after_desc" | "after_nom" | "after_tol" | "first" | "before_error">("after_actual");
  const [newFormulaType, setNewFormulaType] = useState<"avg" | "stddev" | "abs_error" | "pct_error" | "bias" | "custom">("avg");
  const [newCustomFormula, setNewCustomFormula] = useState("=Actual - Nominal");

  // Edit Column Dialog State
  const [editingCol, setEditingCol] = useState<CustomColumn | null>(null);
  const [editingColIsStandard, setEditingColIsStandard] = useState(false);
  const [editColName, setEditColName] = useState("");
  const [editColType, setEditColType] = useState<"text" | "number" | "formula">("text");
  const [editColUnit, setEditColUnit] = useState("");
  const [editColGroup, setEditColGroup] = useState("");
  const [editColDecimalPlaces, setEditColDecimalPlaces] = useState<number | undefined>(undefined);
  const [editFormulaType, setEditFormulaType] = useState<"avg" | "stddev" | "abs_error" | "pct_error" | "bias" | "custom">("custom");
  const [editCustomFormula, setEditCustomFormula] = useState("");

  // Template Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Notify parent component on state changes
  const updateCustomColumnsState = (cols: CustomColumn[]) => {
    setCustomColumns(cols);
    if (onCustomColumnsChange) onCustomColumnsChange(cols);
  };

  const updateStandardColumnConfigsState = (configs: Record<string, CustomColumn>) => {
    setStandardColumnConfigs(configs);
    if (onStandardColumnConfigsChange) onStandardColumnConfigsChange(configs);
  };

  const updateColumnOrderState = (order: string[]) => {
    setColumnOrder(order);
    if (onColumnOrderChange) onColumnOrderChange(order);
  };

  const updateHiddenColumnsState = (hidden: string[]) => {
    setHiddenColumns(hidden);
    if (onHiddenColumnsChange) onHiddenColumnsChange(hidden);
  };

  const toggleColumnHide = (colId: string) => {
    const nextHidden = hiddenColumns.includes(colId)
      ? hiddenColumns.filter((id) => id !== colId)
      : [...hiddenColumns, colId];
    updateHiddenColumnsState(nextHidden);
  };

  // Calculate active unified column order filtered by hiddenColumns
  // ALWAYS returns: ["pt", ...middleColumns, "actions"]
  const getFullColumnOrder = (): string[] => {
    const standardKeys = ["description", "nominal", "tolerance", "ascending_reading"];
    if (hasDescending) standardKeys.push("descending_reading");
    standardKeys.push("error", "status");

    const customIds = customColumns.map((c) => c.id);

    let fullOrder = columnOrder.length > 0 ? [...columnOrder] : [];
    
    // Safety filter to remove 'pt' and 'actions' if they accidentally got saved into state
    fullOrder = fullOrder.filter((k) => k !== "pt" && k !== "actions");

    if (fullOrder.length === 0) {
      fullOrder = ["description", "nominal", "tolerance", "ascending_reading"];
      if (hasDescending) fullOrder.push("descending_reading");
      customIds.forEach((id) => fullOrder.push(id));
      fullOrder.push("error", "status");
    } else {
      standardKeys.forEach((k) => {
        if (!fullOrder.includes(k)) fullOrder.push(k);
      });
      customIds.forEach((id) => {
        if (!fullOrder.includes(id)) {
          const errIdx = fullOrder.indexOf("error");
          if (errIdx !== -1) fullOrder.splice(errIdx, 0, id);
          else fullOrder.push(id);
        }
      });
    }

    if (!hasDescending) {
      fullOrder = fullOrder.filter((k) => k !== "descending_reading");
    }

    return ["pt", ...fullOrder, "actions"];
  };

  const getActiveColumnOrder = (): string[] => {
    const fullOrder = getFullColumnOrder();
    return fullOrder.filter(
      (key) => key === "pt" || key === "actions" || !hiddenColumns.includes(key)
    );
  };

  const addPoint = () => {
    const newPoint: CalibrationPoint = {
      point_number: points.length + 1,
      description: "",
      nominal: 0,
      ascending_reading: 0,
      descending_reading: hasDescending ? 0 : undefined,
      error: 0,
      unit,
      tolerance: tolerance > 0 ? tolerance : 0,
      status: undefined,
      customFields: {},
    };
    onPointsChange([...points, newPoint]);
  };

  const removePoint = (index: number) => {
    const updated = points
      .filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, point_number: i + 1 }));
    onPointsChange(updated);

    setRawInputs((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${index}_`)) {
          delete next[key];
        }
      });
      return next;
    });
  };

  const parseNum = (val: any): number => {
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const parsed = parseFloat(String(val));
    return isNaN(parsed) ? 0 : parsed;
  };

  const computePointStatus = (
    pt: CalibrationPoint,
    ruleType: "default" | "custom_formula" = statusRuleType,
    formulaStr: string = statusFormula,
    currentTol: number = tolerance,
    currentColumns: CustomColumn[] = customColumns,
    currentOrder: string[] = activeOrder
  ): "PASS" | "FAIL" | undefined => {
    const rowTol = pt.tolerance !== undefined && pt.tolerance !== null && pt.tolerance > 0
      ? parseNum(pt.tolerance)
      : parseNum(currentTol);

    if (ruleType === "custom_formula" && formulaStr && formulaStr.trim()) {
      const dummyCol: CustomColumn = {
        id: "status_eval",
        name: "Status Evaluation",
        type: "formula",
        formulaType: "custom",
        customFormula: formulaStr,
      };

      const accVal = acceptanceCriteria?.enabled ? (acceptanceCriteria.value ?? 0) : 0;
      const activeOrder = getActiveColumnOrder();
      const resultStr = evaluateFormulaValue(dummyCol, pt, hasDescending, currentColumns, activeOrder, rowTol, accVal);

      if (resultStr === "TRUE" || resultStr === "1" || resultStr.toLowerCase() === "pass" || resultStr === "true") {
        return "PASS";
      }
      if (resultStr === "FALSE" || resultStr === "0" || resultStr.toLowerCase() === "fail" || resultStr === "false") {
        return "FAIL";
      }
      const numVal = parseFloat(resultStr);
      if (!isNaN(numVal)) {
        return rowTol > 0 ? (Math.abs(numVal) <= rowTol ? "PASS" : "FAIL") : "PASS";
      }
      return "FAIL";
    }

    // Default rule: If standard column error is a formula, its value is already in pt.error.
    // Otherwise check if a custom formula column named 'ERROR' exists.
    let errVal = pt.error;
    const formulaErrCol = currentColumns.find((c) => c.type === "formula" && c.name.toLowerCase() === "error");
    if (formulaErrCol) {
      const accVal = acceptanceCriteria?.enabled ? (acceptanceCriteria.value ?? 0) : 0;
      const activeOrder = getActiveColumnOrder();
      const calcStr = evaluateFormulaValue(formulaErrCol, pt, hasDescending, currentColumns, activeOrder, rowTol, accVal);
      const parsed = parseFloat(calcStr.replace("%", ""));
      if (!isNaN(parsed)) {
        errVal = parsed;
      }
    }

    if (rowTol > 0 && errVal !== undefined) {
      return Math.abs(errVal) <= rowTol ? "PASS" : "FAIL";
    }
    return "PASS";
  };

  const updatePoint = (index: number, field: string, value: any) => {
    const updated = [...points];
    const pt = { ...updated[index] };

    if (field === "customFields") {
      pt.customFields = { ...(pt.customFields || {}), ...value };
    } else {
      (pt as any)[field] = value;
    }

    const nom = parseNum(pt.nominal);
    const asc = parseNum(pt.ascending_reading);
    const desc = pt.descending_reading !== undefined ? parseNum(pt.descending_reading) : undefined;

    // Auto-calculate error
    const errConfig = standardColumnConfigs["error"];
    if (errConfig?.type === "formula" && errConfig.customFormula?.trim()) {
       const accVal = acceptanceCriteria?.enabled ? (acceptanceCriteria.value ?? 0) : 0;
       const activeOrder = getActiveColumnOrder();
       const calcVal = evaluateFormulaValue(errConfig, pt, hasDescending, customColumns, activeOrder, tolerance, accVal);
       const parsed = parseFloat(calcVal.replace("%", ""));
       pt.error = isNaN(parsed) ? 0 : parsed;
    } else if (hasDescending && desc !== undefined) {
      const avg = (asc + desc) / 2;
      pt.error = parseFloat((avg - nom).toFixed(6));
    } else {
      pt.error = parseFloat((asc - nom).toFixed(6));
    }

    pt.unit = unit;

    // Ensure custom columns are mapped with name and value for certificate generation
    if (customColumns.length > 0) {
      const currentFields = pt.customFields || {};
      const computedFields: Record<string, any> = { ...currentFields };
      customColumns.forEach((col) => {
        if (col.type === "formula") {
          const accVal = acceptanceCriteria?.enabled ? (acceptanceCriteria.value ?? 0) : 0;
          const activeOrder = getActiveColumnOrder();
          // Update pt.customFields incrementally so subsequent formula columns (col_error, col_judge) can read the newly computed preceding formula values
          pt.customFields = computedFields;
          const val = evaluateFormulaValue(col, pt, hasDescending, customColumns, activeOrder, tolerance, accVal);
          computedFields[col.id] = { name: col.name, value: val };
        } else {
          let existing = currentFields[col.id];
          if (existing === undefined && col.name) {
            existing = currentFields[col.name];
          }
          const val = typeof existing === "object" && existing !== null && "value" in existing ? existing.value : existing;
          computedFields[col.id] = { name: col.name, value: val ?? "" };
        }
        pt.customFields = computedFields;
      });
      pt.customFields = computedFields;
    }

    // Determine pass/fail status using computePointStatus
    pt.status = computePointStatus(pt);

    updated[index] = pt;
    onPointsChange(updated);
  };



  const handleInputChange = (index: number, field: string, text: string) => {
    const key = `${index}_${field}`;
    setRawInputs((prev) => ({ ...prev, [key]: text }));

    if (field === "description") {
      updatePoint(index, field, text);
    } else {
      // Allow empty / partial inputs (e.g. "-", ".", "-0.") without saving 0
      // Only commit a real number when it's actually parseable
      const trimmed = text.trim();
      if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
        // Don't overwrite the saved value while the user is mid-edit
        return;
      }
      const parsed = parseFloat(trimmed);
      updatePoint(index, field, isNaN(parsed) ? 0 : parsed);
    }
  };

  const handleCustomFieldChange = (index: number, colId: string, text: string, isNumber: boolean) => {
    const key = `${index}_custom_${colId}`;
    setRawInputs((prev) => ({ ...prev, [key]: text }));

    if (isNumber) {
      const trimmed = text.trim();
      // Allow partial/empty input without saving 0 mid-type
      if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") return;
    }

    const currentFields = points[index]?.customFields || {};
    const col = customColumns.find((c) => c.id === colId);
    const colName = col ? col.name : colId;
    const valToSave = isNumber ? (isNaN(parseFloat(text)) ? 0 : parseFloat(text)) : text;

    updatePoint(index, "customFields", {
      ...currentFields,
      [colId]: { name: colName, value: valToSave },
    });
  };

  const handleInputBlur = (index: number, field: string, text: string) => {
    const key = `${index}_${field}`;
    const trimmed = text.trim();
    if (trimmed === "" || trimmed === "-" || trimmed === ".") {
      // Reset to the actual saved value on blur if user left it invalid
      const savedVal = (points[field as any] as any) ?? 0;
      setRawInputs((prev) => ({ ...prev, [key]: String(savedVal) }));
      return;
    }
    const parsed = parseFloat(trimmed);
    if (!isNaN(parsed)) {
      const colDec = getColumnDecimalPlaces(field);
      const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
      setRawInputs((prev) => ({ ...prev, [key]: formatted }));
      updatePoint(index, field, parsed);
    }
  };

  const handleCustomFieldBlur = (index: number, colId: string, text: string, isNumber: boolean) => {
    if (!isNumber) return;
    const trimmed = text.trim();
    const key = `${index}_custom_${colId}`;
    if (trimmed === "" || trimmed === "-" || trimmed === ".") {
      setRawInputs((prev) => ({ ...prev, [key]: "0" }));
      return;
    }
    const parsed = parseFloat(trimmed);
    if (!isNaN(parsed)) {
      const colDec = getColumnDecimalPlaces(colId);
      const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
      setRawInputs((prev) => ({ ...prev, [key]: formatted }));
    }
  };

  const addMultiplePoints = (count: number) => {
    const newPoints: CalibrationPoint[] = [];
    for (let i = 0; i < count; i++) {
      newPoints.push({
        point_number: points.length + i + 1,
        description: "",
        nominal: 0,
        ascending_reading: 0,
        descending_reading: hasDescending ? 0 : undefined,
        error: 0,
        unit,
        tolerance: tolerance > 0 ? tolerance : 0,
        status: undefined,
        customFields: {},
      });
    }
    onPointsChange([...points, ...newPoints]);
  };

  // Helper to extract clean base name without trailing bracketed units like " (inch)"
  const getCleanBaseName = (name: string): string => {
    if (!name) return "";
    return name.replace(/\s*\([^)]*\)$/, "").trim();
  };

  const getStandardColumnOriginalLabel = (colId: string): string => {
    const found = ALL_STANDARD_COLUMNS.find((c) => c.id === colId);
    if (found) return found.label;
    if (colId === "nominal") return "Nominal Value";
    if (colId === "description") return "Description";
    if (colId === "tolerance") return "Tolerance (±)";
    if (colId === "ascending_reading") return "Actual / Ascending";
    if (colId === "descending_reading") return "Descending Reading";
    if (colId === "error") return "Error";
    if (colId === "status") return "Status";
    return colId;
  };

  // Helper to validate unique column names (case-insensitive)
  const isColumnNameTaken = (nameToCheck: string, excludeColId?: string): boolean => {
    const clean = getCleanBaseName(nameToCheck);
    const normalized = clean.trim().toLowerCase();
    if (!normalized) return false;

    // Check custom columns duplicates (only non-excluded, active/visible columns)
    const customDuplicate = customColumns.some((c) => {
      if (c.id === excludeColId) return false;
      if (hiddenColumns.includes(c.id)) return false;
      const colClean = getCleanBaseName(c.name).trim().toLowerCase();
      return colClean === normalized;
    });
    if (customDuplicate) return true;

    // Check standard column config duplicates (only non-excluded, active/visible columns)
    const standardDuplicate = Object.entries(standardColumnConfigs).some(([id, c]) => {
      if (id === excludeColId) return false;
      if (hiddenColumns.includes(id)) return false;
      if (!c.name) return false;
      const colClean = getCleanBaseName(c.name).trim().toLowerCase();
      return colClean === normalized;
    });
    if (standardDuplicate) return true;

    // Standard column IDs mapped to their default names & aliases
    const standardIdToNames: Record<string, string[]> = {
      description: ["description"],
      nominal: ["nominal"],
      tolerance: ["tolerance"],
      ascending_reading: ["actual", "ascending", "actual reading", "ascending reading"],
      descending_reading: ["descending", "descending reading"],
      error: ["error"],
      status: ["status"],
      pt: ["pt", "sl.no", "sl no", "sr.no", "sr no"],
    };

    // If editing an existing standard column, allow its own default names & aliases
    if (excludeColId) {
      const selfNames = standardIdToNames[excludeColId] || [];
      const selfConfigName = standardColumnConfigs[excludeColId]?.name;
      const selfCleanConfig = selfConfigName ? getCleanBaseName(selfConfigName).trim().toLowerCase() : "";
      if (selfNames.includes(normalized) || excludeColId === normalized || (selfCleanConfig && selfCleanConfig === normalized)) {
        return false;
      }
    }

    // Reserved names across all OTHER active/visible standard columns
    const activeReservedNames = Object.entries(standardIdToNames).flatMap(([id, names]) => {
      if (id === excludeColId) return [];
      if (hiddenColumns.includes(id)) return [];
      return names;
    });

    return activeReservedNames.includes(normalized);
  };

  const isAddNameDuplicate = isColumnNameTaken(newColName);
  const isEditNameDuplicate = editingCol ? isColumnNameTaken(editColName, editingCol.id) : false;

  // Helper to format display title: HEADERNAME (UNIT) if unit present, or HEADERNAME only
  const getHeaderDisplayTitle = (rawName: string, colUnitSetting?: string): string => {
    const baseName = getCleanBaseName(rawName);
    let activeUnit = "";
    if (!colUnitSetting || colUnitSetting === "inherit") {
      activeUnit = unit || "";
    } else if (colUnitSetting === "none") {
      activeUnit = "";
    } else {
      activeUnit = colUnitSetting;
    }

    if (activeUnit && activeUnit.trim()) {
      return `${baseName} (${activeUnit.trim()})`;
    }
    return baseName;
  };

  const handleAddColumn = () => {
    if (!newColName.trim() || isAddNameDuplicate) return;

    const colId = `col_${Date.now()}`;
    const cleanName = getCleanBaseName(newColName);
    const newCol: CustomColumn = {
      id: colId,
      name: cleanName,
      type: newColType,
      formulaType: newColType === "formula" ? newFormulaType : undefined,
      customFormula: newColType === "formula" && newFormulaType === "custom" ? newCustomFormula : undefined,
      unit: newColUnit.trim() || undefined,
      decimalPlaces: newColDecimalPlaces,
      groupName: newColGroup.trim() || undefined,
    };

    const nextCols = [...customColumns, newCol];
    updateCustomColumnsState(nextCols);

    // Insert into column order
    const currentOrder = getActiveColumnOrder();
    let anchorKey = "ascending_reading";
    if (hasDescending && currentOrder.includes("descending_reading")) {
      anchorKey = "descending_reading";
    }

    if (newColPlacement === "first") anchorKey = "pt";
    else if (newColPlacement === "after_desc") anchorKey = "description";
    else if (newColPlacement === "after_nom") anchorKey = "nominal";
    else if (newColPlacement === "after_tol") anchorKey = "tolerance";
    else if (newColPlacement === "before_error") anchorKey = "error";

    const anchorIndex = currentOrder.indexOf(anchorKey);
    const updatedOrder = [...currentOrder];
    if (anchorIndex !== -1) {
      if (newColPlacement === "before_error") {
        updatedOrder.splice(anchorIndex, 0, colId);
      } else {
        updatedOrder.splice(anchorIndex + 1, 0, colId);
      }
    } else {
      updatedOrder.push(colId);
    }
    updateColumnOrderState(updatedOrder);

    // Reset dialog
    setNewColName("");
    setNewColType("text");
    setNewColUnit("inherit");
    setNewColDecimalPlaces(undefined);
    setNewColGroup("");
    setNewColPlacement("after_actual");
    setNewFormulaType("avg");
    setNewCustomFormula("=Actual - Nominal");
    setIsAddColumnOpen(false);
  };

  // Edit Dynamic Column
  const handleOpenEditColumn = (col: CustomColumn, isStandard: boolean = false) => {
    setEditingCol(col);
    setEditingColIsStandard(isStandard);
    setEditColName(getCleanBaseName(col.name));
    setEditColType(col.type);
    setEditFormulaType(col.formulaType || "custom");
    setEditCustomFormula(col.customFormula || "=Actual - Nominal");
    setEditColUnit(col.unit || "inherit");
    setEditColGroup(col.groupName || "");
    setEditColDecimalPlaces(col.decimalPlaces);
  };

  const handleSaveEditColumn = () => {
    if (!editingCol || !editColName.trim() || isEditNameDuplicate) return;

    const cleanName = getCleanBaseName(editColName);

    if (editingColIsStandard) {
      const updatedConfigs = { ...standardColumnConfigs };
      updatedConfigs[editingCol.id] = {
        ...editingCol,
        name: cleanName,
        type: editColType,
        formulaType: editColType === "formula" ? editFormulaType : undefined,
        customFormula: editColType === "formula" && editFormulaType === "custom" ? editCustomFormula : undefined,
        unit: editColUnit.trim() || undefined,
        decimalPlaces: editColDecimalPlaces,
        groupName: editColGroup.trim() || undefined,
      };
      updateStandardColumnConfigsState(updatedConfigs);
    } else {
      const updatedCols = customColumns.map((c) => {
        if (c.id === editingCol.id) {
          return {
            ...c,
            name: cleanName,
            type: editColType,
            formulaType: editColType === "formula" ? editFormulaType : undefined,
            customFormula: editColType === "formula" && editFormulaType === "custom" ? editCustomFormula : undefined,
            unit: editColUnit.trim() || undefined,
            decimalPlaces: editColDecimalPlaces,
            groupName: editColGroup.trim() || undefined,
          };
        }
        return c;
      });
      updateCustomColumnsState(updatedCols);
    }

    setEditingCol(null);
    setEditingColIsStandard(false);
  };

  const handleRemoveColumn = (colId: string) => {
    const nextCols = customColumns.filter((c) => c.id !== colId);
    const nextOrder = columnOrder.filter((id) => id !== colId);
    const nextStdConfigs = { ...standardColumnConfigs };
    if (nextStdConfigs[colId]) {
      delete nextStdConfigs[colId];
      updateStandardColumnConfigsState(nextStdConfigs);
    }
    updateCustomColumnsState(nextCols);
    updateColumnOrderState(nextOrder);
  };

  // Move column left or right
  const moveColumnInOrder = (colId: string, direction: "left" | "right") => {
    const currentOrder = getActiveColumnOrder();
    const idx = currentOrder.indexOf(colId);
    if (idx === -1) return;

    const targetIdx = direction === "left" ? idx - 1 : idx + 1;
    if (targetIdx <= 0 || targetIdx >= currentOrder.length - 1) return;

    const updated = [...currentOrder];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    updateColumnOrderState(updated);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColId(colId);
    e.dataTransfer.setData("text/plain", colId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnHeader = (e: React.DragEvent, targetColKey: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetColKey) return;

    const currentOrder = getActiveColumnOrder();
    const sourceIdx = currentOrder.indexOf(draggedColId);
    const targetIdx = currentOrder.indexOf(targetColKey);

    if (sourceIdx !== -1 && targetIdx !== -1) {
      const updated = [...currentOrder];
      const [moved] = updated.splice(sourceIdx, 1);
      updated.splice(targetIdx, 0, moved);
      updateColumnOrderState(updated);
    }
    setDraggedColId(null);
  };

  // Helper to append variable suggestion to formula text field
  const appendVariableToNewFormula = (varName: string) => {
    setNewCustomFormula((prev) => (prev ? `${prev} ${varName}` : `=${varName}`));
  };

  const appendVariableToEditFormula = (varName: string) => {
    setEditCustomFormula((prev) => (prev ? `${prev} ${varName}` : `=${varName}`));
  };

  // Helper to retrieve display values
  const getInputValue = (index: number, field: string, pointValue: any): string => {
    const key = `${index}_${field}`;
    if (rawInputs[key] !== undefined) {
      return rawInputs[key];
    }
    if (pointValue === undefined || pointValue === null) return "";
    
    const config = standardColumnConfigs[field];
    const isNumType = config
      ? (config.type === "number" || config.type === "formula")
      : ["nominal", "tolerance", "ascending_reading", "descending_reading", "error"].includes(field);

    if (isNumType && typeof pointValue === "number" && !isNaN(pointValue)) {
      const colDec = getColumnDecimalPlaces(field);
      return pointValue.toFixed(colDec);
    }
    return String(pointValue);
  };

  const getCustomInputValue = (index: number, colId: string, fieldValue: any): string => {
    const key = `${index}_custom_${colId}`;
    if (rawInputs[key] !== undefined) {
      return rawInputs[key];
    }
    if (fieldValue === undefined || fieldValue === null) return "";
    const col = customColumns.find((c) => c.id === colId);
    if (col?.type === "number" && typeof fieldValue === "number" && !isNaN(fieldValue)) {
      const colDec = getColumnDecimalPlaces(colId);
      return fieldValue.toFixed(colDec);
    }
    return String(fieldValue);
  };

  const renderCustomCell = (col: CustomColumn, pt: CalibrationPoint, idx: number) => {
    if (col.type === "formula") {
      const accVal = acceptanceCriteria?.enabled ? (acceptanceCriteria.value ?? 0) : 0;
      const activeOrder = getActiveColumnOrder();
      const calculatedVal = evaluateFormulaValue(col, pt, hasDescending, customColumns, activeOrder, tolerance, accVal);
      return (
        <TableCell key={col.id} className="bg-primary/5 font-mono text-sm font-medium border-x border-primary/10">
          <span className="text-primary font-bold">{calculatedVal}</span>
        </TableCell>
      );
    }

    const customData = pt.customFields?.[col.id];
    const rawVal = typeof customData === "object" && customData !== null && "value" in customData ? customData.value : customData;
    const isNum = col.type === "number";

    return (
      <TableCell key={col.id} className="border-x border-primary/10">
        <Input
          type={isNum ? "text" : "text"}
          inputMode={isNum ? "decimal" : undefined}
          value={getCustomInputValue(idx, col.id, rawVal)}
          onChange={(e) => handleCustomFieldChange(idx, col.id, e.target.value, isNum)}
          onBlur={(e) => handleCustomFieldBlur(idx, col.id, e.target.value, isNum)}
          className="h-9 text-xs font-mono"
          placeholder={isNum ? "0.000" : "Text..."}
        />
      </TableCell>
    );
  };

  const activeOrder = getActiveColumnOrder();

  const nominalCol = typeConfig.columns.find((c) => c.key === "nominal");
  const ascCol = typeConfig.columns.find((c) => c.key === "ascending_reading");
  const descCol = typeConfig.columns.find((c) => c.key === "descending_reading");
  const errorCol = typeConfig.columns.find((c) => c.key === "error");

  const virtualItems = rowVirtualizer.getVirtualItems();

  const gridContent = (
    <div
      className={cn(
        "space-y-4 transition-all duration-200",
        isFullscreen &&
          "fixed inset-0 z-[9999] bg-background text-foreground p-4 sm:p-6 flex flex-col justify-between overflow-hidden shadow-2xl animate-in fade-in duration-200"
      )}
    >
      {/* Full Window Mode Top Bar */}
      {isFullscreen && (
        <div className="flex items-center justify-between pb-3 border-b bg-muted/40 p-3.5 rounded-xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Maximize2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                Full Window Calibration Data Entry Mode
                <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/30">
                  {points.length} Points
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Comfortable full window layout for entering readings without scrolling. Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-muted border rounded shadow-2xs">Esc</kbd> to exit.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {points.some((p) => p.status !== undefined) && (
              <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border text-xs font-bold shadow-2xs">
                <span className="text-emerald-600">
                  {points.filter((p) => p.status === "PASS").length} Pass
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-red-600">
                  {points.filter((p) => p.status === "FAIL").length} Fail
                </span>
              </div>
            )}

            <Button
              size="sm"
              variant="default"
              onClick={() => toggleFullscreen(false)}
              className="gap-1.5 text-xs font-bold rounded-lg shadow-sm"
            >
              <Minimize2 className="w-4 h-4" />
              Exit Full Window (Esc)
            </Button>
          </div>
        </div>
      )}

      {/* Top Config & Toolbar Bar */}
      <div className="flex flex-wrap items-end justify-between gap-4 p-4 border rounded-xl bg-card shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          {acceptanceCriteria?.enabled && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground font-semibold">Acceptance Criteria</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="any"
                  value={acceptanceCriteria.value ?? 2}
                  onChange={(e) => {
                    if (onAcceptanceCriteriaChange) {
                      onAcceptanceCriteriaChange({
                        ...acceptanceCriteria,
                        value: e.target.value === "" ? 0 : parseFloat(e.target.value),
                      });
                    }
                  }}
                  className="w-[90px] h-9 text-xs font-mono font-bold"
                />
                <Badge variant="outline" className="h-9 px-2 text-xs font-semibold font-mono bg-muted/30">
                  {acceptanceCriteria.type === "percentage" ? "%" : unit}
                </Badge>
              </div>
            </div>
          )}
          
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-semibold">Unit</Label>
            <Select value={unit} onValueChange={onUnitChange}>
              <SelectTrigger className="w-[110px] h-9 text-xs">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                {typeConfig.units.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-semibold">
              Default Tolerance (±)
            </Label>
            <Input
              type="number"
              step="any"
              value={
                rawTolerance !== null
                  ? rawTolerance
                  : tolerance !== undefined && tolerance !== null
                  ? String(tolerance)
                  : ""
              }
              onChange={(e) => {
                const text = e.target.value;
                setRawTolerance(text);
                const parsed = parseFloat(text);
                const newTol = isNaN(parsed) ? 0 : parsed;
                onToleranceChange(newTol);

                const updated = points.map((pt) => {
                  const ptTol = pt.tolerance !== undefined && pt.tolerance > 0 ? pt.tolerance : newTol;
                  const newPt = { ...pt };
                  if (ptTol > 0) {
                    newPt.status = Math.abs(newPt.error) <= ptTol ? "PASS" : "FAIL";
                  } else {
                    newPt.status = undefined;
                  }
                  return newPt;
                });
                onPointsChange(updated);
              }}
              placeholder="0.01"
              className="w-[120px] h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-semibold">
              Decimal Places
            </Label>
            <Select
              value={String(decimalPlaces)}
              onValueChange={(val) => {
                const dp = parseInt(val, 10);
                setDecimalPlaces(dp);
                if (onDecimalPlacesChange) onDecimalPlacesChange(dp);
              }}
            >
              <SelectTrigger className="w-[120px] h-9 text-xs bg-background font-mono font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">None (Integer)</SelectItem>
                <SelectItem value="1">1 Dec (.0)</SelectItem>
                <SelectItem value="2">2 Dec (.00)</SelectItem>
                <SelectItem value="3">3 Dec (.000)</SelectItem>
                <SelectItem value="4">4 Dec (.0000)</SelectItem>
                <SelectItem value="5">5 Dec (.00000)</SelectItem>
                <SelectItem value="6">6 Dec (.000000)</SelectItem>
                <SelectItem value="7">7 Dec (.0000000)</SelectItem>
                <SelectItem value="8">8 Dec (.00000000)</SelectItem>
                <SelectItem value="9">9 Dec (.000000000)</SelectItem>
                <SelectItem value="10">10 Dec (.0000000000)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-end gap-2 ml-auto flex-wrap">
          {/* Full Window View Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleFullscreen()}
            className={cn(
              "text-xs gap-1.5 font-bold transition-all shadow-xs",
              isFullscreen
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-primary/40 text-primary hover:bg-primary/10 hover:border-primary"
            )}
            title={isFullscreen ? "Exit Full Window View (Esc)" : "Expand grid to Full Window View"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                Exit Full Window
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                Full Window View
              </>
            )}
          </Button>

          {/* Template & Grid Settings Modal Button */}
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setIsSettingsOpen(true)}
            title="Configure Template & Grid Settings"
          >
            <Settings2 className="w-3.5 h-3.5 text-primary" />
            Template Settings
          </Button>
          {/* Columns & Visibility Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                <Eye className="w-3.5 h-3.5 text-primary" />
                Columns & Visibility
                {hiddenColumns.length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0 h-4">
                    {hiddenColumns.length} hidden
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-3 z-[10000]" align="end">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-xs">Toggle Column Visibility</span>
                {hiddenColumns.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-primary p-0"
                    onClick={() => updateHiddenColumnsState([])}
                  >
                    Show All
                  </Button>
                )}
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Standard Columns</span>
                {ALL_STANDARD_COLUMNS.map((col) => {
                  if (col.id === "descending_reading" && !hasDescending) return null;
                  const isVisible = !hiddenColumns.includes(col.id);
                  const customConfig = standardColumnConfigs[col.id];
                  const customName = customConfig?.name ? getCleanBaseName(customConfig.name) : "";
                  const isRenamed = Boolean(customName && customName.toLowerCase() !== getCleanBaseName(col.label).toLowerCase());

                  return (
                    <div key={col.id} className="flex items-center justify-between text-xs py-0.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none truncate pr-1">
                        <Checkbox
                          checked={isVisible}
                          onCheckedChange={() => toggleColumnHide(col.id)}
                        />
                        {isRenamed ? (
                          <span className="truncate flex items-center gap-1">
                            <span className="font-semibold text-foreground">{customName}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">({col.label})</span>
                          </span>
                        ) : (
                          <span className="truncate">{col.label}</span>
                        )}
                      </label>
                      {!isVisible ? (
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                    </div>
                  );
                })}

                {customColumns.length > 0 && (
                  <>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block pt-2 border-t">Custom Columns</span>
                    {customColumns.map((col) => {
                      const isVisible = !hiddenColumns.includes(col.id);
                      return (
                        <div key={col.id} className="flex items-center justify-between text-xs py-0.5">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <Checkbox
                              checked={isVisible}
                              onCheckedChange={() => toggleColumnHide(col.id)}
                            />
                            <span className="truncate max-w-[140px]">{col.name}</span>
                          </label>
                          {!isVisible ? (
                            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-primary" />
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={() => setIsAddColumnOpen(true)} className="text-xs gap-1 border-dashed">
            <Columns className="w-3.5 h-3.5 text-primary" />
            Add Column
          </Button>
          <Button variant="outline" size="sm" onClick={() => addMultiplePoints(5)} className="text-xs">
            +5 Points
          </Button>
          <Button variant="outline" size="sm" onClick={() => addMultiplePoints(10)} className="text-xs">
            +10 Points
          </Button>
          <Button size="sm" onClick={addPoint} className="gap-1">
            <Plus className="w-3.5 h-3.5" />
            Add Point
          </Button>
        </div>
      </div>

      {/* TanStack Virtual Data Table */}
      {points.length > 0 ? (
        <div
          ref={parentRef}
          className={cn(
            "border rounded-lg overflow-auto shadow-sm relative transition-all",
            isFullscreen ? "flex-1 max-h-[calc(100vh-230px)] min-h-[400px] bg-background" : "max-h-[600px]"
          )}
        >
          <Table>
            <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10 shadow-xs">
              {(() => {
                const getColGroup = (colKey: string): string | undefined => {
                  if (colKey === "pt" || colKey === "actions" || colKey === "status") return undefined;
                  const stdConfig = standardColumnConfigs[colKey];
                  if (stdConfig?.groupName) return stdConfig.groupName;
                  const customCol = customColumns.find((c) => c.id === colKey);
                  if (customCol?.groupName) return customCol.groupName;
                  return undefined;
                };

                const hasAnyGroups = activeOrder.some((key) => getColGroup(key));

                const topRowCells: { type: "group" | "single"; groupName?: string; colSpan: number; colKeys: string[] }[] = [];
                if (hasAnyGroups) {
                  let currentGroup: string | undefined = undefined;
                  let currentGroupKeys: string[] = [];
                  for (const colKey of activeOrder) {
                    const g = getColGroup(colKey);
                    if (g) {
                      if (currentGroup === g) {
                        currentGroupKeys.push(colKey);
                      } else {
                        if (currentGroup) topRowCells.push({ type: "group", groupName: currentGroup, colSpan: currentGroupKeys.length, colKeys: currentGroupKeys });
                        currentGroup = g;
                        currentGroupKeys = [colKey];
                      }
                    } else {
                      if (currentGroup) {
                        topRowCells.push({ type: "group", groupName: currentGroup, colSpan: currentGroupKeys.length, colKeys: currentGroupKeys });
                        currentGroup = undefined;
                        currentGroupKeys = [];
                      }
                      topRowCells.push({ type: "single", colSpan: 1, colKeys: [colKey] });
                    }
                  }
                  if (currentGroup) topRowCells.push({ type: "group", groupName: currentGroup, colSpan: currentGroupKeys.length, colKeys: currentGroupKeys });
                }

                const renderColHeader = (colKey: string, rowSpan: number = 1, isSubHeader: boolean = false) => {
                  if (colKey === "pt") return (
                    <TableHead key="pt" rowSpan={rowSpan} className="w-12 text-center font-semibold border-r">
                      <span>Pt</span>
                    </TableHead>
                  );

                  if (colKey === "actions") return <TableHead key="actions" rowSpan={rowSpan} className="w-12 text-center border-l"></TableHead>;

                  const dataColumns = activeOrder.filter((k) => k !== "pt" && k !== "actions");
                  const dataIdx = dataColumns.indexOf(colKey);
                  const excelLetter = getExcelColumnLetter(dataIdx);

                  const renderStandardColumn = (id: string, defaultBaseName: string, supportsUnit: boolean = true) => {
                    const config = standardColumnConfigs[id];
                    const rawName = config?.name || defaultBaseName;
                    const baseName = getCleanBaseName(rawName);
                    
                    let colUnitSetting = "inherit";
                    if (!supportsUnit || config?.unit === "none") {
                      colUnitSetting = "none";
                    } else if (config?.unit && config.unit !== "inherit" && config.unit !== "none") {
                      if (typeConfig.units.includes(config.unit)) {
                        colUnitSetting = "inherit";
                      } else {
                        colUnitSetting = config.unit;
                      }
                    }

                    const displayTitle = getHeaderDisplayTitle(baseName, colUnitSetting);
                    const isFormula = config?.type === "formula";
                    const isStatus = id === "status";

                    const getDefaultStandardConfig = (): CustomColumn => {
                      if (id === "error") {
                        return {
                          id,
                          name: baseName,
                          type: "formula",
                          formulaType: "custom",
                          customFormula: hasDescending ? "=((Actual + Descending) / 2) - Nominal" : "=Actual - Nominal",
                        };
                      }
                      if (["nominal", "tolerance", "ascending_reading", "descending_reading"].includes(id)) {
                        return { id, name: baseName, type: "number" };
                      }
                      return { id, name: baseName, type: "text" };
                    };

                    return (
                      <TableHead
                        key={id}
                        rowSpan={rowSpan}
                        draggable={!isStatus}
                        onDragStart={!isStatus ? (e) => handleDragStart(e, id) : undefined}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnHeader(e, id)}
                        className={`font-semibold min-w-[120px] ${!isStatus ? "cursor-grab active:cursor-grabbing hover:bg-muted/50" : ""} select-none transition-colors border-x ${isSubHeader ? "bg-muted/30 border-t" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-1 py-1 group">
                          <div className="flex items-center gap-1 min-w-0 truncate">
                            {!isStatus && <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-50 group-hover:opacity-100" />}
                            <div className="flex items-center justify-center w-5 h-5 rounded shadow-sm bg-primary/10 border border-primary/20 text-primary font-mono font-bold text-[11px] shrink-0 leading-none select-none" title={`Formula Alias: ${excelLetter}`}>
                              {excelLetter}
                            </div>
                            {isFormula && <Calculator className="w-3.5 h-3.5 text-primary shrink-0" />}
                            <span className="truncate">{displayTitle}</span>
                          </div>
                          <div className={`flex items-center gap-0.5 shrink-0 ${isStatus ? "opacity-0 group-hover:opacity-100" : ""}`}>
                            {!isStatus && (
                              <>
                                <Button variant="outline" size="icon" className="h-5 w-5 bg-background text-muted-foreground hover:text-foreground shadow-xs opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); moveColumnInOrder(id, "left"); }} title="Move left"><ChevronLeft className="w-3 h-3" /></Button>
                                <Button variant="outline" size="icon" className="h-5 w-5 bg-background text-muted-foreground hover:text-foreground shadow-xs opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); moveColumnInOrder(id, "right"); }} title="Move right"><ChevronRight className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleOpenEditColumn(config || getDefaultStandardConfig(), true); }} title="Edit Column & Formula"><Edit className="w-3 h-3" /></Button>
                              </>
                            )}
                            {isStatus && (
                               <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-primary" onClick={() => { setEditStatusRuleType(statusRuleType); setEditStatusFormula(statusFormula || "=ABS(C) <= tolerance"); setIsEditStatusOpen(true); }} title="Configure Status Rule & Formula"><Edit className="w-3 h-3" /></Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); toggleColumnHide(id); }} title="Hide column"><X className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      </TableHead>
                    );
                  };

                  if (colKey === "description") return renderStandardColumn("description", "Description", false);
                  if (colKey === "nominal") return renderStandardColumn("nominal", nominalCol?.label || "Nominal", true);
                  if (colKey === "tolerance") return renderStandardColumn("tolerance", "Tolerance (±)", true);
                  if (colKey === "ascending_reading") return renderStandardColumn("ascending_reading", ascCol?.label || "Actual", true);
                  if (colKey === "descending_reading") return renderStandardColumn("descending_reading", descCol?.label || "Descending", true);
                  if (colKey === "error") return renderStandardColumn("error", errorCol?.label || "Error", true);
                  if (colKey === "status") return renderStandardColumn("status", "Status", false);

                  const col = customColumns.find((c) => c.id === colKey);
                  if (!col) return null;

                  const colUnitSetting = col.unit && col.unit !== "inherit" && col.unit !== "none"
                    ? (typeConfig.units.includes(col.unit) ? "inherit" : col.unit)
                    : (col.type === "number" || col.type === "formula" ? "inherit" : "none");
                  const customDisplayTitle = getHeaderDisplayTitle(col.name, colUnitSetting);

                  return (
                    <TableHead
                      key={col.id}
                      rowSpan={rowSpan}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnHeader(e, col.id)}
                      className={`font-semibold min-w-[150px] border-x border-primary/20 select-none cursor-grab active:cursor-grabbing transition-colors ${isSubHeader ? "bg-primary/5 hover:bg-primary/10 border-t" : "bg-primary/10 hover:bg-primary/15"}`}
                    >
                      <div className="flex items-center justify-between gap-1 py-1">
                        <div className="flex items-center gap-1 min-w-0 truncate">
                          <GripVertical className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                          <div className="flex items-center justify-center w-5 h-5 rounded shadow-sm bg-primary/10 border border-primary/20 text-primary font-mono font-bold text-[11px] shrink-0 leading-none select-none" title={`Formula Alias: ${excelLetter}`}>
                            {excelLetter}
                          </div>
                          {col.type === "formula" && <Calculator className="w-3.5 h-3.5 text-primary shrink-0" />}
                          <span className="truncate text-xs font-bold text-primary">{customDisplayTitle}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 hover:opacity-100 transition-opacity [&:has(:hover)]:opacity-100 group-hover:opacity-100 focus-within:opacity-100" style={{opacity: 1 /* Temp fix for hover states */}}>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-5 w-5 bg-background text-muted-foreground hover:text-foreground shadow-xs"
                            onClick={(e) => { e.stopPropagation(); moveColumnInOrder(col.id, "left"); }}
                            title="Move left"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-5 w-5 bg-background text-muted-foreground hover:text-foreground shadow-xs"
                            onClick={(e) => { e.stopPropagation(); moveColumnInOrder(col.id, "right"); }}
                            title="Move right"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); handleOpenEditColumn(col); }}
                            title="Edit Column & Formula"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleRemoveColumn(col.id); }}
                            title="Remove column"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </TableHead>
                  );
                };

                if (!hasAnyGroups) {
                  return (
                    <TableRow>
                      {activeOrder.map(colKey => renderColHeader(colKey, 1, false))}
                    </TableRow>
                  );
                } else {
                  return (
                    <>
                      <TableRow>
                        {topRowCells.map((cell, idx) => {
                          if (cell.type === "group") {
                            return (
                              <TableHead key={`group-${idx}`} colSpan={cell.colSpan} className="text-center font-bold bg-primary/10 border-x border-b border-primary/20 text-primary">
                                {cell.groupName}
                              </TableHead>
                            );
                          } else {
                            return renderColHeader(cell.colKeys[0], 2, false);
                          }
                        })}
                      </TableRow>
                      <TableRow>
                        {activeOrder.filter(k => getColGroup(k)).map(k => renderColHeader(k, 1, true))}
                      </TableRow>
                    </>
                  );
                }
              })()}
            </TableHeader>
            <TableBody>
              {points.map((pt, idx) => (
                <TableRow key={idx} className="hover:bg-muted/30 border-b">
                  {activeOrder.map((colKey) => {
                    if (colKey === "pt") return <TableCell key="pt" className="font-mono text-center text-muted-foreground font-medium text-xs border-r w-12">{pt.point_number}</TableCell>;

                    const isStandardFormula = standardColumnConfigs[colKey]?.type === "formula";
                    if (isStandardFormula && colKey !== "status") {
                      const accVal = acceptanceCriteria?.enabled ? (acceptanceCriteria.value ?? 0) : 0;
                      const activeOrder = getActiveColumnOrder();
                      const calculatedVal = evaluateFormulaValue(standardColumnConfigs[colKey], pt, hasDescending, customColumns, activeOrder, tolerance, accVal);
                      return (
                        <TableCell key={colKey} className="bg-primary/5 font-mono text-sm font-medium border-x border-primary/10">
                          <span className="text-primary font-bold">{calculatedVal}</span>
                        </TableCell>
                      );
                    }

                    if (colKey === "description") return <TableCell key="description"><Input value={getInputValue(idx, "description", pt.description)} onChange={(e) => handleInputChange(idx, "description", e.target.value)} placeholder="e.g. GO" className="h-9 text-xs" /></TableCell>;
                    if (colKey === "nominal") return <TableCell key="nominal"><Input type="text" inputMode="decimal" value={getInputValue(idx, "nominal", pt.nominal)} onChange={(e) => handleInputChange(idx, "nominal", e.target.value)} onBlur={(e) => handleInputBlur(idx, "nominal", e.target.value)} className="h-9 text-xs font-mono" placeholder="0.000" /></TableCell>;
                    if (colKey === "tolerance") return <TableCell key="tolerance"><Input type="text" inputMode="decimal" value={getInputValue(idx, "tolerance", pt.tolerance ?? tolerance)} onChange={(e) => handleInputChange(idx, "tolerance", e.target.value)} onBlur={(e) => handleInputBlur(idx, "tolerance", e.target.value)} className="h-9 text-xs font-mono" placeholder={String(tolerance)} /></TableCell>;
                    if (colKey === "ascending_reading") return <TableCell key="ascending_reading"><Input type="text" inputMode="decimal" value={getInputValue(idx, "ascending_reading", pt.ascending_reading)} onChange={(e) => handleInputChange(idx, "ascending_reading", e.target.value)} onBlur={(e) => handleInputBlur(idx, "ascending_reading", e.target.value)} className="h-9 text-xs font-mono font-medium" placeholder="0.000" /></TableCell>;
                    if (colKey === "descending_reading" && hasDescending) return <TableCell key="descending_reading"><Input type="text" inputMode="decimal" value={getInputValue(idx, "descending_reading", pt.descending_reading ?? 0)} onChange={(e) => handleInputChange(idx, "descending_reading", e.target.value)} onBlur={(e) => handleInputBlur(idx, "descending_reading", e.target.value)} className="h-9 text-xs font-mono font-medium" placeholder="0.000" /></TableCell>;
                    if (colKey === "error") {
                      const colDec = getColumnDecimalPlaces("error");
                      return (
                        <TableCell key="error" className="font-mono text-xs font-semibold">
                          {pt.error !== undefined ? pt.error.toFixed(colDec) : "-"}
                        </TableCell>
                      );
                    }
                    if (colKey === "status") return <TableCell key="status" className="text-center">{pt.status ? <Badge variant={pt.status === "PASS" ? "default" : "destructive"} className="text-[10px] uppercase font-bold">{pt.status}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>;
                    if (colKey === "actions") return <TableCell key="actions" className="text-center border-l w-12"><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removePoint(idx)} title="Delete row"><Trash2 className="w-4 h-4" /></Button></TableCell>;

                    const col = customColumns.find((c) => c.id === colKey);
                    if (!col) return null;
                    return renderCustomCell(col, pt, idx);
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground bg-muted/20">
          <p className="text-sm font-medium">No calibration points added yet.</p>
          <p className="text-xs mt-1">Click "Add Point" or use "+5 Points" above to start entering data.</p>
        </div>
      )}

      {/* Summary & Legend */}
      {points.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <span>{points.length} point(s)</span>
            {points.some((p) => p.status !== undefined) && (
              <>
                <span className="text-emerald-600 font-bold">
                  {points.filter((p) => p.status === "PASS").length} Pass
                </span>
                <span className="text-red-600 font-bold">
                  {points.filter((p) => p.status === "FAIL").length} Fail
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Column Dialog */}
      <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
        <DialogContent className="sm:max-w-[750px] z-[10000]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Columns className="w-5 h-5 text-primary" />
              Add Custom Column
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create a custom column for text, numeric entry, or dynamic calibration formulas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-semibold">Column Header Name</Label>
                <Input
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="e.g., Nominal, Actual, Error"
                  className={`text-xs ${isAddNameDuplicate ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {isAddNameDuplicate && (
                  <p className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    A column with this name already exists. Please enter a unique name.
                  </p>
                )}
              </div>
              <div className="w-36 space-y-1.5 shrink-0">
                <Label className="text-xs font-semibold">Unit Option</Label>
                <Select value={newColUnit || "inherit"} onValueChange={setNewColUnit}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Global ({unit || "None"})</SelectItem>
                    {typeConfig.units.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                    {!typeConfig.units.includes("%") && <SelectItem value="%">% Percentage</SelectItem>}
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Column Group (Optional)</Label>
              <Input
                value={newColGroup}
                onChange={(e) => setNewColGroup(e.target.value)}
                placeholder="e.g., Actual Reading"
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Adjacent columns with the identical group name will be merged under a single header.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Column Data Type</Label>
                <Select value={newColType} onValueChange={(val: any) => setNewColType(val)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text Input (Manual)</SelectItem>
                    <SelectItem value="number">Numeric Input (Manual)</SelectItem>
                    <SelectItem value="formula">Calculated Formula (Auto-Computed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(newColType === "number" || newColType === "formula") ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Decimal Precision</Label>
                  <Select
                    value={newColDecimalPlaces !== undefined ? String(newColDecimalPlaces) : "inherit"}
                    onValueChange={(val) => setNewColDecimalPlaces(val === "inherit" ? undefined : parseInt(val))}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Inherit Global ({decimalPlaces} Dec)</SelectItem>
                      <SelectItem value="0">None (Integer — no decimal)</SelectItem>
                      <SelectItem value="1">1 Dec (.0)</SelectItem>
                      <SelectItem value="2">2 Dec (.00)</SelectItem>
                      <SelectItem value="3">3 Dec (.000)</SelectItem>
                      <SelectItem value="4">4 Dec (.0000)</SelectItem>
                      <SelectItem value="5">5 Dec (.00000)</SelectItem>
                      <SelectItem value="6">6 Dec (.000000)</SelectItem>
                      <SelectItem value="7">7 Dec (.0000000)</SelectItem>
                      <SelectItem value="8">8 Dec (.00000000)</SelectItem>
                      <SelectItem value="9">9 Dec (.000000000)</SelectItem>
                      <SelectItem value="10">10 Dec (.0000000000)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div></div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Placement</Label>
                <Select value={newColPlacement} onValueChange={(val: any) => setNewColPlacement(val)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="after_actual">After Actual</SelectItem>
                    <SelectItem value="after_desc">After Description</SelectItem>
                    <SelectItem value="after_nom">After Nominal</SelectItem>
                    <SelectItem value="after_tol">After Tolerance</SelectItem>
                    <SelectItem value="before_error">Before Error</SelectItem>
                    <SelectItem value="first">First Column</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newColType === "formula" && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Calculator className="w-3.5 h-3.5 text-primary" />
                    Formula Preset
                  </Label>
                  <Select value={newFormulaType} onValueChange={(val: any) => setNewFormulaType(val)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avg">Average / Mean</SelectItem>
                      <SelectItem value="stddev">Standard Deviation</SelectItem>
                      <SelectItem value="pct_error">Percentage Error ((Actual - Nominal) / Nominal * 100)</SelectItem>
                      <SelectItem value="abs_error">Absolute Error (|Actual - Nominal|)</SelectItem>
                      <SelectItem value="bias">Bias / Deviation (Actual - Nominal)</SelectItem>
                      <SelectItem value="custom">Custom Excel / Math Expression</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newFormulaType === "custom" && (
                  <div className="space-y-2.5 pt-1">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Formula Expression (e.g. =B - C or =(C - D)/D * 100)
                    </Label>
                    <Input
                      value={newCustomFormula}
                      onChange={(e) => setNewCustomFormula(e.target.value)}
                      placeholder="e.g., =B - C or =(C - D) / D * 100"
                      className={`font-mono text-xs ${!validateFormulaSyntax(newCustomFormula).valid ? "border-amber-500 focus-visible:ring-amber-500" : ""}`}
                    />

                    {!validateFormulaSyntax(newCustomFormula).valid && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {validateFormulaSyntax(newCustomFormula).message}
                      </p>
                    )}

                    {/* Concise Excel Syntax Reference */}
                    <div className="space-y-1 text-[11px] text-muted-foreground p-2.5 rounded-lg bg-background border shadow-2xs">
                      <span className="font-semibold block text-foreground">Standard Excel Formula Examples:</span>
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] pt-0.5">
                        <div><code className="text-primary font-bold font-mono">=B - C</code> (Difference)</div>
                        <div><code className="text-primary font-bold font-mono">=(B - C)/C * 100</code> (% Error)</div>
                        <div><code className="text-primary font-bold font-mono">=ABS(B - C)</code> (Absolute)</div>
                        <div><code className="text-primary font-bold font-mono">=AVERAGE(B, C)</code> (Mean)</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddColumnOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddColumn} disabled={!newColName.trim() || isAddNameDuplicate}>
              Add Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Column Dialog */}
      <Dialog open={!!editingCol} onOpenChange={(open) => !open && setEditingCol(null)}>
        <DialogContent className="sm:max-w-[520px] w-[95vw] max-w-full overflow-hidden z-[10000]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Edit className="w-5 h-5 text-primary" />
              {editingColIsStandard ? "Edit Standard Column" : "Edit Custom Column"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingColIsStandard && editingCol
                ? `Customize header name, unit, or calculation formula for ${getStandardColumnOriginalLabel(editingCol.id)}.`
                : "Rename column, change data type, or edit calculation formula."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs min-w-0">
            {editingColIsStandard && editingCol && (
              <div className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-background dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-background border border-blue-200/80 dark:border-blue-800/60 shadow-2xs space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    <div className="p-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                      <Sliders className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-foreground truncate">
                      System Field: <span className="text-blue-600 dark:text-blue-400">{getStandardColumnOriginalLabel(editingCol.id)}</span>
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground bg-background shrink-0 px-2 py-0.5">
                    key: {editingCol.id}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground pl-6">
                  Renaming updates display headers & reports while keeping formula mapping intact.
                </p>
              </div>
            )}

            <div className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Column Header Name</Label>
                  {editingColIsStandard && editingCol && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        Default: <span className="font-medium text-foreground">{getStandardColumnOriginalLabel(editingCol.id)}</span>
                      </span>
                      {editColName !== getStandardColumnOriginalLabel(editingCol.id) && (
                        <button
                          type="button"
                          onClick={() => setEditColName(getStandardColumnOriginalLabel(editingCol.id))}
                          className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 focus:outline-none"
                          title="Reset back to default column name"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Reset
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <Input
                  value={editColName}
                  onChange={(e) => setEditColName(e.target.value)}
                  placeholder="e.g., Size, Nominal, Actual"
                  className={`text-xs ${isEditNameDuplicate ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {isEditNameDuplicate && (
                  <p className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    A column with this name already exists. Please enter a unique name.
                  </p>
                )}
              </div>
              <div className="w-36 space-y-1.5 shrink-0">
                <Label className="text-xs font-semibold">Unit Option</Label>
                <Select value={editColUnit || "inherit"} onValueChange={setEditColUnit}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Global ({unit || "None"})</SelectItem>
                    {typeConfig.units.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                    {!typeConfig.units.includes("%") && <SelectItem value="%">% Percentage</SelectItem>}
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Column Group (Optional)</Label>
              <Input
                value={editColGroup}
                onChange={(e) => setEditColGroup(e.target.value)}
                placeholder="e.g., Actual Reading"
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Adjacent columns with the identical group name will be merged under a single header.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Column Data Type</Label>
                <Select value={editColType} onValueChange={(val: any) => setEditColType(val)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text Input (Manual)</SelectItem>
                    <SelectItem value="number">Numeric Input (Manual)</SelectItem>
                    <SelectItem value="formula">Calculated Formula (Auto-Computed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(editColType === "number" || editColType === "formula") && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Decimal Precision</Label>
                  <Select
                    value={editColDecimalPlaces !== undefined ? String(editColDecimalPlaces) : "inherit"}
                    onValueChange={(val) => setEditColDecimalPlaces(val === "inherit" ? undefined : parseInt(val))}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Inherit Global ({decimalPlaces} Dec)</SelectItem>
                      <SelectItem value="0">None (Integer — no decimal)</SelectItem>
                      <SelectItem value="1">1 Dec (.0)</SelectItem>
                      <SelectItem value="2">2 Dec (.00)</SelectItem>
                      <SelectItem value="3">3 Dec (.000)</SelectItem>
                      <SelectItem value="4">4 Dec (.0000)</SelectItem>
                      <SelectItem value="5">5 Dec (.00000)</SelectItem>
                      <SelectItem value="6">6 Dec (.000000)</SelectItem>
                      <SelectItem value="7">7 Dec (.0000000)</SelectItem>
                      <SelectItem value="8">8 Dec (.00000000)</SelectItem>
                      <SelectItem value="9">9 Dec (.000000000)</SelectItem>
                      <SelectItem value="10">10 Dec (.0000000000)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {editColType === "formula" && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Formula Type</Label>
                  <Select value={editFormulaType} onValueChange={(val: any) => setEditFormulaType(val)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avg">Average / Mean</SelectItem>
                      <SelectItem value="stddev">Standard Deviation</SelectItem>
                      <SelectItem value="pct_error">Percentage Error ((Actual - Nominal) / Nominal * 100)</SelectItem>
                      <SelectItem value="abs_error">Absolute Error (|Actual - Nominal|)</SelectItem>
                      <SelectItem value="bias">Bias / Deviation (Actual - Nominal)</SelectItem>
                      <SelectItem value="custom">Custom Formula Expression</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editFormulaType === "custom" && (
                  <div className="space-y-2.5 pt-1">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Formula Expression (e.g. =B - C or =(C - D)/D * 100)
                    </Label>
                    <Input
                      value={editCustomFormula}
                      onChange={(e) => setEditCustomFormula(e.target.value)}
                      placeholder="e.g., =B - C or =(C - D) / D * 100"
                      className={`font-mono text-xs ${!validateFormulaSyntax(editCustomFormula).valid ? "border-amber-500 focus-visible:ring-amber-500" : ""}`}
                    />

                    {!validateFormulaSyntax(editCustomFormula).valid && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {validateFormulaSyntax(editCustomFormula).message}
                      </p>
                    )}

                    {/* Concise Excel Syntax Reference */}
                    <div className="space-y-1 text-[11px] text-muted-foreground p-2.5 rounded-lg bg-background border shadow-2xs">
                      <span className="font-semibold block text-foreground">Standard Excel Formula Examples:</span>
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] pt-0.5">
                        <div><code className="text-primary font-bold font-mono">=B - C</code> (Difference)</div>
                        <div><code className="text-primary font-bold font-mono">=(B - C)/C * 100</code> (% Error)</div>
                        <div><code className="text-primary font-bold font-mono">=ABS(B - C)</code> (Absolute)</div>
                        <div><code className="text-primary font-bold font-mono">=AVERAGE(B, C)</code> (Mean)</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingCol(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEditColumn} disabled={!editColName.trim() || isEditNameDuplicate}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Status Rule & Formula Dialog */}
      <Dialog open={isEditStatusOpen} onOpenChange={setIsEditStatusOpen}>
        <DialogContent className="sm:max-w-[550px] z-[10000]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Calculator className="w-5 h-5 text-primary" />
              Configure Status Rule & Formula
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure how Pass / Fail status is evaluated for each row using standard tolerance or custom expressions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Rule Type Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-bold">Status Evaluation Rule</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  onClick={() => setEditStatusRuleType("default")}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    editStatusRuleType === "default"
                      ? "border-primary bg-primary/10 font-bold text-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <p className="text-xs font-bold">Default System Rule</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Evaluates ABS(Calculated Error) &le; Tolerance
                  </p>
                </div>

                <div
                  onClick={() => {
                    setEditStatusRuleType("custom_formula");
                    if (!editStatusFormula) {
                      setEditStatusFormula("=ABS(C) <= tolerance");
                    }
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    editStatusRuleType === "custom_formula"
                      ? "border-primary bg-primary/10 font-bold text-primary"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <p className="text-xs font-bold">Custom Status Formula</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Define custom pass/fail formula using column letters (A, B, C...)
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Formula Editor */}
            {editStatusRuleType === "custom_formula" && (
              <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Custom Status Expression</Label>
                    <span className="text-[10px] text-muted-foreground">Evaluates to TRUE (PASS) or FALSE (FAIL)</span>
                  </div>
                  <Input
                    value={editStatusFormula}
                    onChange={(e) => setEditStatusFormula(e.target.value)}
                    placeholder="e.g. =ABS(C) <= tolerance"
                    className="font-mono text-xs h-9 font-bold bg-background"
                  />
                </div>

                {/* Quick Formula Presets */}
                <div className="space-y-2 pt-1 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Quick Formula Presets:</span>
                    <span className="text-[9px] text-muted-foreground font-medium">Hover over any button to see formula use case & example</span>
                  </div>
                  
                  <div className="space-y-2 bg-muted/30 p-2.5 rounded-lg border">
                    {/* Category 1: Single Limit & Range Checks */}
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">1. Limit & Range Checks</span>
                      <div className="flex flex-wrap gap-1">
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 font-mono bg-blue-50/60 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400"
                                onClick={() => setEditStatusFormula("=AND(E >= B + D, E <= B + C)")}
                              >
                                =AND(E &ge; B+D, E &le; B+C)
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] p-3 space-y-1.5 text-xs bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl z-[20000]">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] border-b border-slate-800 pb-1">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Upper & Lower Deviation Tolerance Range</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Checks if Actual reading (E) is between Nominal (B) plus Min Tolerance (D) and Nominal (B) plus Max Tolerance (C).
                              </p>
                              <div className="p-2 rounded bg-slate-950 font-mono text-[9.5px] text-slate-200 border border-slate-800 space-y-0.5">
                                <p className="text-amber-400 font-bold text-[10px]">Example:</p>
                                <p>Nominal B = 15.0, Max C = +0.020, Min D = -0.020, Actual E = 14.980</p>
                                <p className="text-emerald-400 font-semibold pt-0.5">14.980 is between 14.980 & 15.020 &rarr; PASS &check;</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 font-mono bg-blue-50/60 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400"
                                onClick={() => setEditStatusFormula("=AND(C >= D, C <= B)")}
                              >
                                =AND(C &ge; D, C &le; B)
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] p-3 space-y-1.5 text-xs bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl z-[20000]">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] border-b border-slate-800 pb-1">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Min Size & Max Size Boundaries</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Checks if Actual size (C) is between Min Size (D) and Max Size (B).
                              </p>
                              <div className="p-2 rounded bg-slate-950 font-mono text-[9.5px] text-slate-200 border border-slate-800 space-y-0.5">
                                <p className="text-amber-400 font-bold text-[10px]">Example:</p>
                                <p>Max B = 41.936, Min D = 41.906, Actual C = 41.920</p>
                                <p className="text-emerald-400 font-semibold pt-0.5">41.920 is between 41.906 & 41.936 &rarr; PASS &check;</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 font-mono bg-blue-50/60 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400"
                                onClick={() => setEditStatusFormula("=B <= C")}
                              >
                                =B &le; C
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] p-3 space-y-1.5 text-xs bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl z-[20000]">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] border-b border-slate-800 pb-1">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Minimum Size Check (Nominal &le; Actual)</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Passes when Nominal / Minimum limit B is less than or equal to Actual reading C.
                              </p>
                              <div className="p-2 rounded bg-slate-950 font-mono text-[9.5px] text-slate-200 border border-slate-800 space-y-0.5">
                                <p className="text-amber-400 font-bold text-[10px]">Example:</p>
                                <p>Nominal B = 0.020, Actual C = 0.025</p>
                                <p className="text-emerald-400 font-semibold pt-0.5">0.020 &le; 0.025 &rarr; PASS &check;</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 font-mono bg-blue-50/60 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400"
                                onClick={() => setEditStatusFormula("=C <= B")}
                              >
                                =C &le; B
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] p-3 space-y-1.5 text-xs bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl z-[20000]">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] border-b border-slate-800 pb-1">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Maximum Size Check (Actual &le; Nominal)</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Passes when Actual reading C does not exceed Maximum limit B.
                              </p>
                              <div className="p-2 rounded bg-slate-950 font-mono text-[9.5px] text-slate-200 border border-slate-800 space-y-0.5">
                                <p className="text-amber-400 font-bold text-[10px]">Example:</p>
                                <p>Max B = 0.020, Actual C = 0.025</p>
                                <p className="text-rose-400 font-semibold pt-0.5">0.025 is greater than 0.020 &rarr; FAIL &cross;</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    {/* Category 2: Multiple Readings */}
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">2. Multiple Readings</span>
                      <div className="flex flex-wrap gap-1">
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 font-mono bg-emerald-50/60 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                                onClick={() => setEditStatusFormula("=AND(ABS(D - B) <= C, ABS(E - B) <= C)")}
                              >
                                =AND(ABS(D-B)&le;C, ABS(E-B)&le;C)
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] p-3 space-y-1.5 text-xs bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl z-[20000]">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] border-b border-slate-800 pb-1">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Strict Check: All Readings In Tolerance</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Requires EVERY reading (Reading 1 D and Reading 2 E) to be individually within tolerance C from Nominal B.
                              </p>
                              <div className="p-2 rounded bg-slate-950 font-mono text-[9.5px] text-slate-200 border border-slate-800 space-y-0.5">
                                <p className="text-amber-400 font-bold text-[10px]">Example:</p>
                                <p>Nominal B = 1.000, Tol C = 0.030</p>
                                <p>Reading 1 D = 1.000 (Err 0 &le; 0.030)</p>
                                <p>Reading 2 E = 10.100 (Err 9.1 &gt; 0.030)</p>
                                <p className="text-rose-400 font-semibold pt-0.5">Reading 2 failed &rarr; FAIL &cross;</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 font-mono bg-emerald-50/60 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                                onClick={() => setEditStatusFormula("=ABS(AVERAGE(D, E) - B) <= C")}
                              >
                                =ABS(AVERAGE(D,E)-B)&le;C
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] p-3 space-y-1.5 text-xs bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl z-[20000]">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] border-b border-slate-800 pb-1">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Average Reading In Tolerance</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Computes average of Reading 1 (D) & Reading 2 (E) and checks if average error is within tolerance C.
                              </p>
                              <div className="p-2 rounded bg-slate-950 font-mono text-[9.5px] text-slate-200 border border-slate-800 space-y-0.5">
                                <p className="text-amber-400 font-bold text-[10px]">Example:</p>
                                <p>Nominal B = 1.000, Tol C = 0.030</p>
                                <p>Reading 1 D = 1.000, Reading 2 E = 1.020</p>
                                <p>Average = 1.010 (Error = 0.010)</p>
                                <p className="text-emerald-400 font-semibold pt-0.5">0.010 &le; 0.030 &rarr; PASS &check;</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 font-mono bg-emerald-50/60 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                                onClick={() => setEditStatusFormula("=ABS(D - E) <= C")}
                              >
                                =ABS(D - E) &le; C
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] p-3 space-y-1.5 text-xs bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl z-[20000]">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] border-b border-slate-800 pb-1">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Repeatability Variation Check</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Checks if the difference between Reading 1 (D) and Reading 2 (E) does not exceed variation limit C.
                              </p>
                              <div className="p-2 rounded bg-slate-950 font-mono text-[9.5px] text-slate-200 border border-slate-800 space-y-0.5">
                                <p className="text-amber-400 font-bold text-[10px]">Example:</p>
                                <p>Reading 1 D = 10.010, Reading 2 E = 10.020, Limit C = 0.030</p>
                                <p className="text-emerald-400 font-semibold pt-0.5">Diff |10.010 - 10.020| = 0.010 &le; 0.030 &rarr; PASS &check;</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    {/* Category 3: Error & Acceptance Criteria */}
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">3. Tolerance & Percentage Error</span>
                      <div className="flex flex-wrap gap-1">
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 font-mono"
                                onClick={() => setEditStatusFormula("=ABS(C) <= tolerance")}
                              >
                                =ABS(C) &le; tolerance
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] p-3 space-y-1.5 text-xs bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl z-[20000]">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] border-b border-slate-800 pb-1">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Absolute Row Error Check</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Checks if absolute value of error in Column C is within the row tolerance limit.
                              </p>
                              <div className="p-2 rounded bg-slate-950 font-mono text-[9.5px] text-slate-200 border border-slate-800 space-y-0.5">
                                <p className="text-amber-400 font-bold text-[10px]">Example:</p>
                                <p>Error C = -0.015, Row Tolerance = 0.020</p>
                                <p className="text-emerald-400 font-semibold pt-0.5">|-0.015| = 0.015 &le; 0.020 &rarr; PASS &check;</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 font-mono"
                                onClick={() => setEditStatusFormula("=ABS(C) <= MPE")}
                              >
                                =ABS(C) &le; MPE
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] p-3 space-y-1.5 text-xs bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl z-[20000]">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] border-b border-slate-800 pb-1">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Template Acceptance Criteria (MPE)</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Checks if error in Column C is within template Maximum Permissible Error (MPE / AC).
                              </p>
                              <div className="p-2 rounded bg-slate-950 font-mono text-[9.5px] text-slate-200 border border-slate-800 space-y-0.5">
                                <p className="text-amber-400 font-bold text-[10px]">Example:</p>
                                <p>Error C = 0.005, Template MPE = 0.010</p>
                                <p className="text-emerald-400 font-semibold pt-0.5">0.005 &le; 0.010 &rarr; PASS &check;</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 font-mono"
                                onClick={() => setEditStatusFormula("=ABS(D) <= 2%")}
                              >
                                =ABS(D) &le; 2%
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] p-3 space-y-1.5 text-xs bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl z-[20000]">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] border-b border-slate-800 pb-1">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Percentage Error Limit Check</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Checks if percentage error in Column D is within 2%.
                              </p>
                              <div className="p-2 rounded bg-slate-950 font-mono text-[9.5px] text-slate-200 border border-slate-800 space-y-0.5">
                                <p className="text-amber-400 font-bold text-[10px]">Example:</p>
                                <p>Pct Error D = 1.5%</p>
                                <p className="text-emerald-400 font-semibold pt-0.5">1.5% &le; 2% &rarr; PASS &check;</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2 font-mono bg-purple-50/60 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400"
                                onClick={() => setEditStatusFormula('=C = "OK"')}
                              >
                                =C = "OK"
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[300px] p-3 space-y-1.5 text-xs bg-slate-900 text-slate-100 border border-slate-700 shadow-2xl z-[20000]">
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] border-b border-slate-800 pb-1">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>Text Verdict Check</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                Checks if text entry in Column C matches &quot;OK&quot;.
                              </p>
                              <div className="p-2 rounded bg-slate-950 font-mono text-[9.5px] text-slate-200 border border-slate-800 space-y-0.5">
                                <p className="text-amber-400 font-bold text-[10px]">Example:</p>
                                <p>Column C = &quot;OK&quot; &rarr; PASS &check;</p>
                                <p>Column C = &quot;NOT OK&quot; &rarr; FAIL &cross;</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clickable Variable Chips */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-semibold text-muted-foreground block">Clickable Column Tokens:</span>
                  <div className="flex flex-wrap gap-1">
                    {activeOrder
                      .filter((k) => k !== "pt" && k !== "status" && k !== "actions")
                      .map((colKey, colIdx) => {
                        const excelLetter = getExcelColumnLetter(colIdx);
                        let name = colKey;
                        if (colKey === "description") name = "Description";
                        else if (colKey === "nominal") name = "Nominal";
                        else if (colKey === "tolerance") name = "Tolerance";
                        else if (colKey === "ascending_reading") name = "Actual";
                        else if (colKey === "descending_reading") name = "Descending";
                        else if (colKey === "error") name = "Error";
                        else {
                          const c = customColumns.find((cc) => cc.id === colKey);
                          if (c) name = c.name;
                        }

                        return (
                          <div
                            key={colKey}
                            onClick={() => {
                              setEditStatusFormula((prev) => (prev ? `${prev} ${excelLetter}` : `=${excelLetter}`));
                            }}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/50 hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-pointer transition-colors shadow-sm"
                            title={`Insert Column ${excelLetter} (${name})`}
                          >
                            <div className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 border border-primary/20 text-primary font-mono font-bold text-[11px] shrink-0 leading-none shadow-sm">
                              {excelLetter}
                            </div>
                            <span className="text-xs text-muted-foreground font-medium font-sans truncate">{name}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsEditStatusOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setStatusRuleType(editStatusRuleType);
                setStatusFormula(editStatusFormula);
                if (onStatusRuleChange) {
                  onStatusRuleChange(editStatusRuleType, editStatusFormula);
                }

                // Immediately recalculate status for all points
                const updated = points.map((pt) => {
                  const newPt = { ...pt };
                  newPt.status = computePointStatus(
                    newPt,
                    editStatusRuleType,
                    editStatusFormula,
                    tolerance,
                    customColumns,
                    activeOrder
                  );
                  return newPt;
                });
                onPointsChange(updated);
                setIsEditStatusOpen(false);
              }}
            >
              Apply Status Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template & Grid Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[480px] z-[10000]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Settings2 className="w-5 h-5 text-primary" />
              Template & Grid Settings
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure decimal precision (1 to 10), measurement units, default tolerances & MPE criteria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Decimal Precision */}
            <div className="space-y-1.5 border-b pb-3">
              <Label className="text-xs font-semibold">Decimal Precision (1 to 10)</Label>
              <p className="text-[11px] text-muted-foreground">
                Set number of decimal places for calculations and automatic formatting on blur.
              </p>
              <Select
                value={String(decimalPlaces)}
                onValueChange={(val) => {
                  const dp = parseInt(val, 10);
                  setDecimalPlaces(dp);
                  if (onDecimalPlacesChange) onDecimalPlacesChange(dp);
                }}
              >
                <SelectTrigger className="w-full h-9 text-xs font-mono font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None — Integer (no decimal)</SelectItem>
                  <SelectItem value="1">1 Decimal (.0)</SelectItem>
                  <SelectItem value="2">2 Decimals (.00)</SelectItem>
                  <SelectItem value="3">3 Decimals (.000)</SelectItem>
                  <SelectItem value="4">4 Decimals (.0000)</SelectItem>
                  <SelectItem value="5">5 Decimals (.00000)</SelectItem>
                  <SelectItem value="6">6 Decimals (.000000)</SelectItem>
                  <SelectItem value="7">7 Decimals (.0000000)</SelectItem>
                  <SelectItem value="8">8 Decimals (.00000000)</SelectItem>
                  <SelectItem value="9">9 Decimals (.000000000)</SelectItem>
                  <SelectItem value="10">10 Decimals (.0000000000)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Measurement Unit */}
            <div className="space-y-1.5 border-b pb-3">
              <Label className="text-xs font-semibold">Default Measurement Unit</Label>
              <Select value={unit} onValueChange={onUnitChange}>
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Unit" />
                </SelectTrigger>
                <SelectContent>
                  {typeConfig.units.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default Tolerance */}
            <div className="space-y-1.5 border-b pb-3">
              <Label className="text-xs font-semibold">Default Tolerance (±)</Label>
              <Input
                type="number"
                step="any"
                value={
                  rawTolerance !== null
                    ? rawTolerance
                    : tolerance !== undefined && tolerance !== null
                    ? String(tolerance)
                    : ""
                }
                onChange={(e) => {
                  const text = e.target.value;
                  setRawTolerance(text);
                  const parsed = parseFloat(text);
                  const newTol = isNaN(parsed) ? 0 : parsed;
                  onToleranceChange(newTol);

                  const updated = points.map((pt) => {
                    const ptTol = pt.tolerance !== undefined && pt.tolerance > 0 ? pt.tolerance : newTol;
                    const newPt = { ...pt };
                    if (ptTol > 0) {
                      newPt.status = Math.abs(newPt.error) <= ptTol ? "PASS" : "FAIL";
                    } else {
                      newPt.status = undefined;
                    }
                    return newPt;
                  });
                  onPointsChange(updated);
                }}
                placeholder="0.001"
                className="h-9 text-xs font-mono"
              />
            </div>

            {/* Acceptance Criteria (MPE) */}
            {onAcceptanceCriteriaChange && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Acceptance Criteria (MPE Limit)</Label>
                  <Checkbox
                    id="modal_acc_check"
                    checked={!!acceptanceCriteria?.enabled}
                    onCheckedChange={(c) =>
                      onAcceptanceCriteriaChange({
                        ...acceptanceCriteria,
                        enabled: !!c,
                      })
                    }
                  />
                </div>
                {acceptanceCriteria?.enabled && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Criteria Limit</Label>
                      <Input
                        type="number"
                        step="any"
                        value={acceptanceCriteria.value ?? 2}
                        onChange={(e) =>
                          onAcceptanceCriteriaChange({
                            ...acceptanceCriteria,
                            value: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="h-8 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Limit Unit</Label>
                      <Select
                        value={acceptanceCriteria.type || "percentage"}
                        onValueChange={(val: any) =>
                          onAcceptanceCriteriaChange({
                            ...acceptanceCriteria,
                            type: val,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">% Percentage</SelectItem>
                          <SelectItem value="absolute">± Absolute Unit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setIsSettingsOpen(false)} className="w-full">
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (isFullscreen) {
    return createPortal(gridContent, document.body);
  }

  return gridContent;
}
