import React, { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Columns, Check, X, AlertCircle } from "lucide-react";
import { CanvasColumnDef } from "@/types/template";
import { toast } from "sonner";

interface ManageHeaderGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialGroupName?: string;
  columns: CanvasColumnDef[];
  onApply: (groupName: string, selectedColIds: string[]) => void;
  onUnmerge?: () => void;
}

const QUICK_GROUP_PRESETS = [
  "OBSERVATIONS",
  "MAXIMUM PERMISSIBLE ERROR",
  "ALLOWABLE LIMITS",
  "CALIBRATION RESULTS",
  "SPECIFICATION & TOLERANCE",
  "REPEATABILITY",
];

export function ManageHeaderGroupModal({
  open,
  onOpenChange,
  initialGroupName = "",
  columns,
  onApply,
  onUnmerge,
}: ManageHeaderGroupModalProps) {
  const [groupName, setGroupName] = useState<string>(initialGroupName || "OBSERVATIONS");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      const cleanInit = initialGroupName?.trim() || "";
      setGroupName(cleanInit || "OBSERVATIONS");

      if (cleanInit) {
        const matching = columns.filter((c) => c.groupName?.trim() === cleanInit).map((c) => c.id);
        setSelectedIds(matching.length > 0 ? matching : columns.slice(0, 2).map((c) => c.id));
      } else {
        // Default to first 2 available data columns
        setSelectedIds(columns.slice(0, Math.min(2, columns.length)).map((c) => c.id));
      }
    }
  }, [open, initialGroupName, columns]);

  const toggleColumn = (colId: string) => {
    setSelectedIds((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(columns.map((c) => c.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleSave = () => {
    const cleanName = groupName.trim();
    if (!cleanName) {
      toast.error("Please enter a group name for the super-header.");
      return;
    }

    if (selectedIds.length < 2) {
      toast.error("Please select at least 2 columns to create a header group.");
      return;
    }

    onApply(cleanName, selectedIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden font-sans">
        <DialogHeader className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
              <Columns className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Manage Header Group (Super-Header)
                <Badge variant="outline" className="text-[10px] text-indigo-300 border-indigo-500/40 bg-indigo-500/10 font-mono">
                  {selectedIds.length} Columns
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300">
                Group multiple adjacent columns under a unified multi-column super-header.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Group Name Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Super-Header / Group Name</span>
              <span className="text-xxs text-primary font-mono lowercase">e.g. OBSERVATIONS</span>
            </Label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. OBSERVATIONS, MAXIMUM PERMISSIBLE ERROR"
              className="font-medium text-sm"
              autoFocus
            />

            {/* Quick Presets */}
            <div className="pt-1.5 flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
              {QUICK_GROUP_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setGroupName(preset)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                    groupName === preset
                      ? "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800 font-semibold"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Column Selector */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select Columns to Include in Group
              </Label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-primary hover:underline font-medium text-xs cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden bg-background">
              {columns.map((col, idx) => {
                const isSelected = selectedIds.includes(col.id);
                return (
                  <label
                    key={col.id}
                    className={`flex items-center justify-between p-2.5 hover:bg-muted/40 transition-colors cursor-pointer text-xs ${
                      isSelected ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleColumn(col.id)}
                        className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      />
                      <span className="font-semibold text-foreground">{col.label || col.id}</span>
                      {col.groupName && col.groupName !== initialGroupName && (
                        <span className="text-xxs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                          (Currently in: {col.groupName})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {col.type && (
                        <Badge variant="outline" className="text-[10px] uppercase font-mono py-0">
                          {col.type}
                        </Badge>
                      )}
                      <span className="text-xxs text-muted-foreground font-mono">
                        Col {idx + 1}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            {selectedIds.length < 2 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Select at least 2 columns to form a merged group header.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-5 pt-3 bg-muted/30 border-t border-border flex items-center justify-between flex-wrap gap-2">
          {initialGroupName && onUnmerge ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUnmerge}
              className="text-xs text-rose-600 border-rose-300 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Unmerge Group
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={selectedIds.length < 2 || !groupName.trim()}
              className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Apply Group ({selectedIds.length} Cols)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
