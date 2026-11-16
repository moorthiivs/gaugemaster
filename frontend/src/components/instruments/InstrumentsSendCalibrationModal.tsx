import React from "react";
import { Instrument } from "@/types/instrument";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export interface InstrumentsSendCalibrationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAgency: string;
  setSelectedAgency: (val: string) => void;
  emailColumns: { id: string; label: string }[];
  selectedEmailColumns: string[];
  setSelectedEmailColumns: React.Dispatch<React.SetStateAction<string[]>>;
  selected: Record<string, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  dataItems: Instrument[];
  description: string;
  setDescription: (val: string) => void;
  isSendCalibration: boolean;
  onSendMail: () => void;
}

export function InstrumentsSendCalibrationModal({
  isOpen,
  onOpenChange,
  selectedAgency,
  setSelectedAgency,
  emailColumns,
  selectedEmailColumns,
  setSelectedEmailColumns,
  selected,
  setSelected,
  dataItems,
  description,
  setDescription,
  isSendCalibration,
  onSendMail,
}: InstrumentsSendCalibrationModalProps) {
  const selectedCount = Object.keys(selected).filter((id) => selected[id]).length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Instruments to Calibration Agency</DialogTitle>
          <DialogDescription>
            Enter agency email, review selected instruments and add description.
          </DialogDescription>
        </DialogHeader>

        {/* Agency Email Input */}
        <div className="space-y-2">
          <Label>Calibration Agency Email</Label>
          <Input
            type="email"
            value={selectedAgency}
            onChange={(e) => setSelectedAgency(e.target.value)}
            placeholder="Enter agency email"
          />
        </div>

        {/* Columns Selection */}
        <div className="space-y-2">
          <Label>Select Columns to Include in Email</Label>
          <div className="flex flex-wrap gap-4 border p-3 rounded-md max-h-32 overflow-y-auto">
            {emailColumns.map((col) => (
              <div key={col.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`col-${col.id}`}
                  checked={selectedEmailColumns.includes(col.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedEmailColumns((prev) => [...prev, col.id]);
                    } else {
                      setSelectedEmailColumns((prev) => prev.filter((c) => c !== col.id));
                    }
                  }}
                />
                <label htmlFor={`col-${col.id}`} className="text-sm cursor-pointer">
                  {col.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Instruments List */}
        <div className="space-y-2">
          <Label>Selected Instruments ({selectedCount})</Label>

          <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
            {Object.keys(selected)
              .filter((id) => selected[id])
              .map((id) => {
                const item = dataItems.find((i) => i.id === id);
                if (!item) return null;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-muted p-2 rounded-md"
                  >
                    <div className="text-sm">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.id_code}</div>
                    </div>

                    {/* Accessible Remove Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${item.name || item.id_code} from selection`}
                      onClick={() =>
                        setSelected((prev) => {
                          const copy = { ...prev };
                          delete copy[item.id];
                          return copy;
                        })
                      }
                    >
                      ✕
                    </Button>
                  </div>
                );
              })}

            {selectedCount === 0 && (
              <p className="text-sm text-muted-foreground">No instruments selected</p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter description for the agency…"
          />
        </div>

        <DialogFooter>
          <Button disabled={isSendCalibration} onClick={onSendMail}>
            {isSendCalibration ? "Mail Sending..." : "Send Mail"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
