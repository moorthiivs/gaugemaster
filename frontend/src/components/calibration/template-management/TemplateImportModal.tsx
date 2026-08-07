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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileUp, AlertTriangle, CheckCircle, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  validateImportPackage,
  importTemplates,
  ImportPreviewResult,
  DuplicateStrategy,
} from "@/lib/templateManagementActions";

interface TemplateImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  userId?: string;
  userName?: string;
  onSuccess: () => void;
}

export function TemplateImportModal({
  open,
  onOpenChange,
  companyId,
  userId,
  userName,
  onSuccess,
}: TemplateImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>("SKIP");

  const handleFileChange = async (file: File) => {
    if (!file.name.endsWith(".zip") && !file.name.endsWith(".json")) {
      toast.error("Please upload a valid .zip or .json calibration template package.");
      return;
    }

    setSelectedFile(file);
    setValidating(true);
    try {
      const res = await validateImportPackage(file, companyId);
      setPreview(res);
      toast.success(`Package validated: ${res.totalFound} templates found.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to validate template package.");
      setPreview(null);
    } finally {
      setValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedFile || !preview) return;

    setImporting(true);
    try {
      const result = await importTemplates({
        file: selectedFile,
        duplicateStrategy,
        companyId,
        userId,
        userName,
      });

      toast.success(
        `Import completed! Created: ${result.importedCount}, Updated: ${result.updatedCount}, Skipped: ${result.skippedCount}`,
      );
      onSuccess();
      onOpenChange(false);
      // Reset state
      setSelectedFile(null);
      setPreview(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to import templates.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileUp className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Import Calibration Templates</DialogTitle>
              <DialogDescription>
                Upload an exported template package (.zip) to import reusable specs into your organization.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Select Area */}
          {!preview ? (
            <div className="border-2 border-dashed border-border hover:border-primary rounded-xl p-6 text-center space-y-3 transition-colors bg-muted/20">
              <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
              <div>
                <label className="cursor-pointer">
                  <span className="text-primary font-medium hover:underline">Click to upload</span> or drag and drop
                  <input
                    type="file"
                    accept=".zip,.json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-1">calibration-templates-export.zip</p>
              </div>

              {validating && (
                <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium pt-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Validating package structure...
                </div>
              )}
            </div>
          ) : (
            <>
              {/* File Info Header */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium">{selectedFile?.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                  }}
                >
                  Change File
                </Button>
              </div>

              {/* Import Preview Statistics */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-card border rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Total Found</div>
                  <div className="text-lg font-bold text-foreground">{preview.totalFound}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">New</div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{preview.newCount}</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                  <div className="text-xs text-amber-600 dark:text-amber-400">Duplicates</div>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{preview.duplicateCount}</div>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg p-2">
                  <div className="text-xs text-rose-600 dark:text-rose-400">Invalid</div>
                  <div className="text-lg font-bold text-rose-700 dark:text-rose-300">{preview.invalidCount}</div>
                </div>
              </div>

              {/* Duplicate Handling Selector */}
              {preview.duplicateCount > 0 && (
                <div className="space-y-2 bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    Duplicate Templates Found ({preview.duplicateCount}): Select Action Strategy
                  </div>

                  <RadioGroup
                    value={duplicateStrategy}
                    onValueChange={(val) => setDuplicateStrategy(val as DuplicateStrategy)}
                    className="space-y-2 pt-1 text-xs"
                  >
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="SKIP" id="strat-skip" className="mt-0.5" />
                      <Label htmlFor="strat-skip" className="font-normal cursor-pointer">
                        <span className="font-semibold text-foreground">Skip Duplicates (Default)</span> — Safest option. Preserves existing production templates.
                      </Label>
                    </div>

                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="IMPORT_AS_NEW" id="strat-copy" className="mt-0.5" />
                      <Label htmlFor="strat-copy" className="font-normal cursor-pointer">
                        <span className="font-semibold text-foreground">Import as New</span> — Renames duplicate templates with a "(Copy)" suffix.
                      </Label>
                    </div>

                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="REPLACE" id="strat-replace" className="mt-0.5" />
                      <Label htmlFor="strat-replace" className="font-normal cursor-pointer">
                        <span className="font-semibold text-foreground">Replace Existing</span> — Overwrites existing matching templates.
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Template Items Scroll List */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Template Package Details:</Label>
                <ScrollArea className="h-44 border rounded-lg p-2">
                  <div className="space-y-1.5 text-xs">
                    {preview.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-card border">
                        <div className="truncate max-w-[280px]">
                          <span className="font-medium">{item.name}</span>
                          <div className="text-[10px] text-muted-foreground">
                            {item.calibration_type} • {item.instrument_type}
                          </div>
                        </div>

                        <div>
                          {item.status === "NEW" && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                              New
                            </Badge>
                          )}
                          {item.status === "DUPLICATE" && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">
                              Duplicate
                            </Badge>
                          )}
                          {item.status === "INVALID" && (
                            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[10px]">
                              Invalid
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExecuteImport} disabled={importing || !preview || preview.items.length === 0}>
            {importing ? "Importing..." : "Confirm & Import Templates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
