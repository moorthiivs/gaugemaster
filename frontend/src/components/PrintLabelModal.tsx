import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Printer, LayoutGrid, ScrollText } from "lucide-react";
import { Instrument } from "@/types/instrument";
import { createPortal } from "react-dom";

interface PrintLabelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instruments: Instrument[];
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

export function PrintLabelModal({ open, onOpenChange, instruments }: PrintLabelModalProps) {
  const [layout, setLayout] = useState<"grid" | "roll">("grid");
  const [selectedFields, setSelectedFields] = useState<string[]>([
    "id_code", "name", "last_calibration_date", "due_date"
  ]);

  const toggleField = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const renderValue = (inst: any, fieldId: string) => {
    const val = inst[fieldId];
    if (!val) return "N/A";
    
    // Format dates if needed
    if (fieldId === "last_calibration_date" || fieldId === "due_date") {
      const dateStr = String(val);
      const cleanStr = dateStr.endsWith("Z") ? dateStr.slice(0, -1) : dateStr;
      const d = new Date(cleanStr);
      if (isNaN(d.getTime())) return "N/A";
      return d.toLocaleDateString();
    }
    
    return String(val);
  };

  // Render the printable content inside a portal to body so we can easily isolate it
  const printableArea = open ? createPortal(
    <div id="print-section" className="hidden print:block bg-white text-black w-full">
      <style>
        {`
          @media print {
            body > *:not(#print-section) {
              display: none !important;
            }
            body {
              background-color: white;
            }
            #print-section {
              display: block !important;
              position: relative !important;
            }
            @page {
              margin: 10mm;
            }
            .print-grid {
              display: grid !important;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
            }
            .print-roll {
              display: flex !important;
              flex-direction: column;
              gap: 20px;
            }
            .print-label {
              page-break-inside: avoid;
              border: 1px solid #000;
              padding: 10px;
              border-radius: 4px;
              font-family: sans-serif;
              background-color: white;
              color: black;
            }
            .print-roll .print-label {
              page-break-after: always;
              width: 100%;
              max-width: 400px;
            }
            .print-field {
              display: flex;
              margin-bottom: 4px;
              font-size: 12px;
            }
            .print-field-key {
              font-weight: bold;
              width: 100px;
              flex-shrink: 0;
            }
            .print-field-val {
              flex-grow: 1;
            }
          }
        `}
      </style>
      <div className={layout === "grid" ? "print-grid" : "print-roll"}>
        {instruments.map((inst) => (
          <div key={inst.id} className="print-label">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Print Labels ({instruments.length} items)
            </DialogTitle>
            <DialogDescription>
              Select the fields to include on the labels and choose a print layout.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-bold">Layout Option</Label>
              <RadioGroup value={layout} onValueChange={(val: "grid" | "roll") => setLayout(val)} className="flex gap-4">
                <div className="flex items-center space-x-2 border p-3 rounded-md flex-1 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLayout("grid")}>
                  <RadioGroupItem value="grid" id="layout-grid" />
                  <Label htmlFor="layout-grid" className="flex items-center gap-2 cursor-pointer w-full font-medium">
                    <LayoutGrid className="h-4 w-4" />
                    Grid (A4 / Letter Paper)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border p-3 rounded-md flex-1 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setLayout("roll")}>
                  <RadioGroupItem value="roll" id="layout-roll" />
                  <Label htmlFor="layout-roll" className="flex items-center gap-2 cursor-pointer w-full font-medium">
                    <ScrollText className="h-4 w-4" />
                    Continuous Roll (Label Printer)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-bold flex justify-between items-center">
                <span>Fields to Print</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs" 
                  onClick={() => setSelectedFields(AVAILABLE_FIELDS.map(f => f.id))}
                >
                  Select All
                </Button>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border p-4 rounded-md bg-muted/20">
                {AVAILABLE_FIELDS.map((field) => (
                  <div key={field.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`print-field-${field.id}`}
                      checked={selectedFields.includes(field.id)}
                      onCheckedChange={() => toggleField(field.id)}
                    />
                    <label
                      htmlFor={`print-field-${field.id}`}
                      className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {field.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-bold">Preview (First Item)</Label>
              <div className="border border-dashed p-4 rounded-md bg-white text-black flex justify-center">
                {instruments.length > 0 ? (
                  <div className="border border-black p-3 rounded text-sm w-full max-w-[300px]">
                    {AVAILABLE_FIELDS.filter((f) => selectedFields.includes(f.id)).map((field) => (
                      <div key={field.id} className="flex mb-1">
                        <span className="font-bold w-[100px] flex-shrink-0 text-xs">{field.label}:</span>
                        <span className="text-xs">{renderValue(instruments[0], field.id)}</span>
                      </div>
                    ))}
                    {selectedFields.length === 0 && (
                      <span className="text-muted-foreground italic text-xs">No fields selected</span>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No instruments selected</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handlePrint} className="gap-2" disabled={selectedFields.length === 0 || instruments.length === 0}>
              <Printer className="h-4 w-4" /> Print Labels
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {printableArea}
    </>
  );
}
