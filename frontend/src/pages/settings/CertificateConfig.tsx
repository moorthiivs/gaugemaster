import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, FileText, ShieldCheck, Loader2, Palette, Upload, Image as ImageIcon, X } from "lucide-react";
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
  headerCompanyName: "ACME ENTERPRISES",
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
                placeholder="ACME ENTERPRISES"
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
                      src={`${import.meta.env.VITE_API_BASE_URL || ''}${config.companyLogoPath}`}
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
                        src={`${import.meta.env.VITE_API_BASE_URL || ''}${config.companyLogoPath}`}
                        alt=""
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                  {(config.headerDisplayMode === "name" || config.headerDisplayMode === "both") && (
                    <span className="text-xs font-bold uppercase">{config.headerCompanyName || "ACME ENTERPRISES"}</span>
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
