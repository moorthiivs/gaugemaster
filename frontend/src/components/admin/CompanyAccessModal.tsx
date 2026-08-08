import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Shield, ShieldOff, Clock, Calendar as CalendarIcon, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarPicker } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CompanyListItem, UpdateCompanyAccessDto } from "@/lib/superAdminActions";

interface CompanyAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: CompanyListItem;
  onSave: (dto: UpdateCompanyAccessDto) => Promise<void>;
}

export default function CompanyAccessModal({
  open,
  onOpenChange,
  company,
  onSave,
}: CompanyAccessModalProps) {
  const [accessStatus, setAccessStatus] = useState<"enabled" | "disabled" | "time_limited">(
    (company.accessStatus as any) || "enabled"
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    company.accessStartDate ? new Date(company.accessStartDate) : new Date()
  );
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    company.accessExpiryDate
      ? new Date(company.accessExpiryDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Default +30 days
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company) {
      setAccessStatus((company.accessStatus as any) || "enabled");
      setStartDate(company.accessStartDate ? new Date(company.accessStartDate) : new Date());
      setExpiryDate(
        company.accessExpiryDate
          ? new Date(company.accessExpiryDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
    }
  }, [company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dto: UpdateCompanyAccessDto = {
        accessStatus,
        accessStartDate: accessStatus === "time_limited" && startDate ? startDate.toISOString() : undefined,
        accessExpiryDate: accessStatus === "time_limited" && expiryDate ? expiryDate.toISOString() : undefined,
      };
      await onSave(dto);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Shield className="h-5 w-5 text-primary" />
            Manage Login Access
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure access control and validity period for <strong className="text-foreground">{company.companyName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Access status selector */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold">Access Mode</Label>
            <RadioGroup
              value={accessStatus}
              onValueChange={(val: any) => setAccessStatus(val)}
              className="space-y-2"
            >
              <div
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  accessStatus === "enabled"
                    ? "border-emerald-500/50 bg-emerald-500/5 shadow-xs"
                    : "border-border/70 hover:bg-muted/30"
                }`}
              >
                <RadioGroupItem value="enabled" id="access-enabled" className="mt-0.5" />
                <div onClick={() => setAccessStatus("enabled")} className="flex-1 cursor-pointer">
                  <Label htmlFor="access-enabled" className="font-bold text-sm cursor-pointer flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <Shield className="h-4 w-4" /> Permanent Access Enabled
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Users of this company can log in at any time without restriction.
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  accessStatus === "time_limited"
                    ? "border-amber-500/50 bg-amber-500/5 shadow-xs"
                    : "border-border/70 hover:bg-muted/30"
                }`}
              >
                <RadioGroupItem value="time_limited" id="access-time" className="mt-0.5" />
                <div onClick={() => setAccessStatus("time_limited")} className="flex-1 cursor-pointer">
                  <Label htmlFor="access-time" className="font-bold text-sm cursor-pointer flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <Clock className="h-4 w-4" /> Time-Limited Access
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Access is allowed only between specified start and expiry dates.
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  accessStatus === "disabled"
                    ? "border-red-500/50 bg-red-500/5 shadow-xs"
                    : "border-border/70 hover:bg-muted/30"
                }`}
              >
                <RadioGroupItem value="disabled" id="access-disabled" className="mt-0.5" />
                <div onClick={() => setAccessStatus("disabled")} className="flex-1 cursor-pointer">
                  <Label htmlFor="access-disabled" className="font-bold text-sm cursor-pointer flex items-center gap-1.5 text-red-700 dark:text-red-400">
                    <ShieldOff className="h-4 w-4" /> Access Disabled
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All users of this company are blocked from logging into the platform.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Date pickers for time_limited */}
          {accessStatus === "time_limited" && (
            <div className="space-y-3 p-3 rounded-xl bg-muted/40 border border-border/60">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Trial Duration Presets
                </Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: "7 Days", days: 7 },
                    { label: "15 Days", days: 15 },
                    { label: "30 Days (Default)", days: 30 },
                    { label: "60 Days", days: 60 },
                    { label: "90 Days", days: 90 },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2 font-semibold"
                      onClick={() => {
                        const baseStart = startDate || new Date();
                        setStartDate(baseStart);
                        setExpiryDate(new Date(baseStart.getTime() + preset.days * 24 * 60 * 60 * 1000));
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs font-normal justify-start text-left"
                    >
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                      {startDate ? format(startDate, "dd MMM yyyy") : "Pick start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Expiry Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs font-normal justify-start text-left"
                    >
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                      {expiryDate ? format(expiryDate, "dd MMM yyyy") : "Pick expiry date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarPicker
                      mode="single"
                      selected={expiryDate}
                      onSelect={setExpiryDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5 font-bold" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Access Controls"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
