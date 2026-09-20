import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  FileSpreadsheet,
  Info,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { bulkDeleteTemplates } from "@/lib/templateActions";
import { CalibrationTemplate } from "@/types/template";
import { CALIBRATION_TYPES } from "@/types/calibration";

interface TemplateBulkDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTemplates: CalibrationTemplate[];
  isSuperAdmin?: boolean;
  onSuccess: () => void;
}

export function TemplateBulkDeleteModal({
  open,
  onOpenChange,
  selectedTemplates,
  isSuperAdmin = false,
  onSuccess,
}: TemplateBulkDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [forceConfirmed, setForceConfirmed] = useState(false);
  const [inUseError, setInUseError] = useState<{
    message: string;
    inUseTemplates?: { id: string; name: string; calibrationCount: number }[];
  } | null>(null);

  // Partition selected templates into system vs deletable custom templates
  const { systemTemplates, deletableTemplates } = useMemo(() => {
    const sys: CalibrationTemplate[] = [];
    const del: CalibrationTemplate[] = [];

    selectedTemplates.forEach((tpl) => {
      if (!tpl.companyId && !tpl.userId && !isSuperAdmin) {
        sys.push(tpl);
      } else {
        del.push(tpl);
      }
    });

    return { systemTemplates: sys, deletableTemplates: del };
  }, [selectedTemplates, isSuperAdmin]);

  const handleDelete = async () => {
    if (deletableTemplates.length === 0) {
      toast.error("No eligible templates to delete.");
      return;
    }

    setLoading(true);
    setInUseError(null);

    try {
      const idsToDelete = deletableTemplates.map((t) => t.id);
      const res = await bulkDeleteTemplates(idsToDelete, forceConfirmed);

      toast.success(
        res.message || `${deletableTemplates.length} template(s) deleted successfully!`,
      );
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      const respData = err.response?.data;
      if (respData?.code === "TEMPLATES_IN_USE" || respData?.inUseTemplates) {
        setInUseError({
          message:
            respData.message ||
            "Some templates are linked to existing calibration records.",
          inUseTemplates: respData.inUseTemplates || [],
        });
      } else {
        const errorMsg =
          respData?.message || err.message || "Failed to delete calibration templates.";
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = (isOpen: boolean) => {
    if (!loading) {
      setInUseError(null);
      setForceConfirmed(false);
      onOpenChange(isOpen);
    }
  };

  const getDisciplineBadgeClass = (type?: string) => {
    switch (type) {
      case "dimensional":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
      case "pressure":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
      case "electrical":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
      case "thermal":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-2xl max-w-[95vw] p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        {/* Top Danger Header */}
        <div className="bg-destructive/[0.04] dark:bg-destructive/[0.08] border-b border-destructive/15 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 shrink-0 mt-0.5 shadow-2xs">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                    Bulk Delete Templates
                  </DialogTitle>
                  <Badge variant="outline" className="text-2xs bg-destructive/10 text-destructive border-destructive/30 font-semibold px-2">
                    Irreversible Action
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  Review the selected calibration templates below before permanently removing them from your library.
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 text-xs max-h-[calc(85vh-160px)] overflow-y-auto">
          {/* Bento Stats Strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border bg-card/60 shadow-2xs flex flex-col justify-between">
              <span className="text-tiny font-medium text-muted-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                Total Selected
              </span>
              <span className="text-lg font-bold font-mono text-foreground mt-1">
                {selectedTemplates.length}
              </span>
            </div>

            <div className="p-3 rounded-xl border bg-destructive/[0.03] border-destructive/20 shadow-2xs flex flex-col justify-between">
              <span className="text-tiny font-medium text-destructive flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                Eligible to Delete
              </span>
              <span className="text-lg font-bold font-mono text-destructive mt-1">
                {deletableTemplates.length}
              </span>
            </div>

            <div className="p-3 rounded-xl border bg-muted/30 shadow-2xs flex flex-col justify-between">
              <span className="text-tiny font-medium text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                System Protected
              </span>
              <span className="text-lg font-bold font-mono text-foreground mt-1">
                {systemTemplates.length}
              </span>
            </div>
          </div>

          {/* System Template Protection Notice */}
          {systemTemplates.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/25 text-amber-950 dark:text-amber-200 flex items-start gap-3">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold text-foreground">
                  {systemTemplates.length} Global System Template(s) Protected
                </p>
                <p className="text-tiny text-muted-foreground leading-relaxed">
                  Default system templates are shared across all tenants and cannot be deleted. They will automatically be excluded from this operation.
                </p>
              </div>
            </div>
          )}

          {/* Templates in use warning */}
          {inUseError && (
            <div className="p-4 rounded-xl bg-rose-500/[0.08] border border-rose-500/30 text-rose-950 dark:text-rose-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-foreground">Active Calibration Records Warning</p>
                  <p className="text-tiny text-muted-foreground mt-0.5 leading-relaxed">
                    {inUseError.message}
                  </p>
                </div>
              </div>

              {inUseError.inUseTemplates && inUseError.inUseTemplates.length > 0 && (
                <div className="bg-background/90 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-tiny space-y-1.5 max-h-28 overflow-y-auto">
                  {inUseError.inUseTemplates.map((t) => (
                    <div key={t.id} className="flex justify-between items-center text-foreground py-0.5">
                      <span className="font-medium truncate max-w-[380px]">{t.name}</span>
                      <Badge variant="outline" className="text-2xs text-rose-600 border-rose-300 dark:border-rose-800 shrink-0">
                        {t.calibrationCount} certificate(s)
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-1 border-t border-rose-500/20">
                <Checkbox
                  id="confirm-force"
                  checked={forceConfirmed}
                  onCheckedChange={(checked) => setForceConfirmed(!!checked)}
                />
                <label
                  htmlFor="confirm-force"
                  className="text-tiny font-semibold leading-none cursor-pointer select-none text-foreground"
                >
                  I understand and wish to proceed with permanently deleting these templates.
                </label>
              </div>
            </div>
          )}

          {/* Templates Preview List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Eligible Templates for Deletion ({deletableTemplates.length})
              </span>
              {deletableTemplates.length === 0 && (
                <span className="text-destructive font-semibold text-tiny">No eligible templates</span>
              )}
            </div>

            {deletableTemplates.length > 0 ? (
              <ScrollArea className="h-56 rounded-xl border border-border/70 bg-card/50 p-2">
                <div className="space-y-1.5 pr-1">
                  {deletableTemplates.map((tpl) => {
                    const calType = CALIBRATION_TYPES.find(
                      (c) => c.type === tpl.calibration_type,
                    );

                    return (
                      <div
                        key={tpl.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-background hover:bg-muted/40 transition-colors border border-border/50 text-xs gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground text-xs leading-snug">
                            {tpl.name}
                          </div>
                          <div className="text-tiny text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-medium text-foreground/80">{tpl.instrument_type || "Instrument"}</span>
                            {tpl.doc_no && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-2xs bg-muted px-1.5 py-0.2 rounded">
                                  Doc: {tpl.doc_no}
                                </span>
                              </>
                            )}
                            {tpl.doc_rev && (
                              <span className="font-mono text-2xs text-muted-foreground">
                                Rev: {tpl.doc_rev}
                              </span>
                            )}
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className={`text-2xs capitalize shrink-0 font-medium px-2 py-0.5 ${getDisciplineBadgeClass(tpl.calibration_type)}`}
                        >
                          {calType?.label || tpl.calibration_type}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="border rounded-xl p-8 text-center text-muted-foreground bg-muted/10">
                <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs font-medium text-foreground">No customizable templates selected to delete</p>
                <p className="text-tiny text-muted-foreground mt-0.5">
                  Only custom company templates can be removed.
                </p>
              </div>
            )}
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border text-tiny text-muted-foreground flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-primary" />
            <span>
              Existing calibration certificates created with these templates will preserve all recorded calibration data and historical records.
            </span>
          </div>
        </div>

        <DialogFooter className="bg-muted/20 border-t border-border/60 px-6 py-3.5 flex flex-row items-center justify-end gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleModalClose(false)}
            disabled={loading}
            className="text-xs h-8 px-3.5 font-medium"
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={
              loading ||
              deletableTemplates.length === 0 ||
              (!!inUseError && !forceConfirmed)
            }
            className="gap-1.5 text-xs h-8 px-4 font-semibold shadow-xs"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Delete {deletableTemplates.length} Template(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
