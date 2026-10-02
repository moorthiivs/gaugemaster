import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Instrument } from "@/types/instrument";

interface InstrumentsDeleteModalsProps {
  deleteModalOpen: boolean;
  setDeleteModalOpen: (open: boolean) => void;
  instrumentToDelete: Instrument | null;
  onConfirmDelete: () => void;

  bulkDeleteModalOpen: boolean;
  setBulkDeleteModalOpen: (open: boolean) => void;
  selectedCount: number;
  onConfirmBulkDelete: () => void;

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
  return (
    <>
      {/* Single Instrument Delete Confirmation */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Instrument
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the instrument{" "}
              <strong>{instrumentToDelete?.name}</strong> ({instrumentToDelete?.id_code})? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={bulkDeleteModalOpen} onOpenChange={setBulkDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Instruments
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedCount}</strong> selected
              instruments? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirmBulkDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
