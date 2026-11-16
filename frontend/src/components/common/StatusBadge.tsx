import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Send,
  Ban,
  Archive,
  Layers,
  FileCheck,
  Tag,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalibrationWorkflowHoverCard } from "./CalibrationWorkflowHoverCard";

export type StatusCategory =
  | "verdict"
  | "instrument"
  | "item_status"
  | "approval"
  | "auto";

export interface StatusBadgeProps {
  status: string | null | undefined;
  subStatus?: string | null;
  category?: StatusCategory;
  size?: "xs" | "sm" | "md";
  className?: string;
  showIcon?: boolean;
}

// Deterministic hash to map any custom status string to a harmonious, distinctive color theme
const DYNAMIC_CUSTOM_PALETTES = [
  {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30 hover:border-purple-500/50",
    dot: "bg-purple-500",
  },
  {
    bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-500/30 hover:border-cyan-500/50",
    dot: "bg-cyan-500",
  },
  {
    bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-500/30 hover:border-indigo-500/50",
    dot: "bg-indigo-500",
  },
  {
    bg: "bg-teal-500/10 dark:bg-teal-500/20",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-500/30 hover:border-teal-500/50",
    dot: "bg-teal-500",
  },
  {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30 hover:border-amber-500/50",
    dot: "bg-amber-500",
  },
  {
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/30 hover:border-rose-500/50",
    dot: "bg-rose-500",
  },
  {
    bg: "bg-orange-500/10 dark:bg-orange-500/20",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/30 hover:border-orange-500/50",
    dot: "bg-orange-500",
  },
  {
    bg: "bg-sky-500/10 dark:bg-sky-500/20",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-500/30 hover:border-sky-500/50",
    dot: "bg-sky-500",
  },
  {
    bg: "bg-violet-500/10 dark:bg-violet-500/20",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-500/30 hover:border-violet-500/50",
    dot: "bg-violet-500",
  },
  {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30 hover:border-emerald-500/50",
    dot: "bg-emerald-500",
  },
  {
    bg: "bg-slate-500/10 dark:bg-slate-500/20",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-500/30 hover:border-slate-500/50",
    dot: "bg-slate-500",
  },
];

function getDynamicPalette(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DYNAMIC_CUSTOM_PALETTES[Math.abs(hash) % DYNAMIC_CUSTOM_PALETTES.length];
}

