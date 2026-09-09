import { useState, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  FileSpreadsheet,
  Info,
  CheckCircle2,
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
      if (!tpl.companyId && !isSuperAdmin) {
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

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Bulk Delete Templates
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Review selected calibration templates before permanent deletion.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Summary Banner */}
          <div className="p-3 rounded-lg border bg-muted/30 flex items-center justify-between">
            <span className="text-muted-foreground">Total Selected:</span>
            <span className="font-semibold text-foreground text-sm">
              {selectedTemplates.length} template(s)
            </span>
          </div>

          {/* System Template Protection Notice */}
          {systemTemplates.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">
                  {systemTemplates.length} System Template(s) Protected
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Global system default templates cannot be deleted and will be excluded automatically.
                </p>
              </div>
            </div>
          )}

          {/* Templates in use warning */}
          {inUseError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-300 space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs">Calibrations Reference Warning</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {inUseError.message}
                  </p>
                </div>
              </div>

              {inUseError.inUseTemplates && inUseError.inUseTemplates.length > 0 && (
                <div className="bg-background/80 p-2 rounded border border-rose-200 dark:border-rose-900 text-[11px] space-y-1 max-h-24 overflow-y-auto">
                  {inUseError.inUseTemplates.map((t) => (
                    <div key={t.id} className="flex justify-between items-center text-foreground">
                      <span className="font-medium truncate max-w-[260px]">{t.name}</span>
                      <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300">
                        {t.calibrationCount} certificate(s)
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="confirm-force"
                  checked={forceConfirmed}
                  onCheckedChange={(checked) => setForceConfirmed(!!checked)}
                />
                <label
                  htmlFor="confirm-force"
                  className="text-[11px] font-medium leading-none cursor-pointer select-none text-foreground"
                >
                  I understand and wish to proceed with deleting these templates.
                </label>
              </div>
            </div>
          )}

          {/* Templates Preview List */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground font-medium">
              <span>Eligible for Deletion ({deletableTemplates.length}):</span>
              {deletableTemplates.length === 0 && (
                <span className="text-destructive font-semibold">None eligible</span>
              )}
            </div>

            {deletableTemplates.length > 0 ? (
              <ScrollArea className="h-48 border rounded-lg p-2 bg-background/50">
                <div className="space-y-1.5">
                  {deletableTemplates.map((tpl) => {
                    const calType = CALIBRATION_TYPES.find(
                      (c) => c.type === tpl.calibration_type,
                    );

                    return (
                      <div
                        key={tpl.id}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 transition-colors border border-transparent hover:border-border text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-medium text-foreground truncate">
                            {tpl.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {tpl.instrument_type} {tpl.doc_no && `• Doc: ${tpl.doc_no}`}
                          </div>
                        </div>

                        <Badge
                          variant="secondary"
                          className="text-[10px] capitalize shrink-0 font-normal"
                        >
                          {calType?.label || tpl.calibration_type}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="border rounded-lg p-6 text-center text-muted-foreground">
                <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs">No customizable templates selected to delete.</p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Existing calibration certificates created with these templates will preserve their recorded data.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleModalClose(false)}
            disabled={loading}
            className="text-xs"
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
            className="gap-1.5 text-xs shadow-sm"
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
