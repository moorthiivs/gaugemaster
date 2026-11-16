import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileCheck, Trash2, X, FileSpreadsheet, Printer } from "lucide-react";
import { Instrument } from "@/types/instrument";

interface InstrumentsReviewSelectedModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItemsList: Instrument[];
  onClearAllSelections: () => void;
  onDeselectItem: (id: string) => void;
  onExportSelected: () => void;
  onPrintSelected: () => void;
}

export function InstrumentsReviewSelectedModal({
  isOpen,
  onOpenChange,
  selectedItemsList,
  onClearAllSelections,
  onDeselectItem,
  onExportSelected,
  onPrintSelected,
}: InstrumentsReviewSelectedModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col space-y-4">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              <span>Review Selected Instruments ({selectedItemsList.length})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
              onClick={onClearAllSelections}
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </Button>
          </DialogTitle>
          <DialogDescription>
            Review all items selected across search & pagination. Deselect any item not required,
            then print labels or download in XLSX format.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border rounded-xl max-h-[50vh] scrollbar-thin">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-12 text-center">S.No</TableHead>
                <TableHead>ID Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last Cal. Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedItemsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-xs">
                    No items selected. Select items from the inventory table to review or print.
                  </TableCell>
                </TableRow>
              ) : (
                selectedItemsList.map((item, idx) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 text-xs">
                    <TableCell className="text-center font-mono text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{item.id_code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.location || "-"}</TableCell>
                    <TableCell>
                      {item.last_calibration_date
                        ? format(new Date(item.last_calibration_date), "dd-MM-yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {item.due_date ? format(new Date(item.due_date), "dd-MM-yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "OK"
                            ? "default"
                            : item.status === "Overdue"
                            ? "destructive"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Deselect this item"
                        onClick={() => onDeselectItem(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
          <div className="text-xs text-muted-foreground font-medium">
            {selectedItemsList.length} item(s) selected
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedItemsList.length === 0}
              onClick={onExportSelected}
              className="gap-1.5 text-emerald-600 hover:text-emerald-700 border-emerald-600/30 hover:bg-emerald-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Download XLSX ({selectedItemsList.length})</span>
            </Button>
            <Button
              disabled={selectedItemsList.length === 0}
              size="sm"
              onClick={onPrintSelected}
              className="gap-1.5 bg-primary text-primary-foreground"
            >
              <Printer className="w-4 h-4" />
              <span>Print Labels ({selectedItemsList.length})</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
