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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SplitSquareVertical, Table, ArrowRightLeft, Sparkles, Check } from "lucide-react";
import { TableGridBlock } from "@/types/template";

export interface MergeTablesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTable: TableGridBlock | null;
  availableTables: TableGridBlock[];
  onMerge: (tableAId: string, tableBId: string) => void;
}

export function MergeTablesModal({
  open,
  onOpenChange,
  sourceTable,
  availableTables,
  onMerge,
}: MergeTablesModalProps) {
  const [selectedTableBId, setSelectedTableBId] = useState<string>("");

  useEffect(() => {
    if (open && availableTables.length > 0) {
      // Auto-select the first available table if only one exists or if none selected
      if (!selectedTableBId || !availableTables.some((t) => t.id === selectedTableBId)) {
        setSelectedTableBId(availableTables[0].id);
      }
    }
  }, [open, availableTables, selectedTableBId]);

  const targetTableB = availableTables.find((t) => t.id === selectedTableBId) || null;

  const handleConfirm = () => {
    if (!sourceTable || !selectedTableBId) return;
    onMerge(sourceTable.id, selectedTableBId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
              <SplitSquareVertical className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Merge Tables into Side-by-Side (50/50)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Combine two standalone tables into a single side-by-side split row container. All rows, columns, formulas, and tolerances are 100% preserved.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target table selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Select Second Table to Place on the Right:
            </Label>
            {availableTables.length === 0 ? (
              <div className="p-3 rounded-lg border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
                No other standalone data tables found on canvas. Add another table first to merge them side-by-side.
              </div>
            ) : (
              <Select value={selectedTableBId} onValueChange={setSelectedTableBId}>
                <SelectTrigger className="w-full text-xs font-medium">
                  <SelectValue placeholder="Choose a table..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <Table className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold">{t.title || "Untitled Table"}</span>
                        <span className="text-muted-foreground text-2xs">
                          ({t.rows?.length || 0} rows, {t.columns?.length || 0} cols)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Visual Preview of Side-by-Side Placement */}
          {sourceTable && targetTableB && (
            <div className="border border-indigo-200 dark:border-indigo-800/80 rounded-xl p-3 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
              <div className="flex items-center justify-between text-2xs font-bold text-indigo-700 dark:text-indigo-300">
                <span>PREVIEW: SIDE-BY-SIDE SPLIT (50% / 50%)</span>
                <Badge variant="outline" className="text-2xs bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700">
                  Ratio: 50 / 50
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Left Card */}
                <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                    <Table className="w-3.5 h-3.5" />
                    <span className="truncate">{sourceTable.title || "Left Table"}</span>
                  </div>
                  <div className="text-2xs text-muted-foreground">
                    Position: <span className="font-semibold text-slate-800 dark:text-slate-200">Left Column (50%)</span>
                  </div>
                  <div className="flex items-center gap-1 text-2xs">
                    <Badge variant="secondary" className="text-xxs px-1 py-0 font-medium">
                      {sourceTable.rows?.length || 0} rows
                    </Badge>
                    <Badge variant="secondary" className="text-xxs px-1 py-0 font-medium">
                      {sourceTable.columns?.length || 0} cols
                    </Badge>
                  </div>
                </div>

                {/* Right Card */}
                <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                    <Table className="w-3.5 h-3.5" />
                    <span className="truncate">{targetTableB.title || "Right Table"}</span>
                  </div>
                  <div className="text-2xs text-muted-foreground">
                    Position: <span className="font-semibold text-slate-800 dark:text-slate-200">Right Column (50%)</span>
                  </div>
                  <div className="flex items-center gap-1 text-2xs">
                    <Badge variant="secondary" className="text-xxs px-1 py-0 font-medium">
                      {targetTableB.rows?.length || 0} rows
                    </Badge>
                    <Badge variant="secondary" className="text-xxs px-1 py-0 font-medium">
                      {targetTableB.columns?.length || 0} cols
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
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
            disabled={!selectedTableBId || availableTables.length === 0}
            onClick={handleConfirm}
            className="text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>Merge Side-by-Side</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
