import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Printer, LayoutGrid, ScrollText, Search, X, Ruler, Maximize2, Minimize2, Check, FileSpreadsheet, Eye, Sliders } from "lucide-react";
import { Instrument } from "@/types/instrument";
import { createPortal } from "react-dom";

interface PrintLabelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instruments: Instrument[];
  onExportXlsx?: (items: Instrument[], selectedFields?: string[]) => void;
}

const AVAILABLE_FIELDS = [
  { id: "id_code", label: "ID Code" },
  { id: "name", label: "Name" },
  { id: "location", label: "Location" },
  { id: "last_calibration_date", label: "Last Cal. Date" },
  { id: "due_date", label: "Due Date" },
  { id: "frequency", label: "Frequency" },
  { id: "status", label: "Status" },
  { id: "make", label: "Make" },
  { id: "range", label: "Range" },
  { id: "serial_no", label: "Serial No." },
  { id: "least_count", label: "Least Count" },
  { id: "calibration_source", label: "Cal. Source" },
  { id: "cert_no", label: "Cert. No." },
];

export interface LabelSizePreset {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  columns: number;
  layout: "grid" | "roll";
}

const LABEL_PRESETS: LabelSizePreset[] = [
  { id: "standard_50x25", name: "Thermal Roll - 50mm × 25mm (Standard Gauge)", width: 50, height: 25, columns: 1, layout: "roll" },
  { id: "a4_grid_3x8", name: "Standard A4 Sheet (3 × 8 Grid, 70×37mm)", width: 70, height: 37, columns: 3, layout: "grid" },
  { id: "medium_70x35", name: "Medium Label - 70mm × 35mm", width: 70, height: 35, columns: 2, layout: "grid" },
  { id: "large_100x50", name: "Large Asset Label - 100mm × 50mm", width: 100, height: 50, columns: 1, layout: "roll" },
  { id: "compact_38x19", name: "Compact Label - 38mm × 19mm", width: 38, height: 19, columns: 1, layout: "roll" },
  { id: "custom", name: "⚙️ Custom Dimensions (Enter Custom W × H)", width: 50, height: 25, columns: 1, layout: "roll" },
];

