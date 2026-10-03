import React from "react";
import { format } from "date-fns";
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
import { YearMonthDatePicker } from "@/components/ui/year-month-date-picker";
import { CalendarDays, Upload, FileSpreadsheet } from "lucide-react";

export interface InstrumentsDateUpdateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  instrument: Instrument | null;
  newLastCalDate: string;
  setNewLastCalDate: (date: string) => void;
  newDueDate: string;
  setNewDueDate: (date: string) => void;
  certificateFile: File | null;
  setCertificateFile: (file: File | null) => void;
  updatingDates: boolean;
  onUpdateDates: () => void;
  baseUrl: string;
}

export function InstrumentsDateUpdateModal({
  isOpen,
  onOpenChange,
  instrument,
  newLastCalDate,
  setNewLastCalDate,
  newDueDate,
  setNewDueDate,
  certificateFile,
  setCertificateFile,
  updatingDates,
  onUpdateDates,
  baseUrl,
}: InstrumentsDateUpdateModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md space-y-4">
        <DialogHeader>
          <DialogTitle>Log External Calibration</DialogTitle>
          <DialogDescription>
            Upload certificate and update dates for {instrument?.name} ({instrument?.id_code}).
            {instrument?.due_date && (
              <span className="block mt-1 text-xs text-muted-foreground font-medium">
                Previous Due Date: {format(new Date(instrument.due_date), "dd-MM-yyyy")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Last Calibration Date</Label>
            <YearMonthDatePicker
              value={newLastCalDate}
              onChange={(val) => {
                setNewLastCalDate(val);
                // Auto calculate due date if frequency exists
                if (val && instrument) {
                  const freqMonths = parseFrequencyMonths(instrument.frequency);
                  if (freqMonths > 0) {
                    const [y, m, d] = val.split("-").map(Number);
                    const due = new Date(y, m - 1, d);
                    due.setMonth(due.getMonth() + freqMonths);
                    setNewDueDate(format(due, "yyyy-MM-dd"));
                  }
                }
              }}
              placeholder="Select last calibration date"
              formatPattern="dd-MMM-yyyy"
              clearable
            />
          </div>

          {newDueDate && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
              <Label className="text-xs text-muted-foreground">Next Due Date (Auto-calculated)</Label>
              <div className="font-medium flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                {format(new Date(newDueDate), "dd-MM-yyyy")}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Based on instrument frequency: {instrument?.frequency || "Not set"}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Attach Certificate (PDF/Image)</Label>
            <div className="relative">
              <input
                type="file"
                id="certificate-upload"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setCertificateFile(e.target.files[0]);
                  }
                }}
              />
              <label
                htmlFor="certificate-upload"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.add("border-primary", "bg-primary/10");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove("border-primary", "bg-primary/10");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove("border-primary", "bg-primary/10");
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const droppedFile = e.dataTransfer.files[0];
                    setCertificateFile(droppedFile);
                  }
                }}
                className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium transition-all border-2 border-dashed rounded-lg cursor-pointer border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 text-muted-foreground"
              >
                <Upload className="w-5 h-5 mr-2 text-primary/70" />
                {certificateFile ? (
                  <span className="text-foreground truncate max-w-[200px]">{certificateFile.name}</span>
                ) : (
                  <span>Click to browse or drag and drop</span>
                )}
              </label>
            </div>
            {instrument?.certificate_file && (
              <div className="flex items-center mt-2 text-sm">
                <span className="text-muted-foreground mr-2">Current file:</span>
                <a
                  href={instrument.certificate_file.startsWith("http") ? instrument.certificate_file : `${baseUrl}${instrument.certificate_file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-primary hover:underline font-medium"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  View Certificate
                </a>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={updatingDates || !newLastCalDate || !certificateFile} onClick={onUpdateDates}>
            {updatingDates ? "Saving..." : "Save External Calibration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
