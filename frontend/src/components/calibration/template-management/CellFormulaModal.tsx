import React, { useState, useEffect, useMemo } from "react";
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
  Calculator,
  CheckCircle2,
  AlertCircle,
  Hash,
  Table as TableIcon,
  Sparkles,
  X,
  Plus,
} from "lucide-react";
import { CanvasBlock, TableGridBlock, SplitRowBlock } from "@/types/template";
import {
  evaluateFormulaExpression,
  buildRowContext,
  buildGlobalTablesContext,
  slugifyTableKey,
  validateFormula,
} from "@/lib/formulaEngine";
import { toast } from "sonner";

export interface CellFormulaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockIndex: number;
  childIndex: number | null;
  rowIndex: number;
  colId: string;
  colLabel: string;
  initialFormula: string;
  blocks: CanvasBlock[];
  decimalPlaces?: number;
  onApplyFormula: (
    blockIndex: number,
    childIndex: number | null,
    rowIndex: number,
    colId: string,
    formula: string
  ) => void;
  onClearFormula: (
    blockIndex: number,
    childIndex: number | null,
    rowIndex: number,
    colId: string
  ) => void;
}

export function CellFormulaModal({
  open,
  onOpenChange,
  blockIndex,
  childIndex,
  rowIndex,
  colId,
  colLabel,
  initialFormula,
  blocks,
  decimalPlaces = 3,
  onApplyFormula,
  onClearFormula,
}: CellFormulaModalProps) {
  const [formula, setFormula] = useState(initialFormula || "");

  useEffect(() => {
    setFormula(initialFormula || "");
  }, [initialFormula, open]);

  // Resolve target table and row
  const { targetTable, targetRow, allTables } = useMemo(() => {
    let tbl: TableGridBlock | null = null;
    const targetBlock = blocks[blockIndex];
    if (targetBlock) {
      if (childIndex !== null && targetBlock.type === "split_row") {
        tbl = (targetBlock as SplitRowBlock).children?.[childIndex] as TableGridBlock;
      } else if (targetBlock.type === "table_grid") {
        tbl = targetBlock as TableGridBlock;
      }
    }

    const row = tbl?.rows?.[rowIndex] || null;

    // Gather all tables in canvas with their resolved tableKeys
    const tables: Array<{
      key: string;
      title: string;
      columns: Array<{ id: string; label: string }>;
      isCurrent: boolean;
    }> = [];

    blocks.forEach((b, bIdx) => {
      if (!b) return;
      if (b.type === "table_grid") {
        const t = b as TableGridBlock;
        const key = t.tableKey || slugifyTableKey(t.title || `table_${bIdx + 1}`);
        tables.push({
          key,
          title: t.title || `Table ${bIdx + 1}`,
          columns: (t.columns || [])
            .filter((c) => c && c.id !== "point_number" && c.id !== "sl_no")
            .map((c) => ({ id: c.id, label: c.label || c.id })),
          isCurrent: bIdx === blockIndex && childIndex === null,
        });
      } else if (b.type === "split_row" && Array.isArray((b as SplitRowBlock).children)) {
        (b as SplitRowBlock).children.forEach((c, cIdx) => {
          if (c && c.type === "table_grid") {
            const key = c.tableKey || slugifyTableKey(c.title || `table_${bIdx + 1}_${cIdx + 1}`);
            tables.push({
              key,
              title: c.title || `Table ${bIdx + 1} (${cIdx + 1})`,
              columns: (c.columns || [])
                .filter((col) => col && col.id !== "point_number" && col.id !== "sl_no")
                .map((col) => ({ id: col.id, label: col.label || col.id })),
              isCurrent: bIdx === blockIndex && cIdx === childIndex,
            });
          }
        });
      }
    });

    return { targetTable: tbl, targetRow: row, allTables: tables };
  }, [blocks, blockIndex, childIndex, rowIndex]);

  // Live evaluation test
  const testResult = useMemo(() => {
    const trimmed = formula.trim();
    if (!trimmed) {
      return { success: true, formatted: "-", message: "No formula (Manual Input mode)" };
    }

    if (!targetTable || !targetRow) {
      return { success: false, message: "Target table or row not found" };
    }

    try {
      const dec = targetTable.decimal_places ?? decimalPlaces ?? 3;
      const tol = typeof targetTable.tolerance === "number" ? targetTable.tolerance : 0.02;
      const ctx = buildRowContext(targetRow, targetTable.columns, tol, dec, 0, targetTable.nominal);
      const globalContext = buildGlobalTablesContext(blocks);
      Object.assign(ctx.valuesMap, globalContext);
      Object.assign(ctx.rawValuesMap, globalContext);

      const res = evaluateFormulaExpression(trimmed, ctx, dec);
      if (!res.success) {
        return { success: false, message: res.error || res.formatted || "Formula evaluation error" };
      }
      return {
        success: true,
        formatted: res.formatted,
        numeric: res.numeric,
        message: `Evaluated value: ${res.formatted}`,
      };
    } catch (err: any) {
      return { success: false, message: err.message || "Invalid formula expression" };
    }
  }, [formula, targetTable, targetRow, blocks, decimalPlaces]);

  const handleInsertToken = (token: string) => {
    setFormula((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return `=${token}`;
      return `${prev} ${token}`;
    });
  };

  const handleApply = () => {
    const trimmed = formula.trim();
    if (trimmed) {
      const valid = validateFormula(trimmed);
      const errorMsg = valid.errors?.join("; ") || "";
      if (!valid.isValid && !errorMsg.includes("not found")) {
        toast.error(`Invalid formula syntax: ${errorMsg}`);
        return;
      }
      onApplyFormula(blockIndex, childIndex, rowIndex, colId, trimmed);
      toast.success(`Formula applied to Row ${rowIndex + 1} (${colLabel})`);
    } else {
      onClearFormula(blockIndex, childIndex, rowIndex, colId);
      toast.info(`Formula cleared for Row ${rowIndex + 1}. Manual input enabled.`);
    }
    onOpenChange(false);
  };

  const handleClear = () => {
    onClearFormula(blockIndex, childIndex, rowIndex, colId);
    toast.info(`Formula cleared for Row ${rowIndex + 1}. Manual input enabled.`);
    onOpenChange(false);
  };

  // Quick Preset Formulas
  const presets = useMemo(() => {
    const list: Array<{ label: string; formula: string; description: string }> = [];
    const otherTables = allTables.filter((t) => !t.isCurrent);

    if (otherTables.length >= 2) {
      const t1 = otherTables[0].key;
      const t2 = otherTables[1].key;
      list.push({
        label: `Sum Error (${otherTables[0].title} + ${otherTables[1].title})`,
        formula: `=SUM(${t1}.error, ${t2}.error)`,
        description: `Sum of error measurements from both tables`,
      });
      list.push({
        label: `Vector Sum ((${t1}) + (${t2}))`,
        formula: `=SUM((${t1}.error)+(${t2}.error))`,
        description: `Element-wise vector sum of reading errors`,
      });
      list.push({
        label: `Max Error (${t1}, ${t2})`,
        formula: `=MAX(${t1}.error, ${t2}.error)`,
        description: `Peak error across both measurement tables`,
      });
    } else if (otherTables.length === 1) {
      const t1 = otherTables[0].key;
      list.push({
        label: `Sum Error from ${otherTables[0].title}`,
        formula: `=SUM(${t1}.error)`,
        description: `Sum of all error readings in ${t1}`,
      });
      list.push({
        label: `Max Error from ${otherTables[0].title}`,
        formula: `=MAX(${t1}.error)`,
        description: `Highest error reading in ${t1}`,
      });
    }

    list.push({
      label: "Reading - Nominal (Local Error)",
      formula: "=reading - nominal",
      description: "Standard calibration deviation for this row",
    });

    return list;
  }, [allTables]);

  const currentTableKey =
    targetTable?.tableKey || slugifyTableKey(targetTable?.title || "table");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>Row {rowIndex + 1} Cell Formula</span>
                  <Badge variant="outline" className="font-mono text-xs text-purple-600 bg-purple-50 border-purple-200">
                    {colLabel}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                  Table: <code className="font-mono font-bold text-foreground">#{currentTableKey}</code> • Row {rowIndex + 1}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-4 text-xs pr-1">
          {/* Metrology use-case banner */}
          <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
            <p className="text-purple-950 dark:text-purple-200 leading-relaxed font-medium">
              💡 <strong>Flexible Calculation & Manual Input:</strong> Assigning a formula here makes this specific row computed. Other rows in the same column without a formula will remain editable for manual input. You can reference error or reading columns from other tables using dot notation (e.g. <code className="font-mono bg-purple-100 dark:bg-purple-900 px-1 py-0.5 rounded text-purple-900 dark:text-purple-200">{`clockwise.error`}</code>).
            </p>
          </div>

          {/* Preset Formulas */}
          {presets.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick Preset Formulas</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormula(preset.formula)}
                    className="h-7 text-xs font-mono gap-1 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/50 text-left"
                    title={preset.description}
                  >
                    <Plus className="w-3 h-3 text-purple-600" />
                    <span>{preset.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Cross-Table References helper */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <TableIcon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Available Table Variables (Click to Insert)</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
              {allTables.map((tbl, tIdx) => (
                <div
                  key={tIdx}
                  className={`p-2 rounded border bg-card text-card-foreground ${
                    tbl.isCurrent ? "border-primary/40 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/50">
                    <span className="font-bold text-xs truncate max-w-[130px]" title={tbl.title}>
                      {tbl.title}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                      #{tbl.key}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tbl.columns.map((col) => {
                      const token = tbl.isCurrent ? col.id : `${tbl.key}.${col.id}`;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => handleInsertToken(token)}
                          className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted hover:bg-purple-100 hover:text-purple-800 dark:hover:bg-purple-900/40 dark:hover:text-purple-300 border transition-colors cursor-pointer"
                          title={`Insert ${token}`}
                        >
                          {token}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formula Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cell-formula-input" className="text-xs font-bold text-foreground">
                Formula Expression
              </Label>
              {formula.trim() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormula("")}
                  className="h-5 px-1.5 text-2xs text-muted-foreground hover:text-destructive"
                >
                  Clear input
                </Button>
              )}
            </div>
            <Input
              id="cell-formula-input"
              type="text"
              placeholder="e.g. =SUM(clockwise.error, counter_clockwise.error)"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              className="font-mono text-xs h-9 bg-background focus:ring-purple-500"
            />
          </div>

          {/* Live Preview / Validation Box */}
          <div
            className={`p-3 rounded-lg border flex items-start gap-2.5 ${
              testResult.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">
                  {testResult.success ? "Preview Result" : "Formula Syntax Error"}
                </span>
                {testResult.success && testResult.formatted !== undefined && (
                  <span className="font-mono font-bold text-sm">
                    {testResult.formatted}
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-90 mt-0.5 font-mono">
                {testResult.message}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t shrink-0 flex items-center justify-between sm:justify-between">
          <div>
            {initialFormula && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleClear}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Formula (Allow Manual Input)</span>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={!testResult.success && Boolean(formula.trim())}
              className="h-8 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white gap-1.5 shadow-xs"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Apply Formula</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
