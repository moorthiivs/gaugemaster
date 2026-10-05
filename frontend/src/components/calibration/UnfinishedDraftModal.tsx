import React from "react";
import { format, isValid } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileClock,
  Play,
  RotateCcw,
  Calendar,
  Layers,
  Thermometer,
  FileSpreadsheet,
  ArrowRight,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export interface UnfinishedDraftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: any;
  instrumentName?: string;
  instrumentCode?: string;
  onResume: () => void;
  onStartScratch: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const STEP_LABELS: Record<number, { full: string; short: string }> = {
  0: { full: "Step 1: Instrument & Environmental", short: "Step 1: Setup" },
  1: { full: "Step 2: Standards & Reference Setup", short: "Step 2: Standards" },
  2: { full: "Step 3: Calibration Readings & Results", short: "Step 3: Readings" },
  3: { full: "Step 4: Review, Signatures & Remarks", short: "Step 4: Signatures" },
  4: { full: "Step 5: Certificate Preview & Verification", short: "Step 5: Preview" },
};

export const UnfinishedDraftModal: React.FC<UnfinishedDraftModalProps> = ({
  open,
  onOpenChange,
  draft,
  instrumentName,
  instrumentCode,
  onResume,
  onStartScratch,
  onCancel,
  isLoading = false,
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setIsConfirmingDelete(false);
    }
  }, [open]);

  if (!draft) return null;

  let draftData: any = draft.data;
  if (typeof draftData === "string") {
    try {
      draftData = JSON.parse(draftData);
    } catch {
      draftData = {};
    }
  }

  const effectiveInstCode =
    instrumentCode ||
    draftData?.selectedInstrument?.id_code ||
    draftData?.selectedInstrument?.code ||
    "Instrument";
  const effectiveInstName =
    instrumentName ||
    draftData?.selectedInstrument?.name ||
    draftData?.selectedInstrument?.item_type ||
    "Calibration Target";

  // Last saved time
  const updatedDate = draft.updated_at
    ? new Date(draft.updated_at)
    : draft.created_at
      ? new Date(draft.created_at)
      : null;
  const formattedSavedAt =
    updatedDate && isValid(updatedDate)
      ? format(updatedDate, "dd-MMM-yyyy, hh:mm a")
      : "Recently saved";

  // Current step
  const currentStep = typeof draftData?.step === "number" ? draftData.step : 0;
  const stepInfo = STEP_LABELS[currentStep] || {
    full: `Step ${currentStep + 1}`,
    short: `Step ${currentStep + 1}`,
  };

  // Layout blocks / points count
  const layoutBlocksCount = Array.isArray(draftData?.wizardLayoutBlocks)
    ? draftData.wizardLayoutBlocks.length
    : 0;
  const pointsCount = Array.isArray(draftData?.calPoints)
    ? draftData.calPoints.length
    : 0;
  const readingsSummary =
    layoutBlocksCount > 0
      ? `${layoutBlocksCount} canvas table${layoutBlocksCount > 1 ? "s" : ""}`
      : pointsCount > 0
        ? `${pointsCount} calibration point${pointsCount > 1 ? "s" : ""}`
        : "Template configured";

  // Environmental info
  const envTemp = draftData?.envTemp;
  const envHumidity = draftData?.envHumidity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border border-border/80 shadow-2xl rounded-2xl bg-card">
        {/* Header Section */}
        <div className="p-6 pb-5 border-b border-border/60 bg-muted/20">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/25 shadow-inner">
              <FileClock className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className=" text-xs bg-background border-border/80 text-foreground px-2 py-0.5"
                >
                  {effectiveInstCode}
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-[11px]  bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5"
                >
                  Draft Detected
                </Badge>
              </div>

              <DialogTitle className="text-lg font-bold text-foreground mt-2 tracking-tight">
                Unfinished Draft Found
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                An autosaved calibration for{" "}
                <span className="font-semibold text-foreground">{effectiveInstName}</span>{" "}
                was saved on <span className="font-medium text-foreground">{formattedSavedAt}</span>.
              </DialogDescription>
            </div>
          </div>

          {/* Telemetry Snapshot Strip */}
          <div className="mt-4 grid grid-cols-3 gap-2 p-3 rounded-xl bg-background border border-border/70 text-xs">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Progress
              </span>
              <span className="font-semibold text-foreground truncate mt-1 flex items-center gap-1.5" title={stepInfo.full}>
                <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{stepInfo.short}</span>
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-l border-border/60 pl-3">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Readings
              </span>
              <span className="font-semibold text-foreground truncate mt-1 flex items-center gap-1.5" title={readingsSummary}>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{readingsSummary}</span>
              </span>
            </div>

            <div className="flex flex-col min-w-0 border-l border-border/60 pl-3">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Environment
              </span>
              <span className="font-semibold text-foreground truncate mt-1 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="truncate">
                  {envTemp ? `${envTemp}°C` : "N/A"}
                  {envHumidity ? ` • ${envHumidity}%` : ""}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Decision Action Tiles */}
        <div className="p-6 space-y-3">
          {/* Primary Action Tile: Resume Draft (Hero Choice) */}
          <button
            type="button"
            onClick={onResume}
            disabled={isLoading}
            className="w-full text-left p-4 rounded-xl border-2 border-emerald-500/50 hover:border-emerald-600 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.09] active:bg-emerald-500/[0.12] transition-all duration-150 group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 cursor-pointer shadow-sm hover:shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform mt-0.5">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      Resume Unfinished Draft
                    </span>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Continue directly at <strong className="text-foreground">{stepInfo.full}</strong> with all entered readings, formulas, and calibration conditions preserved.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-1 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
          </button>

          {/* Secondary Action: Start from Scratch with Safe Confirmation Step */}
          {!isConfirmingDelete ? (
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              disabled={isLoading}
              className="w-full text-left p-4 rounded-xl border border-border/80 hover:border-red-300 dark:hover:border-red-800/80 bg-background hover:bg-red-50/40 dark:hover:bg-red-950/20 active:bg-red-50/70 transition-all duration-150 group focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-muted text-muted-foreground group-hover:bg-red-100 dark:group-hover:bg-red-950/60 group-hover:text-red-600 dark:group-hover:text-red-400 flex items-center justify-center shrink-0 transition-colors mt-0.5">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-foreground group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                      Start from Scratch
                    </span>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Permanently delete this saved draft from your dashboard and begin a clean, blank calibration session.
                    </p>
                  </div>
                </div>
                <Trash2 className="w-4 h-4 text-muted-foreground/50 group-hover:text-red-500 shrink-0 mt-1 transition-colors" />
              </div>
            </button>
          ) : (
            <div className="p-4 rounded-xl border-2 border-red-500/60 bg-red-500/[0.06] dark:bg-red-950/30 space-y-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-500/25 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-red-700 dark:text-red-400 block">
                    Confirm Deleting Unfinished Draft
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Are you sure you want to discard this draft for{" "}
                    <strong className="text-foreground">{effectiveInstCode}</strong>? All entered progress (
                    <span className="font-medium text-foreground">{stepInfo.full}</span>,{" "}
                    <span className="font-medium text-foreground">{readingsSummary}</span>) will be permanently erased.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-red-500/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConfirmingDelete(false)}
                  disabled={isLoading}
                  className="h-8 text-xs font-medium"
                >
                  Cancel, Keep Draft
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setIsConfirmingDelete(false);
                    onStartScratch();
                  }}
                  disabled={isLoading}
                  className="h-8 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Yes, Delete & Start Fresh
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Area */}
        <div className="px-6 py-3 bg-muted/20 border-t border-border/60 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/70" />
            Select an option to proceed
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsConfirmingDelete(false);
              onCancel();
            }}
            disabled={isLoading}
            className="text-xs text-muted-foreground hover:text-foreground h-8 px-3"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Cancel / Choose Another
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
