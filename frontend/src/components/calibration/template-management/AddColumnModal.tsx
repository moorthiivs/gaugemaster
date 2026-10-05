import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Columns,
  Plus,
  Calculator,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CheckCircle2,
  AlertCircle,
  Lock,
  Info,
} from "lucide-react";
import { CanvasColumnDef, TableGridBlock } from "@/types/template";
import { testEvaluateFormula } from "@/lib/formulaEngine";
import { toast } from "sonner";

export interface AddColumnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTable: TableGridBlock | null;
  globalDecimalPlaces?: number;
  onAddColumn: (tableId: string, column: CanvasColumnDef) => void;
}

/**
 * Generate a unique snake_case column key/identifier based on the column name.
 */
export function generateColumnKey(
  name: string,
  existingColumns: CanvasColumnDef[] = [],
): string {
  let base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!base) {
    base = "col";
  }

  const existingKeys = new Set(
    existingColumns.map((c) => (c.key || c.id || "").toLowerCase()),
  );

  if (!existingKeys.has(base)) {
    return base;
  }

  let counter = 1;
  while (existingKeys.has(`${base}_${counter}`)) {
    counter++;
  }
  return `${base}_${counter}`;
}

const COLUMN_TYPES: {
  value: CanvasColumnDef["type"];
  label: string;
  badge: string;
  description: string;
  defaultAlign: "left" | "center" | "right";
  defaultWidth: number;
}[] = [
  {
    value: "reading",
    label: "Reading / Observed",
    badge: "Direct Input",
    description: "Direct measurement reading entered by technician during calibration.",
    defaultAlign: "right",
    defaultWidth: 120,
  },
  {
    value: "nominal",
    label: "Nominal / Specification",
    badge: "Baseline Spec",
    description: "Target baseline standard or drawing specification value.",
    defaultAlign: "right",
    defaultWidth: 130,
  },
  {
    value: "trial",
    label: "Trial (t1, t2, t3...)",
    badge: "Multi-Trial",
    description: "Repeated trial observation for multi-run calibration points.",
    defaultAlign: "right",
    defaultWidth: 100,
  },
  {
    value: "formula",
    label: "Formula Calculation",
    badge: "Auto Computed",
    description: "Calculated expression automatically derived from other columns (e.g. error, deviation).",
    defaultAlign: "right",
    defaultWidth: 120,
  },
  {
    value: "status",
    label: "Judgement / Pass-Fail",
    badge: "Metrology Verdict",
    description: "Tolerance compliance evaluation returning PASS, FAIL, or review status.",
    defaultAlign: "center",
    defaultWidth: 120,
  },
  {
    value: "tolerance",
    label: "Tolerance (±)",
    badge: "Allowable Limits",
    description: "Allowable tolerance limit for this calibration point or row.",
    defaultAlign: "right",
    defaultWidth: 110,
  },
  {
    value: "number",
    label: "Numeric Value",
    badge: "General Number",
    description: "Standard numeric field without metrology calculation binding.",
    defaultAlign: "right",
    defaultWidth: 110,
  },
  {
    value: "text",
    label: "Text / Note",
    badge: "String / Notes",
    description: "General text, test conditions, or descriptive parameters.",
    defaultAlign: "left",
    defaultWidth: 140,
  },
];

