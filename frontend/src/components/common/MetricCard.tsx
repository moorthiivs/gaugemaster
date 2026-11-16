import React, { ReactNode } from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
    label?: string;
  };
  variant?: "default" | "success" | "warning" | "destructive" | "info";
  action?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  action,
  onClick,
  className,
}: MetricCardProps) {
  const iconVariantClasses = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    destructive: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border border-border bg-card shadow-xs transition-all duration-200",
        onClick && "cursor-pointer hover:border-primary/40 hover:shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-semibold text-muted-foreground tracking-normal uppercase">
          {title}
        </span>
        {Icon && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
              iconVariantClasses[variant]
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </div>

        {(subtitle || trend) && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pt-0.5">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  trend.isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.value}
              </span>
            )}
            {subtitle && <span className="truncate">{subtitle}</span>}
          </div>
        )}
      </div>

      {action && <div className="mt-3 pt-2.5 border-t border-border/50">{action}</div>}
    </div>
  );
}
