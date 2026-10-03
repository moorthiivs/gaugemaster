import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, FileText, ShieldCheck, Loader2, Palette, Upload, Image as ImageIcon, X, Type, RotateCcw } from "lucide-react";
import httpClient, { API_URL } from "@/lib/httpClient";

interface CertConfig {
  certPrefix: string;
  certSeparator: string;
  certYearFormat: string;
  certSeqLength: number;
  certNextSeq: number;
  certResetFrequency?: 'never' | 'monthly' | 'yearly' | 'financial_year' | 'custom';
  certCustomResetMonths?: number;
  certStartSeq?: number;
  certLastResetPeriod?: string;
  ulrPrefix: string;
  ulrSeparator: string;
  ulrYearFormat: string;
  ulrSeqLength: number;
  ulrNextSeq: number;
  ulrResetFrequency?: 'never' | 'monthly' | 'yearly' | 'financial_year' | 'custom';
  ulrCustomResetMonths?: number;
  ulrStartSeq?: number;
  ulrLastResetPeriod?: string;
  headerCompanyName: string;
  headerCompanySubtitle: string;
  headerRightBoxText1: string;
  headerRightBoxText2: string;
  footerLine1: string;
  footerLine2: string;
  footerLine3: string;
  // Appearance
  borderColor: string;
  headerBgColor?: string;
  headerDisplayMode: string;
  companyLogoPath: string;
  // Typography & Font Sizes (pt)
  titleFontSize?: number;
  tableHeaderFontSize?: number;
  contentFontSize?: number;
  labelFontSize?: number;
  valueFontSize?: number;
  signatureFontSize?: number;
  // Layout, Spacing & Signature Dimensions (pt)
  signatureImageWidth?: number;
  signatureImageHeight?: number;
  tableGap?: number;
}

const DEFAULTS: CertConfig = {
  certPrefix: "CAL/CERT",
  certSeparator: "/",
  certYearFormat: "YYYY",
  certSeqLength: 5,
  certNextSeq: 0,
  certResetFrequency: "never",
  certCustomResetMonths: 1,
  certStartSeq: 0,
  certLastResetPeriod: "",
  ulrPrefix: "ULR",
  ulrSeparator: "/",
  ulrYearFormat: "YYYY",
  ulrSeqLength: 5,
  ulrNextSeq: 0,
  ulrResetFrequency: "never",
  ulrCustomResetMonths: 1,
  ulrStartSeq: 0,
  ulrLastResetPeriod: "",
  headerCompanyName: "Company Name",
  headerCompanySubtitle: "(CALIBRATION LABORATORY)",
  headerRightBoxText1: "NABL / LAB",
  headerRightBoxText2: "CC - 2632",
  footerLine1: "CALIBRATION CENTER :",
  footerLine2: "Laboratory Address, Behind Main Road, Industrial Zone, State - 440024.",
  footerLine3: "Website: www.gaugemaster.com | Email: info@gaugemaster.com | Phone: +91 98222 23948",
  borderColor: "#0369a1",
  headerBgColor: "#54c6f3",
  headerDisplayMode: "name",
  companyLogoPath: "",
  // Typography & Font Sizes (pt)
  titleFontSize: 8.0,
  tableHeaderFontSize: 7.2,
  contentFontSize: 6.8,
  labelFontSize: 7.0,
  valueFontSize: 7.5,
  signatureFontSize: 7.0,
  // Layout, Spacing & Signature Dimensions (pt)
  signatureImageWidth: 75,
  signatureImageHeight: 28,
  tableGap: 2.5,
};

