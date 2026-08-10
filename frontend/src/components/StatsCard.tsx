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
      className="relative overflow-hidden bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 group flex flex-col justify-between"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4 }}
    >
      <div className="absolute top-0 right-0 -mt-2 -mr-2 h-16 w-16 bg-primary/10 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-center justify-between gap-1.5 mb-3 sm:mb-4 relative z-10">
        <div className="flex h-9 w-9 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-primary/15 to-purple-500/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform duration-300">
          <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border whitespace-nowrap shrink-0 ${
              trend.isPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
            }`}
          >
            {trend.isPositive ? (
              <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            )}
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      <div className="relative z-10">
        <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-0.5 sm:mb-1 group-hover:text-primary transition-colors duration-300 truncate">
          {value}
        </div>
        <div className="text-xs sm:text-sm font-medium text-muted-foreground leading-snug">
          {label}
        </div>
      </div>
    </motion.div>
  );
}