export function PrintLabelModal({ open, onOpenChange, instruments, onExportXlsx }: PrintLabelModalProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "id_code", "name", "last_calibration_date", "due_date"
  ]);
  const [itemsToPrint, setItemsToPrint] = useState<Instrument[]>(instruments);

  // Search & Expand filter state for selected items
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpandedList, setIsExpandedList] = useState(false);

  // Custom Label Sizing State
  const [selectedPresetId, setSelectedPresetId] = useState<string>("standard_50x25");
  const [customWidth, setCustomWidth] = useState<number>(50);
  const [customHeight, setCustomHeight] = useState<number>(25);
  const [gridColumns, setGridColumns] = useState<number>(1);
  const [fontSize, setFontSize] = useState<number>(10);
  const [showBorder, setShowBorder] = useState<boolean>(true);
  const [layoutMode, setLayoutMode] = useState<"grid" | "roll">("roll");

  useEffect(() => {
    setItemsToPrint(instruments);
  }, [instruments, open]);

  // When size preset changes, sync dimensions and layout defaults
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = LABEL_PRESETS.find((p) => p.id === presetId);
    if (preset && preset.id !== "custom") {
      setCustomWidth(preset.width);
      setCustomHeight(preset.height);
      setGridColumns(preset.columns);
      setLayoutMode(preset.layout);
    }
  };

  // Filter items in selected list by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return itemsToPrint;
    const q = searchQuery.toLowerCase().trim();
    return itemsToPrint.filter(
      (item) =>
        (item.id_code && item.id_code.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        (item.make && item.make.toLowerCase().includes(q))
    );
  }, [itemsToPrint, searchQuery]);

  const toggleField = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handleRemoveItem = (id: string) => {
    setItemsToPrint((prev) => prev.filter((i) => i.id !== id));
  };

  const handlePrint = () => {
    window.print();
  };

  const renderValue = (inst: any, fieldId: string) => {
    const val = inst[fieldId];
    if (!val) return "N/A";

    if (fieldId === "last_calibration_date" || fieldId === "due_date") {
      const dateStr = String(val);
      const cleanStr = dateStr.endsWith("Z") ? dateStr.slice(0, -1) : dateStr;
      const d = new Date(cleanStr);
      if (isNaN(d.getTime())) return "N/A";
      return d.toLocaleDateString();
    }

    return String(val);
  };

  // Effective dimensions
  const activeWidth = customWidth || 50;
  const activeHeight = customHeight || 25;

  // Determine effective print layout mode
  const isRollMode = layoutMode === "roll" && gridColumns === 1;

  // Render printable output into portal for window.print()
  const printableArea = open ? createPortal(
    <div id="print-section" className="hidden print:block bg-white text-black w-full">
      <style>
        {`
          @media print {
            body > *:not(#print-section) {
              display: none !important;
            }
            html, body {
              background-color: white !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }
            #print-section {
              display: block !important;
              position: relative !important;
              width: 100% !important;
            }
            @page {
              size: ${isRollMode ? `${activeWidth}mm ${activeHeight}mm` : "A4 portrait"};
              margin: ${isRollMode ? "0mm" : "8mm"};
            }
            .print-container {
              ${isRollMode
                ? `
                  display: block !important;
                  width: ${activeWidth}mm !important;
                `
                : `
                  display: grid !important;
                  grid-template-columns: repeat(${gridColumns}, 1fr) !important;
                  gap: 4mm !important;
                  width: 100% !important;
                `
              }
            }
            .print-label {
              box-sizing: border-box !important;
              width: ${isRollMode ? `${activeWidth}mm` : "100%"} !important;
              height: ${activeHeight}mm !important;
              min-height: ${activeHeight}mm !important;
              max-height: ${activeHeight}mm !important;
              padding: 3mm 4mm !important;
              border: ${showBorder ? "1px solid #000" : "none"} !important;
              border-radius: 2px !important;
              font-size: ${fontSize}px !important;
              font-family: Arial, sans-serif !important;
              background-color: white !important;
              color: black !important;
              page-break-inside: avoid !important;
              overflow: hidden !important;
              ${isRollMode ? "page-break-after: always !important;" : "page-break-after: auto !important;"}
            }
            .print-label-header {
              font-weight: 800 !important;
              font-size: ${Math.max(fontSize - 1, 7)}px !important;
              border-bottom: 1px solid #000 !important;
              padding-bottom: 2px !important;
              margin-bottom: 3px !important;
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
            }
            .print-field {
              display: flex !important;
              align-items: center !important;
              line-height: 1.25 !important;
              margin-bottom: 2px !important;
            }
            .print-field-key {
              font-weight: bold !important;
              width: 38% !important;
              flex-shrink: 0 !important;
            }
            .print-field-val {
              flex-grow: 1 !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
          }
        `}
      </style>
      <div className="print-container">
        {itemsToPrint.map((inst) => (
          <div key={inst.id} className="print-label">
            <div className="print-label-header">
              <span>CALIBRATION</span>
              <span>{inst.id_code}</span>
            </div>
            {AVAILABLE_FIELDS.filter((f) => selectedFields.includes(f.id)).map((field) => (
              <div key={field.id} className="print-field">
                <span className="print-field-key">{field.label}:</span>
                <span className="print-field-val">{renderValue(inst, field.id)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[94vw] max-h-[92vh] overflow-hidden flex flex-col p-6 shadow-2xl rounded-2xl">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2.5 text-lg font-bold">
                <Printer className="h-5 w-5 text-primary" />
                Print & Custom Label Studio ({itemsToPrint.length} items)
              </span>
              <Badge variant="outline" className="text-xs font-mono px-2.5 py-1 bg-primary/10 text-primary border-primary/30">
                {activeWidth}mm × {activeHeight}mm
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Filter bulk items, customize paper & label sizes, choose printable fields, and generate labels.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 py-4 grid grid-cols-1 lg:grid-cols-12 gap-6 scrollbar-thin">
            {/* ── LEFT PANE: Controls & Selections (Col 1-7) ── */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* 1. Bulk Items View & Search Filter */}
              <div className="space-y-2.5 border rounded-xl p-3.5 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-bold text-foreground">Selected Items</Label>
                    <Badge variant="secondary" className="text-[11px] font-semibold">
                      {itemsToPrint.length} Total
                    </Badge>
                    {searchQuery && (
                      <Badge variant="outline" className="text-[10px] bg-background">
                        {filteredItems.length} Matched
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 px-2"
                      onClick={() => setIsExpandedList(!isExpandedList)}
                      title={isExpandedList ? "Collapse List" : "Expand Full View"}
                    >
                      {isExpandedList ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      <span>{isExpandedList ? "Compact" : "Full View"}</span>
                    </Button>
                    {itemsToPrint.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10 px-2"
                        onClick={() => setItemsToPrint([])}
                      >
                        Deselect All
                      </Button>
                    )}
                  </div>
                </div>

                {/* Bulk Filter Input */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search selected items by ID Code, Name, Location..."
                    className="pl-8 pr-7 h-8 text-xs bg-background"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 absolute right-1 top-1 text-muted-foreground hover:text-foreground"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Scrollable list container with responsive expansion */}
                <div className={`overflow-y-auto border rounded-lg p-2 bg-background space-y-1.5 scrollbar-thin transition-all duration-200 ${isExpandedList ? "max-h-64" : "max-h-36"}`}>
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      {itemsToPrint.length === 0 ? "No items selected to print." : "No items match your search filter."}
                    </div>
                  ) : (
                    filteredItems.map((inst) => (
                      <div key={inst.id} className="flex items-center justify-between bg-muted/40 hover:bg-muted/80 px-2.5 py-1.5 rounded-md border text-xs transition-colors">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="font-mono font-bold text-foreground bg-background px-1.5 py-0.5 rounded border border-border/60">{inst.id_code}</span>
                          <span className="font-medium text-foreground truncate">{inst.name}</span>
                          {inst.location && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded hidden sm:inline-block truncate">{inst.location}</span>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Remove item"
                          onClick={() => handleRemoveItem(inst.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 2. Professional Custom Label Sizing Options */}
              <div className="space-y-3 border rounded-xl p-3.5 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                    <Ruler className="h-4 w-4 text-primary" />
                    Custom Label Sizing & Paper Dimensions
                  </Label>
                </div>

                {/* Preset Dropdown */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Select Label Size Preset</span>
                  <Select value={selectedPresetId} onValueChange={handlePresetChange}>
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Select paper/label size" />
                    </SelectTrigger>
                    <SelectContent>
                      {LABEL_PRESETS.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id} className="text-xs">
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Width & Height Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">Width (mm)</span>
                    <Input
                      type="number"
                      min={15}
                      max={300}
                      value={customWidth}
                      onChange={(e) => {
                        setCustomWidth(Number(e.target.value) || 50);
                        setSelectedPresetId("custom");
                      }}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">Height (mm)</span>
                    <Input
                      type="number"
                      min={10}
                      max={300}
                      value={customHeight}
                      onChange={(e) => {
                        setCustomHeight(Number(e.target.value) || 25);
                        setSelectedPresetId("custom");
                      }}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">Columns</span>
                    <Select
                      value={String(gridColumns)}
                      onValueChange={(val) => setGridColumns(Number(val))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1" className="text-xs">1 Column (Roll)</SelectItem>
                        <SelectItem value="2" className="text-xs">2 Columns</SelectItem>
                        <SelectItem value="3" className="text-xs">3 Columns (A4)</SelectItem>
                        <SelectItem value="4" className="text-xs">4 Columns</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">Font Size (px)</span>
                    <Select
                      value={String(fontSize)}
                      onValueChange={(val) => setFontSize(Number(val))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="8" className="text-xs">8px (Tiny)</SelectItem>
                        <SelectItem value="9" className="text-xs">9px (Compact)</SelectItem>
                        <SelectItem value="10" className="text-xs">10px (Standard)</SelectItem>
                        <SelectItem value="11" className="text-xs">11px (Medium)</SelectItem>
                        <SelectItem value="12" className="text-xs">12px (Large)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Border & Layout Style Toggle */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-border-cb"
                      checked={showBorder}
                      onCheckedChange={(c) => setShowBorder(!!c)}
                    />
                    <label htmlFor="show-border-cb" className="cursor-pointer text-muted-foreground font-medium">
                      Draw Label Border Box
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={layoutMode === "grid" ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2"
                      onClick={() => setLayoutMode("grid")}
                    >
                      <LayoutGrid className="h-3 w-3" /> Grid Sheet
                    </Button>
                    <Button
                      variant={layoutMode === "roll" ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px] gap-1 px-2"
                      onClick={() => setLayoutMode("roll")}
                    >
                      <ScrollText className="h-3 w-3" /> Continuous Roll
                    </Button>
                  </div>
                </div>
              </div>

              {/* 3. Fields to Print Selector */}
              <div className="space-y-2.5 border rounded-xl p-3.5 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-foreground">Printable Fields</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setSelectedFields(AVAILABLE_FIELDS.map((f) => f.id))}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground px-2"
                      onClick={() => setSelectedFields(["id_code", "name"])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 border p-3 rounded-lg bg-background">
                  {AVAILABLE_FIELDS.map((field) => (
                    <div key={field.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`print-field-${field.id}`}
                        checked={selectedFields.includes(field.id)}
                        onCheckedChange={() => toggleField(field.id)}
                      />
                      <label
                        htmlFor={`print-field-${field.id}`}
                        className="text-xs font-medium cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {field.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT PANE: Scaled Live Preview & Real-Time Summary (Col 8-12) ── */}
            <div className="lg:col-span-5 space-y-4 flex flex-col">
              <div className="border rounded-xl p-4 bg-muted/10 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b pb-2">
                  <Label className="text-sm font-bold flex items-center gap-1.5">
                    <Eye className="h-4 w-4 text-primary" />
                    Live Label Preview
                  </Label>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {activeWidth} × {activeHeight} mm
                  </Badge>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-900 border border-dashed rounded-xl min-h-[220px]">
                  {itemsToPrint.length > 0 ? (
                    <div className="w-full flex justify-center">
                      <div
                        style={{
                          width: "100%",
                          maxWidth: `${Math.min(activeWidth * 4.5, 340)}px`,
                          minHeight: `${Math.min(activeHeight * 3.5, 180)}px`,
                          fontSize: `${fontSize}px`,
                          border: showBorder ? "1px solid #000" : "1px dashed #ccc",
                        }}
                        className="bg-white text-black p-3 rounded shadow-md font-sans transition-all duration-200 space-y-1 overflow-hidden"
                      >
                        <div className="border-b border-black/20 pb-1 mb-1 flex items-center justify-between">
                          <span className="font-extrabold text-[11px] tracking-wider uppercase">CALIBRATION LABEL</span>
                          <span className="text-[9px] text-gray-500 font-mono">{itemsToPrint[0].id_code}</span>
                        </div>
                        {AVAILABLE_FIELDS.filter((f) => selectedFields.includes(f.id)).map((field) => (
                          <div key={field.id} className="flex items-center leading-tight">
                            <span className="font-bold w-[38%] shrink-0 opacity-90">{field.label}:</span>
                            <span className="truncate flex-1 font-medium">{renderValue(itemsToPrint[0], field.id)}</span>
                          </div>
                        ))}
                        {selectedFields.length === 0 && (
                          <span className="text-muted-foreground italic text-xs block text-center py-4">No fields selected</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      No instruments selected to generate preview.
                    </div>
                  )}
                </div>

                {/* Print Configuration Summary */}
                <div className="bg-background border rounded-lg p-3 text-xs space-y-1.5 text-muted-foreground font-mono">
                  <div className="flex justify-between">
                    <span>Selected Items:</span>
                    <strong className="text-foreground font-semibold">{itemsToPrint.length}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Dimensions:</span>
                    <strong className="text-foreground font-semibold">{activeWidth}mm × {activeHeight}mm</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Layout Mode:</span>
                    <strong className="text-foreground font-semibold">{layoutMode === "grid" ? `Grid (${gridColumns} cols)` : "Continuous Roll"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Fields Count:</span>
                    <strong className="text-foreground font-semibold">{selectedFields.length} selected</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between sm:justify-between">
            <div>
              {onExportXlsx && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={itemsToPrint.length === 0}
                  onClick={() => onExportXlsx(itemsToPrint, selectedFields)}
                  className="gap-1.5 text-emerald-600 hover:text-emerald-700 border-emerald-600/30 hover:bg-emerald-50 text-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Download XLSX ({itemsToPrint.length})</span>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                className="gap-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm px-4"
                disabled={selectedFields.length === 0 || itemsToPrint.length === 0}
              >
                <Printer className="h-4 w-4" />
                <span>Print Labels ({itemsToPrint.length})</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printableArea}
    </>
  );
}