function formatTitleCase(str: string): string {
  if (!str) return str;
  return str
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBadge({
  status,
  subStatus,
  category = "auto",
  size = "sm",
  className,
  showIcon = true,
}: StatusBadgeProps) {
  if (!status) {
    return (
      <Badge variant="outline" className={cn("text-xs text-muted-foreground", className)}>
        —
      </Badge>
    );
  }

  const raw = status.trim();
  const lower = raw.toLowerCase();

  const sizeClasses = {
    xs: "text-[11px] px-1.5 py-0.5 gap-1 font-medium",
    sm: "text-xs px-2 py-0.5 gap-1.5 font-medium",
    md: "text-sm px-2.5 py-1 gap-1.5 font-semibold",
  };

  const iconSizes = {
    xs: "h-3 w-3 shrink-0",
    sm: "h-3.5 w-3.5 shrink-0",
    md: "h-4 w-4 shrink-0",
  };

  // 1. Verdict checks (PASS / FAIL / CONDITIONAL)
  if (lower === "pass" || lower === "accepted" || lower === "compliant") {
    return (
      <Badge
        variant="success"
        className={cn("whitespace-nowrap inline-flex items-center", sizeClasses[size], className)}
      >
        {showIcon && <CheckCircle2 className={iconSizes[size]} />}
        <span>{raw.toUpperCase()}</span>
      </Badge>
    );
  }

  if (lower === "fail" || lower === "rejected" || lower === "scrapped" || lower === "non-compliant") {
    return (
      <Badge
        variant="destructive"
        className={cn("whitespace-nowrap inline-flex items-center", sizeClasses[size], className)}
      >
        {showIcon && <XCircle className={iconSizes[size]} />}
        <span>{raw.toUpperCase()}</span>
      </Badge>
    );
  }

  // 2. Instrument status (OK, Overdue, Due Soon, Sent for Calibration)
  if (lower === "ok" || lower === "calibrated") {
    return (
      <Badge
        variant="success"
        className={cn("whitespace-nowrap inline-flex items-center", sizeClasses[size], className)}
      >
        {showIcon && <CheckCircle2 className={iconSizes[size]} />}
        <span>{raw}</span>
      </Badge>
    );
  }

  if (lower.includes("overdue") || lower === "over due") {
    return (
      <Badge
        variant="destructive"
        className={cn("whitespace-nowrap inline-flex items-center", sizeClasses[size], className)}
      >
        {showIcon && <AlertTriangle className={iconSizes[size]} />}
        <span>Overdue</span>
      </Badge>
    );
  }

  if (lower.includes("due soon") || lower.includes("upcoming")) {
    return (
      <Badge
        variant="warning"
        className={cn("whitespace-nowrap inline-flex items-center", sizeClasses[size], className)}
      >
        {showIcon && <Clock className={iconSizes[size]} />}
        <span>{raw}</span>
      </Badge>
    );
  }

  // Under Calibration with animated Stepper HoverCard (Calibration -> Review -> Approval)
  if (lower.includes("under calibration") || lower === "under_calibration" || lower.includes("in calibration")) {
    const badgeElement = (
      <Badge
        variant="outline"
        className={cn(
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 whitespace-nowrap inline-flex items-center font-semibold cursor-pointer transition-all hover:bg-blue-500/15 shadow-2xs hover:shadow-xs",
          sizeClasses[size],
          className
        )}
      >
        {showIcon && <Clock className={iconSizes[size]} />}
        <span>Under Calibration</span>
      </Badge>
    );

    return (
      <CalibrationWorkflowHoverCard
        status="Under Calibration"
        subStatus={subStatus || "Review Pending"}
      >
        {badgeElement}
      </CalibrationWorkflowHoverCard>
    );
  }

  if (lower.includes("sent for calibration")) {
    return (
      <Badge
        variant="info"
        className={cn("whitespace-nowrap inline-flex items-center", sizeClasses[size], className)}
      >
        {showIcon && <Send className={iconSizes[size]} />}
        <span>{raw}</span>
      </Badge>
    );
  }

  // 3. Approval status (Approved, Pending Approval, Draft)
  if (lower === "approved") {
    return (
      <Badge
        variant="success"
        className={cn("whitespace-nowrap inline-flex items-center", sizeClasses[size], className)}
      >
        {showIcon && <ShieldCheck className={iconSizes[size]} />}
        <span>Approved</span>
      </Badge>
    );
  }

  if (lower.includes("pending") || lower === "under review" || lower === "submitted") {
    return (
      <Badge
        variant="warning"
        className={cn("whitespace-nowrap inline-flex items-center", sizeClasses[size], className)}
      >
        {showIcon && <Clock className={iconSizes[size]} />}
        <span>{raw}</span>
      </Badge>
    );
  }

  if (lower === "draft") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-muted/50 text-muted-foreground border-border whitespace-nowrap inline-flex items-center",
          sizeClasses[size],
          className
        )}
      >
        {showIcon && <Layers className={iconSizes[size]} />}
        <span>Draft</span>
      </Badge>
    );
  }

  // 4. Item status (Active, Inactive, Spare, Stock)
  if (lower === "active") {
    return (
      <Badge
        variant="success"
        className={cn("whitespace-nowrap inline-flex items-center", sizeClasses[size], className)}
      >
        {showIcon && <CheckCircle2 className={iconSizes[size]} />}
        <span>Active</span>
      </Badge>
    );
  }

  if (lower === "spare") {
    return (
      <Badge
        variant="info"
        className={cn("whitespace-nowrap inline-flex items-center", sizeClasses[size], className)}
      >
        {showIcon && <Archive className={iconSizes[size]} />}
        <span>Spare</span>
      </Badge>
    );
  }

  if (lower === "stock") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-secondary text-secondary-foreground border-border whitespace-nowrap inline-flex items-center",
          sizeClasses[size],
          className
        )}
      >
        {showIcon && <Layers className={iconSizes[size]} />}
        <span>Stock</span>
      </Badge>
    );
  }

  if (lower === "inactive") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-muted/40 text-muted-foreground border-border whitespace-nowrap inline-flex items-center",
          sizeClasses[size],
          className
        )}
      >
        {showIcon && <Ban className={iconSizes[size]} />}
        <span>Inactive</span>
      </Badge>
    );
  }

  // Dynamic Badge for any custom status entered by the user
  const palette = getDynamicPalette(lower);
  const formattedLabel = formatTitleCase(raw);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "whitespace-nowrap inline-flex items-center font-medium shadow-2xs transition-all duration-150 select-none",
              palette.bg,
              palette.text,
              palette.border,
              sizeClasses[size],
              className
            )}
          >
            {showIcon && (
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 animate-pulse", palette.dot)} />
            )}
            <span>{formattedLabel}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Custom Status: {raw}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