export default function CertificateConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<CertConfig>({ ...DEFAULTS });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await httpClient.post("/settings/upload-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const logoUrl = res.data?.url;
      if (logoUrl) {
        update("companyLogoPath", logoUrl);
        toast.success("Logo uploaded successfully!");
      }
    } catch {
      toast.error("Failed to upload logo");
    } finally {
      setLogoUploading(false);
      if (logoFileRef.current) logoFileRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!user?.id || !user?.companyId) return;
    setLoading(true);
    httpClient
      .get("/settings/fetchmailconfig", { params: { userId: user.id, companyId: user.companyId } })
      .then((res) => {
        const existing = res.data?.certificateConfig;
        if (existing) {
          setConfig((prev) => ({ ...prev, ...existing }));
        }
      })
      .catch((err) => console.error("Failed to load certificate settings:", err))
      .finally(() => setLoading(false));
  }, [user?.id, user?.companyId]);

  const handleSave = async () => {
    if (!user?.id || !user?.companyId) return;
    setSaving(true);
    try {
      await httpClient.post("/settings/mailconfig", {
        userId: user.id,
        companyId: user.companyId,
        certificateConfig: config,
      });
      toast.success("Certificate configuration saved!");
    } catch (err) {
      console.error("Failed to save certificate configuration:", err);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const getPeriodBadge = (freq?: string, customMonths?: number) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatDate = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

    if (freq === "monthly") {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      return {
        title: "Monthly Reset",
        dateRange: `${formatDate(startDate)} to ${formatDate(endDate)}`,
        desc: "Resets to start sequence automatically on the 1st of every month",
      };
    }
    if (freq === "yearly") {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 12, 0);
      return {
        title: "Yearly Reset",
        dateRange: `${formatDate(startDate)} to ${formatDate(endDate)}`,
        desc: "Resets to start sequence automatically on January 1st every year",
      };
    }
    if (freq === "financial_year") {
      const isAfterApril = month >= 3;
      const fyStart = isAfterApril ? year : year - 1;
      const fyEnd = fyStart + 1;
      const startDate = new Date(fyStart, 3, 1);
      const endDate = new Date(fyEnd, 3, 0);
      return {
        title: `Financial Year Reset (FY ${fyStart}-${fyEnd})`,
        dateRange: `${formatDate(startDate)} to ${formatDate(endDate)}`,
        desc: "Resets to start sequence automatically on April 1st every financial year",
      };
    }
    if (freq === "custom") {
      const interval = Math.max(1, customMonths || 1);
      let startDate: Date;
      let endDate: Date;

      if (interval <= 12) {
        const pIdx = Math.floor(month / interval);
        const sMonth = pIdx * interval;
        startDate = new Date(year, sMonth, 1);
        endDate = new Date(year, sMonth + interval, 0);
      } else {
        const baseYear = 2026;
        const totalMonths = (year - baseYear) * 12 + month;
        const pIdx = Math.floor(totalMonths / interval);
        const startTotalMonths = pIdx * interval;
        startDate = new Date(baseYear, startTotalMonths, 1);
        endDate = new Date(baseYear, startTotalMonths + interval, 0);
      }

      let durationText = `${interval} month(s)`;
      if (interval >= 12) {
        const yrs = Math.floor(interval / 12);
        const rem = interval % 12;
        if (rem === 0) {
          durationText = `${interval} months (${yrs} ${yrs === 1 ? "year" : "years"})`;
        } else {
          durationText = `${interval} months (${yrs} ${yrs === 1 ? "yr" : "yrs"} ${rem} ${rem === 1 ? "mo" : "mos"})`;
        }
      }

      return {
        title: `Custom Reset (Every ${interval} Months)`,
        dateRange: `${formatDate(startDate)} to ${formatDate(endDate)}`,
        desc: `Resets automatically every ${durationText}`,
      };
    }
    return {
      title: "Continuous (Never Reset)",
      dateRange: "All time continuous sequence",
      desc: "Sequence increments continuously without resetting",
    };
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

  const certPeriodInfo = getPeriodBadge(config.certResetFrequency, config.certCustomResetMonths);
  const ulrPeriodInfo = getPeriodBadge(config.ulrResetFrequency, config.ulrCustomResetMonths);

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
              <CardDescription className="text-xs">Configure how certificate numbers are generated and reset</CardDescription>
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

          {/* Reset Options Row */}
          <div className="pt-3 border-t border-border/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sequence Reset Frequency</Label>
              <Select
                value={config.certResetFrequency || "never"}
                onValueChange={(v: any) => update("certResetFrequency", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Continuous (Never Reset)</SelectItem>
                  <SelectItem value="monthly">Monthly Reset (01 to end of month)</SelectItem>
                  <SelectItem value="yearly">Yearly Reset (Once a Year, Jan 1)</SelectItem>
                  <SelectItem value="financial_year">Financial Year (Apr 1 - Mar 31)</SelectItem>
                  <SelectItem value="custom">Custom Interval (Every N Months)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.certResetFrequency === "custom" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Custom Interval (Months)</Label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {(config.certCustomResetMonths ?? 1) >= 12
                      ? `${Math.floor((config.certCustomResetMonths ?? 1) / 12)}y ${(config.certCustomResetMonths ?? 1) % 12}m`
                      : `${config.certCustomResetMonths ?? 1} mo`}
                  </span>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={config.certCustomResetMonths ?? 1}
                  onChange={(e) => update("certCustomResetMonths", Math.min(120, Math.max(1, parseInt(e.target.value) || 1)))}
                  placeholder="e.g. 3 for quarterly"
                />
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {[
                    { label: "1M", val: 1 },
                    { label: "2M", val: 2 },
                    { label: "3M (Q)", val: 3 },
                    { label: "6M (Half)", val: 6 },
                    { label: "12M (1Y)", val: 12 },
                    { label: "24M (2Y)", val: 24 },
                    { label: "36M (3Y)", val: 36 },
                  ].map((chip) => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => update("certCustomResetMonths", chip.val)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        config.certCustomResetMonths === chip.val
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "bg-muted/50 hover:bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Sequence Base</Label>
              <Input
                type="number"
                min={0}
                value={config.certStartSeq ?? 0}
                onChange={(e) => update("certStartSeq", Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0 (starts from 1)"
              />
              <p className="text-[10px] text-muted-foreground">0 issues 0001 upon reset</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Current Sequence Counter</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  value={config.certNextSeq ?? 0}
                  onChange={(e) => update("certNextSeq", Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Current counter"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  title="Reset counter to start sequence"
                  className="h-9 px-2.5 text-xs gap-1 whitespace-nowrap text-amber-600 hover:text-amber-700"
                  onClick={() => {
                    const start = config.certStartSeq ?? 0;
                    update("certNextSeq", start);
                    toast.success(`Certificate sequence counter reset to ${start}. Click Save to apply.`);
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Issued count in active period</p>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Next Certificate Number Preview</p>
                <p className="text-xl font-mono font-bold text-primary tracking-wider">{previewCert()}</p>
              </div>
              <div className="sm:text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  {certPeriodInfo.title}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{certPeriodInfo.dateRange}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-primary/10 text-[11px] text-muted-foreground gap-1">
              <span>{certPeriodInfo.desc}</span>
              <span className="font-mono font-semibold text-foreground">
                Current sequence: {config.certNextSeq || 0} issued
              </span>
            </div>
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
              <CardDescription className="text-xs">Configure how ULR (Unique Lab Reference) numbers are generated and reset</CardDescription>
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

          {/* ULR Reset Options Row */}
          <div className="pt-3 border-t border-border/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sequence Reset Frequency</Label>
              <Select
                value={config.ulrResetFrequency || "never"}
                onValueChange={(v: any) => update("ulrResetFrequency", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Continuous (Never Reset)</SelectItem>
                  <SelectItem value="monthly">Monthly Reset (01 to end of month)</SelectItem>
                  <SelectItem value="yearly">Yearly Reset (Once a Year, Jan 1)</SelectItem>
                  <SelectItem value="financial_year">Financial Year (Apr 1 - Mar 31)</SelectItem>
                  <SelectItem value="custom">Custom Interval (Every N Months)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.ulrResetFrequency === "custom" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Custom Interval (Months)</Label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {(config.ulrCustomResetMonths ?? 1) >= 12
                      ? `${Math.floor((config.ulrCustomResetMonths ?? 1) / 12)}y ${(config.ulrCustomResetMonths ?? 1) % 12}m`
                      : `${config.ulrCustomResetMonths ?? 1} mo`}
                  </span>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={config.ulrCustomResetMonths ?? 1}
                  onChange={(e) => update("ulrCustomResetMonths", Math.min(120, Math.max(1, parseInt(e.target.value) || 1)))}
                  placeholder="e.g. 3 for quarterly"
                />
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  {[
                    { label: "1M", val: 1 },
                    { label: "2M", val: 2 },
                    { label: "3M (Q)", val: 3 },
                    { label: "6M (Half)", val: 6 },
                    { label: "12M (1Y)", val: 12 },
                    { label: "24M (2Y)", val: 24 },
                    { label: "36M (3Y)", val: 36 },
                  ].map((chip) => (
                    <button
                      key={chip.val}
                      type="button"
                      onClick={() => update("ulrCustomResetMonths", chip.val)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        config.ulrCustomResetMonths === chip.val
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "bg-muted/50 hover:bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Sequence Base</Label>
              <Input
                type="number"
                min={0}
                value={config.ulrStartSeq ?? 0}
                onChange={(e) => update("ulrStartSeq", Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0 (starts from 1)"
              />
              <p className="text-[10px] text-muted-foreground">0 issues 0001 upon reset</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Current Sequence Counter</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  value={config.ulrNextSeq ?? 0}
                  onChange={(e) => update("ulrNextSeq", Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Current counter"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  title="Reset ULR counter to start sequence"
                  className="h-9 px-2.5 text-xs gap-1 whitespace-nowrap text-amber-600 hover:text-amber-700"
                  onClick={() => {
                    const start = config.ulrStartSeq ?? 0;
                    update("ulrNextSeq", start);
                    toast.success(`ULR sequence counter reset to ${start}. Click Save to apply.`);
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Issued count in active period</p>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Next ULR Number Preview</p>
                <p className="text-xl font-mono font-bold text-emerald-600 tracking-wider">{previewUlr()}</p>
              </div>
              <div className="sm:text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {ulrPeriodInfo.title}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{ulrPeriodInfo.dateRange}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-emerald-500/10 text-[11px] text-muted-foreground gap-1">
              <span>{ulrPeriodInfo.desc}</span>
              <span className="font-mono font-semibold text-foreground">
                Current sequence: {config.ulrNextSeq || 0} issued
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificate Header Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-600" />
            <div>
              <CardTitle className="text-base">Certificate Header Settings</CardTitle>
              <CardDescription className="text-xs">Customize the header text of the calibration certificate</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Company Name</Label>
              <Input
                value={config.headerCompanyName}
                onChange={(e) => update("headerCompanyName", e.target.value)}
                placeholder="Company Name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company Subtitle</Label>
              <Input
                value={config.headerCompanySubtitle}
                onChange={(e) => update("headerCompanySubtitle", e.target.value)}
                placeholder="(CALIBRATION LABORATORY)"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Top Right Box (Line 1)</Label>
              <Input
                value={config.headerRightBoxText1}
                onChange={(e) => update("headerRightBoxText1", e.target.value)}
                placeholder="NABL / LAB"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Top Right Box (Line 2)</Label>
              <Input
                value={config.headerRightBoxText2}
                onChange={(e) => update("headerRightBoxText2", e.target.value)}
                placeholder="CC - 2632"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificate Footer Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-600" />
            <div>
              <CardTitle className="text-base">Certificate Footer Settings</CardTitle>
              <CardDescription className="text-xs">Customize the footer text of the calibration certificate</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Footer Line 1 (Heading)</Label>
              <Input
                value={config.footerLine1}
                onChange={(e) => update("footerLine1", e.target.value)}
                placeholder="CALIBRATION CENTER :"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Footer Line 2 (Address)</Label>
              <Input
                value={config.footerLine2}
                onChange={(e) => update("footerLine2", e.target.value)}
                placeholder="Laboratory Address, Behind Main Road, Industrial Zone, State - 440024."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Footer Line 3 (Contact Info)</Label>
              <Input
                value={config.footerLine3}
                onChange={(e) => update("footerLine3", e.target.value)}
                placeholder="Website: www.gaugemaster.com | Email: info@gaugemaster.com | Phone: +91 98222 23948"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificate Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-violet-600" />
            <div>
              <CardTitle className="text-base">Certificate Appearance</CardTitle>
              <CardDescription className="text-xs">Customize colors, logo, and header display of the certificate</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Border Color */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Border Accent Color</Label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="color"
                  value={config.borderColor}
                  onChange={(e) => update("borderColor", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5"
                />
              </div>
              <Input
                value={config.borderColor}
                onChange={(e) => update("borderColor", e.target.value)}
                placeholder="#0369a1"
                className="w-32 font-mono text-sm"
              />
              <div className="flex-1 h-4 rounded-full" style={{ background: config.borderColor }} />
            </div>
            <p className="text-[10px] text-muted-foreground">This color is applied to the top/bottom strip borders and the title text of the certificate.</p>
          </div>

          {/* Header & Footer Banner Background Color */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Header & Footer Banner Color</Label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="color"
                  value={config.headerBgColor || "#54c6f3"}
                  onChange={(e) => update("headerBgColor", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5"
                />
              </div>
              <Input
                value={config.headerBgColor || "#54c6f3"}
                onChange={(e) => update("headerBgColor", e.target.value)}
                placeholder="#54c6f3"
                className="w-32 font-mono text-sm"
              />
              <div className="flex-1 h-4 rounded-full" style={{ background: config.headerBgColor || "#54c6f3" }} />
            </div>
            <p className="text-[10px] text-muted-foreground">This color is applied as the background color for both the top header banner and bottom footer banner of the certificate.</p>
          </div>

          {/* Header Display Mode */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Header Display Mode</Label>
            <Select value={config.headerDisplayMode} onValueChange={(v) => update("headerDisplayMode", v)}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Company Name Only</SelectItem>
                <SelectItem value="logo">Logo Only</SelectItem>
                <SelectItem value="both">Logo + Company Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Logo Upload */}
          {(config.headerDisplayMode === "logo" || config.headerDisplayMode === "both") && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Company Logo</Label>
              {config.companyLogoPath ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img
                      src={`${(import.meta.env.VITE_API_BASE_URL || API_URL || '').replace(/\/api\/?$/, '')}${config.companyLogoPath}`}
                      alt="Company Logo"
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => logoFileRef.current?.click()}
                      disabled={logoUploading}
                    >
                      {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Change Logo
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => update("companyLogoPath", "")}
                    >
                      <X className="w-3.5 h-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center w-full h-28 rounded-lg border-2 border-dashed border-border hover:border-primary/40 bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => logoFileRef.current?.click()}
                >
                  {logoUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-muted-foreground/50 mb-1" />
                      <span className="text-xs text-muted-foreground">Click to upload company logo</span>
                      <span className="text-[10px] text-muted-foreground/60">PNG, JPG, WEBP — Max 2MB</span>
                    </>
                  )}
                </div>
              )}
              <input
                ref={logoFileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          )}

          {/* Live Preview */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Preview</Label>
            <div className="rounded-lg border border-black overflow-hidden shadow-sm">
              {/* Header Banner */}
              <div className="p-3 flex items-center justify-between text-black" style={{ backgroundColor: config.headerBgColor || "#54c6f3" }}>
                <div className="flex items-center gap-2">
                  {config.companyLogoPath && (config.headerDisplayMode === "logo" || config.headerDisplayMode === "both") && (
                    <div className="w-8 h-8 rounded bg-white/30 flex items-center justify-center overflow-hidden">
                      <img
                        src={`${(import.meta.env.VITE_API_BASE_URL || API_URL || '').replace(/\/api\/?$/, '')}${config.companyLogoPath}`}
                        alt=""
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  {(config.headerDisplayMode === "name" || config.headerDisplayMode === "both") && (
                    <span className="text-xs font-bold uppercase">{config.headerCompanyName || "Company Name"}</span>
                  )}
                </div>
                <span className="text-sm font-extrabold text-white tracking-wider drop-shadow-sm">CALIBRATION CERTIFICATE</span>
                <span className="text-[10px] font-bold text-right">{config.headerRightBoxText2 || "CC-2632"}</span>
              </div>
              
              {/* Body Placeholder */}
              <div className="bg-white p-4 text-center text-xs text-slate-500 font-medium">
                [ Calibration Certificate Body Content ]
              </div>
              
              {/* Footer Banner */}
              <div className="p-2.5 text-black text-center text-[10px] font-semibold border-t border-black space-y-0.5" style={{ backgroundColor: config.headerBgColor || "#54c6f3" }}>
                <div className="font-bold uppercase tracking-wide">{config.footerLine1 || "CALIBRATION CENTER :"}</div>
                <div className="text-[9px]">{config.footerLine2 || "Laboratory Address Details..."}</div>
                <div className="text-[9px]">{config.footerLine3 || "Contact Details & Website..."}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificate Typography, Spacing & Signatures */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-base">Certificate Typography, Spacing & Signatures (pt)</CardTitle>
                <CardDescription className="text-xs">
                  Customize font sizes, table margins/gaps, and signature image dimensions across the certificate. Increase sizes for better visibility, or adjust table spacing to fit single page requirements.
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => {
                setConfig((prev) => ({
                  ...prev,
                  titleFontSize: 8.0,
                  tableHeaderFontSize: 7.2,
                  contentFontSize: 6.8,
                  labelFontSize: 7.0,
                  valueFontSize: 7.5,
                  signatureFontSize: 7.0,
                  signatureImageWidth: 75,
                  signatureImageHeight: 28,
                  tableGap: 2.5,
                }));
                toast.info("Typography and spacing reset to standard defaults");
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Defaults
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Header / Section Title Size (pt)</Label>
              <Input
                type="number"
                step="0.1"
                min="5"
                max="14"
                value={config.titleFontSize ?? 8.0}
                onChange={(e) => update("titleFontSize", parseFloat(e.target.value) || 8.0)}
                placeholder="8.0"
              />
              <p className="text-[11px] text-muted-foreground">e.g. Description & Identification, Traceability headers</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Table Column Headers Size (pt)</Label>
              <Input
                type="number"
                step="0.1"
                min="5"
                max="12"
                value={config.tableHeaderFontSize ?? 7.2}
                onChange={(e) => update("tableHeaderFontSize", parseFloat(e.target.value) || 7.2)}
                placeholder="7.2"
              />
              <p className="text-[11px] text-muted-foreground">e.g. Procedure, Standard Ref, Master Used columns</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Content & Data Size (pt)</Label>
              <Input
                type="number"
                step="0.1"
                min="5"
                max="12"
                value={config.contentFontSize ?? 6.8}
                onChange={(e) => update("contentFontSize", parseFloat(e.target.value) || 6.8)}
                placeholder="6.8"
              />
              <p className="text-[11px] text-muted-foreground">e.g. Table cell data, environmental details, results</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Field Label Size (pt)</Label>
              <Input
                type="number"
                step="0.1"
                min="5"
                max="12"
                value={config.labelFontSize ?? 7.0}
                onChange={(e) => update("labelFontSize", parseFloat(e.target.value) || 7.0)}
                placeholder="7.0"
              />
              <p className="text-[11px] text-muted-foreground">e.g. "Instrument (DUC)", "Make", "Model No.", "ID No."</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Field Value Size (pt)</Label>
              <Input
                type="number"
                step="0.1"
                min="5"
                max="12"
                value={config.valueFontSize ?? 7.5}
                onChange={(e) => update("valueFontSize", parseFloat(e.target.value) || 7.5)}
                placeholder="7.5"
              />
              <p className="text-[11px] text-muted-foreground">e.g. Instrument name, serial number, make text</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Signature Text Size (pt)</Label>
              <Input
                type="number"
                step="0.1"
                min="5"
                max="12"
                value={config.signatureFontSize ?? 7.0}
                onChange={(e) => update("signatureFontSize", parseFloat(e.target.value) || 7.0)}
                placeholder="7.0"
              />
              <p className="text-[11px] text-muted-foreground">e.g. Calibrated By, Authorized By, Engineer titles</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Signature Image Width (pt)</Label>
              <Input
                type="number"
                step="1"
                min="30"
                max="150"
                value={config.signatureImageWidth ?? 75}
                onChange={(e) => update("signatureImageWidth", parseFloat(e.target.value) || 75)}
                placeholder="75"
              />
              <p className="text-[11px] text-muted-foreground">Width boundary for signature & stamp images</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Signature Image Height (pt)</Label>
              <Input
                type="number"
                step="1"
                min="15"
                max="60"
                value={config.signatureImageHeight ?? 28}
                onChange={(e) => update("signatureImageHeight", parseFloat(e.target.value) || 28)}
                placeholder="28"
              />
              <p className="text-[11px] text-muted-foreground">Height boundary for signature & stamp images</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Table Gap / Spacing (pt)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="15"
                value={config.tableGap ?? 2.5}
                onChange={(e) => update("tableGap", e.target.value === "" ? 2.5 : parseFloat(e.target.value))}
                placeholder="2.5"
              />
              <p className="text-[11px] text-muted-foreground">Margin / gap below each table from Description to Results</p>
            </div>
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
