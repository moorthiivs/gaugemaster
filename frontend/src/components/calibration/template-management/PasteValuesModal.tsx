import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardPaste, Table, Check, Sparkles, AlertCircle, ArrowDown } from "lucide-react";
import { CanvasColumnDef } from "@/types/template";
import { parseClipboardValues } from "@/lib/tableClipboardHelper";
import { toast } from "sonner";

export interface PasteValuesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableTitle?: string;
  columns: CanvasColumnDef[];
  rowsCount: number;
  initialColId?: string;
  onApplyPaste: (colId: string, clipboardText: string, autoExpand: boolean) => void;
}

export function PasteValuesModal({
  open,
  onOpenChange,
  tableTitle,
  columns,
  rowsCount,
  initialColId,
  onApplyPaste,
}: PasteValuesModalProps) {
  const [selectedColId, setSelectedColId] = useState<string>("nominal");
  const [text, setText] = useState<string>("");
  const [autoExpand, setAutoExpand] = useState<boolean>(true);

  // Available target columns (excluding point_number/sl_no and formula/status columns)
  const targetColumns = useMemo(() => {
    return (columns || []).filter(
      (c) =>
        c &&
        c.id !== "point_number" &&
        c.id !== "sl_no" &&
        c.id !== "sino" &&
        c.type !== "formula" &&
        c.type !== "status"
    );
  }, [columns]);

  // Track modal open state transition to prevent wipeout during user input
  const prevOpenRef = useRef(false);

  useEffect(() => {
    // Only reset text and column selection when transitioning from closed to open
    if (open && !prevOpenRef.current) {
      if (initialColId && targetColumns.some((c) => c.id === initialColId)) {
        setSelectedColId(initialColId);
      } else {
        const nominalCol = targetColumns.find(
          (c) => (c.type === "nominal" || c.id === "nominal") && c.id !== "point_number"
        );
        if (nominalCol) {
          setSelectedColId(nominalCol.id);
        } else if (targetColumns.length > 0) {
          setSelectedColId(targetColumns[0].id);
        }
      }
      setText("");
    }
    prevOpenRef.current = open;
  }, [open, initialColId, targetColumns]);

  const parsedValues = useMemo(() => {
    return parseClipboardValues(text);
  }, [text]);

  const handleReadClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (!clipText || clipText.trim() === "") {
          toast.info("Clipboard is empty or contains no text.");
          return;
        }
        setText(clipText);
        toast.success(`Loaded ${parseClipboardValues(clipText).length} values from clipboard!`);
        return;
      }
    } catch (err) {
      console.warn("navigator.clipboard.readText failed, falling back to manual paste prompt", err);
    }
    toast.info("Please paste values directly into the box below (Ctrl+V).");
  };

  const handleApply = () => {
    if (parsedValues.length === 0) {
      toast.error("Please paste or type at least one value.");
      return;
    }
    onApplyPaste(selectedColId, text, autoExpand);
    onOpenChange(false);
  };

  const selectedColObj = targetColumns.find((c) => c.id === selectedColId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <ClipboardPaste className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Paste Column Values into {tableTitle || "Table"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Paste values from Excel, Google Sheets, or text (one per line). Existing formulas, units, tolerances, and table layout are preserved.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-xs overflow-y-auto pr-1 flex-1">
          {/* Target Column selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Target Column to Receive Values:
            </Label>
            <Select value={selectedColId} onValueChange={setSelectedColId}>
              <SelectTrigger className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700">
                <SelectValue placeholder="Select target column..." />
              </SelectTrigger>
              <SelectContent>
                {targetColumns.map((col) => (
                  <SelectItem key={col.id} value={col.id} className="text-xs cursor-pointer">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {col.label || col.id}
                    </span>{" "}
                    <span className="text-muted-foreground text-2xs font-mono ml-1">
                      ({col.id} &bull; {col.type})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Paste area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Values to Paste (Press Ctrl+V or paste from Excel):
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReadClipboard}
                className="h-6 px-2 text-2xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10"
              >
                <ClipboardPaste className="w-3 h-3" />
                <span>Paste from Clipboard</span>
              </Button>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"0.000\n0.010\n0.020\n0.030\n0.040\n0.050..."}
              rows={5}
              className="font-mono text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md focus:border-primary"
            />
          </div>

          {/* Live Preview & Summary Card */}
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Detected: <strong className="text-primary font-mono text-sm">{parsedValues.length}</strong> values
                </span>
              </div>
              <Badge variant="outline" className="text-2xs font-mono">
                Current Table Rows: {rowsCount}
              </Badge>
            </div>

            {/* Scrollable Live Table Preview */}
            {parsedValues.length > 0 && (
              <div className="mt-2 border border-slate-300 dark:border-slate-700 rounded-md overflow-hidden bg-white dark:bg-slate-950 max-h-40 overflow-y-auto">
                <table className="w-full text-2xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-1 px-2 text-left w-16">Row #</th>
                      <th className="py-1 px-2 text-left">Pasted Value into "{selectedColObj?.label || selectedColId}"</th>
                      <th className="py-1 px-2 text-right w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {parsedValues.map((val, idx) => {
                      const isNewRow = idx >= rowsCount;
                      return (
                        <tr
                          key={idx}
                          className={isNewRow ? "bg-amber-50/50 dark:bg-amber-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-900"}
                        >
                          <td className="py-0.5 px-2 text-muted-foreground">{idx + 1}</td>
                          <td className="py-0.5 px-2 font-bold text-slate-900 dark:text-slate-100">
                            {val}
                          </td>
                          <td className="py-0.5 px-2 text-right">
                            {isNewRow ? (
                              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-sans font-semibold">
                                + Add row
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-sans font-medium">
                                Update
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Auto expand checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={autoExpand}
              onChange={(e) => setAutoExpand(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary w-3.5 h-3.5"
            />
            <span className="text-xs">
              Auto-add new table rows if pasted count ({parsedValues.length}) exceeds current rows ({rowsCount})
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 shrink-0 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={parsedValues.length === 0}
            onClick={handleApply}
            className="text-xs font-semibold gap-1.5 shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply {parsedValues.length > 0 ? `(${parsedValues.length} Values)` : ""}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
