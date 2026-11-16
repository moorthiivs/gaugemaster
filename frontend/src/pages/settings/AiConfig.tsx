import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  ShieldCheck,
  Cpu,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Bot,
  Zap,
  BarChart3,
  Clock,
  Database,
  Activity,
  Check,
  Flame,
  Layers,
  Info,
  Gauge,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import httpClient from "@/lib/httpClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface UsageReport {
  quotaDate: string;
  resetAt: string;
  secondsUntilReset: number;
  hasApiKey: boolean;
  maskedKey: string;
  model: {
    id: string;
    name: string;
    tier: string;
    rateLimits: {
      rpm: number;
      tpm: number;
      rpd: number;
      contextWindow: number;
      maxOutputTokens: number;
    };
  };
  userUsage: {
    messagesUsedToday: number;
    dailyMessageLimit: number;
    messagesRemaining: number;
    percentConsumed: number;
    tokensUsedToday: number;
    dailyTokenLimit: number;
    tokensRemaining: number;
    tokenPercentConsumed: number;
    isLimitReached: boolean;
  };
  googleFreeAvailability: {
    googleDailyLimit: number;
    totalCompanyUsedToday: number;
    googleRemainingToday: number;
    googlePercentConsumed: number;
    googleRpmLimit: number;
    googleTpmLimit: number;
    totalTokensConsumedToday: number;
  };
  contextBreakdown: {
    category: string;
    count: number;
    label: string;
  }[];
  healthStatus: "optimal" | "moderate" | "near_limit" | "depleted";
}

