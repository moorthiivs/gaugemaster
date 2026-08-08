import { useState } from "react";
import { AlertTriangle, Trash2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CompanyListItem } from "@/lib/superAdminActions";

interface DeleteCompanyConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: CompanyListItem;
  onConfirm: (confirmationName: string) => Promise<void>;
}

export default function DeleteCompanyConfirmModal({
  open,
  onOpenChange,
  company,
  onConfirm,
}: DeleteCompanyConfirmModalProps) {
  const [typedName, setTypedName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isMatched = typedName.trim().toLowerCase() === company.companyName.trim().toLowerCase();

  const handleConfirmDelete = async () => {
    if (!isMatched) return;
    setDeleting(true);
    try {
      await onConfirm(typedName.trim());
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 border-red-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-red-600 dark:text-red-400">
            <ShieldAlert className="h-5 w-5" />
            Delete Customer Company
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Permanent database cascading deletion warning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Warning box */}
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>CRITICAL: THIS ACTION CANNOT BE UNDONE</span>
            </div>
            <p className="text-red-700/90 dark:text-red-300/90 leading-relaxed">
              Deleting <strong>"{company.companyName}"</strong> will permanently purge all associated data from the system database, including:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-red-700/80 dark:text-red-300/80 font-mono text-[11px]">
              <li><strong>{company.userCount || 0}</strong> registered users</li>
              <li><strong>{company.instrumentCount || 0}</strong> instruments and gauges</li>
              <li><strong>{company.calibrationCount || 0}</strong> calibration records & certificates</li>
              <li>SRFs, calibration templates, settings, and reminders</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              Type <span className="font-bold text-foreground select-all bg-muted px-1.5 py-0.5 rounded border">{company.companyName}</span> to confirm:
            </Label>
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Type company name exactly..."
              className="h-9 text-xs font-medium border-red-500/30 focus-visible:ring-red-500"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="gap-1.5 font-bold bg-red-600 hover:bg-red-700"
            disabled={!isMatched || deleting}
            onClick={handleConfirmDelete}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting Company..." : "Permanently Delete Company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
