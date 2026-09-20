import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Cpu, AlertCircle, Loader2 } from "lucide-react";
import httpClient from "@/lib/httpClient";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface AiConnectionBadgeProps {
  className?: string;
  compact?: boolean;
}

export const AiConnectionBadge: React.FC<AiConnectionBadgeProps> = ({
  className = "",
  compact = false,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const { data: status, isLoading } = useQuery({
    queryKey: ["ai-status"],
    queryFn: async () => {
      try {
        const res = await httpClient.get("/ai/status");
        return res.data as {
          configured: boolean;
          maskedKey: string;
          defaultModel: string;
          enabled: boolean;
        };
      } catch {
        return {
          configured: false,
          maskedKey: "",
          defaultModel: "gemini-2.0-flash",
          enabled: false,
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (!isOnline) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 text-[10px] font-semibold ${className}`}
            >
              <Cpu className="w-3 h-3 text-amber-600" />
              {compact ? "Local Engine" : "Local Engine (Offline)"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            Network is offline. Deterministic In-Browser Metrology Engine active.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isLoading) {
    return (
      <Badge
        variant="outline"
        className={`bg-muted text-muted-foreground gap-1 text-[10px] ${className}`}
      >
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        Checking AI...
      </Badge>
    );
  }

  const isConfigured = status?.configured && status?.enabled;

  if (isConfigured) {
    const modelLabel =
      status.defaultModel === "gemini-3.5-flash-lite"
        ? "Gemini 3.5 Flash Lite"
        : status.defaultModel === "gemini-3.1-flash-lite"
        ? "Gemini 3.1 Flash Lite"
        : status.defaultModel === "gemini-3.8-flash"
        ? "Gemini 3.8 Flash"
        : status.defaultModel || "Gemini Cloud AI";

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[10px] font-semibold ${className}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
              {compact ? "Online" : `Online (${modelLabel})`}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            Connected to Central AI Gateway. Zero raw keys exposed on client.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30 gap-1 text-[10px] font-medium ${className}`}
          >
            <Cpu className="w-2.5 h-2.5 text-slate-500" />
            {compact ? "Local Engine" : "Local Engine (Key Not Set)"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          No company Gemini key configured. Template generation and Copilot run using local deterministic formulas.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
