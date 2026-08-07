import { useState } from "react";
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
import { Download, FileArchive, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { exportTemplates } from "@/lib/templateManagementActions";
import { CalibrationTemplate } from "@/types/template";

interface TemplateExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTemplates: CalibrationTemplate[];
  allTemplates: CalibrationTemplate[];
  companyId?: string;
  userId?: string;
  userName?: string;
}

export function TemplateExportModal({
  open,
  onOpenChange,
  selectedTemplates,
  allTemplates,
  companyId,
  userId,
  userName,
}: TemplateExportModalProps) {
  const [exportScope, setExportScope] = useState<"selected" | "all">("selected");
  const [loading, setLoading] = useState(false);

  const targetTemplates = exportScope === "selected" && selectedTemplates.length > 0
    ? selectedTemplates
    : allTemplates;

  const handleExport = async () => {
    if (targetTemplates.length === 0) {
      toast.error("No templates available to export.");
      return;
    }

    setLoading(true);
    try {
      const templateIds = targetTemplates.map((t) => t.id);
      await exportTemplates({
        templateIds,
        companyId,
        userId,
        userName,
      });
      toast.success(`Exported ${targetTemplates.length} templates successfully!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to export calibration templates");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileArchive className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Export Calibration Templates</DialogTitle>
              <DialogDescription>
                Download a reusable package containing complete template specs & formulas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Export Scope:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportScope("selected")}
                disabled={selectedTemplates.length === 0}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                  exportScope === "selected" && selectedTemplates.length > 0
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-accent/50 disabled:opacity-50"
                }`}
              >
                <div className="font-semibold text-sm">Selected Templates</div>
                <div className="text-xs text-muted-foreground mt-1">
                  <Badge variant="secondary">{selectedTemplates.length} templates</Badge>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportScope("all")}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                  exportScope === "all"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:bg-accent/50"
                }`}
              >
                <div className="font-semibold text-sm">All Templates</div>
                <div className="text-xs text-muted-foreground mt-1">
                  <Badge variant="secondary">{allTemplates.length} templates</Badge>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg border border-border text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Package Metadata Included:
            </div>
            <div>• Format Version 1.0 manifest with full formula & section trees</div>
            <div>• Cleansed database IDs (ready for new customer import)</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading || targetTemplates.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            {loading ? "Exporting..." : `Export Package (${targetTemplates.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
