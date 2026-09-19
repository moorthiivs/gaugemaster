import React, { useState, useEffect, useMemo } from "react";
import { CanvasColumnDef, CalibrationCalculationModel } from "@/types/template";
import {
  validateFormula,
  testEvaluateFormula,
  resolveVariableSemanticRole,
  FormulaValidationResult,
} from "@/lib/formulaEngine";
import {
  translateExcelFormula,
  explainSemanticFormula,
  ExcelTranslationResult,
} from "@/lib/excelFormulaTranslator";
import {
  runMetrologyBoundaryTests,
  BoundaryTestReport,
} from "@/lib/metrologyBoundaryTester";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Sparkles,
  Info,
  Copy,
  Check,
  RotateCcw,
  ArrowUpRight,
  Calculator,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Wand2,
  HelpCircle,
  ShieldCheck,
  Activity,
  AlignLeft,
  CheckCheck,
} from "lucide-react";

export interface ColumnFormulaInspectorProps {
  column: CanvasColumnDef;
  allColumns: CanvasColumnDef[];
  calculationModel?: CalibrationCalculationModel;
  onUpdateColumn: (updatedCol: CanvasColumnDef) => void;
  onSelectColumn?: (colId: string) => void;
  tableDecimalPlaces?: number;
  sampleNominal?: number;
  sampleLowerLimit?: number;
  sampleUpperLimit?: number;
}

