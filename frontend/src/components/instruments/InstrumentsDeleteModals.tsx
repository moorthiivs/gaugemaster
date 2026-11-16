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
import { Label } from "@/components/ui/label";
import { Trash2, Info } from "lucide-react";
import { Instrument } from "@/types/instrument";

interface InstrumentsDeleteModalsProps {
  deleteModalOpen: boolean;
  setDeleteModalOpen: (open: boolean) => void;
  instrumentToDelete: Instrument | null;
  onConfirmDelete: (reason?: string) => void;

  bulkDeleteModalOpen: boolean;
  setBulkDeleteModalOpen: (open: boolean) => void;
  selectedCount: number;
  onConfirmBulkDelete: (reason?: string) => void;

  isDeleting: boolean;
}

export function InstrumentsDeleteModals({
  deleteModalOpen,
  setDeleteModalOpen,
  instrumentToDelete,
  onConfirmDelete,
  bulkDeleteModalOpen,
  setBulkDeleteModalOpen,
  selectedCount,
  onConfirmBulkDelete,
  isDeleting,
}: InstrumentsDeleteModalsProps) {
  const [singleReason, setSingleReason] = useState("");
  const [bulkReason, setBulkReason] = useState("");

  useEffect(() => {
    if (!deleteModalOpen) setSingleReason("");
  }, [deleteModalOpen]);

  useEffect(() => {
    if (!bulkDeleteModalOpen) setBulkReason("");
  }, [bulkDeleteModalOpen]);

  return (
    <>
      {/* Single Instrument Soft Delete Confirmation */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-600 dark:text-amber-500 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Move Instrument to Trash
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-1 text-sm text-muted-foreground">
              <span>
                Are you sure you want to delete{" "}
                <strong className="text-foreground">{instrumentToDelete?.name}</strong>{" "}
                ({instrumentToDelete?.id_code})?
              </span>
              <span className="block text-xs bg-amber-500/10 text-amber-800 dark:text-amber-300 p-2.5 rounded-md border border-amber-500/20">
                <Info className="h-3.5 w-3.5 inline mr-1 text-amber-600" />
                This item will be moved to the <strong>Trash (Recovery Center)</strong>, where it and its active calibration records can be restored whenever needed.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-1">
            <Label htmlFor="single-delete-reason" className="text-xs text-muted-foreground">
              Reason for deletion (optional)
            </Label>
            <Input
              id="single-delete-reason"
              placeholder="e.g. Decommissioned, replaced, duplicate entry"
              value={singleReason}
              onChange={(e) => setSingleReason(e.target.value)}
              className="text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => onConfirmDelete(singleReason.trim() || undefined)}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              {isDeleting ? "Moving to Trash..." : "Move Instrument to Trash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={bulkDeleteModalOpen} onOpenChange={setBulkDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-600 dark:text-amber-500 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Move Instruments to Trash
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-1 text-sm text-muted-foreground">
              <span>
                Are you sure you want to delete <strong className="text-foreground">{selectedCount}</strong> selected instruments?
              </span>
              <span className="block text-xs bg-amber-500/10 text-amber-800 dark:text-amber-300 p-2.5 rounded-md border border-amber-500/20">
                <Info className="h-3.5 w-3.5 inline mr-1 text-amber-600" />
                Selected items and their active calibrations will be moved to the <strong>Trash (Recovery Center)</strong> and can be restored at any time.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-1">
            <Label htmlFor="bulk-delete-reason" className="text-xs text-muted-foreground">
              Reason for deletion (optional)
            </Label>
            <Input
              id="bulk-delete-reason"
              placeholder="e.g. Batch cleanup, departmental transfer"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              className="text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5"
              onClick={() => onConfirmBulkDelete(bulkReason.trim() || undefined)}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              {isDeleting ? "Moving to Trash..." : "Move Instruments to Trash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
