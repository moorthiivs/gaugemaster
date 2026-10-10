import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { addCustomInstrumentStatus } from "@/lib/instrumentActions";
import { AlertCircle, Loader2, PlusCircle, Check } from "lucide-react";

interface AddCustomStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingStatuses: string[];
  companyId?: string;
  onStatusCreated: (newStatus: string) => void;
}

export function AddCustomStatusModal({
  open,
  onOpenChange,
  existingStatuses = [],
  companyId,
  onStatusCreated,
}: AddCustomStatusModalProps) {
  const [statusName, setStatusName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const trimmed = statusName.trim();

  // Validate duplicate against canonical + existing custom statuses (case-insensitive)
  const duplicateMatch = useMemo(() => {
    if (!trimmed) return null;
    return existingStatuses.find(
      (s) => s.trim().toLowerCase() === trimmed.toLowerCase()
    );
  }, [trimmed, existingStatuses]);

  const isDuplicate = !!duplicateMatch;
  const isValid = trimmed.length > 0 && !isDuplicate;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValid || submitting) return;

    if (!companyId) {
      toast({
        title: "Company Required",
        description: "Company ID is missing. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await addCustomInstrumentStatus(companyId, trimmed);
      const createdStatus = res.status || trimmed;
      toast({
        title: "Custom Status Created",
        description: `Status "${createdStatus}" has been added and selected.`,
        variant: "success",
      });
      onStatusCreated(createdStatus);
      setStatusName("");
      onOpenChange(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create custom status.";
      toast({
        title: "Cannot Add Status",
        description: Array.isArray(msg) ? msg.join(", ") : String(msg),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setStatusName("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Add Custom Status</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Define a custom instrument status for your organization.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="custom-status-input" className="text-xs font-semibold">
              Status Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="custom-status-input"
              value={statusName}
              onChange={(e) => setStatusName(e.target.value)}
              placeholder="e.g., Under Maintenance, In Quarantine, Scrap Pending..."
              className={`h-9 text-xs ${
                isDuplicate ? "border-destructive focus-visible:ring-destructive/20" : ""
              }`}
              autoFocus
              maxLength={50}
            />
            {isDuplicate && (
              <div className="flex items-center gap-1.5 text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Status &quot;{duplicateMatch}&quot; already exists. Please enter a unique status name.
                </span>
              </div>
            )}
            {!isDuplicate && trimmed.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                This custom status will be available in registration, edits, master list, and dashboard.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!isValid || submitting}
              className="gap-1.5 font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Add Status</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