export const ColumnFormulaInspector: React.FC<ColumnFormulaInspectorProps> = ({
  column,
  allColumns,
  calculationModel,
  onUpdateColumn,
  onSelectColumn,
  tableDecimalPlaces = 3,
  sampleNominal = 35.035,
  sampleLowerLimit,
  sampleUpperLimit,
}) => {
  const [copied, setCopied] = useState(false);
  const [testInputs, setTestInputs] = useState<Record<string, any>>({});
  const [showExplanation, setShowExplanation] = useState(false);

  // 1. Authoritative 7-Layer Validation Result
  const validation: FormulaValidationResult = useMemo(() => {
    return validateFormula(column.formula || "", allColumns, calculationModel);
  }, [column.formula, column.id, column.formulaConfidence, allColumns, calculationModel]);

  // 2. AI Recommendation & Translation Analysis
  const aiRecommendation: ExcelTranslationResult = useMemo(() => {
    const rawToAnalyze = column.sourceFormula || column.formula || "";
    return translateExcelFormula(rawToAnalyze, allColumns, column);
  }, [column.sourceFormula, column.formula, allColumns, column]);

  // Determine whether an AI fix is actively available/recommended
  const hasAiFixAvailable = useMemo(() => {
    if (!aiRecommendation.translatedFormula) return false;
    const isCurrentFormulaDifferent = aiRecommendation.translatedFormula !== column.formula;
    const hasUnsupported = validation.unsupportedFunctions && validation.unsupportedFunctions.length > 0;
    const needsReview = validation.status === "NEEDS_REVIEW" || validation.status === "INVALID";
    return isCurrentFormulaDifferent && (hasUnsupported || needsReview || !column.formula);
  }, [aiRecommendation, column.formula, validation]);

  // 3. Automated Boundary Testing for Judgement / Acceptance Columns
  const boundaryReport: BoundaryTestReport | null = useMemo(() => {
    const isJudgement =
      column.role === "JUDGEMENT" ||
      column.semanticRole === "JUDGEMENT" ||
      column.type === "status" ||
      (column.label || "").toLowerCase().includes("judgement");

    if (!isJudgement || !column.formula || !validation.syntaxValid) {
      return null;
    }

    const nom = sampleNominal;
    const lower = sampleLowerLimit ?? nom - 0.02;
    const upper = sampleUpperLimit ?? nom - 0.01;
    const dp = column.decimal_places ?? tableDecimalPlaces ?? 3;

    return runMetrologyBoundaryTests({
      formula: column.formula,
      nominal: nom,
      lowerLimit: lower,
      upperLimit: upper,
      decimalPlaces: dp,
    });
  }, [
    column.role,
    column.semanticRole,
    column.type,
    column.label,
    column.formula,
    validation.syntaxValid,
    sampleNominal,
    sampleLowerLimit,
    sampleUpperLimit,
    column.decimal_places,
    tableDecimalPlaces,
  ]);

  // 4. Initialize default test inputs for detected dependencies
  useEffect(() => {
    setTestInputs((prev) => {
      const next: Record<string, any> = { ...prev };
      validation.dependencies.forEach((dep) => {
        if (next[dep] === undefined) {
          const sem = resolveVariableSemanticRole(dep, allColumns);
          next[dep] = sem.defaultTestValue;
        }
      });
      return next;
    });
  }, [validation.dependencies, allColumns]);

  // 5. Compute Live Diagnostic Test Result & Substituted Expression
  const testExecution = useMemo(() => {
    const dp = column.decimal_places ?? tableDecimalPlaces ?? 3;
    return testEvaluateFormula(column.formula || "", testInputs, dp);
  }, [column.formula, testInputs, column.decimal_places, tableDecimalPlaces]);

  const substitutedFormula = useMemo(() => {
    if (!column.formula || validation.dependencies.length === 0) return null;
    let expr = column.formula;
    for (const dep of validation.dependencies) {
      const val = testInputs[dep] ?? resolveVariableSemanticRole(dep, allColumns).defaultTestValue;
      const re = new RegExp(`\\b${dep}\\b`, "g");
      expr = expr.replace(re, String(val));
    }
    return expr;
  }, [column.formula, validation.dependencies, testInputs, allColumns]);

  // Handle Formula Text Change
  const handleFormulaChange = (newFormula: string) => {
    const nextValidation = validateFormula(newFormula, allColumns, calculationModel);

    onUpdateColumn({
      ...column,
      formula: newFormula,
      formulaStatus: nextValidation.status,
      formulaConfidence: nextValidation.confidence,
      formulaReviewMessage: nextValidation.errors[0] || nextValidation.warnings[0] || undefined,
      dependsOn: nextValidation.dependencies.length > 0 ? nextValidation.dependencies : column.dependsOn,
      formulaSource: column.formulaSource || "USER_DEFINED",
    });
  };

  // Apply AI Recommended Fix
  const handleApplyAiFix = () => {
    if (!aiRecommendation.translatedFormula) return;
    const translated = aiRecommendation.translatedFormula;
    const nextValidation = validateFormula(translated, allColumns, calculationModel);

    onUpdateColumn({
      ...column,
      formula: translated,
      sourceFormula: column.sourceFormula || column.formula || undefined,
      formulaStatus: nextValidation.status,
      formulaConfidence: aiRecommendation.confidence,
      formulaSource: "EXCEL_TRANSLATED",
      translationReason: aiRecommendation.reason,
      dependsOn: aiRecommendation.dependencies.length > 0 ? aiRecommendation.dependencies : nextValidation.dependencies,
      aiSuggestedFormula: undefined,
      aiReason: undefined,
    });
  };

  // Format Formula
  const handleFormatFormula = () => {
    if (!column.formula) return;
    let formatted = column.formula
      .replace(/\s+/g, " ")
      .replace(/\s*([+\-*/<>=!&|]+)\s*/g, " $1 ")
      .replace(/\s*,\s*/g, ", ")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      .trim();

    const keywords = ["IF", "AND", "OR", "NOT", "AVERAGE", "MAX", "MIN", "SUM", "ABS", "ROUND", "SQRT", "POW", "ISBLANK"];
    for (const kw of keywords) {
      const re = new RegExp(`\\b${kw}\\b`, "gi");
      formatted = formatted.replace(re, kw);
    }
    handleFormulaChange(formatted);
  };

  // Quick Insert Token at cursor / end
  const handleInsertToken = (token: string) => {
    const cur = column.formula || "";
    let next: string;
    if (!cur.trim()) {
      next = token;
    } else if (token.endsWith("()")) {
      next = `${cur} ${token.slice(0, -1)}`;
    } else if (["+", "-", "*", "/", ">", "<", ">=", "<=", "==", "!=", "&&", "||", "AND", "OR"].includes(token)) {
      next = `${cur.trimEnd()} ${token} `;
    } else {
      next = `${cur.trimEnd()} ${token}`;
    }
    handleFormulaChange(next);
  };

  const copyFormula = () => {
    if (column.formula) {
      navigator.clipboard.writeText(column.formula);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* ------------------------------------------------------------- */}
      {/* AI RECOMMENDATION / UNSUPPORTED EXCEL FUNCTION CARD           */}
      {/* ------------------------------------------------------------- */}
      {hasAiFixAvailable && (
        <div className="p-3.5 bg-gradient-to-br from-amber-500/10 via-amber-50/50 to-orange-50/40 dark:from-amber-950/40 dark:via-amber-900/20 dark:to-slate-900 rounded-xl border border-amber-300 dark:border-amber-800/80 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
              <span className="font-bold text-xs text-amber-950 dark:text-amber-200">
                {validation.unsupportedFunctions.length > 0
                  ? "Unsupported Excel Function Detected"
                  : "AI Recommended Metrology Replacement"}
              </span>
            </div>
            <Badge
              variant="outline"
              className="bg-amber-100/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border-amber-300 text-[10px] font-bold"
            >
              Confidence: {aiRecommendation.confidence}
            </Badge>
          </div>

          {validation.unsupportedFunctions.length > 0 && (
            <div className="space-y-1 text-[11px] text-amber-900 dark:text-amber-300">
              <p className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Excel construct: <code className="font-mono bg-white/70 dark:bg-black/30 px-1 py-0.5 rounded">{validation.unsupportedFunctions.join(", ")}</code>
              </p>
              <p className="text-[10.5px] leading-relaxed text-amber-800/90 dark:text-amber-300/80">
                {aiRecommendation.reason}
              </p>
            </div>
          )}

          {/* AI Recommended Replacement Formula */}
          <div className="p-2.5 bg-white dark:bg-slate-950 rounded-lg border border-amber-200 dark:border-amber-900/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Recommended Semantic Formula:
              </span>
              <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-300">
                ✓ AST Validated
              </Badge>
            </div>
            <div className="font-mono text-[11.5px] font-bold text-foreground bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 break-all select-all">
              {aiRecommendation.translatedFormula}
            </div>
            {aiRecommendation.explanation && (
              <p className="text-[10px] text-muted-foreground italic leading-tight">
                "{aiRecommendation.explanation}"
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-0.5">
            <Button
              type="button"
              size="sm"
              onClick={handleApplyAiFix}
              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Apply AI Fix
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowExplanation(!showExplanation)}
              className="h-7 text-xs border-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-950/50 text-amber-900 dark:text-amber-200 flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              {showExplanation ? "Hide Explanation" : "Explain"}
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PLAIN ENGLISH EXPLANATION CARD (WHEN TOGGLED)                 */}
      {/* ------------------------------------------------------------- */}
      {showExplanation && (
        <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-xs text-blue-950 dark:text-blue-200">Metrological Formula Meaning</span>
          </div>
          <p className="text-[11px] text-blue-900 dark:text-blue-300 leading-relaxed">
            {explainSemanticFormula(column.formula || "", column.role)}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: FORMULA EDITOR & STATUS HEADER                     */}
      {/* ------------------------------------------------------------- */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5 text-primary" />
            <Label className="text-xs font-bold text-foreground">Formula Expression (fx)</Label>
          </div>

          {/* Validation Status Badge */}
          {validation.status === "VALIDATED" || validation.status === "VALID" ? (
            <Badge
              variant="outline"
              className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-semibold text-[10px] px-2 py-0.5 flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Validated
            </Badge>
          ) : validation.status === "NEEDS_REVIEW" ? (
            <Badge
              variant="outline"
              className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-semibold text-[10px] px-2 py-0.5 flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              Review Required
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold text-[10px] px-2 py-0.5 flex items-center gap-1"
            >
              <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
              Invalid Formula
            </Badge>
          )}
        </div>

        {/* Multiline Monospace Formula Editor Field (NO Truncation) */}
        <div className="relative group">
          <textarea
            value={column.formula || ""}
            onChange={(e) => handleFormulaChange(e.target.value)}
            placeholder="e.g. actual_dimension - nominal"
            rows={3}
            className="w-full min-h-[85px] max-h-[240px] p-2.5 font-mono text-[11.5px] leading-relaxed rounded-lg border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary whitespace-pre-wrap break-all overflow-y-auto resize-y"
          />

          <div className="absolute right-2 top-2 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleFormatFormula}
              className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
              title="Format Formula"
            >
              <AlignLeft className="w-3 h-3 text-slate-600" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={copyFormula}
              className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
              title="Copy Formula"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-600" />}
            </Button>
            {column.sourceFormula && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleFormulaChange(column.sourceFormula!)}
                className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                title="Reset to Original Excel Formula"
              >
                <RotateCcw className="w-3 h-3 text-slate-600" />
              </Button>
            )}
          </div>
        </div>

        {/* 7-Layer Metrology Validation Checklist */}
        <div className="pt-1 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-primary" />
            7-Layer Metrology Quality Gate
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[9.5px]">
            {/* L1: Syntax */}
            <div className={`p-1.5 rounded border flex items-center gap-1 ${
              validation.syntaxValid ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40"
            }`}>
              {validation.syntaxValid ? <Check className="w-2.5 h-2.5 shrink-0 text-emerald-600" /> : <XCircle className="w-2.5 h-2.5 shrink-0 text-rose-600" />}
              <span className="truncate">L1: AST Syntax</span>
            </div>

            {/* L2: Variables */}
            <div className={`p-1.5 rounded border flex items-center gap-1 ${
              validation.variablesValid ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40"
            }`}>
              {validation.variablesValid ? <Check className="w-2.5 h-2.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-amber-600" />}
              <span className="truncate">L2: Variables Known</span>
            </div>

            {/* L3: DAG Cycle */}
            <div className={`p-1.5 rounded border flex items-center gap-1 ${
              !validation.circularDependency ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40"
            }`}>
              {!validation.circularDependency ? <Check className="w-2.5 h-2.5 shrink-0 text-emerald-600" /> : <XCircle className="w-2.5 h-2.5 shrink-0 text-rose-600" />}
              <span className="truncate">L3: DAG Acyclic</span>
            </div>

            {/* L4: Runtime Execution */}
            <div className={`p-1.5 rounded border flex items-center gap-1 ${
              validation.executable ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40"
            }`}>
              {validation.executable ? <Check className="w-2.5 h-2.5 shrink-0 text-emerald-600" /> : <XCircle className="w-2.5 h-2.5 shrink-0 text-rose-600" />}
              <span className="truncate">L4: Runtime Exec</span>
            </div>

            {/* L5: Metrology Semantics */}
            <div className={`p-1.5 rounded border flex items-center gap-1 ${
              validation.metrologyValid ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40"
            }`}>
              {validation.metrologyValid ? <Check className="w-2.5 h-2.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-amber-600" />}
              <span className="truncate">L5: Metrology Dir</span>
            </div>

            {/* L6: Boundary Tests */}
            <div className={`p-1.5 rounded border flex items-center gap-1 ${
              validation.boundaryTestsPassed ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40"
            }`}>
              {validation.boundaryTestsPassed ? <Check className="w-2.5 h-2.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-amber-600" />}
              <span className="truncate">L6: Boundary Pass</span>
            </div>

            {/* L7: Template Suitability */}
            <div className={`p-1.5 rounded border flex items-center gap-1 col-span-2 ${
              validation.suitabilityValid ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40"
            }`}>
              {validation.suitabilityValid ? <Check className="w-2.5 h-2.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-amber-600" />}
              <span className="truncate">L7: Model Suitability ({calculationModel || "STANDARD"})</span>
            </div>
          </div>
        </div>

        {/* Validation Errors & Warnings */}
        {validation.errors.length > 0 && (
          <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 space-y-1">
            {validation.errors.map((err, i) => (
              <p key={i} className="text-[10px] text-rose-600 dark:text-rose-400 font-sans leading-tight">
                ✕ {err}
              </p>
            ))}
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 space-y-1">
            {validation.warnings.map((warn, i) => (
              <p key={i} className="text-[10px] text-amber-700 dark:text-amber-300 font-sans leading-tight">
                ⚠️ {warn}
              </p>
            ))}
          </div>
        )}

        {/* Quick-Insert Token Palette */}
        <div className="space-y-1 pt-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Quick Insert Tokens:</span>
          <div className="flex flex-wrap gap-1">
            {[
              "actual_dimension",
              "nominal",
              "reading",
              "lower_limit",
              "upper_limit",
              "tolerance",
              "average",
              "mpe",
              "t1",
              "t2",
              "t3",
            ].map((tok) => (
              <button
                key={tok}
                type="button"
                onClick={() => handleInsertToken(tok)}
                className="px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-mono text-[9.5px] transition-colors cursor-pointer"
              >
                +{tok}
              </button>
            ))}
            {["+", "-", "*", "/", ">=", "<=", "==", "AND", "OR", "IF()", "ABS()", "AVERAGE()"].map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => handleInsertToken(op)}
                className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-mono text-[9.5px] transition-colors cursor-pointer"
              >
                {op}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 2: BOUNDARY VERIFICATION (FOR JUDGEMENT COLUMNS)      */}
      {/* ------------------------------------------------------------- */}
      {boundaryReport && (
        <div className="p-3 bg-gradient-to-br from-indigo-50/80 to-slate-50 dark:from-indigo-950/30 dark:to-slate-900/80 rounded-xl border border-indigo-200 dark:border-indigo-900/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <Label className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                Automated Metrology Boundary Tests
              </Label>
            </div>
            <Badge
              variant="outline"
              className={
                boundaryReport.allPassed
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "bg-amber-50 text-amber-700 border-amber-300"
              }
            >
              {boundaryReport.passedCount}/{boundaryReport.totalCount} Passed
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {boundaryReport.testCases.map((tc, idx) => (
              <div
                key={idx}
                className={`p-1.5 rounded border text-[10px] font-mono flex items-center justify-between ${
                  tc.passed
                    ? "bg-white/80 dark:bg-slate-950 border-emerald-200 dark:border-emerald-950 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300"
                }`}
              >
                <div className="break-all pr-1">
                  <span className="font-semibold">{tc.testName}: </span>
                  <span className="text-muted-foreground">{String(tc.testValue ?? "null")}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="font-bold">{tc.actualResult}</span>
                  {tc.passed ? <Check className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[9.5px] text-muted-foreground leading-tight">
            {boundaryReport.summary}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION 3: DEPENDENCIES WITH SEMANTIC ROLES                   */}
      {/* ------------------------------------------------------------- */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <span>Dependencies</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">
              {validation.dependencies.length}
            </Badge>
          </Label>
          <span className="text-[10px] text-muted-foreground">Click chip to inspect column</span>
        </div>

        {validation.dependencies.length === 0 ? (
          <p className="text-[10.5px] text-muted-foreground italic">No variable dependencies detected.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {validation.dependencies.map((dep) => {
              const info = resolveVariableSemanticRole(dep, allColumns);
              const isCol = allColumns.some((c) => c.id.toLowerCase() === dep.toLowerCase() || c.label.toLowerCase() === dep.toLowerCase());

              return (
                <button
                  key={dep}
                  type="button"
                  onClick={() => isCol && onSelectColumn?.(dep)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-mono transition-all ${
                    isCol
                      ? "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:border-primary text-foreground cursor-pointer shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-muted-foreground"
                  }`}
                  title={isCol ? `Click to inspect column: ${dep}` : `Standard metrology variable: ${dep}`}
                >
                  <span className="font-bold text-primary">{dep}</span>
                  <span className="text-muted-foreground text-[8.5px]">→ {info.label}</span>
                  {isCol && <ArrowUpRight className="w-2.5 h-2.5 text-muted-foreground ml-0.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 4: INTERACTIVE FORMULA TEST RUNNER PREVIEW            */}
      {/* ------------------------------------------------------------- */}
      <div className="p-3 bg-gradient-to-b from-blue-50/60 to-slate-50 dark:from-blue-950/20 dark:to-slate-900/80 rounded-xl border border-blue-200/80 dark:border-blue-900/60 space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-blue-950 dark:text-blue-300 flex items-center gap-1.5">
            <Play className="w-3 h-3 text-blue-600 fill-blue-600" />
            Interactive Formula Test Preview
          </Label>
          <span className="text-[9.5px] text-muted-foreground font-mono">Live Diagnostic</span>
        </div>

        {validation.dependencies.length === 0 ? (
          <div className="p-2 bg-white dark:bg-slate-950 rounded-lg border text-center text-muted-foreground text-[10.5px]">
            Constant expression: <code className="font-mono font-bold text-foreground">{testExecution.formatted}</code>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {validation.dependencies.map((dep) => {
                const info = resolveVariableSemanticRole(dep, allColumns);

                return (
                  <div key={dep} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground break-all" title={dep}>
                        {dep}
                      </span>
                      <span className="text-[8.5px] text-slate-400">{info.role}</span>
                    </div>
                    <Input
                      type="number"
                      step="any"
                      value={testInputs[dep] ?? info.defaultTestValue}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setTestInputs((p) => ({ ...p, [dep]: isNaN(val) ? e.target.value : val }));
                      }}
                      className="h-7 text-[11px] font-mono bg-white dark:bg-slate-950"
                    />
                  </div>
                );
              })}
            </div>

            {/* Substituted Expression Preview */}
            {substitutedFormula && (
              <div className="p-2 rounded bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-mono">
                <span className="text-muted-foreground block text-[9px] uppercase tracking-wider font-sans">Numeric Substitution:</span>
                <span className="text-foreground break-all">{substitutedFormula}</span>
              </div>
            )}

            {/* Test Execution Result */}
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-muted-foreground font-medium block">Computed Test Result</span>
                <span
                  className={`text-sm font-bold font-mono ${
                    testExecution.formatted === "PASS"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : testExecution.formatted === "FAIL"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-primary"
                  }`}
                >
                  {testExecution.formatted}
                </span>
              </div>

              <div>
                {testExecution.success ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 text-[9.5px] flex items-center gap-1"
                  >
                    <Check className="w-2.5 h-2.5" /> Formula executes successfully
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 text-[9.5px] flex items-center gap-1"
                  >
                    <XCircle className="w-2.5 h-2.5" /> {testExecution.error || "Execution error"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 5: CALCULATION & METROLOGY SETTINGS                   */}
      {/* ------------------------------------------------------------- */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
        <Label className="text-xs font-bold text-foreground">Calculation Settings</Label>

        <div className="grid grid-cols-2 gap-2">
          {/* Decimal Precision */}
          <div className="space-y-1">
            <Label className="text-[10.5px] text-muted-foreground font-semibold">Precision Override</Label>
            <Select
              value={String(column.decimal_places ?? tableDecimalPlaces ?? 3)}
              onValueChange={(val) => onUpdateColumn({ ...column, decimal_places: parseInt(val, 10) })}
            >
              <SelectTrigger className="h-7 text-xs">
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

          {/* Blank Behavior */}
          <div className="space-y-1">
            <Label className="text-[10.5px] text-muted-foreground font-semibold">Blank Value Behavior</Label>
            <Select
              value={column.formulaBlankBehavior || "DASH"}
              onValueChange={(val: any) => onUpdateColumn({ ...column, formulaBlankBehavior: val })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DASH">Show Dash ("-")</SelectItem>
                <SelectItem value="ZERO">Evaluate as Zero</SelectItem>
                <SelectItem value="BLANK">Leave Empty ("")</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 6: AI & SOURCE INFORMATION AUDIT                      */}
      {/* ------------------------------------------------------------- */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            AI & Source Information
          </Label>

          {column.formulaConfidence && (
            <Badge
              variant="outline"
              className={`text-[9.5px] font-semibold capitalize ${
                column.formulaConfidence === "HIGH"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : column.formulaConfidence === "MEDIUM"
                  ? "bg-amber-50 text-amber-700 border-amber-300"
                  : "bg-rose-50 text-rose-700 border-rose-300"
              }`}
            >
              Confidence: {column.formulaConfidence}
            </Badge>
          )}
        </div>

        <div className="space-y-1 text-[10.5px]">
          <div className="flex items-center justify-between py-0.5 border-b border-dashed border-slate-200 dark:border-slate-800">
            <span className="text-muted-foreground">Source Origin:</span>
            <span className="font-semibold text-foreground capitalize">
              {column.formulaSource ? column.formulaSource.replace(/_/g, " ").toLowerCase() : "System Generated"}
            </span>
          </div>

          {column.translationReason && (
            <div className="py-0.5 border-b border-dashed border-slate-200 dark:border-slate-800">
              <span className="text-muted-foreground block text-[9.5px]">Translation Logic:</span>
              <span className="text-[10px] text-foreground italic">{column.translationReason}</span>
            </div>
          )}

          {column.sourceFormula && (
            <div className="py-1 border-b border-dashed border-slate-200 dark:border-slate-800 space-y-0.5">
              <span className="text-muted-foreground flex items-center gap-1 text-[9.5px]">
                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                Original Excel Formula:
              </span>
              <code className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 p-1 rounded font-mono text-[10px] border border-emerald-200 dark:border-emerald-900 block break-all whitespace-normal select-all">
                {column.sourceFormula}
              </code>
            </div>
          )}

          <div className="py-1 space-y-0.5">
            <span className="text-muted-foreground text-[9.5px]">Semantic Gaugemaster Formula:</span>
            <code className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-1 rounded font-mono text-[10.5px] block break-all whitespace-normal select-all font-semibold">
              {column.formula || "(none)"}
            </code>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 7: CERTIFICATE DISPLAY SETTINGS                       */}
      {/* ------------------------------------------------------------- */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            {column.hideInCertificate ? (
              <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-primary" />
            )}
            Certificate Visibility
          </Label>
          <span className="text-[10px] text-muted-foreground">
            {column.hideInCertificate
              ? "Hidden from final printed calibration certificate"
              : "Visible on calibration certificate"}
          </span>
        </div>

        <Button
          type="button"
          variant={column.hideInCertificate ? "outline" : "secondary"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onUpdateColumn({ ...column, hideInCertificate: !column.hideInCertificate })}
        >
          {column.hideInCertificate ? "Show on Print" : "Hide on Print"}
        </Button>
      </div>
    </div>
  );
};
