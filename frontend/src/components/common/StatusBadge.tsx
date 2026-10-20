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

  // Fallback for custom statuses
  return (
    <Badge
      variant="outline"
      className={cn(
        "bg-primary/5 text-foreground border-primary/20 hover:border-primary/40 whitespace-nowrap inline-flex items-center font-medium shadow-2xs",
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Tag className={iconSizes[size]} />}
      <span>{raw}</span>
    </Badge>
  );
}