export default function AiConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    maskedKey: string;
    defaultModel: string;
    enabled: boolean;
    floatingBotEnabled?: boolean;
  }>({
    configured: false,
    maskedKey: "",
    defaultModel: "gemini-3-flash-preview",
    enabled: true,
    floatingBotEnabled: true,
  });

  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [inputApiKey, setInputApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");
  const [enabled, setEnabled] = useState(true);
  const [floatingBotEnabled, setFloatingBotEnabled] = useState(() => {
    return localStorage.getItem("gm_floating_copilot_enabled") !== "false";
  });
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    latencyMs?: number;
    model?: string;
  } | null>(null);

  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Fetch AI configuration status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await httpClient.get("/ai/status");
      if (res.data) {
        setAiStatus(res.data);
        setSelectedModel(res.data.defaultModel || "gemini-3-flash-preview");
        setEnabled(res.data.enabled !== false);
        if (res.data.floatingBotEnabled !== undefined) {
          setFloatingBotEnabled(
            res.data.floatingBotEnabled !== false &&
              localStorage.getItem("gm_floating_copilot_enabled") !== "false"
          );
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch AI configuration status", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed usage report
  const fetchUsageReport = async () => {
    try {
      setLoadingReport(true);
      const res = await httpClient.get("/ai/usage-report");
      if (res.data) {
        setUsageReport(res.data);
      }
    } catch (err: any) {
      console.error("Failed to fetch detailed usage report", err);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchUsageReport();
  }, []);

  // Update countdown to midnight reset
  useEffect(() => {
    if (!usageReport?.resetAt) return;
    const updateCountdown = () => {
      const diffMs = new Date(usageReport.resetAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setCountdown({ hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [usageReport?.resetAt]);

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

      // Refresh telemetry after test
      fetchUsageReport();
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
        floatingBotEnabled,
      };

      if (inputApiKey.trim()) {
        payload.apiKey = inputApiKey.trim();
      }

      await httpClient.post("/ai/config", payload);

      localStorage.setItem("gm_floating_copilot_enabled", String(floatingBotEnabled));
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("copilot:toggle-floating-bot", { detail: { enabled: floatingBotEnabled } })
        );
      }

      toast({
        title: "AI Configuration Saved",
        description: "Company AI Gateway settings have been securely updated.",
      });

      setInputApiKey("");
      setShowKeyInput(false);
      await fetchStatus();
      await fetchUsageReport();
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

  const formatTokens = (tokens: number) => {
    if (!tokens && tokens !== 0) return "0";
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
    return tokens.toLocaleString();
  };

  const getHealthBadge = (healthStatus?: string) => {
    switch (healthStatus) {
      case "optimal":
        return {
          label: "Optimal Free Quota",
          badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          dotClass: "bg-emerald-500",
        };
      case "moderate":
        return {
          label: "Moderate Usage",
          badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          dotClass: "bg-blue-500",
        };
      case "near_limit":
        return {
          label: "Approaching Limit",
          badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          dotClass: "bg-amber-500",
        };
      case "depleted":
        return {
          label: "Daily Limit Reached",
          badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          dotClass: "bg-rose-500",
        };
      default:
        return {
          label: "Free Tier Active",
          badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          dotClass: "bg-emerald-500",
        };
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const health = getHealthBadge(usageReport?.healthStatus);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Enterprise Security Banner */}
      <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-primary/5 to-transparent shadow-xs rounded-2xl">
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
              onClick={() => {
                fetchStatus();
                fetchUsageReport();
              }}
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
      <Card className="rounded-2xl">
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

          {/* Global Floating Mini-Bot Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
            <div className="space-y-0.5 max-w-xl">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <Label htmlFor="floating-bot-enabled" className="text-sm font-semibold cursor-pointer">
                  Global Floating Copilot Mini-Bot
                </Label>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Display the persistent floating Metrology Copilot button across all Gaugemaster application screens for instant calibration assistance and formula auditing.
              </p>
            </div>
            <Switch
              id="floating-bot-enabled"
              checked={floatingBotEnabled}
              onCheckedChange={(val) => {
                setFloatingBotEnabled(val);
                localStorage.setItem("gm_floating_copilot_enabled", String(val));
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("copilot:toggle-floating-bot", { detail: { enabled: val } })
                  );
                }
              }}
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
                <SelectItem value="gemini-3-flash-preview">
                  Gemini 3 Flash (Recommended — Ultra-Fast ~1.9s & High Free Quota)
                </SelectItem>
                <SelectItem value="gemini-3.5-flash">
                  Gemini 3.5 Flash (Balanced Multimodal Reasoning)
                </SelectItem>
                <SelectItem value="gemini-3.6-flash">
                  Gemini 3.6 Flash (Google Recommended Production Model)
                </SelectItem>
                <SelectItem value="gemini-3.5-flash-lite">
                  Gemini 3.5 Flash Lite (Lightweight High-Throughput)
                </SelectItem>
                <SelectItem value="gemini-3.1-pro-preview">
                  Gemini 3.1 Pro (Low-Level Cost-Efficient)
                </SelectItem>
                <SelectItem value="gemini-3.1-flash-lite">
                  Gemini 3.1 Flash Lite (Ultra Lightweight)
                </SelectItem>
                <SelectItem value="gemini-3.8-flash">
                  Gemini 3.8 Flash (Deep Multimodal Reasoning)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              The AI Gateway automatically cascades through fallback models if Google returns rate-limit (429) or high-demand (503) warnings.
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

      {/* DETAILED REPORT: Gemini Model Usage & Free Availability Report (TypeUI Fundamentals) */}
      <Card className="border-border shadow-xs overflow-hidden rounded-2xl">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <CardTitle className="text-base font-bold tracking-tight">
                  Google Gemini API Usage & Free Availability Report
                </CardTitle>
                <Badge variant="outline" className={`${health.badgeClass} text-[11px] gap-1.5 font-semibold`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${health.dotClass} animate-pulse`} />
                  {health.label}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Real-time visibility into your active Google Gemini model telemetry, daily free quota consumption, and available headroom.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-background/80 text-[11px] font-mono text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>
                  Resets in: <strong className="text-foreground font-semibold">{String(countdown.hours).padStart(2, "0")}h {String(countdown.minutes).padStart(2, "0")}m {String(countdown.seconds).padStart(2, "0")}s</strong>
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchUsageReport}
                disabled={loadingReport}
                className="h-8 text-xs gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingReport ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh Report</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* Section 1: 4 Key Metric Hero Cards (TypeUI Grid & Proximity Grouping) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Consumed Free Requests Today */}
            <div className="p-3.5 rounded-xl border bg-card/60 hover:bg-card/90 transition-colors space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Free Quota Consumed</span>
                <Flame className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {usageReport?.userUsage.messagesUsedToday ?? 0}
                  <span className="text-xs font-normal text-muted-foreground font-sans ml-1">
                    / {usageReport?.userUsage.dailyMessageLimit ?? 50}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {usageReport?.userUsage.percentConsumed ?? 0}% of daily free safety quota
                </p>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, usageReport?.userUsage.percentConsumed ?? 0)}%` }}
                />
              </div>
            </div>

            {/* 2. Free Requests Remaining Today */}
            <div className="p-3.5 rounded-xl border bg-card/60 hover:bg-card/90 transition-colors space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Free Quota Available</span>
                <Sparkles className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                  {usageReport?.userUsage.messagesRemaining ?? 50}
                  <span className="text-xs font-normal text-muted-foreground font-sans ml-1">
                    left today
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Ready for instant ISO 17025 queries
                </p>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] py-0 h-5 font-medium">
                100% Zero-Cost Tier
              </Badge>
            </div>

            {/* 3. Tokens Used Today */}
            <div className="p-3.5 rounded-xl border bg-card/60 hover:bg-card/90 transition-colors space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Tokens Consumed</span>
                <Cpu className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {formatTokens(usageReport?.userUsage.tokensUsedToday ?? 0)}
                  <span className="text-xs font-normal text-muted-foreground font-sans ml-1">
                    / {formatTokens(usageReport?.userUsage.dailyTokenLimit ?? 200000)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatTokens(usageReport?.userUsage.tokensRemaining ?? 200000)} free tokens left
                </p>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, usageReport?.userUsage.tokenPercentConsumed ?? 0)}%` }}
                />
              </div>
            </div>

            {/* 4. Google Free Cloud Limit Headroom */}
            <div className="p-3.5 rounded-xl border bg-card/60 hover:bg-card/90 transition-colors space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Google Free Tier Cap</span>
                <Zap className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {usageReport?.googleFreeAvailability.totalCompanyUsedToday ?? 0}
                  <span className="text-xs font-normal text-muted-foreground font-sans ml-1">
                    / {(usageReport?.googleFreeAvailability.googleDailyLimit ?? 1500).toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {(usageReport?.googleFreeAvailability.googleRemainingToday ?? 1500).toLocaleString()} cloud requests remaining
                </p>
              </div>
              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 text-[10px] py-0 h-5 font-medium">
                1,500 RPD Free Cap
              </Badge>
            </div>
          </div>

          {/* Section 2: Dual Visual Capacity Meters (TypeUI Visual Hierarchy) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Meter 1: User Tenant Daily Quota */}
            <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold">User Daily Safety Quota</span>
                </div>
                <span className="text-xs font-mono font-bold">
                  {usageReport?.userUsage.messagesUsedToday ?? 0} / {usageReport?.userUsage.dailyMessageLimit ?? 50} (
                  {usageReport?.userUsage.percentConsumed ?? 0}%)
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (usageReport?.userUsage.percentConsumed ?? 0) >= 90
                        ? "bg-rose-500"
                        : (usageReport?.userUsage.percentConsumed ?? 0) >= 60
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, usageReport?.userUsage.percentConsumed ?? 0)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>0 used</span>
                  <span>{usageReport?.userUsage.messagesRemaining ?? 50} available</span>
                  <span>50 limit</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Prevents accidental runaway loops while ensuring generous daily availability for formula audits and template generations. Resets automatically at 00:00 UTC.
              </p>
            </div>

            {/* Meter 2: Google Cloud Free Rate Limits */}
            <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-semibold">Google Cloud Daily Free Tier Headroom</span>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {usageReport?.googleFreeAvailability.totalCompanyUsedToday ?? 0} / {(usageReport?.googleFreeAvailability.googleDailyLimit ?? 1500).toLocaleString()} (
                  {usageReport?.googleFreeAvailability.googlePercentConsumed ?? 0}%)
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.max(1, Math.min(100, usageReport?.googleFreeAvailability.googlePercentConsumed ?? 0))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>0 RPD</span>
                  <span>{(usageReport?.googleFreeAvailability.googleRemainingToday ?? 1500).toLocaleString()} free left</span>
                  <span>1,500 RPD</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <Badge variant="outline" className="text-[10px] font-mono py-0 h-5 bg-background">
                  RPM Limit: {usageReport?.model.rateLimits.rpm ?? 30} req/min
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono py-0 h-5 bg-background">
                  TPM Limit: {formatTokens(usageReport?.model.rateLimits.tpm ?? 1000000)} tokens/min
                </Badge>
              </div>
            </div>
          </div>

          {/* Section 3: Active Model Specifications & Rate Limits (TypeUI Data Scannability) */}
          <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Active Gemini Model Telemetry & Free Rate Limits
                </span>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px] font-mono">
                {usageReport?.model.id || "gemini-3.5-flash-lite"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg border bg-background/60 space-y-0.5">
                <p className="text-[10.5px] text-muted-foreground">Requests / Min (RPM)</p>
                <p className="text-xs font-bold font-mono text-foreground">
                  {usageReport?.model.rateLimits.rpm ?? 30} RPM
                </p>
              </div>

              <div className="p-2.5 rounded-lg border bg-background/60 space-y-0.5">
                <p className="text-[10.5px] text-muted-foreground">Tokens / Min (TPM)</p>
                <p className="text-xs font-bold font-mono text-foreground">
                  {formatTokens(usageReport?.model.rateLimits.tpm ?? 1000000)} TPM
                </p>
              </div>

              <div className="p-2.5 rounded-lg border bg-background/60 space-y-0.5">
                <p className="text-[10.5px] text-muted-foreground">Requests / Day (RPD)</p>
                <p className="text-xs font-bold font-mono text-foreground">
                  {(usageReport?.model.rateLimits.rpd ?? 1500).toLocaleString()} RPD
                </p>
              </div>

              <div className="p-2.5 rounded-lg border bg-background/60 space-y-0.5">
                <p className="text-[10.5px] text-muted-foreground">Context Window</p>
                <p className="text-xs font-bold font-mono text-foreground">1,048,576 tokens</p>
              </div>

              <div className="p-2.5 rounded-lg border bg-background/60 space-y-0.5">
                <p className="text-[10.5px] text-muted-foreground">Max Output</p>
                <p className="text-xs font-bold font-mono text-foreground">8,192 tokens</p>
              </div>

              <div className="p-2.5 rounded-lg border bg-background/60 space-y-0.5">
                <p className="text-[10.5px] text-muted-foreground">Billing Plan</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Free Tier ($0)</p>
              </div>
            </div>
          </div>

          {/* Section 4: Today's Consumption by Feature Area */}
          <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Today's Metrology Operations Breakdown
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(usageReport?.contextBreakdown || []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background/60"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">{item.category}</p>
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                      {item.count} queries
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: TypeUI Info Callout & Resilience Guarantee */}
          <div className="p-3.5 rounded-xl border bg-emerald-500/5 border-emerald-500/20 text-xs flex items-start gap-3 text-muted-foreground leading-relaxed">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground text-xs">
                Zero Cost & Continuous Uptime Assurance
              </p>
              <p className="text-[11.5px] mt-0.5">
                Your company API key operates on Google AI's official Free Tier with zero billing charges. If Google returns transient 429 rate-limit notifications during high network traffic, Gaugemaster automatically cascades to fallback models and local deterministic metrology rule engines, keeping your calibration laboratory operational at all times.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

