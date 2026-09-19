import React, { useState } from "react";
import { TableGridBlock, CanvasColumnDef } from "@/types/template";
import {
  auditCalibrationTable,
  generateFixedTableColumns,
  TableAuditReport,
  ColumnAuditItem
} from "@/lib/calibrationTableAuditor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Wand2,
  ShieldCheck,
  FileSpreadsheet,
  Cpu,
  Layers,
  Activity,
  ArrowRight,
  Info,
  Check,
  Eye,
  Sliders
} from "lucide-react";

export interface TableAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: TableGridBlock | null;
  onApplyFixes: (tableId: string, updatedColumns: CanvasColumnDef[]) => void;
  onSelectColumnForInspection?: (columnId: string) => void;
}

export const TableAuditModal: React.FC<TableAuditModalProps> = ({
  open,
  onOpenChange,
  table,
  onApplyFixes,
  onSelectColumnForInspection,
}) => {
  if (!table) return null;

  const auditReport: TableAuditReport = auditCalibrationTable(table);
  const { healthSummary } = auditReport;

  // Selected column for drilldown (defaults to first column with issues, or first column)
  const defaultSelectedColId =
    auditReport.columnAudits.find(c => c.issues.length > 0 || !!c.recommendedFormula)?.columnId ||
    auditReport.columnAudits[0]?.columnId;

  const [selectedColumnId, setSelectedColumnId] = useState<string | undefined>(defaultSelectedColId);

  const activeAuditItem: ColumnAuditItem | undefined =
    auditReport.columnAudits.find(c => c.columnId === selectedColumnId) ||
    auditReport.columnAudits[0];

  const activeColDef: CanvasColumnDef | undefined =
    table.columns?.find(c => c.id === activeAuditItem?.columnId);

  const handleApplyAll = () => {
    const { columns, changedCount } = generateFixedTableColumns(table);
    if (changedCount > 0) {
      onApplyFixes(table.id, columns);
      onOpenChange(false);
    }
  };

  const handleApplySingleColumnFix = (columnId: string, formula: string, reason?: string) => {
    const updated = (table.columns || []).map(col => {
      if (col.id === columnId) {
        return {
          ...col,
          formula,
          formulaStatus: "VALIDATED" as const,
          formulaConfidence: activeAuditItem?.confidence || "HIGH",
          formulaSource: col.sourceFormula ? ("EXCEL_TRANSLATED" as const) : ("SYSTEM_GENERATED" as const),
          translationReason: reason || activeAuditItem?.recommendationReason,
        };
      }
      return col;
    });
    onApplyFixes(table.id, updated);
  };

  const fixableColumns = auditReport.columnAudits.filter(
    (col) => !!col.recommendedFormula && col.recommendedFormula !== col.currentFormula
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl border-slate-200 dark:border-slate-800">
        {/* Modal Header */}
        <DialogHeader className="p-4 pb-3 border-b bg-slate-50 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-foreground">
                    Calibration Table Intelligence & Audit
                  </DialogTitle>
                  <Badge variant="outline" className="font-mono text-xs uppercase bg-primary/5 text-primary border-primary/30">
                    {auditReport.tableTitle}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Automated metrological audit, 7-layer formula validation, calculation model verification, and atomic repairs.
                </DialogDescription>
              </div>
            </div>

            {/* Model & Readiness Badges */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1 flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-800 text-foreground border border-slate-300 dark:border-slate-700">
                <Cpu className="w-3.5 h-3.5 text-primary" />
                Model: <span className="font-mono text-primary font-bold">{auditReport.calculationModel}</span>
              </Badge>

              <Badge
                variant="outline"
                className={`text-xs font-bold px-2.5 py-1 flex items-center gap-1.5 shadow-sm ${
                  healthSummary.certificateReadiness === "READY FOR TRIAL RUN"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
                    : healthSummary.certificateReadiness === "REVIEW REQUIRED"
                    ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800"
                    : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800"
                }`}
              >
                {healthSummary.certificateReadiness === "READY FOR TRIAL RUN" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : healthSummary.certificateReadiness === "REVIEW REQUIRED" ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                )}
                {healthSummary.certificateReadiness}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body: 3 Sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
          {/* ========================================================================= */}
          {/* SECTION A: Table Health Summary (8 Metrics + Circular Dep Alert)          */}
          {/* ========================================================================= */}
          <section className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" />
                Section A: Metrology Health Summary
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                Tolerance Distribution: <strong className="capitalize text-foreground">{auditReport.toleranceClassification}</strong>
              </span>
            </div>

            {/* Circular Dependency Warning if present */}
            {auditReport.circularDependencies.length > 0 && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Blocking Circular Dependency Detected</p>
                  <p className="text-[11.5px] mt-0.5">
                    Formulas cannot be resolved because the following cycle exists:{" "}
                    {auditReport.circularDependencies.map((c) => c.join(" → ")).join("; ")}.
                  </p>
                </div>
              </div>
            )}

            {/* 8 Metrics Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-[10px] text-muted-foreground block">Total Cols</span>
                <span className="font-bold text-sm text-foreground">{healthSummary.totalColumns}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-[10px] text-muted-foreground block">Inputs</span>
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400">{healthSummary.inputColumns}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-[10px] text-muted-foreground block">Calculated</span>
                <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">{healthSummary.calculatedColumns}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-[10px] text-muted-foreground block">Judgements</span>
                <span className="font-bold text-sm text-purple-600 dark:text-purple-400">{healthSummary.judgementColumns}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-[10px] text-muted-foreground block">Valid</span>
                <span className="font-bold text-sm text-emerald-600">{healthSummary.validFormulas}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-[10px] text-muted-foreground block">Review Needed</span>
                <span className={`font-bold text-sm ${healthSummary.needsReviewFormulas > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {healthSummary.needsReviewFormulas}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-[10px] text-muted-foreground block">Boundaries Pass</span>
                <span className="font-bold text-sm text-teal-600">{healthSummary.boundaryTestsPassed}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-[10px] text-muted-foreground block">Cycles</span>
                <span className={`font-bold text-sm ${healthSummary.cyclesDetected > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {healthSummary.cyclesDetected}
                </span>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION B: Column Audit Interactive Table                                 */}
          {/* ========================================================================= */}
          <section className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Section B: Column Registry & Status (Click row to inspect details)
              </span>
              <span className="text-xs text-muted-foreground">
                Showing {auditReport.columnAudits.length} columns
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-muted-foreground font-semibold">
                    <th className="py-2 px-3 w-10 text-center">#</th>
                    <th className="py-2 px-3">Column Label & ID</th>
                    <th className="py-2 px-3">Semantic Role</th>
                    <th className="py-2 px-3">Data Type</th>
                    <th className="py-2 px-3">Formula</th>
                    <th className="py-2 px-3 text-center">Validation Status</th>
                    <th className="py-2 px-3 text-center">Confidence</th>
                    <th className="py-2 px-3 text-center">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {auditReport.columnAudits.map((item, idx) => {
                    const isSelected = item.columnId === activeAuditItem?.columnId;
                    return (
                      <tr
                        key={item.columnId}
                        onClick={() => setSelectedColumnId(item.columnId)}
                        className={`cursor-pointer transition-colors duration-150 ${
                          isSelected
                            ? "bg-primary/10 dark:bg-primary/20 font-medium"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            {item.columnLabel}
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground">{item.columnId}</div>
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px] font-mono uppercase px-1.5 py-0">
                            {item.semanticRole || item.inferredRole}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                            {item.dataType}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 max-w-[200px]">
                          {item.currentFormula ? (
                            <code className="font-mono text-[10.5px] bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded text-foreground block truncate">
                              {item.currentFormula}
                            </code>
                          ) : item.recommendedFormula ? (
                            <span className="text-[10.5px] text-amber-600 dark:text-amber-400 italic">
                              AI Fix Available
                            </span>
                          ) : (
                            <span className="text-[10.5px] text-muted-foreground italic">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {item.formulaStatus === "VALIDATED" || item.formulaStatus === "VALID" ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[9.5px] py-0">
                              <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-600" /> Valid
                            </Badge>
                          ) : item.formulaStatus === "NEEDS_REVIEW" ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[9.5px] py-0">
                              <AlertTriangle className="w-2.5 h-2.5 mr-1 text-amber-600" /> Review
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 text-[9.5px] py-0">
                              <XCircle className="w-2.5 h-2.5 mr-1 text-rose-600" /> Invalid
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`font-mono text-[10px] font-bold ${
                            item.confidence === "HIGH" ? "text-emerald-600" : item.confidence === "MEDIUM" ? "text-amber-600" : "text-rose-600"
                          }`}>
                            {item.confidence}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {item.issues.length > 0 ? (
                            <Badge variant="destructive" className="text-[9.5px] px-1.5 py-0">
                              {item.issues.length}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION C: Active Column Detail & Repair Drilldown                        */}
          {/* ========================================================================= */}
          {activeAuditItem && (
            <section className="bg-white dark:bg-slate-900 rounded-xl p-4 border-2 border-primary/30 dark:border-primary/40 shadow-sm space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    Section C: Column Detail Drilldown:
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {activeAuditItem.columnLabel}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">({activeAuditItem.columnId})</span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    Role: {activeAuditItem.semanticRole}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-mono">
                    Type: {activeAuditItem.dataType}
                  </Badge>
                  {activeColDef && onSelectColumnForInspection && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs flex items-center gap-1"
                      onClick={() => onSelectColumnForInspection(activeAuditItem.columnId)}
                    >
                      <Eye className="w-3 h-3" />
                      Open in Inspector
                    </Button>
                  )}
                </div>
              </div>

              {/* Column Properties Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Left: Formulas */}
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Current Formula:
                    </span>
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 font-mono text-xs text-foreground border border-slate-200 dark:border-slate-800 break-all select-all">
                      {activeAuditItem.currentFormula || "(No formula defined)"}
                    </div>
                  </div>

                  {activeAuditItem.sourceFormula && (
                    <div>
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Original Excel Formula:
                      </span>
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 font-mono text-xs text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 break-all select-all">
                        {activeAuditItem.sourceFormula}
                      </div>
                    </div>
                  )}

                  {/* Dependencies */}
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Dependencies:
                    </span>
                    {activeAuditItem.dependencies.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {activeAuditItem.dependencies.map((dep) => (
                          <Badge key={dep} variant="outline" className="font-mono text-[10.5px] px-2 py-0 bg-slate-50 dark:bg-slate-950">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px] italic">None</span>
                    )}
                  </div>
                </div>

                {/* Right: Issues & Boundary Tests */}
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Validation Audit Findings:
                    </span>
                    {activeAuditItem.issues.length > 0 ? (
                      <div className="space-y-1 mt-1">
                        {activeAuditItem.issues.map((iss, i) => (
                          <div key={i} className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-[11px] flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>{iss}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-[11px] flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>All AST syntax, semantic typing, and metrology rules satisfied.</span>
                      </div>
                    )}
                  </div>

                  {/* Boundary Report if available */}
                  {activeAuditItem.boundaryReport && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                      <div className="flex items-center justify-between font-semibold">
                        <span>7-Point Boundary Verification:</span>
                        <Badge
                          variant="outline"
                          className={
                            activeAuditItem.boundaryReport.allPassed
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : "bg-amber-50 text-amber-700 border-amber-300"
                          }
                        >
                          {activeAuditItem.boundaryReport.passedCount} / {activeAuditItem.boundaryReport.totalCount} Passed
                        </Badge>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground mt-1">
                        Tested nominal, limits, inside/outside tolerance, and blank input behavior.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Recommendation Box if available */}
              {activeAuditItem.recommendedFormula && activeAuditItem.recommendedFormula !== activeAuditItem.currentFormula && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      AI Recommended Metrological Fix:
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-white text-amber-800 border-amber-300">
                      Confidence: {activeAuditItem.confidence}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="font-mono text-xs font-bold text-primary bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 shadow-sm">
                      {activeAuditItem.recommendedFormula}
                    </code>

                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 shadow-sm flex items-center gap-1"
                      onClick={() =>
                        handleApplySingleColumnFix(
                          activeAuditItem.columnId,
                          activeAuditItem.recommendedFormula!,
                          activeAuditItem.recommendationReason
                        )
                      }
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Apply AI Fix to Column
                    </Button>
                  </div>

                  {activeAuditItem.recommendationReason && (
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 italic">
                      {activeAuditItem.recommendationReason}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-3.5 border-t bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>ISO/IEC 17025 metrology compliance: Deterministic AST evaluation ensures audit-proof calculations.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {fixableColumns.length > 0 && (
              <Button
                size="sm"
                onClick={handleApplyAll}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Fix Entire Table ({fixableColumns.length} formulas)
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
