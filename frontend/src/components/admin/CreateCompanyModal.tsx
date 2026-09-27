import { useState } from "react";
import { format } from "date-fns";
import { Building2, Mail, User as UserIcon, Lock, Shield, Clock, Calendar as CalendarIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarPicker } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CreateCompanyDto } from "@/lib/superAdminActions";

interface CreateCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (dto: CreateCompanyDto) => Promise<void>;
}

export default function CreateCompanyModal({
  open,
  onOpenChange,
  onCreate,
}: CreateCompanyModalProps) {
  const [companyName, setCompanyName] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [industry, setIndustry] = useState("Manufacturing");
  const [companySize, setCompanySize] = useState("11-50 employees");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [accessStatus, setAccessStatus] = useState<"enabled" | "time_limited">("enabled");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setCompanyName("");
    setRegisteredEmail("");
    setIndustry("Manufacturing");
    setCompanySize("11-50 employees");
    setAdminName("");
    setAdminPassword("");
    setAccessStatus("enabled");
    setExpiryDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !registeredEmail.trim()) return;

    setSaving(true);
    try {
      const dto: CreateCompanyDto = {
        companyName: companyName.trim(),
        registeredEmail: registeredEmail.trim().toLowerCase(),
        industry,
        companySize,
        adminName: adminName.trim() || "Company Admin",
        adminPassword: adminPassword.trim() || "Admin@123",
        accessStatus,
        accessExpiryDate: accessStatus === "time_limited" && expiryDate ? expiryDate.toISOString() : undefined,
      };
      await onCreate(dto);
      resetForm();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Building2 className="h-5 w-5 text-primary" />
            Provision New Customer Company
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Register a new tenant company and configure its administrator and initial access controls.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Company Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Company Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-xs font-semibold">
                  Company Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="companyName"
                    placeholder="e.g. Acme Precision Lab"
                    className="pl-8 text-xs h-9"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="registeredEmail" className="text-xs font-semibold">
                  Contact / Admin Email <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="registeredEmail"
                    type="email"
                    placeholder="admin@company.com"
                    className="pl-8 text-xs h-9"
                    value={registeredEmail}
                    onChange={(e) => setRegisteredEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manufacturing">Manufacturing & Engineering</SelectItem>
                    <SelectItem value="Automotive">Automotive</SelectItem>
                    <SelectItem value="Aerospace">Aerospace & Defense</SelectItem>
                    <SelectItem value="Healthcare">Healthcare & Pharma</SelectItem>
                    <SelectItem value="Calibration Lab">Commercial Calibration Lab</SelectItem>
                    <SelectItem value="Electronics">Electronics & Semiconductors</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Company Size</Label>
                <Select value={companySize} onValueChange={setCompanySize}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10 employees">1 - 10 employees</SelectItem>
                    <SelectItem value="11-50 employees">11 - 50 employees</SelectItem>
                    <SelectItem value="51-200 employees">51 - 200 employees</SelectItem>
                    <SelectItem value="201-500 employees">201 - 500 employees</SelectItem>
                    <SelectItem value="500+ employees">500+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Initial Admin Credentials */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Initial Admin Account</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="adminName" className="text-xs font-semibold">
                  Admin Name <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <div className="relative">
                  <UserIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="adminName"
                    placeholder="Defaults to Company Admin"
                    className="pl-8 text-xs h-9"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminPassword" className="text-xs font-semibold">
                  Initial Password <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="Defaults to Admin@123"
                    className="pl-8 text-xs h-9"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Access Control */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Initial Access Mode</h3>
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
                onClick={() => setAccessStatus("enabled")}
              >
                <RadioGroupItem value="enabled" id="new-access-enabled" className="mt-0.5" />
                <div className="flex-1 cursor-pointer">
                  <Label htmlFor="new-access-enabled" className="font-bold text-xs cursor-pointer flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <Shield className="h-3.5 w-3.5" /> Permanent Enabled Access
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Standard production subscription with full, continuous platform access.
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  accessStatus === "time_limited"
                    ? "border-amber-500/50 bg-amber-500/5 shadow-xs"
                    : "border-border/70 hover:bg-muted/30"
                }`}
                onClick={() => setAccessStatus("time_limited")}
              >
                <RadioGroupItem value="time_limited" id="new-access-time" className="mt-0.5" />
                <div className="flex-1 cursor-pointer">
                  <Label htmlFor="new-access-time" className="font-bold text-xs cursor-pointer flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <Clock className="h-3.5 w-3.5" /> Trial / Time-Limited Access
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Temporary evaluation license. Access expires automatically after the trial period.
                  </p>
                </div>
              </div>
            </RadioGroup>

            {accessStatus === "time_limited" && (
              <div className="space-y-2 p-3 rounded-xl bg-muted/40 border border-border/60">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Trial Duration Presets
                </Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: "15 Days", days: 15 },
                    { label: "30 Days (Standard)", days: 30 },
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
                        setExpiryDate(new Date(Date.now() + preset.days * 24 * 60 * 60 * 1000));
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>

                <div className="pt-2">
                  <Label className="text-xs font-medium">Trial Expiry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs font-normal justify-start text-left mt-1"
                      >
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                        {expiryDate ? format(expiryDate, "dd MMM yyyy") : "Pick expiry date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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
            )}
          </div>

          <DialogFooter className="pt-3">
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
              <Plus className="h-4 w-4" />
              {saving ? "Provisioning..." : "Create Company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
