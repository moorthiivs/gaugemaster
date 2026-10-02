import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2, Search, ArrowUp, ArrowDown, GripVertical, Check } from "lucide-react";

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

interface InstrumentsColumnModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  columnConfigs: ColumnConfig[];
  defaultColumns: ColumnConfig[];
  onSave: (newConfigs: ColumnConfig[]) => void;
}

export function InstrumentsColumnModal({
  isOpen,
  onOpenChange,
  columnConfigs,
  defaultColumns,
  onSave,
}: InstrumentsColumnModalProps) {
  const [columnSearchQuery, setColumnSearchQuery] = useState("");
  const [tempColumnConfigs, setTempColumnConfigs] = useState<ColumnConfig[]>([]);
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTempColumnConfigs([...columnConfigs]);
      setColumnSearchQuery("");
      setDraggedColIndex(null);
    }
  }, [isOpen, columnConfigs]);

  const handleToggleColumnVisibility = (colId: string, checked: boolean) => {
    setTempColumnConfigs((prev) =>
      prev.map((c) => (c.id === colId ? { ...c, visible: checked } : c))
    );
  };

  const handleMoveColumn = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tempColumnConfigs.length) return;
    const newConfigs = [...tempColumnConfigs];
    const [moved] = newConfigs.splice(index, 1);
    newConfigs.splice(targetIndex, 0, moved);
    setTempColumnConfigs(newConfigs);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === index) return;
    const newConfigs = [...tempColumnConfigs];
    const [dragged] = newConfigs.splice(draggedColIndex, 1);
    newConfigs.splice(index, 0, dragged);
    setTempColumnConfigs(newConfigs);
    setDraggedColIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedColIndex(null);
  };

  const handleSave = () => {
    onSave(tempColumnConfigs);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            <span>Customize Instrument Columns</span>
          </DialogTitle>
          <DialogDescription>
            Drag & drop columns to re-order, or use the checkboxes to toggle visibility.
          </DialogDescription>
        </DialogHeader>

        {/* Search & Quick Actions */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search columns..."
              value={columnSearchQuery}
              onChange={(e) => setColumnSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setTempColumnConfigs((prev) => prev.map((c) => ({ ...c, visible: true })))}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-muted-foreground"
                onClick={() =>
                  setTempColumnConfigs((prev) =>
                    prev.map((c) => ({
                      ...c,
                      visible: c.id === "sino" || c.id === "name" || c.id === "id_code",
                    }))
                  )
                }
              >
                Deselect All
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-primary font-medium"
              onClick={() => setTempColumnConfigs([...defaultColumns])}
            >
              Reset Default
            </Button>
          </div>
        </div>

        {/* Drag & Drop Re-orderable & Selectable Columns List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 border rounded-xl p-2 max-h-[45vh] scrollbar-thin">
          {tempColumnConfigs
            .map((col, index) => ({ col, originalIndex: index }))
            .filter(({ col }) => col.label.toLowerCase().includes(columnSearchQuery.toLowerCase()))
            .map(({ col, originalIndex }) => (
              <div
                key={col.id}
                draggable
                onDragStart={(e) => handleDragStart(e, originalIndex)}
                onDragOver={(e) => handleDragOver(e, originalIndex)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all duration-150 select-none ${
                  draggedColIndex === originalIndex
                    ? "bg-primary/10 border-primary shadow-md scale-[1.01] z-10"
                    : col.visible
                    ? "bg-card border-border hover:border-primary/40 shadow-2xs"
                    : "bg-muted/30 border-transparent opacity-60 hover:opacity-80"
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <Checkbox
                    id={`col-cfg-${col.id}`}
                    checked={col.visible}
                    onCheckedChange={(checked) => handleToggleColumnVisibility(col.id, !!checked)}
                  />
                  <label
                    htmlFor={`col-cfg-${col.id}`}
                    className="font-medium text-xs truncate cursor-pointer select-none"
                  >
                    {col.label}
                  </label>
                </div>

                {/* Up / Down Re-order Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    disabled={originalIndex === 0}
                    onClick={() => handleMoveColumn(originalIndex, "up")}
                    title="Move Up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    disabled={originalIndex === tempColumnConfigs.length - 1}
                    onClick={() => handleMoveColumn(originalIndex, "down")}
                    title="Move Down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Check className="w-4 h-4" />
            <span>Save Configuration</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