export function AddColumnModal({
  open,
  onOpenChange,
  targetTable,
  globalDecimalPlaces = 3,
  onAddColumn,
}: AddColumnModalProps) {
  const [columnName, setColumnName] = useState("");
  const [columnKey, setColumnKey] = useState("");
  const [columnType, setColumnType] = useState<CanvasColumnDef["type"]>("reading");
  const [judgementMode, setJudgementMode] = useState<"formula" | "manual">("formula");
  const [isTypeManual, setIsTypeManual] = useState(false);
  const [columnDecimals, setColumnDecimals] = useState<string>("inherit");
  const [columnFormula, setColumnFormula] = useState("");
  const [columnAlign, setColumnAlign] = useState<"left" | "center" | "right">("right");
  const [columnWidth, setColumnWidth] = useState<number>(120);
  const [columnGroupName, setColumnGroupName] = useState<string>("");

  const formulaInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Table's effective default decimal precision
  const effectiveGlobalDec =
    targetTable?.decimal_places ?? globalDecimalPlaces ?? 3;

  // Selected type helper config
  const selectedTypeConfig = useMemo(() => {
    return COLUMN_TYPES.find((c) => c.value === columnType) || COLUMN_TYPES[0];
  }, [columnType]);

  // Existing header groups in this table
  const existingGroups = useMemo(() => {
    if (!targetTable?.columns) return [];
    const groups = new Set<string>();
    targetTable.columns.forEach((c) => {
      if (c.groupName?.trim()) {
        groups.add(c.groupName.trim());
      }
    });
    return Array.from(groups);
  }, [targetTable]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setColumnName("");
      setColumnKey("");
      setColumnType("reading");
      setJudgementMode("formula");
      setIsTypeManual(false);
      setColumnDecimals("inherit");
      setColumnFormula("");
      setColumnAlign("right");
      setColumnWidth(120);
      setColumnGroupName("");
    }
  }, [open]);

  // Handle column name input & auto-generate disabled key
  const handleNameChange = (name: string) => {
    setColumnName(name);

    // Key / Identifier is always automatically derived
    const generated = generateColumnKey(name, targetTable?.columns || []);
    setColumnKey(generated);

    // Smart auto-type selection if user hasn't manually selected one
    if (!isTypeManual) {
      const lower = name.toLowerCase().trim();
      if (
        lower.includes("judge") ||
        lower.includes("status") ||
        lower.includes("verdict") ||
        lower.includes("pass") ||
        lower.includes("fail") ||
        lower.includes("result")
      ) {
        setColumnType("status");
        setColumnAlign("center");
        setColumnWidth(120);
        if (
          lower.includes("manual") ||
          lower.includes("visual") ||
          lower.includes("wear") ||
          lower.includes("ring") ||
          lower.includes("check")
        ) {
          setJudgementMode("manual");
        } else if (!columnFormula) {
          setColumnFormula("IF(ABS(error) <= tolerance, 'PASS', 'FAIL')");
        }
      } else if (
        lower.includes("nominal") ||
        lower.includes("spec") ||
        lower.includes("std") ||
        lower.includes("master")
      ) {
        setColumnType("nominal");
        setColumnAlign("right");
        setColumnWidth(130);
      } else if (
        lower.includes("error") ||
        lower.includes("dev") ||
        lower.includes("diff") ||
        lower.includes("delta") ||
        lower.includes("calc") ||
        lower.includes("avg") ||
        lower.includes("mean")
      ) {
        setColumnType("formula");
        setColumnAlign("right");
        setColumnWidth(120);
        if (!columnFormula) {
          if (lower.includes("avg") || lower.includes("mean")) {
            setColumnFormula("AVERAGE(t1, t2, t3)");
          } else {
            setColumnFormula("reading - nominal");
          }
        }
      } else if (lower.includes("trial") || /^t\d+/i.test(lower)) {
        setColumnType("trial");
        setColumnAlign("right");
        setColumnWidth(100);
      } else if (lower.includes("tol")) {
        setColumnType("tolerance");
        setColumnAlign("right");
        setColumnWidth(110);
      } else if (
        lower.includes("remark") ||
        lower.includes("desc") ||
        lower.includes("note") ||
        lower.includes("comment")
      ) {
        setColumnType("text");
        setColumnAlign("left");
        setColumnWidth(140);
      }
    }
  };

  const handleTypeSelect = (newType: CanvasColumnDef["type"]) => {
    setColumnType(newType);
    setIsTypeManual(true);

    const typeConfig = COLUMN_TYPES.find((c) => c.value === newType);
    if (typeConfig) {
      setColumnAlign(typeConfig.defaultAlign);
      setColumnWidth(typeConfig.defaultWidth);
    }

    if (newType === "status" && !columnFormula.trim()) {
      setColumnFormula("IF(ABS(error) <= tolerance, 'PASS', 'FAIL')");
    } else if (newType === "formula" && !columnFormula.trim()) {
      setColumnFormula("reading - nominal");
    }
  };

  // Available token keys from the active table to click-insert into formula
  const availableTokens = useMemo(() => {
    const tokens = new Set<string>([
      "nominal",
      "reading",
      "tolerance",
      "error",
      "deviation",
    ]);
    (targetTable?.columns || []).forEach((c) => {
      const k = c.key || c.id;
      if (k && !k.startsWith("col_") && k !== "point_number" && k !== "sl_no") {
        tokens.add(k);
      }
    });
    return Array.from(tokens);
  }, [targetTable]);

  // Insert token into formula at current cursor position
  const insertToken = (token: string) => {
    const textarea = formulaInputRef.current;
    if (!textarea) {
      setColumnFormula((prev) => (prev ? `${prev} ${token}` : token));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = columnFormula;
    const newText = text.substring(0, start) + token + text.substring(end);
    setColumnFormula(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 10);
  };

  // Sample row context for live formula evaluation preview
  const sampleContext = useMemo(() => {
    const ctx: Record<string, any> = {
      nominal: 20.0,
      nom: 20.0,
      reading: 20.002,
      actual: 20.002,
      error: 0.002,
      deviation: 0.002,
      tolerance: targetTable?.tolerance ?? 0.02,
      lowerLimit: 19.98,
      upperLimit: 20.02,
      t1: 20.001,
      t2: 20.002,
      t3: 20.003,
    };
    (targetTable?.columns || []).forEach((c) => {
      const k = c.key || c.id;
      if (k && !(k in ctx)) {
        ctx[k] =
          c.type === "nominal"
            ? 20.0
            : c.type === "reading" || c.type === "trial"
              ? 20.002
              : 0;
      }
    });
    return ctx;
  }, [targetTable]);

  // Live test evaluation
  const liveTestResult = useMemo(() => {
    if (columnType !== "formula" && (columnType !== "status" || judgementMode === "manual")) return null;
    if (!columnFormula.trim()) return null;
    return testEvaluateFormula(columnFormula.trim(), sampleContext);
  }, [columnType, judgementMode, columnFormula, sampleContext]);

  // Submit Handler
  const handleSaveColumn = () => {
    if (!targetTable) {
      toast.error("No target table selected");
      return;
    }

    const trimmedName = columnName.trim();
    if (!trimmedName) {
      toast.error("Please enter a Column Name");
      return;
    }

    const trimmedKey =
      columnKey.trim() || generateColumnKey(trimmedName, targetTable.columns || []);

    // Check key uniqueness
    const isDuplicate = (targetTable.columns || []).some(
      (c) => (c.key || c.id || "").toLowerCase() === trimmedKey.toLowerCase(),
    );
    if (isDuplicate) {
      toast.error(
        `A column with identifier "${trimmedKey}" already exists in this table.`,
      );
      return;
    }

    const isManualJudgement = columnType === "status" && judgementMode === "manual";

    // Check formula requirement
    if (!isManualJudgement && (columnType === "formula" || columnType === "status") && !columnFormula.trim()) {
      toast.error("Please enter a formula expression for this column");
      return;
    }

    const dedicatedDec =
      columnDecimals === "inherit" ? undefined : parseInt(columnDecimals, 10);

    const newCol: CanvasColumnDef = {
      id: trimmedKey,
      key: trimmedKey,
      label: trimmedName,
      type: columnType,
      role: columnType === "status" ? "JUDGEMENT" : undefined,
      isManualJudgement: isManualJudgement,
      judgementMode: columnType === "status" ? judgementMode : undefined,
      formula:
        !isManualJudgement && (columnType === "formula" || columnType === "status")
          ? columnFormula.trim()
          : undefined,
      decimal_places: dedicatedDec,
      decimalPrecision: dedicatedDec,
      align: columnAlign,
      width: columnWidth,
      groupName: columnGroupName.trim() || undefined,
      editable: isManualJudgement || (columnType !== "formula" && columnType !== "status"),
    };

    onAddColumn(targetTable.id, newCol);
    toast.success(`Added column "${trimmedName}" to table`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-0 gap-0 border border-slate-200 dark:border-slate-800 bg-background shadow-2xl rounded-xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
              <Columns className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base font-semibold text-foreground">
                  Add Column to Table
                </DialogTitle>
                {targetTable && (
                  <Badge
                    variant="outline"
                    className="text-xs font-normal border-slate-300 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                  >
                    {targetTable.title || "Calibration Data"}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure header name, data type, formula calculations, and display format.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {/* Section 1: Column Name & Disabled Key Identifier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5">
              <div className="h-6 flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">
                  Column Name / Header <span className="text-destructive">*</span>
                </Label>
              </div>
              <Input
                value={columnName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Observed Reading, Runout"
                className="h-10 text-sm border-slate-300 dark:border-slate-600 bg-background shadow-xs hover:border-slate-400 dark:hover:border-slate-500 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                autoFocus
              />
              <div className="h-4 flex items-center">
                <span className="text-xs text-muted-foreground truncate">
                  Header displayed in table &amp; certificates.
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-6 flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <span>Key / Identifier</span>
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                </Label>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 leading-none">
                  auto (disabled)
                </span>
              </div>
              <Input
                value={columnKey}
                disabled
                readOnly
                tabIndex={-1}
                placeholder="e.g. observed_reading"
                className="h-10 text-sm font-mono border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 cursor-not-allowed select-none shadow-inner"
              />
              <div className="h-4 flex items-center">
                <span className="text-xs text-muted-foreground truncate">
                  Formula token:{" "}
                  <code className="font-mono text-primary font-semibold">
                    {columnKey || "runout"}
                  </code>
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Column Type & Decimals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {/* Column Type Select */}
            <div className="space-y-1.5">
              <div className="h-6 flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">
                  Column Type <span className="text-destructive">*</span>
                </Label>
              </div>
              <Select value={columnType} onValueChange={(val: any) => handleTypeSelect(val)}>
                <SelectTrigger className="h-10 text-sm border-slate-300 dark:border-slate-600 bg-background shadow-xs hover:border-slate-400 dark:hover:border-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="Select column type" />
                </SelectTrigger>
                <SelectContent className="max-h-64 border-slate-200 dark:border-slate-800 shadow-lg">
                  {COLUMN_TYPES.map((typeItem) => (
                    <SelectItem
                      key={typeItem.value}
                      value={typeItem.value}
                      className="py-2.5 cursor-pointer text-sm"
                    >
                      <div className="flex items-center justify-between w-full gap-3">
                        <span className="font-medium">{typeItem.label}</span>
                        <span className="text-xs opacity-75 font-normal">
                          ({typeItem.badge})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Decimals Option */}
            <div className="space-y-1.5">
              <div className="h-6 flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">
                  Decimal Places
                </Label>
                <span className="text-xs text-muted-foreground font-mono leading-none">
                  Global: <strong className="text-foreground">{effectiveGlobalDec} Dec</strong>
                </span>
              </div>
              <Select
                value={columnDecimals}
                onValueChange={(val: string) => setColumnDecimals(val)}
                disabled={columnType === "text" || columnType === "status"}
              >
                <SelectTrigger className="h-10 text-sm border-slate-300 dark:border-slate-600 bg-background shadow-xs hover:border-slate-400 dark:hover:border-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="Select decimals" />
                </SelectTrigger>
                <SelectContent className="border-slate-200 dark:border-slate-800 shadow-lg">
                  <SelectItem value="inherit" className="py-2">
                    <div className="flex items-center justify-between w-full gap-3">
                      <span className="font-medium">Default Global</span>
                      <span className="text-xs opacity-75 font-normal">
                        ({effectiveGlobalDec} Decimals)
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="0" className="py-2">0 — Integer (e.g. 10)</SelectItem>
                  <SelectItem value="1" className="py-2">1 — 0.0 (Tenths)</SelectItem>
                  <SelectItem value="2" className="py-2">2 — 0.00 (Hundredths)</SelectItem>
                  <SelectItem value="3" className="py-2">3 — 0.000 (Thousandths)</SelectItem>
                  <SelectItem value="4" className="py-2">4 — 0.0000 (Ten-thousandths)</SelectItem>
                  <SelectItem value="5" className="py-2">5 — 0.00000 (5 Decimals)</SelectItem>
                  <SelectItem value="6" className="py-2">6 — 0.000000 (Sub-micron)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contextual Description Banner */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
            <div className="p-1 rounded-full bg-primary/10 text-primary shrink-0">
              <Info className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {selectedTypeConfig.label}:{" "}
                </span>
                <span>{selectedTypeConfig.description}</span>
              </div>
              {selectedTypeConfig.value !== "text" && selectedTypeConfig.value !== "status" && (
                <Badge
                  variant="outline"
                  className="text-[11px] font-mono px-2 py-0 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0"
                >
                  Precision:{" "}
                  {columnDecimals === "inherit"
                    ? `${effectiveGlobalDec} dec (table)`
                    : `${columnDecimals} dec (custom)`}
                </Badge>
              )}
            </div>
          </div>

          {/* Section 3: Formula Input Section (Visible when Column Type is Formula or Judgement) */}
          {(columnType === "formula" || columnType === "status") && (
            <div className="space-y-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
              {columnType === "status" && (
                <div className="space-y-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">
                      Judgement Evaluation Mode:
                    </Label>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500">
                      {judgementMode === "manual" ? "Visual / Functional Check" : "Calculated Tolerance"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setJudgementMode("formula");
                        if (!columnFormula.trim()) {
                          setColumnFormula("IF(ABS(error) <= tolerance, 'PASS', 'FAIL')");
                        }
                      }}
                      className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all text-center ${
                        judgementMode === "formula"
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Formula (Auto PASS / FAIL)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setJudgementMode("manual");
                      }}
                      className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all text-center ${
                        judgementMode === "manual"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Manual Check (OK / NOT OK)
                    </button>
                  </div>
                </div>
              )}

              {columnType === "status" && judgementMode === "manual" ? (
                <div className="space-y-2 py-1 text-xs">
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 space-y-1.5">
                    <div className="font-semibold flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Manual Visual & Functional Inspection Mode Active</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400">
                      Perfect for <strong>Thread Plug Gauges</strong>, <strong>Thread Rings</strong>, and limit gauges (e.g. checked by GO/NOGO wear check rings).
                      The technician can directly type or 1-click toggle <strong>OK</strong> / <strong>NOT OK</strong> during calibration without requiring numeric readings or tolerance calculation formulas.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="h-6 flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-primary" />
                      <span>Formula Expression <span className="text-destructive">*</span></span>
                    </Label>
                    <Badge
                      variant="outline"
                      className="text-xs font-mono border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      {columnType === "status" ? "Pass/Fail Verdict" : "Math Expression"}
                    </Badge>
                  </div>

                  <Textarea
                    ref={formulaInputRef}
                    value={columnFormula}
                    onChange={(e) => setColumnFormula(e.target.value)}
                    placeholder={
                      columnType === "status"
                        ? "e.g. IF(ABS(error) <= tolerance, 'PASS', 'FAIL')"
                        : "e.g. reading - nominal"
                    }
                    className="font-mono text-sm h-20 resize-none border-slate-300 dark:border-slate-600 bg-background shadow-xs hover:border-slate-400 dark:hover:border-slate-500 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                  />

              {/* Variable Tokens */}
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground font-medium">
                  Insert Column Variables:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {availableTokens.map((tok) => (
                    <Button
                      key={tok}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertToken(tok)}
                      className="h-6 px-2 text-xs font-mono font-normal gap-1 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary hover:text-primary transition-colors"
                      title={`Click to insert ${tok}`}
                    >
                      <Plus className="w-3 h-3 text-muted-foreground" />
                      <span>{tok}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Quick Formula Examples */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs text-muted-foreground font-medium">
                  Quick Examples:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {columnType === "status" ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setColumnFormula("IF(ABS(error) <= tolerance, 'PASS', 'FAIL')")
                        }
                        className="h-6 px-2 text-xs font-mono border border-slate-200 dark:border-slate-700"
                      >
                        ABS(error) &lt;= tolerance
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setColumnFormula(
                            "IF(ISBLANK(reading), '-', IF(ABS(error) <= tolerance, 'PASS', 'FAIL'))",
                          )
                        }
                        className="h-6 px-2 text-xs font-mono border border-slate-200 dark:border-slate-700"
                      >
                        Blank-Safe Check
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setColumnFormula(
                            "IF(reading >= lowerLimit AND reading <= upperLimit, 'PASS', 'FAIL')",
                          )
                        }
                        className="h-6 px-2 text-xs font-mono border border-slate-200 dark:border-slate-700"
                      >
                        Min / Max Limits
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setColumnFormula("reading - nominal")}
                        className="h-6 px-2 text-xs font-mono border border-slate-200 dark:border-slate-700"
                      >
                        reading - nominal
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setColumnFormula("AVERAGE(t1, t2, t3)")}
                        className="h-6 px-2 text-xs font-mono border border-slate-200 dark:border-slate-700"
                      >
                        AVERAGE(t1, t2, t3)
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setColumnFormula("ROUND(reading - nominal, 3)")}
                        className="h-6 px-2 text-xs font-mono border border-slate-200 dark:border-slate-700"
                      >
                        ROUND(diff, 3)
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Live Preview Result */}
              {liveTestResult && (
                <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    {liveTestResult.success ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          Formula Syntax Valid
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          {liveTestResult.error || "Check formula syntax"}
                        </span>
                      </>
                    )}
                  </div>
                  {liveTestResult.success && liveTestResult.result !== undefined && (
                    <div className="font-mono bg-background px-2.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-foreground font-semibold">
                      Sample Result:{" "}
                      <span className="text-primary">{String(liveTestResult.result)}</span>
                    </div>
                  )}
                </div>
              )}
                </>
              )}
            </div>
          )}

          {/* Section 4: Text Alignment & Column Width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5">
              <div className="h-6 flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">
                  Text Alignment
                </Label>
              </div>
              <div className="grid grid-cols-3 gap-1.5 h-10">
                <Button
                  type="button"
                  variant={columnAlign === "left" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setColumnAlign("left")}
                  className={`h-10 text-xs gap-1.5 font-medium ${
                    columnAlign !== "left"
                      ? "border-slate-300 dark:border-slate-600 bg-background hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      : "shadow-xs"
                  }`}
                >
                  <AlignLeft className="w-4 h-4" />
                  <span>Left</span>
                </Button>
                <Button
                  type="button"
                  variant={columnAlign === "center" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setColumnAlign("center")}
                  className={`h-10 text-xs gap-1.5 font-medium ${
                    columnAlign !== "center"
                      ? "border-slate-300 dark:border-slate-600 bg-background hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      : "shadow-xs"
                  }`}
                >
                  <AlignCenter className="w-4 h-4" />
                  <span>Center</span>
                </Button>
                <Button
                  type="button"
                  variant={columnAlign === "right" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setColumnAlign("right")}
                  className={`h-10 text-xs gap-1.5 font-medium ${
                    columnAlign !== "right"
                      ? "border-slate-300 dark:border-slate-600 bg-background hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      : "shadow-xs"
                  }`}
                >
                  <AlignRight className="w-4 h-4" />
                  <span>Right</span>
                </Button>
              </div>
              <div className="h-4 flex items-center">
                <span className="text-xs text-muted-foreground truncate">
                  Cell &amp; header alignment in table.
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="h-6 flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">
                  Column Width
                </Label>
                <span className="text-xs font-mono text-muted-foreground leading-none">{columnWidth}px</span>
              </div>
              <div className="flex items-center gap-2 h-10">
                <Input
                  type="number"
                  min={60}
                  max={400}
                  step={5}
                  value={columnWidth}
                  onChange={(e) => setColumnWidth(parseInt(e.target.value, 10) || 120)}
                  className="h-10 text-sm font-mono border-slate-300 dark:border-slate-600 bg-background shadow-xs hover:border-slate-400 dark:hover:border-slate-500 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 flex-1"
                />
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setColumnWidth(100)}
                    className="h-10 px-3 text-xs border-slate-300 dark:border-slate-600 bg-background hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                    title="Compact column (100px)"
                  >
                    Sm
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setColumnWidth(130)}
                    className="h-10 px-3 text-xs border-slate-300 dark:border-slate-600 bg-background hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                    title="Standard column (130px)"
                  >
                    Md
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setColumnWidth(180)}
                    className="h-10 px-3 text-xs border-slate-300 dark:border-slate-600 bg-background hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                    title="Wide column (180px)"
                  >
                    Lg
                  </Button>
                </div>
              </div>
              <div className="h-4 flex items-center">
                <span className="text-xs text-muted-foreground truncate">
                  Rendered column width on canvas.
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Header Grouping / Super-Header (Optional) */}
          <div className="space-y-2 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Columns className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Header Group / Super-Header</span>
                <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
              </Label>
              {columnGroupName && (
                <button
                  type="button"
                  onClick={() => setColumnGroupName("")}
                  className="text-xs text-rose-500 hover:text-rose-600 font-medium cursor-pointer"
                >
                  Clear Group
                </button>
              )}
            </div>
            <Input
              value={columnGroupName}
              onChange={(e) => setColumnGroupName(e.target.value)}
              placeholder="e.g. OBSERVATIONS, TOLERANCE (leave blank for single header)"
              className="h-9 text-sm border-slate-300 dark:border-slate-600 bg-background"
            />
            {existingGroups.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[11px] text-muted-foreground font-medium">Existing groups in table:</span>
                {existingGroups.map((grp) => (
                  <Badge
                    key={grp}
                    variant={columnGroupName === grp ? "default" : "outline"}
                    className="text-[11px] cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() => setColumnGroupName(grp)}
                  >
                    {grp}
                  </Badge>
                ))}
              </div>
            )}
            <span className="text-xs text-muted-foreground block">
              Merges this column under a shared super-header across 2, 3, or more adjacent columns.
            </span>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/30 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 text-sm border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSaveColumn}
            className="h-10 px-6 text-sm font-medium gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Column</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
