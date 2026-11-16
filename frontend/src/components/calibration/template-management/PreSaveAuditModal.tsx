import React from "react";
import { CanvasBlock } from "@/types/template";
import {
  validateTemplatePreSave,
  PreSaveAuditResult,
} from "@/lib/templatePreSaveValidator";
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
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";

export interface PreSaveAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: CanvasBlock[];
  onConfirmSave: () => void;
}

export const PreSaveAuditModal: React.FC<PreSaveAuditModalProps> = ({
  open,
  onOpenChange,
  blocks,
  onConfirmSave,
}) => {
  const auditResult: PreSaveAuditResult = validateTemplatePreSave(blocks);

  const handleProceed = () => {
    onConfirmSave();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                auditResult.canSaveProduction
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
              }`}
            >
              {auditResult.canSaveProduction ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Pre-Save Quality & Metrology Gate</span>
                <Badge
                  variant="outline"
                  className={
                    auditResult.canSaveProduction
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                      : "bg-rose-50 text-rose-700 border-rose-300"
                  }
                >
                  {auditResult.canSaveProduction ? "Production Ready" : "Action Required"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Automated 12-point metrology quality gate verifying AST syntax, dependency graphs, blank safety, calculation model alignment, and boundary checks.
              </DialogDescription>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900/60 text-center">
              <span className="text-[10.5px] text-muted-foreground block">Passed Checks</span>
              <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                ✓ {auditResult.passedCount}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-amber-200 dark:border-amber-900/60 text-center">
              <span className="text-[10.5px] text-muted-foreground block">Warnings</span>
              <span className="font-bold text-base text-amber-600 dark:text-amber-400">
                ⚠ {auditResult.warningCount}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-rose-200 dark:border-rose-900/60 text-center">
              <span className="text-[10.5px] text-muted-foreground block">Blocking Errors</span>
              <span className="font-bold text-base text-rose-600 dark:text-rose-400">
                ✕ {auditResult.errorCount}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable List of Checks */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {auditResult.checks.map((chk) => (
            <div
              key={chk.id}
              className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                chk.status === "PASS"
                  ? "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
                  : chk.status === "WARN"
                  ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60"
                  : "bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60"
              }`}
            >
              <div className="mt-0.5">
                {chk.status === "PASS" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : chk.status === "WARN" ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground text-xs">{chk.name}</span>
                    {chk.isBlocking && (
                      <Badge variant="destructive" className="text-[8.5px] py-0 px-1">
                        Blocking
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[9px] uppercase font-mono px-1 py-0">
                    {chk.category}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {chk.details}
                </p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="p-4 border-t bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {auditResult.canSaveProduction
              ? "All critical checks passed. Ready to save to Instrument Master."
              : "Resolve critical errors before saving template for production calibration."}
          </p>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleProceed}
              disabled={!auditResult.canSaveProduction}
              className={
                auditResult.canSaveProduction
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
                  : "opacity-50 cursor-not-allowed"
              }
            >
              <span>Confirm & Save</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
