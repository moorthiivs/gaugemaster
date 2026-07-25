import { useState, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CalibrationPoint, CalibrationTypeConfig } from "@/types/calibration";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Columns, Calculator, X, Sparkles, GripVertical, ChevronLeft, ChevronRight, Edit, Eye, EyeOff, Check, AlertTriangle, Settings2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
}: CalibrationDataGridProps) {
  const hasDescending = typeConfig.columns.some((c) => c.key === "descending_reading");

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
  const [newColPlacement, setNewColPlacement] = useState<"after_actual" | "after_desc" | "after_nom" | "after_tol" | "first" | "before_error">("after_actual");
  const [newFormulaType, setNewFormulaType] = useState<"avg" | "stddev" | "abs_error" | "pct_error" | "bias" | "custom">("avg");
  const [newCustomFormula, setNewCustomFormula] = useState("=Actual - Nominal");

  // Edit Column Dialog State
  const [editingCol, setEditingCol] = useState<CustomColumn | null>(null);
  const [editingColIsStandard, setEditingColIsStandard] = useState(false);
  const [editColName, setEditColName] = useState("");
  const [editColType, setEditColType] = useState<"text" | "number" | "formula">("text");
  const [editColUnit, setEditColUnit] = useState("");
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
  const getActiveColumnOrder = (): string[] => {
    const standardKeys = ["description", "nominal", "tolerance", "ascending_reading"];
    if (hasDescending) standardKeys.push("descending_reading");
    standardKeys.push("error", "status");

    const customIds = customColumns.map((c) => c.id);

    let fullOrder = columnOrder.length > 0 ? [...columnOrder] : [];
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

    // Filter out 'pt', 'actions', and any hidden columns
    const middleOrder = fullOrder.filter(
      (key) => key !== "pt" && key !== "actions" && !hiddenColumns.includes(key)
    );

    // ALWAYS return 'pt' as Column 1 and 'actions' as the VERY LAST column
    return ["pt", ...middleOrder, "actions"];
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

      const resultStr = evaluateFormulaValue(dummyCol, pt, hasDescending, currentColumns, currentOrder, rowTol);

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
      const calcStr = evaluateFormulaValue(formulaErrCol, pt, hasDescending, currentColumns, currentOrder, rowTol);
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
       const calcVal = evaluateFormulaValue(errConfig, pt, hasDescending, customColumns, activeOrder, tolerance);
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
      const computedFields: Record<string, any> = {};
      customColumns.forEach((col) => {
        if (col.type === "formula") {
          const val = evaluateFormulaValue(col, pt, hasDescending, customColumns, activeOrder, tolerance);
          computedFields[col.id] = { name: col.name, value: val };
        } else {
          const existing = currentFields[col.id];
          const val = typeof existing === "object" && existing !== null && "value" in existing ? existing.value : existing;
          computedFields[col.id] = { name: col.name, value: val ?? "" };
        }
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
      const parsed = parseFloat(text);
      updatePoint(index, field, isNaN(parsed) ? 0 : parsed);
    }
  };

  const handleCustomFieldChange = (index: number, colId: string, text: string, isNumber: boolean) => {
    const key = `${index}_custom_${colId}`;
    setRawInputs((prev) => ({ ...prev, [key]: text }));

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
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && text.trim() !== "") {
      const formatted = parsed.toFixed(decimalPlaces);
      const key = `${index}_${field}`;
      setRawInputs((prev) => ({ ...prev, [key]: formatted }));
      updatePoint(index, field, parsed);
    }
  };

  const handleCustomFieldBlur = (index: number, colId: string, text: string, isNumber: boolean) => {
    if (!isNumber) return;
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && text.trim() !== "") {
      const formatted = parsed.toFixed(decimalPlaces);
      const key = `${index}_custom_${colId}`;
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

  // Helper to validate unique column names (case-insensitive)
  const isColumnNameTaken = (nameToCheck: string, excludeColId?: string): boolean => {
    const normalized = nameToCheck.trim().toLowerCase();
    if (!normalized) return false;

    // Check custom columns duplicates (excluding current editing column)
    const customDuplicate = customColumns.some(
      (c) => c.id !== excludeColId && c.name.trim().toLowerCase() === normalized
    );
    if (customDuplicate) return true;

    // Check standard column config duplicates (excluding current editing column)
    const standardDuplicate = Object.entries(standardColumnConfigs).some(
      ([id, c]) => id !== excludeColId && c.name && c.name.trim().toLowerCase() === normalized
    );
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
      if (selfNames.includes(normalized) || excludeColId === normalized) {
        return false;
      }
    }

    // Reserved names across all OTHER standard columns
    const allReservedNames = Object.entries(standardIdToNames).flatMap(([id, names]) =>
      id === excludeColId ? [] : names
    );

    return allReservedNames.includes(normalized);
  };

  const isAddNameDuplicate = isColumnNameTaken(newColName);
  const isEditNameDuplicate = editingCol ? isColumnNameTaken(editColName, editingCol.id) : false;

  // Add Dynamic Column  // Helper to extract clean base name without trailing bracketed units like " (inch)"
  const getCleanBaseName = (name: string): string => {
    if (!name) return "";
    return name.replace(/\s*\([^)]*\)$/, "").trim();
  };

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
    return String(pointValue);
  };

  const getCustomInputValue = (index: number, colId: string, fieldValue: any): string => {
    const key = `${index}_custom_${colId}`;
    if (rawInputs[key] !== undefined) {
      return rawInputs[key];
    }
    if (fieldValue === undefined || fieldValue === null) return "";
    return String(fieldValue);
  };

  const renderCustomCell = (col: CustomColumn, pt: CalibrationPoint, idx: number) => {
    if (col.type === "formula") {
      const calculatedVal = evaluateFormulaValue(col, pt, hasDescending, customColumns, activeOrder, tolerance);
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

  return (
    <div className="space-y-4">
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
            <PopoverContent className="w-64 p-3 space-y-3" align="end">
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
                  return (
                    <div key={col.id} className="flex items-center justify-between text-xs py-0.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <Checkbox
                          checked={isVisible}
                          onCheckedChange={() => toggleColumnHide(col.id)}
                        />
                        <span>{col.label}</span>
                      </label>
                      {!isVisible ? (
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-primary" />
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
          className="border rounded-lg overflow-auto shadow-sm max-h-[600px] relative"
        >
          <Table>
            <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10 shadow-xs">
              <TableRow>
                {activeOrder.map((colKey) => {
                  if (colKey === "pt") return (
                    <TableHead key="pt" className="w-12 text-center font-semibold border-r">
                      <span>Pt</span>
                    </TableHead>
                  );

                  if (colKey === "actions") return <TableHead key="actions" className="w-12 text-center border-l"></TableHead>;

                  const dataColumns = activeOrder.filter((k) => k !== "pt" && k !== "actions");
                  const dataIdx = dataColumns.indexOf(colKey);
                  const excelLetter = getExcelColumnLetter(dataIdx);                  const renderStandardColumn = (id: string, defaultBaseName: string, supportsUnit: boolean = true) => {
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
                        draggable={!isStatus}
                        onDragStart={!isStatus ? (e) => handleDragStart(e, id) : undefined}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnHeader(e, id)}
                        className={`font-semibold min-w-[120px] ${!isStatus ? "cursor-grab active:cursor-grabbing hover:bg-muted/50" : ""} select-none transition-colors border-x`}
                      >
                        <div className="flex items-center justify-between gap-1 py-1 group">
                          <div className="flex items-center gap-1 min-w-0 truncate">
                            {!isStatus && <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-50 group-hover:opacity-100" />}
                            <Badge className="bg-primary text-primary-foreground font-mono font-bold text-[9px] px-1 py-0 h-4 shrink-0">{excelLetter}</Badge>
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

                  if (colKey === "actions") return <TableHead key="actions" className="w-12 text-center border-l"></TableHead>;

                  const col = customColumns.find((c) => c.id === colKey);
                  if (!col) return null;

                  const colUnitSetting = col.unit && col.unit !== "inherit" && col.unit !== "none"
                    ? (typeConfig.units.includes(col.unit) ? "inherit" : col.unit)
                    : (col.type === "number" || col.type === "formula" ? "inherit" : "none");
                  const customDisplayTitle = getHeaderDisplayTitle(col.name, colUnitSetting);

                  return (
                    <TableHead
                      key={col.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnHeader(e, col.id)}
                      className="font-semibold min-w-[150px] bg-primary/10 border-x border-primary/20 select-none cursor-grab active:cursor-grabbing hover:bg-primary/15 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1 py-1">
                        <div className="flex items-center gap-1 min-w-0 truncate">
                          <GripVertical className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                          <Badge className="bg-primary text-primary-foreground font-mono font-bold text-[9px] px-1 py-0 h-4 shrink-0">{excelLetter}</Badge>
                          {col.type === "formula" && <Calculator className="w-3.5 h-3.5 text-primary shrink-0" />}
                          <span className="truncate text-xs font-bold text-primary">{customDisplayTitle}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-5 w-5 bg-background text-muted-foreground hover:text-foreground shadow-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveColumnInOrder(col.id, "left");
                            }}
                            title="Move left"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-5 w-5 bg-background text-muted-foreground hover:text-foreground shadow-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveColumnInOrder(col.id, "right");
                            }}
                            title="Move right"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditColumn(col);
                            }}
                            title="Edit Column & Formula"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveColumn(col.id);
                            }}
                            title="Remove column"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((pt, idx) => (
                <TableRow key={idx} className="hover:bg-muted/30 border-b">
                  {activeOrder.map((colKey) => {
                    if (colKey === "pt") return <TableCell key="pt" className="font-mono text-center text-muted-foreground font-medium text-xs border-r w-12">{pt.point_number}</TableCell>;

                    const isStandardFormula = standardColumnConfigs[colKey]?.type === "formula";
                    if (isStandardFormula && colKey !== "status") {
                      const calculatedVal = evaluateFormulaValue(standardColumnConfigs[colKey], pt, hasDescending, customColumns, activeOrder, tolerance);
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
                    if (colKey === "error") return <TableCell key="error" className="font-mono text-xs font-semibold">{pt.error !== undefined ? pt.error.toFixed(decimalPlaces) : "-"}</TableCell>;
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
        <DialogContent className="sm:max-w-[500px]">
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

            <div className="grid grid-cols-2 gap-3">
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Edit className="w-5 h-5 text-primary" />
              Edit Custom Column
            </DialogTitle>
            <DialogDescription className="text-xs">
              Rename column, change data type, or edit calculation formula.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-semibold">Column Header Name</Label>
                <Input
                  value={editColName}
                  onChange={(e) => setEditColName(e.target.value)}
                  placeholder="e.g., TEST"
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
        <DialogContent className="sm:max-w-[550px]">
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
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground block">Quick Formula Presets:</span>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 font-mono"
                      onClick={() => setEditStatusFormula("=ABS(C) <= tolerance")}
                    >
                      =ABS(C) &le; tolerance
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 font-mono"
                      onClick={() => setEditStatusFormula("=ABS(C) <= 0.2")}
                    >
                      =ABS(C) &le; 0.2
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 font-mono"
                      onClick={() => setEditStatusFormula("=ABS(D) <= 2")}
                    >
                      =ABS(D) &le; 2%
                    </Button>
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
                          <Badge
                            key={colKey}
                            variant="secondary"
                            onClick={() => {
                              setEditStatusFormula((prev) => (prev ? `${prev} ${excelLetter}` : `=${excelLetter}`));
                            }}
                            className="cursor-pointer hover:bg-primary/20 text-[10px] font-mono gap-1 py-1"
                            title={`Insert Column ${excelLetter} (${name})`}
                          >
                            <span className="font-bold text-primary">{excelLetter}</span>
                            <span className="text-muted-foreground font-sans">({name})</span>
                          </Badge>
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
        <DialogContent className="sm:max-w-[480px]">
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
}
