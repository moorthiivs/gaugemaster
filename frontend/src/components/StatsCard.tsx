import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  value: string;
  label: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  delay?: number;
}

export function StatsCard({ value, label, icon: Icon, trend, delay = 0 }: StatsCardProps) {
  return (
    <motion.div
      className="relative overflow-hidden bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-sm hover:border-primary/40 transition-all duration-200 group flex flex-col justify-between"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay }}
    >
      <div className="flex items-center justify-between gap-1.5 mb-3 sm:mb-4 relative z-10">
        <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 transition-colors">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${
              trend.isPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
            }`}
          >
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      <div className="relative z-10">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight mb-0.5 sm:mb-1 tabular-nums text-foreground group-hover:text-primary transition-colors duration-200 truncate">
          {value}
        </div>
        <div className="text-xs sm:text-sm font-medium text-muted-foreground leading-snug">
          {label}
        </div>
      </div>
    </motion.div>
  );
}