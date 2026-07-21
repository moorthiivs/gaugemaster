import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, FileText, ShieldCheck, Loader2 } from "lucide-react";
import httpClient from "@/lib/httpClient";

interface CertConfig {
  certPrefix: string;
  certSeparator: string;
  certYearFormat: string;
  certSeqLength: number;
  certNextSeq: number;
  ulrPrefix: string;
  ulrSeparator: string;
  ulrYearFormat: string;
  ulrSeqLength: number;
  ulrNextSeq: number;
}

const DEFAULTS: CertConfig = {
  certPrefix: "CAL/CERT",
  certSeparator: "/",
  certYearFormat: "YYYY",
  certSeqLength: 5,
  certNextSeq: 0,
  ulrPrefix: "ULR",
  ulrSeparator: "/",
  ulrYearFormat: "YYYY",
  ulrSeqLength: 5,
  ulrNextSeq: 0,
};

export default function CertificateConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<CertConfig>({ ...DEFAULTS });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id || !user?.companyId) return;
    setLoading(true);
    httpClient
      .get("/settings", { params: { userId: user.id, companyId: user.companyId } })
      .then((res) => {
        const existing = res.data?.certificateConfig;
        if (existing) {
          setConfig({ ...DEFAULTS, ...existing });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id, user?.companyId]);

  const handleSave = async () => {
    if (!user?.id || !user?.companyId) return;
    setSaving(true);
    try {
      await httpClient.post("/settings", {
        userId: user.id,
        companyId: user.companyId,
        certificateConfig: config,
      });
      toast.success("Certificate configuration saved!");
    } catch {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const previewCert = () => {
    const year = config.certYearFormat === "YY"
      ? String(new Date().getFullYear()).slice(-2)
      : String(new Date().getFullYear());
    const seq = String((config.certNextSeq || 0) + 1).padStart(config.certSeqLength, "0");
    return `${config.certPrefix}${config.certSeparator}${year}${config.certSeparator}${seq}`;
  };

  const previewUlr = () => {
    const year = config.ulrYearFormat === "YY"
      ? String(new Date().getFullYear()).slice(-2)
      : String(new Date().getFullYear());
    const seq = String((config.ulrNextSeq || 0) + 1).padStart(config.ulrSeqLength, "0");
    return `${config.ulrPrefix}${config.ulrSeparator}${year}${config.ulrSeparator}${seq}`;
  };

  const update = (field: keyof CertConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Certificate Number Format */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-base">Certificate Number Format</CardTitle>
              <CardDescription className="text-xs">Configure how certificate numbers are generated</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Prefix</Label>
              <Input
                value={config.certPrefix}
                onChange={(e) => update("certPrefix", e.target.value)}
                placeholder="CAL/CERT"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Separator</Label>
              <Select value={config.certSeparator} onValueChange={(v) => update("certSeparator", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="/">/</SelectItem>
                  <SelectItem value="-">-</SelectItem>
                  <SelectItem value="_">_</SelectItem>
                  <SelectItem value=".">.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Year Format</Label>
              <Select value={config.certYearFormat} onValueChange={(v) => update("certYearFormat", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YYYY">YYYY (2026)</SelectItem>
                  <SelectItem value="YY">YY (26)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sequence Digits</Label>
              <Select value={String(config.certSeqLength)} onValueChange={(v) => update("certSeqLength", parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 digits (001)</SelectItem>
                  <SelectItem value="4">4 digits (0001)</SelectItem>
                  <SelectItem value="5">5 digits (00001)</SelectItem>
                  <SelectItem value="6">6 digits (000001)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <p className="text-xs text-muted-foreground mb-1">Next Certificate Number Preview</p>
            <p className="text-lg font-mono font-bold text-primary tracking-wider">{previewCert()}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Current sequence: {config.certNextSeq || 0} issued
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ULR Number Format */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <CardTitle className="text-base">ULR Number Format</CardTitle>
              <CardDescription className="text-xs">Configure how ULR (Unique Lab Reference) numbers are generated</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Prefix</Label>
              <Input
                value={config.ulrPrefix}
                onChange={(e) => update("ulrPrefix", e.target.value)}
                placeholder="ULR"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Separator</Label>
              <Select value={config.ulrSeparator} onValueChange={(v) => update("ulrSeparator", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="/">/</SelectItem>
                  <SelectItem value="-">-</SelectItem>
                  <SelectItem value="_">_</SelectItem>
                  <SelectItem value=".">.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Year Format</Label>
              <Select value={config.ulrYearFormat} onValueChange={(v) => update("ulrYearFormat", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YYYY">YYYY (2026)</SelectItem>
                  <SelectItem value="YY">YY (26)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sequence Digits</Label>
              <Select value={String(config.ulrSeqLength)} onValueChange={(v) => update("ulrSeqLength", parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 digits (001)</SelectItem>
                  <SelectItem value="4">4 digits (0001)</SelectItem>
                  <SelectItem value="5">5 digits (00001)</SelectItem>
                  <SelectItem value="6">6 digits (000001)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4">
            <p className="text-xs text-muted-foreground mb-1">Next ULR Number Preview</p>
            <p className="text-lg font-mono font-bold text-emerald-600 tracking-wider">{previewUlr()}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Current sequence: {config.ulrNextSeq || 0} issued
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[180px]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
