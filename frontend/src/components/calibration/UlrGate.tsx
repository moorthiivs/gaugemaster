import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, FileText, ShieldAlert, ShieldCheck } from "lucide-react";

interface UlrGateProps {
  ulrEnabled: boolean;
  onUlrEnabledChange: (enabled: boolean) => void;
  nextUlrNumber: string;
  nextCertNumber: string;
  certificateGenerated: boolean;
  onGenerateCertificate: () => void;
  onPrint: () => void;
  loading?: boolean;
}

/**
 * ULR Number gate component — controls whether certificate generation is allowed.
 * When ULR is enabled, generates a ULR number and enables certificate buttons.
 * When disabled, shows a message and disables certificate buttons.
 */
export function UlrGate({
  ulrEnabled,
  onUlrEnabledChange,
  nextUlrNumber,
  nextCertNumber,
  certificateGenerated,
  onGenerateCertificate,
  onPrint,
  loading,
}: UlrGateProps) {
  return (
    <div className="space-y-5">
      {/* Certificate Number Preview */}
      <Card className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="w-5 h-5 text-primary" />
          <h4 className="font-semibold text-sm">Certificate Number</h4>
        </div>
        <p className="font-mono text-lg font-bold text-primary tracking-wide">{nextCertNumber}</p>
        <p className="text-[11px] text-muted-foreground mt-1">This number is auto-generated based on your certificate configuration.</p>
      </Card>

      {/* ULR Number Toggle */}
      <Card className={`p-4 transition-all duration-300 ${
        ulrEnabled
          ? "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-300 dark:border-emerald-700"
          : "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-300 dark:border-amber-700"
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {ulrEnabled ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            )}
            <h4 className="font-semibold text-sm">ULR Number</h4>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">
              {ulrEnabled ? "Enabled" : "Disabled"}
            </Label>
          </div>
        </div>

        {ulrEnabled ? (
          <div>
            <p className="font-mono text-lg font-bold text-emerald-600 tracking-wide">{nextUlrNumber}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              ULR number will be assigned to this calibration and included in the certificate.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
              ULR Number will not be included in the certificate.
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Toggle the switch above if you wish to generate a ULR Number.
            </p>
          </div>
        )}
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={onGenerateCertificate}
          disabled={loading}
          className="flex-1 gap-2"
          size="lg"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {certificateGenerated ? "Re-generate Certificate" : "Generate Certificate"}
        </Button>

        <Button
          variant="outline"
          onClick={onPrint}
          disabled={!certificateGenerated}
          className="gap-2"
          size="lg"
        >
          <Printer className="w-4 h-4" />
          Print
        </Button>
      </div>
    </div>
  );
}
