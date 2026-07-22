import { useState } from "react";
import { CalibrationPoint, CalibrationTypeConfig } from "@/types/calibration";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Columns, Calculator, X, Sparkles, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { HyperFormula } from "hyperformula";

interface CalibrationDataGridProps {
  typeConfig: CalibrationTypeConfig;
  points: CalibrationPoint[];
  onPointsChange: (points: CalibrationPoint[]) => void;
  unit: string;
  onUnitChange: (unit: string) => void;
  tolerance: number;
  onToleranceChange: (tolerance: number) => void;
}

export interface CustomColumn {
  id: string;
  name: string;
  type: "text" | "number" | "formula";
  formulaType?: "avg" | "stddev" | "abs_error" | "pct_error" | "bias" | "custom";
  customFormula?: string;
}

/**
 * Dynamic data entry grid for calibration points.
 * Features:
 * - Unified Column Order Engine (Drag & Drop or click ← / → to move custom columns anywhere)
 * - Powered by HyperFormula (Excel-compatible formula calculation engine)
 * - Editable per-item tolerance
 * - High-precision string input handling (allows 0.000 / micron values without erasing decimals)
 */
export function CalibrationDataGrid({
  typeConfig,
  points,
  onPointsChange,
  unit,
  onUnitChange,
  tolerance,
  onToleranceChange,
}: CalibrationDataGridProps) {
  const hasDescending = typeConfig.columns.some((c) => c.key === "descending_reading");

  // Raw input strings for decimal inputs
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [rawTolerance, setRawTolerance] = useState<string | null>(null);

  // Dynamic custom columns state
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);

  // Column order state storing column IDs in order
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  // Drag and drop state
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  // Dialog state for adding new columns
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<"text" | "number" | "formula">("text");
  const [newColPlacement, setNewColPlacement] = useState<"after_actual" | "after_desc" | "after_nom" | "after_tol" | "first" | "before_error">("after_actual");
  const [newFormulaType, setNewFormulaType] = useState<"avg" | "stddev" | "abs_error" | "pct_error" | "bias" | "custom">("avg");
  const [newCustomFormula, setNewCustomFormula] = useState("=Actual - Nominal");

  // Calculate active unified column order
  const getActiveColumnOrder = (): string[] => {
    const standardKeys = ["pt", "description", "nominal", "tolerance", "ascending_reading"];
    if (hasDescending) standardKeys.push("descending_reading");
    standardKeys.push("error", "status", "actions");

    const customIds = customColumns.map((c) => c.id);

    if (columnOrder.length > 0) {
      let order = columnOrder.filter((k) => standardKeys.includes(k) || customIds.includes(k));

      // Add missing standard keys
      standardKeys.forEach((k) => {
        if (!order.includes(k)) order.push(k);
      });

      // Add missing custom keys
      customIds.forEach((id) => {
        if (!order.includes(id)) {
          const errIdx = order.indexOf("error");
          if (errIdx !== -1) order.splice(errIdx, 0, id);
          else order.push(id);
        }
      });

      if (!hasDescending) {
        order = order.filter((k) => k !== "descending_reading");
      }
      return order;
    }

    // Default initial order
    const initial = ["pt", "description", "nominal", "tolerance", "ascending_reading"];
    if (hasDescending) initial.push("descending_reading");
    customIds.forEach((id) => initial.push(id));
    initial.push("error", "status", "actions");
    return initial;
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
    if (hasDescending && desc !== undefined) {
      const avg = (asc + desc) / 2;
      pt.error = parseFloat((avg - nom).toFixed(6));
    } else {
      pt.error = parseFloat((asc - nom).toFixed(6));
    }

    // Determine pass/fail based on row tolerance
    const rowTol = pt.tolerance !== undefined && pt.tolerance !== null && pt.tolerance > 0 
      ? parseNum(pt.tolerance) 
      : tolerance;

    pt.unit = unit;
    if (rowTol > 0) {
      pt.status = Math.abs(pt.error) <= rowTol ? "PASS" : "FAIL";
    } else {
      pt.status = undefined;
    }

    // Ensure custom columns are mapped with name and value for certificate generation
    if (customColumns.length > 0) {
      const currentFields = pt.customFields || {};
      const computedFields: Record<string, any> = {};
      customColumns.forEach((col) => {
        if (col.type === "formula") {
          const val = calculateFormulaValue(col, pt);
          computedFields[col.id] = { name: col.name, value: val };
        } else {
          const existing = currentFields[col.id];
          const val = typeof existing === "object" && existing !== null && "value" in existing ? existing.value : existing;
          computedFields[col.id] = { name: col.name, value: val ?? "" };
        }
      });
      pt.customFields = computedFields;
    }

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

  // Add Dynamic Column and place in columnOrder
  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    const colId = `col_${Date.now()}`;
    const newCol: CustomColumn = {
      id: colId,
      name: newColName.trim(),
      type: newColType,
      formulaType: newColType === "formula" ? newFormulaType : undefined,
      customFormula: newColType === "formula" && newFormulaType === "custom" ? newCustomFormula : undefined,
    };

    setCustomColumns((prev) => [...prev, newCol]);

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
    setColumnOrder(updatedOrder);

    // Reset dialog
    setNewColName("");
    setNewColType("text");
    setNewColPlacement("after_actual");
    setNewFormulaType("avg");
    setNewCustomFormula("=Actual - Nominal");
    setIsAddColumnOpen(false);
  };

  const handleRemoveColumn = (colId: string) => {
    setCustomColumns((prev) => prev.filter((c) => c.id !== colId));
    setColumnOrder((prev) => prev.filter((id) => id !== colId));
  };

  // Move column left or right across any column in table
  const moveColumnInOrder = (colId: string, direction: "left" | "right") => {
    const currentOrder = getActiveColumnOrder();
    const idx = currentOrder.indexOf(colId);
    if (idx === -1) return;

    const targetIdx = direction === "left" ? idx - 1 : idx + 1;
    if (targetIdx <= 0 || targetIdx >= currentOrder.length - 1) return; // Stay within bounds

    const updated = [...currentOrder];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, moved);
    setColumnOrder(updated);
  };

  // Drag and Drop handlers across any table column
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
      setColumnOrder(updated);
    }
    setDraggedColId(null);
  };

  // Evaluate formula using HyperFormula spreadsheet engine
  const calculateFormulaValue = (col: CustomColumn, pt: CalibrationPoint) => {
    const nom = parseNum(pt.nominal);
    const asc = parseNum(pt.ascending_reading);
    const desc = pt.descending_reading !== undefined ? parseNum(pt.descending_reading) : undefined;
    const actual = desc !== undefined ? (asc + desc) / 2 : asc;
    const err = pt.error ?? (actual - nom);

    let formulaExpr = "";

    switch (col.formulaType) {
      case "avg":
        formulaExpr = "=AVERAGE(Nominal, Actual)";
        break;
      case "stddev":
        formulaExpr = desc !== undefined ? "=STDEV(Ascending, Descending)" : "=0";
        break;
      case "pct_error":
        formulaExpr = "=((Actual - Nominal) / Nominal) * 100";
        break;
      case "abs_error":
        formulaExpr = "=ABS(Actual - Nominal)";
        break;
      case "bias":
        formulaExpr = "=Actual - Nominal";
        break;
      case "custom":
        formulaExpr = col.customFormula || "=Actual - Nominal";
        break;
      default:
        return "-";
    }

    try {
      let expr = formulaExpr.trim();
      if (!expr.startsWith("=")) {
        expr = "=" + expr;
      }

      // Convert variable names to HyperFormula cell coordinates
      const excelExpr = expr
        .replace(/\bNominal\b/gi, "A1")
        .replace(/\bTolerance\b/gi, "B1")
        .replace(/\bActual\b/gi, "C1")
        .replace(/\bAscending\b/gi, "C1")
        .replace(/\bDescending\b/gi, hasDescending ? "D1" : "0")
        .replace(/\bError\b/gi, String(err));

      const sheetData = [[nom, pt.tolerance || tolerance, asc, desc || 0]];
      const hf = HyperFormula.buildFromArray(sheetData, { licenseKey: "gpl-v3" });

      hf.setCellContents({ sheet: 0, col: 4, row: 0 }, [[excelExpr]]);
      const res = hf.getCellValue({ sheet: 0, col: 4, row: 0 });

      if (res === null || res === undefined) return "-";
      if (typeof res === "object" && "type" in res) {
        return `#${(res as any).type}`;
      }
      if (typeof res === "number") {
        return isNaN(res) ? "Err" : (col.formulaType === "pct_error" ? `${res.toFixed(3)}%` : res.toFixed(4));
      }
      return String(res);
    } catch {
      return "Err";
    }
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
      const calculatedVal = calculateFormulaValue(col, pt);
      return (
        <TableCell key={col.id} className="bg-primary/5 font-mono text-sm font-medium border-x border-primary/10">
          <span className="text-primary font-bold">{calculatedVal}</span>
        </TableCell>
      );
    }

    const fieldValue = pt.customFields?.[col.id];
    return (
      <TableCell key={col.id} className="bg-primary/5 border-x border-primary/10">
        <Input
          type="text"
          inputMode={col.type === "number" ? "decimal" : "text"}
          value={getCustomInputValue(idx, col.id, fieldValue)}
          onChange={(e) => handleCustomFieldChange(idx, col.id, e.target.value, col.type === "number")}
          placeholder={col.type === "number" ? "0.00" : "Value..."}
          className="h-8 text-sm font-mono"
        />
      </TableCell>
    );
  };

  const nominalCol = typeConfig.columns.find((c) => c.key === "nominal");
  const ascCol = typeConfig.columns.find((c) => c.key === "ascending_reading");
  const descCol = typeConfig.columns.find((c) => c.key === "descending_reading");
  const errorCol = typeConfig.columns.find((c) => c.key === "error");

  const activeOrder = getActiveColumnOrder();

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Unit</label>
          <Select value={unit} onValueChange={onUnitChange}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue />
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
          <label className="text-xs font-medium text-muted-foreground">Default Tolerance (±)</label>
          <Input
            type="text"
            inputMode="decimal"
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
            className="w-[120px] h-9"
          />
        </div>

        <div className="flex gap-2 ml-auto flex-wrap">
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

      {/* Data Table */}
      {points.length > 0 ? (
        <div className="border rounded-lg overflow-x-auto shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {activeOrder.map((colKey) => {
                  if (colKey === "pt") return <TableHead key="pt" className="w-12 text-center font-semibold">Pt</TableHead>;
                  if (colKey === "description") return <TableHead key="description" className="font-semibold min-w-[120px]" onDragOver={handleDragOver} onDrop={(e) => handleDropOnHeader(e, "description")}>Description</TableHead>;
                  if (colKey === "nominal") return <TableHead key="nominal" className="font-semibold min-w-[110px]" onDragOver={handleDragOver} onDrop={(e) => handleDropOnHeader(e, "nominal")}>{nominalCol?.label || "Nominal"} ({unit})</TableHead>;
                  if (colKey === "tolerance") return <TableHead key="tolerance" className="font-semibold min-w-[110px]" onDragOver={handleDragOver} onDrop={(e) => handleDropOnHeader(e, "tolerance")}>Tolerance (±)</TableHead>;
                  if (colKey === "ascending_reading") return <TableHead key="ascending_reading" className="font-semibold min-w-[110px]" onDragOver={handleDragOver} onDrop={(e) => handleDropOnHeader(e, "ascending_reading")}>{ascCol?.label || "Actual"} ({unit})</TableHead>;
                  if (colKey === "descending_reading") return <TableHead key="descending_reading" className="font-semibold min-w-[110px]" onDragOver={handleDragOver} onDrop={(e) => handleDropOnHeader(e, "descending_reading")}>{descCol?.label || "Descending"} ({unit})</TableHead>;
                  if (colKey === "error") return <TableHead key="error" className="font-semibold" onDragOver={handleDragOver} onDrop={(e) => handleDropOnHeader(e, "error")}>{errorCol?.label || "Error"} ({unit})</TableHead>;
                  if (colKey === "status") return <TableHead key="status" className="font-semibold text-center">Status</TableHead>;
                  if (colKey === "actions") return <TableHead key="actions" className="w-12"></TableHead>;

                  const col = customColumns.find((c) => c.id === colKey);
                  if (!col) return null;

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
                          {col.type === "formula" && <Calculator className="w-3.5 h-3.5 text-primary shrink-0" />}
                          <span className="truncate text-xs font-bold text-primary">{col.name}</span>
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
                            title="Move column left"
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
                            title="Move column right"
                          >
                            <ChevronRight className="w-3 h-3" />
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
              {points.map((pt, idx) => {
                const ptTol = pt.tolerance !== undefined && pt.tolerance !== null && parseNum(pt.tolerance) > 0
                  ? parseNum(pt.tolerance)
                  : tolerance;

                const isOutOfTolerance = ptTol > 0 && Math.abs(pt.error) > ptTol;

                return (
                  <TableRow key={idx} className={isOutOfTolerance ? "bg-red-50/60 dark:bg-red-950/20" : ""}>
                    {activeOrder.map((colKey) => {
                      if (colKey === "pt") return <TableCell key="pt" className="text-center font-medium text-muted-foreground">{pt.point_number}</TableCell>;
                      if (colKey === "description") {
                        return (
                          <TableCell key="description">
                            <Input
                              type="text"
                              value={getInputValue(idx, "description", pt.description)}
                              onChange={(e) => handleInputChange(idx, "description", e.target.value)}
                              placeholder="e.g., GO / NO GO"
                              className="h-8 text-sm"
                            />
                          </TableCell>
                        );
                      }
                      if (colKey === "nominal") {
                        return (
                          <TableCell key="nominal">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={getInputValue(idx, "nominal", pt.nominal)}
                              onChange={(e) => handleInputChange(idx, "nominal", e.target.value)}
                              placeholder="0.000"
                              className="h-8 text-sm font-mono"
                            />
                          </TableCell>
                        );
                      }
                      if (colKey === "tolerance") {
                        return (
                          <TableCell key="tolerance">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={getInputValue(idx, "tolerance", pt.tolerance)}
                              onChange={(e) => handleInputChange(idx, "tolerance", e.target.value)}
                              placeholder={String(tolerance || "0.01")}
                              className="h-8 text-sm font-mono"
                            />
                          </TableCell>
                        );
                      }
                      if (colKey === "ascending_reading") {
                        return (
                          <TableCell key="ascending_reading">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={getInputValue(idx, "ascending_reading", pt.ascending_reading)}
                              onChange={(e) => handleInputChange(idx, "ascending_reading", e.target.value)}
                              placeholder="0.000"
                              className="h-8 text-sm font-mono"
                            />
                          </TableCell>
                        );
                      }
                      if (colKey === "descending_reading") {
                        return (
                          <TableCell key="descending_reading">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={getInputValue(idx, "descending_reading", pt.descending_reading)}
                              onChange={(e) => handleInputChange(idx, "descending_reading", e.target.value)}
                              placeholder="0.000"
                              className="h-8 text-sm font-mono"
                            />
                          </TableCell>
                        );
                      }
                      if (colKey === "error") {
                        return (
                          <TableCell key="error">
                            <span className={`font-mono text-sm font-semibold ${isOutOfTolerance ? "text-red-600" : "text-emerald-600"}`}>
                              {pt.error.toFixed(4)}
                            </span>
                          </TableCell>
                        );
                      }
                      if (colKey === "status") {
                        return (
                          <TableCell key="status" className="text-center">
                            {pt.status === "PASS" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-300 text-[10px] font-bold">PASS</Badge>
                            ) : pt.status === "FAIL" ? (
                              <Badge className="bg-red-500/15 text-red-600 border-red-300 text-[10px] font-bold">FAIL</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      }
                      if (colKey === "actions") {
                        return (
                          <TableCell key="actions">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePoint(idx)}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        );
                      }

                      const col = customColumns.find((c) => c.id === colKey);
                      if (!col) return null;
                      return renderCustomCell(col, pt, idx);
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground bg-muted/20">
          <p className="text-sm font-medium">No calibration points added yet.</p>
          <p className="text-xs mt-1">Click "Add Point" or use "+5 Points" above to start entering data.</p>
        </div>
      )}

      {/* Summary */}
      {points.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
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
      )}

      {/* Add Column Dialog */}
      <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Columns className="w-5 h-5 text-primary" />
              Add Custom Column
            </DialogTitle>
            <DialogDescription>
              Create a custom column for text, numeric entry, or dynamic calibration formulas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Column Header Name</Label>
              <Input
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="e.g., Description, Average, Bias, Std Dev"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Column Data Type</Label>
                <Select
                  value={newColType}
                  onValueChange={(val: any) => setNewColType(val)}
                >
                  <SelectTrigger>
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
                <Label className="text-xs font-semibold">Column Position / Placement</Label>
                <Select
                  value={newColPlacement}
                  onValueChange={(val: any) => setNewColPlacement(val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="after_actual">After Actual (Default)</SelectItem>
                    <SelectItem value="after_desc">After Description</SelectItem>
                    <SelectItem value="after_nom">After Nominal</SelectItem>
                    <SelectItem value="after_tol">After Tolerance</SelectItem>
                    <SelectItem value="before_error">Before Error</SelectItem>
                    <SelectItem value="first">First Column (After Pt)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newColType === "formula" && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Calculator className="w-3.5 h-3.5 text-primary" />
                    Select Formula Preset
                  </Label>
                  <Select
                    value={newFormulaType}
                    onValueChange={(val: any) => setNewFormulaType(val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avg">Average / Mean (Nominal & Actual)</SelectItem>
                      <SelectItem value="stddev">Standard Deviation (Repeatability)</SelectItem>
                      <SelectItem value="pct_error">Percentage Error (%)</SelectItem>
                      <SelectItem value="abs_error">Absolute Error (|Actual - Nominal|)</SelectItem>
                      <SelectItem value="bias">Bias / Difference (Actual - Nominal)</SelectItem>
                      <SelectItem value="custom">Custom Expression / Math</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newFormulaType === "custom" && (
                  <div className="space-y-2 pt-1">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Excel / HyperFormula Expression
                    </Label>
                    <Input
                      value={newCustomFormula}
                      onChange={(e) => setNewCustomFormula(e.target.value)}
                      placeholder="e.g., =ROUND(Actual - Nominal, 4) or =IF(ABS(Error) <= Tolerance, 1, 0)"
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Powered by <strong>HyperFormula</strong> (Excel engine). Supports <code className="text-primary font-bold">{`=AVERAGE()`}</code>, <code className="text-primary font-bold">{`=STDEV()`}</code>, <code className="text-primary font-bold">{`=ABS()`}</code>, <code className="text-primary font-bold">{`=ROUND()`}</code>, <code className="text-primary font-bold">{`=IF()`}</code>.
                      <br />
                      Variables: <code className="text-primary font-bold">{`Nominal`}</code>, <code className="text-primary font-bold">{`Actual`}</code>, <code className="text-primary font-bold">{`Error`}</code>, <code className="text-primary font-bold">{`Tolerance`}</code>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddColumnOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddColumn} disabled={!newColName.trim()}>
              Add Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


