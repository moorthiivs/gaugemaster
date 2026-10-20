import React, { useState, useEffect } from "react";
import { format, isValid } from "date-fns";
import { Instrument } from "@/types/instrument";
import { parseFrequencyMonths } from "@/lib/instrumentActions";
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
import { YearMonthDatePicker, parseFlexibleDate } from "@/components/ui/year-month-date-picker";
import TooltipProv from "@/components/TooltipProv";
import {
  CalendarDays,
  Upload,
  FileSpreadsheet,
  FileCheck2,
  ExternalLink,
  X,
  FileText,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { getSecureFileUrl } from "@/lib/tokenStorage";

export interface InstrumentsDateUpdateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  instrument: Instrument | null;
  newLastCalDate: string;
  setNewLastCalDate: (date: string) => void;
  newDueDate: string;
  setNewDueDate: (date: string) => void;
  newCertNo?: string;
  setNewCertNo?: (certNo: string) => void;
  certificateFile: File | null;
  setCertificateFile: (file: File | null) => void;
  updatingDates: boolean;
  onUpdateDates: () => void;
  baseUrl?: string;
}

export function InstrumentsDateUpdateModal({
  isOpen,
  onOpenChange,
  instrument,
  newLastCalDate,
  setNewLastCalDate,
  newDueDate,
  setNewDueDate,
  newCertNo = "",
  setNewCertNo,
  certificateFile,
  setCertificateFile,
  updatingDates,
  onUpdateDates,
}: InstrumentsDateUpdateModalProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Frequency months with intelligent fallback (default to 12 months if unspecified)
  const freqMonths = (instrument ? parseFrequencyMonths(instrument.frequency) : 0) || 12;

  // Auto-calculate Next Due Date based on Last Calibration Date and Frequency
  const calculateDueDate = (calDateStr: string) => {
    if (!calDateStr) return;
    const dateObj = parseFlexibleDate(calDateStr);
    if (dateObj && isValid(dateObj)) {
      const due = new Date(dateObj);
      due.setMonth(due.getMonth() + freqMonths);
      setNewDueDate(format(due, "yyyy-MM-dd"));
    }
  };

  // Recalculate whenever Last Calibration Date changes
  const handleLastCalDateChange = (val: string) => {
    setNewLastCalDate(val);
    calculateDueDate(val);
  };

  // Auto-populate Next Due Date when modal opens if empty
  useEffect(() => {
    if (isOpen && newLastCalDate && !newDueDate) {
      calculateDueDate(newLastCalDate);
    }
  }, [isOpen, newLastCalDate, newDueDate, freqMonths]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setCertificateFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0 gap-0 border rounded-xl shadow-xl">
        {/* Header */}
        <div className="p-5 border-b bg-muted/20">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-2xs">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold text-foreground">
                Log External Calibration
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Record external calibration dates, certificate reference, and attach official laboratory report.
              </DialogDescription>
            </div>
          </div>

          {/* Instrument Summary Card */}
          {instrument && (
            <div className="mt-3.5 rounded-lg border bg-background/80 dark:bg-background/40 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs">
              <div className="min-w-0">
                <span className="font-semibold text-foreground truncate block">
                  {instrument.name}
                </span>
                <span className="text-muted-foreground  text-[11px]">
                  ID Code: <span className="font-medium text-foreground">{instrument.id_code}</span>
                  {instrument.location ? ` • ${instrument.location}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {instrument.frequency && (
                  <Badge variant="outline" className="text-[10px]  px-2 py-0.5">
                    Freq: {instrument.frequency}
                  </Badge>
                )}
                {instrument.due_date && (
                  <div className="text-[11px]  text-muted-foreground flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60">
                    <CalendarDays className="w-3.5 h-3.5 text-amber-500" />
                    Exp: {format(new Date(instrument.due_date), "dd-MMM-yyyy")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          {/* Two-Column Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-primary" />
                Last Calibration Date <span className="text-destructive">*</span>
              </Label>
              <YearMonthDatePicker
                value={newLastCalDate}
                onChange={handleLastCalDateChange}
                placeholder="Select calibration date"
                formatPattern="dd-MMM-yyyy"
                clearable
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                  Next Due Date <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 font-normal text-emerald-700 dark:text-emerald-300 border-emerald-300/80 bg-emerald-50/80 dark:bg-emerald-950/40"
                  >
                    Auto: +{freqMonths >= 12 && freqMonths % 12 === 0 ? `${freqMonths / 12} yr` : `${freqMonths} mo`}
                  </Badge>
                  <TooltipProv content={`Re-calculate due date based on frequency (+${freqMonths} months)`}>
                    <button
                      type="button"
                      onClick={() => calculateDueDate(newLastCalDate)}
                      className="text-muted-foreground hover:text-emerald-600 transition-colors p-0.5 rounded cursor-pointer"
                      title="Sync Due Date"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </TooltipProv>
                </div>
              </div>
              <YearMonthDatePicker
                value={newDueDate}
                onChange={setNewDueDate}
                placeholder="Select next due date"
                formatPattern="dd-MMM-yyyy"
                clearable
              />
            </div>
          </div>

          {/* Certificate Number Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Certificate Number <span className="text-muted-foreground font-normal">(NABL / Lab Reference)</span>
            </Label>
            <Input
              value={newCertNo}
              onChange={(e) => setNewCertNo && setNewCertNo(e.target.value)}
              placeholder="e.g. CC389925000000500F or VI/23-24/1229-01"
              className="h-9  text-xs"
            />
          </div>

          {/* Attach Certificate Section */}
          <div className="space-y-2 pt-1">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-primary" />
                Attach Certificate Document
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">PDF, PNG, JPG, Excel (up to 25MB)</span>
            </Label>

            {/* Hidden Input for File Selection */}
            <input
              type="file"
              id="ext-certificate-upload"
              accept=".pdf,image/*,.xlsx,.xls,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  setCertificateFile(e.target.files[0]);
                }
              }}
            />

            {/* If New File Selected */}
            {certificateFile ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 p-3 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {certificateFile.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(certificateFile.size / 1024).toFixed(1)} KB • Ready to upload
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <label
                    htmlFor="ext-certificate-upload"
                    className="inline-flex items-center gap-1 text-xs font-medium text-foreground px-2.5 py-1 rounded-md border border-border hover:bg-muted cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Change
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setCertificateFile(null)}
                    title="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : instrument?.certificate_file ? (
              /* If Existing Certificate File Present */
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10 p-3 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-100 truncate">
                        {instrument.cert_no ? `Certificate ${instrument.cert_no}` : "Attached Certificate"}
                      </p>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal bg-emerald-100/60 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300">
                        Current
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground  truncate">
                      {instrument.certificate_file.split("/").pop()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={getSecureFileUrl(instrument.certificate_file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 bg-emerald-100/50 dark:bg-emerald-900/40 hover:bg-emerald-200/60 dark:hover:bg-emerald-800/60 px-2.5 py-1 rounded-md border border-emerald-300/60 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View
                  </a>
                  <label
                    htmlFor="ext-certificate-upload"
                    className="inline-flex items-center gap-1 text-xs font-medium text-foreground px-2.5 py-1 rounded-md border border-border hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    Replace
                  </label>
                </div>
              </div>
            ) : (
              /* Dropzone when no file exists */
              <label
                htmlFor="ext-certificate-upload"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center w-full px-4 py-6 text-sm font-medium transition-all border-2 border-dashed rounded-xl cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-[0.99]"
                    : "border-muted-foreground/25 hover:border-emerald-500/60 hover:bg-emerald-500/5 text-muted-foreground"
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 shadow-2xs">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  Click to browse or drag and drop certificate
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Attach scanned calibration PDF or vendor measurement sheet
                </p>
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updatingDates}
            className="text-xs h-9 px-4"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={updatingDates || !newLastCalDate || (!certificateFile && !instrument?.certificate_file)}
            onClick={onUpdateDates}
            className="text-xs h-9 px-4 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
          >
            {updatingDates ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Save External Calibration
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
