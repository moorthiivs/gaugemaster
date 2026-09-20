import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ShieldCheck, Cpu, KeyRound, CheckCircle2, AlertCircle, Loader2, RefreshCw, Eye, EyeOff } from "lucide-react";
import httpClient from "@/lib/httpClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AiConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    maskedKey: string;
    defaultModel: string;
    enabled: boolean;
  }>({
    configured: false,
    maskedKey: "",
    defaultModel: "gemini-3.5-flash-lite",
    enabled: true,
  });

  const [inputApiKey, setInputApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-3.5-flash-lite");
  const [enabled, setEnabled] = useState(true);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    latencyMs?: number;
    model?: string;
  } | null>(null);

  // Fetch AI configuration status on mount
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await httpClient.get("/ai/status");
      if (res.data) {
        setAiStatus(res.data);
        setSelectedModel(res.data.defaultModel || "gemini-3.5-flash-lite");
        setEnabled(res.data.enabled !== false);
      }
    } catch (err: any) {
      console.error("Failed to fetch AI configuration status", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTestConnection = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);

      const payload: any = {
        model: selectedModel,
      };
      if (inputApiKey.trim()) {
        payload.apiKeyOverride = inputApiKey.trim();
      }

      const res = await httpClient.post("/ai/test-connection", payload);
      setTestResult({
        success: true,
        message: res.data.message || "Connection successful!",
        latencyMs: res.data.latencyMs,
        model: res.data.model,
      });

      toast({
        title: "AI Gateway Connected",
        description: `Successfully reached Google Gemini Cloud (${res.data.latencyMs}ms latency).`,
      });
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message || err.message || "Failed to reach Google Gemini API";
      setTestResult({
        success: false,
        message: errMsg,
      });
      toast({
        title: "Connection Failed",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload: any = {
        defaultModel: selectedModel,
        enabled,
      };

      if (inputApiKey.trim()) {
        payload.apiKey = inputApiKey.trim();
      }

      await httpClient.post("/ai/config", payload);

      toast({
        title: "AI Configuration Saved",
        description: "Company AI Gateway settings have been securely updated.",
      });

      setInputApiKey("");
      setShowKeyInput(false);
      await fetchStatus();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Failed to save configuration";
      toast({
        title: "Save Failed",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Enterprise Security Banner */}
      <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-primary/5 to-transparent shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  AI & Copilot Gateway
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[10px] font-semibold">
                    <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" />
                    Zero-Exposure Gateway
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Centralized, tenant-isolated Google Gemini integration for ISO/IEC 17025 template synthesis and Copilot operations.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              className="h-8 text-xs gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="p-3 rounded-xl bg-background/80 border text-xs space-y-1.5 leading-relaxed text-muted-foreground">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Enterprise Zero-Risk Architecture:</strong> The Gemini API key is stored exclusively inside the PostgreSQL database on your private server. Browser workstations, client cookies, and JavaScript DevTools <strong>never</strong> hold or expose the raw API key.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Cpu className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Dual-Engine Resilience:</strong> All authorized engineers can use Copilot globally without entering keys. If the server or internet is unavailable, the system automatically runs the local deterministic metrology engine offline.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            Company API Credentials & Model Selection
          </CardTitle>
          <CardDescription className="text-xs">
            Configure the Google Gemini API key used by all users across your company.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Active Status Badge */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/30">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  aiStatus.configured
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                }`}
              />
              <div>
                <p className="text-sm font-semibold">
                  {aiStatus.configured ? "AI Gateway Configured & Active" : "No API Key Configured"}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {aiStatus.configured ? aiStatus.maskedKey : "AI features are operating in local offline engine fallback."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={aiStatus.configured ? "default" : "secondary"} className="text-xs">
                {aiStatus.configured ? "Cloud AI Ready" : "Local Engine Fallback"}
              </Badge>
            </div>
          </div>

          {/* Enable / Disable Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl border">
            <div className="space-y-0.5">
              <Label htmlFor="ai-enabled" className="text-sm font-medium">Enable Cloud AI Features</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, engineers can generate templates from documents and receive Copilot assistance.
              </p>
            </div>
            <Switch
              id="ai-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {/* Model Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="model-select" className="text-xs font-semibold">Primary Gemini Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger id="model-select" className="h-9">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini-3.5-flash-lite">
                  Gemini 3.5 Flash Lite (Recommended — Ultra-Fast & High Quota)
                </SelectItem>
                <SelectItem value="gemini-3.1-flash-lite">
                  Gemini 3.1 Flash Lite (High-Speed Lightweight)
                </SelectItem>
                <SelectItem value="gemini-3.8-flash">
                  Gemini 3.8 Flash (Deep Multimodal Reasoning)
                </SelectItem>
                <SelectItem value="gemini-3.5-flash">
                  Gemini 3.5 Flash (Balanced Performance)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              The AI Gateway automatically cascades through fallback models if Google returns rate-limit (429) warnings.
            </p>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="api-key" className="text-xs font-semibold">
                {aiStatus.configured ? "Update Google Gemini API Key" : "Google Gemini API Key"}
              </Label>
              {aiStatus.configured && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className="h-6 text-[11px] text-primary gap-1 cursor-pointer"
                >
                  {showKeyInput ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showKeyInput ? "Cancel Key Change" : "Change Key"}
                </Button>
              )}
            </div>

            {(!aiStatus.configured || showKeyInput) && (
              <div className="space-y-1.5">
                <Input
                  id="api-key"
                  type="password"
                  value={inputApiKey}
                  onChange={(e) => setInputApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="font-mono text-xs h-9"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  Get a free production key at{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline hover:text-primary/80"
                  >
                    Google AI Studio
                  </a>
                  . Keys are masked immediately upon saving.
                </p>
              </div>
            )}
          </div>

          {/* Test Connection Results */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  : "bg-destructive/10 border-destructive/30 text-destructive dark:text-destructive"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-semibold">
                  {testResult.success
                    ? `Gateway Connection Verified (${testResult.model})`
                    : "Gateway Connection Error"}
                </p>
                <p>{testResult.message}</p>
                {testResult.latencyMs !== undefined && (
                  <p className="text-[10.5px] font-mono opacity-80">
                    Roundtrip Latency: {testResult.latencyMs}ms
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting || isSaving || (!aiStatus.configured && !inputApiKey.trim())}
              className="gap-1.5 h-8 text-xs cursor-pointer"
            >
              {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Test Connection
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || isTesting}
              className="gap-1.5 h-8 text-xs font-semibold cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
