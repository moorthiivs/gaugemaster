import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardSummary } from "@/types/instrument";
import { getDashboardSummary, getFilterParams } from "@/lib/instrumentActions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSEO } from "@/hooks/useSEO";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  CalendarClock,
  Package,
  CheckCircle2,
  Calendar,
  CalendarIcon,
  Loader2,
  ArrowRight,
  Clock,
  XCircle,
  TrendingUp,
  ShieldCheck,
  Activity,
  MapPin,
  Gauge,
  ChevronRight,
  RefreshCw,
  X,
  Target,
  Filter,
  RotateCcw,
} from "lucide-react";
import { DashboardChart } from "@/components/DashboardChart";
import { useAuth } from "@/lib/auth";
import { DashboardPieChart } from "@/components/DashboardPieChart";
import { CalibrationProgressChart } from "@/components/CalibrationProgressChart";
import { ModuleDistributionCard } from "@/components/ModuleDistributionCard";
import { Button } from "@/components/ui/button";
import { CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ─── Inline Mini Animated Sparklines & Radial Progress ──────────────────
const MiniSparkline = ({
  type,
  color,
  progressPercent,
}: {
  type: "wave" | "bars" | "radial" | "curve" | "arc" | "trend";
  color: string;
  progressPercent?: number;
}) => {
  if (type === "bars") {
    return (
      <svg className="w-11 h-6 shrink-0" viewBox="0 0 44 24" fill="none">
        {[
          { x: 2, h: 10, delay: 0.1 },
          { x: 13, h: 18, delay: 0.2 },
          { x: 24, h: 12, delay: 0.3 },
          { x: 35, h: 22, delay: 0.4 },
        ].map((bar, i) => (
          <motion.rect
            key={i}
            x={bar.x}
            y={24 - bar.h}
            width="6"
            height={bar.h}
            rx="2"
            fill={color}
            opacity={0.85}
            initial={{ height: 0, y: 24 }}
            animate={{ height: bar.h, y: 24 - bar.h }}
            transition={{ duration: 0.5, delay: bar.delay, ease: "easeOut" }}
          />
        ))}
      </svg>
    );
  }

  if (type === "radial" || type === "arc") {
    const strokePercent =
      progressPercent !== undefined ? Math.max(8, progressPercent) : 80;
    const strokeDash = 100 - strokePercent;

    return (
      <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
        <svg className="w-7 h-7 transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-muted/30"
            strokeWidth="4"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <motion.path
            strokeWidth="4"
            strokeDasharray="100, 100"
            stroke={color}
            strokeLinecap="round"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            initial={{ strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: strokeDash }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
      </div>
    );
  }

  // Wave / Curve / Trend sparklines
  const pathD =
    type === "wave"
      ? "M2 18 Q 11 4, 22 14 T 42 6"
      : type === "curve"
        ? "M2 20 C 12 20, 24 8, 42 4"
        : "M2 22 L 12 15 L 24 18 L 42 4";

  return (
    <svg className="w-11 h-6 shrink-0" viewBox="0 0 44 24" fill="none">
      <defs>
        <linearGradient id={`grad-${type}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${pathD} L 42 24 L 2 24 Z`}
        fill={`url(#grad-${type})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      />
      <motion.path
        d={pathD}
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </svg>
  );
};

// ─── Compact & Uniform KPI Card Component ──────────────────────────────
interface KPICardProps {
  title: string;
  value: string | number;
  icon: any;
  variant: "critical" | "warning" | "success" | "info" | "primary" | "neutral";
  subtitle?: string;
  actionLabel?: string;
  onClick?: () => void;
  loading?: boolean;
  pulse?: boolean;
  progressPercent?: number;
  index?: number;
}

const KPICard = ({
  title,
  value,
  icon: Icon,
  variant,
  subtitle,
  actionLabel = "Click to view",
  onClick,
  loading,
  pulse,
  progressPercent,
  index = 0,
}: KPICardProps) => {
  const variantStyles = {
    critical: {
      chartType: "wave" as const,
      chartColor: "#ef4444",
      border:
        "border-red-200/80 dark:border-red-900/40 hover:border-red-500/60 hover:shadow-red-500/10",
      cardBg: "bg-card hover:bg-red-500/5",
      badge:
        "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/30",
      valueTxt: (val: number) =>
        val > 0
          ? "text-red-600 dark:text-red-400 font-extrabold"
          : "text-foreground font-bold",
      footerHover: "group-hover:text-red-600 dark:group-hover:text-red-400",
    },
    primary: {
      chartType: "bars" as const,
      chartColor: "#3b82f6",
      border:
        "border-blue-200/80 dark:border-blue-900/40 hover:border-blue-500/60 hover:shadow-blue-500/10",
      cardBg: "bg-card hover:bg-blue-500/5",
      badge:
        "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30",
      valueTxt: (val: number) =>
        val > 0
          ? "text-blue-600 dark:text-blue-400 font-extrabold"
          : "text-foreground font-bold",
      footerHover: "group-hover:text-blue-600 dark:group-hover:text-blue-400",
    },
    info: {
      chartType: "radial" as const,
      chartColor: "#a855f7",
      border:
        "border-purple-200/80 dark:border-purple-900/40 hover:border-purple-500/60 hover:shadow-purple-500/10",
      cardBg: "bg-card hover:bg-purple-500/5",
      badge:
        "bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md shadow-purple-500/30",
      valueTxt: () => "text-purple-600 dark:text-purple-400 font-extrabold",
      footerHover:
        "group-hover:text-purple-600 dark:group-hover:text-purple-400",
    },
    warning: {
      chartType: "curve" as const,
      chartColor: "#f59e0b",
      border:
        "border-amber-200/80 dark:border-amber-900/40 hover:border-amber-500/60 hover:shadow-amber-500/10",
      cardBg: "bg-card hover:bg-amber-500/5",
      badge:
        "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30",
      valueTxt: (val: number) =>
        val > 0
          ? "text-amber-600 dark:text-amber-400 font-extrabold"
          : "text-foreground font-bold",
      footerHover: "group-hover:text-amber-600 dark:group-hover:text-amber-400",
    },
    success: {
      chartType: "arc" as const,
      chartColor: "#10b981",
      border:
        "border-emerald-200/80 dark:border-emerald-900/40 hover:border-emerald-500/60 hover:shadow-emerald-500/10",
      cardBg: "bg-card hover:bg-emerald-500/5",
      badge:
        "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30",
      valueTxt: () => "text-emerald-600 dark:text-emerald-400 font-extrabold",
      footerHover:
        "group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
    },
    neutral: {
      chartType: "trend" as const,
      chartColor: "#06b6d4",
      border:
        "border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-slate-500/10",
      cardBg: "bg-card hover:bg-cyan-500/5",
      badge:
        "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30",
      valueTxt: () => "text-foreground font-bold",
      footerHover: "group-hover:text-cyan-600 dark:group-hover:text-cyan-400",
    },
  };
  const styles = variantStyles[variant];

  if (loading) {
    return <Skeleton className="h-[132px] rounded-2xl" />;
  }

  const rawNum =
    typeof value === "number" ? value : parseInt(String(value), 10);
  const numericVal = isNaN(rawNum) ? 0 : rawNum;
  const valueColorClass = styles.valueTxt(numericVal);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 24,
        delay: index * 0.05,
      }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="h-[132px]"
    >
      <Card
        className={cn(
          "h-full p-3.5 flex flex-col justify-between rounded-2xl shadow-2xs transition-all duration-300 group relative overflow-hidden border backdrop-blur-sm",
          styles.cardBg,
          styles.border,
          onClick && "cursor-pointer",
        )}
        aria-label={title}
        onClick={onClick}
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
            {title}
          </span>
          <div
            className={cn(
              "p-1.5 rounded-xl transition-transform shrink-0 relative",
              styles.badge,
              pulse && "pulse-dot",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
          </div>
        </div>

        {/* Main Content Area with Mini Sparkline Chart */}
        <div className="my-auto">
          <div className="flex items-center justify-between gap-1">
            <div
              className={cn(
                "text-2xl tracking-tight tabular-nums",
                valueColorClass,
              )}
            >
              {value}
            </div>
            <MiniSparkline
              type={styles.chartType}
              color={styles.chartColor}
              progressPercent={progressPercent}
            />
          </div>

          {progressPercent !== undefined ? (
            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden mt-1.5">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          ) : subtitle ? (
            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 font-medium">
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* Footer Link / Action Hint */}
        <div
          className={cn(
            "flex items-center justify-between pt-1.5 border-t border-border/40 text-[11px] font-semibold text-muted-foreground transition-colors",
            styles.footerHover,
          )}
        >
          <span className="truncate">{actionLabel}</span>
          <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform shrink-0" />
        </div>
      </Card>
    </motion.div>
  );
};

// ─── Quick Date Preset Buttons ────────────────────────────────────────
const DatePresets = ({
  activePreset,
  onSelect,
}: {
  activePreset: string | null;
  onSelect: (presetLabel: string, start: Date, end: Date) => void;
}) => {
  const presets = [
    {
      label: "This Month",
      getRange: () => {
        const n = new Date();
        return [
          new Date(n.getFullYear(), n.getMonth(), 1),
          new Date(n.getFullYear(), n.getMonth() + 1, 0),
        ] as const;
      },
    },
    {
      label: "Next 30 Days",
      getRange: () => {
        const n = new Date();
        const e = new Date();
        e.setDate(n.getDate() + 30);
        return [n, e] as const;
      },
    },
    {
      label: "This Quarter",
      getRange: () => {
        const n = new Date();
        const q = Math.floor(n.getMonth() / 3) * 3;
        return [
          new Date(n.getFullYear(), q, 1),
          new Date(n.getFullYear(), q + 3, 0),
        ] as const;
      },
    },
    {
      label: "This Year",
      getRange: () => {
        const n = new Date();
        return [
          new Date(n.getFullYear(), 0, 1),
          new Date(n.getFullYear(), 11, 31),
        ] as const;
      },
    },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {presets.map((p) => {
        const isSelected = activePreset === p.label;
        return (
          <Button
            key={p.label}
            variant={isSelected ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-7 px-2.5 text-[11px] font-bold rounded-lg transition-all",
              isSelected
                ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
            )}
            onClick={() => {
              const [s, e] = p.getRange();
              onSelect(p.label, s, e);
            }}
          >
            {p.label}
          </Button>
        );
      })}
    </div>
  );
};

// ─── Dashboard Page ───────────────────────────────────────────────────
const Index = () => {
  useSEO({
    title: "Dashboard — Calibration Action Center",
    description:
      "Operational dashboard showing calibrations due today, progress targets, and instrument metrics.",
  });
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range filters
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  });
  const [activePreset, setActivePreset] = useState<string | null>("This Month");
  const [itemStatus, setItemStatus] = useState<string | undefined>("Active");
  const [category, setCategory] = useState<string>("Working"); // Default to "Working" Gauges
  const [calibrationStatus, setCalibrationStatus] = useState<
    string | undefined
  >(undefined);
  const [location, setLocation] = useState<string | undefined>(undefined);
  const [locations, setLocations] = useState<string[]>([]);
  const [itemStatuses, setItemStatuses] = useState<string[]>([]);

  const { user } = useAuth();
  const navigate = useNavigate();

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (startDate || endDate) count++;
    if (location) count++;
    if (itemStatus && itemStatus !== "Active") count++;
    if (calibrationStatus) count++;
    if (category && category !== "Working") count++;
    return count;
  }, [startDate, endDate, location, itemStatus, calibrationStatus, category]);

  useEffect(() => {
    if (!user?.id) return;

    async function fetchDashboard() {
      setLoading(true);
      setError(null);
      try {
        const filters = await getFilterParams(user?.id);
        setLocations(filters.location || []);
        setItemStatuses(filters.item_status || []);

        const startStr = startDate
          ? format(startDate, "yyyy-MM-dd")
          : undefined;
        const endStr = endDate ? format(endDate, "yyyy-MM-dd") : undefined;
        const isRefParam =
          category === "Working"
            ? "false"
            : category === "Reference"
              ? "true"
              : undefined;
        const d = await getDashboardSummary(
          user?.id,
          startStr,
          endStr,
          itemStatus,
          calibrationStatus,
          location,
          isRefParam,
        );
        setData(d);
      } catch (err: any) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [
    user?.id,
    startDate,
    endDate,
    itemStatus,
    calibrationStatus,
    location,
    category,
  ]);

  // Click Handlers for KPI Cards & Action Banners
  const handleCardClick = (
    type:
      | "total"
      | "due"
      | "overdue"
      | "calibrated"
      | "today"
      | "today_completed",
  ) => {
    const params = new URLSearchParams();
    const todayStr = format(new Date(), "yyyy-MM-dd");

    if (location) params.append("location", location);
    if (itemStatus) params.append("item_status", itemStatus);
    if (calibrationStatus) params.append("status", calibrationStatus);
    if (category === "Working") params.append("is_reference_standard", "false");
    if (category === "Reference")
      params.append("is_reference_standard", "true");

    if (type === "overdue") {
      params.set("status", "Overdue");
    } else if (type === "today") {
      params.set("due_date_start", todayStr);
      params.set("due_date_end", todayStr);
      params.set("status", "All");
      params.set("item_status", "All");
      params.set("is_reference_standard", "All");
    } else if (type === "today_completed") {
      params.set("calibrated_in_range_start", todayStr);
      params.set("calibrated_in_range_end", todayStr);
    } else if (type === "calibrated" || type === "due") {
      if (startDate)
        params.append(
          "calibrated_in_range_start",
          format(startDate, "yyyy-MM-dd"),
        );
      else
        params.append(
          "calibrated_in_range_start",
          format(
            new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            "yyyy-MM-dd",
          ),
        );

      if (endDate)
        params.append("calibrated_in_range_end", format(endDate, "yyyy-MM-dd"));
      else
        params.append(
          "calibrated_in_range_end",
          format(
            new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
            "yyyy-MM-dd",
          ),
        );
    }

    navigate(`/instruments?${params.toString()}`);
  };

  const handleClearFilters = () => {
    const now = new Date();
    setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    setActivePreset("This Month");
    setItemStatus("Active");
    setCategory("Working");
    setCalibrationStatus(undefined);
    setLocation(undefined);
  };

  const calibrationStatusData = data?.statusDistribution || [];
  const itemStatusData = data?.itemStatusDistribution || [];
  const chartData = data?.dueDatesByMonth || [];

  // Table pagination
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.ceil((data?.dueSoonList?.length || 0) / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const currentPageData =
    data?.dueSoonList?.slice(startIndex, startIndex + itemsPerPage) || [];

  // Monthly Target Plan Progress (Completed out of Planned, e.g. 10/50)
  const completedCount = data?.calibratedCount || 0;
  const plannedCount = data?.dueThisMonth || 0;
  const targetProgressPercent =
    plannedCount > 0
      ? Math.min(100, Math.round((completedCount / plannedCount) * 100))
      : 0;

  // Compliance Rate Calculation
  const complianceRate = useMemo(() => {
    if (!data || data.total === 0) return 0;
    const nonOverdue = data.total - data.overdue;
    return Math.round((nonOverdue / data.total) * 100);
  }, [data]);

  const formattedStart = startDate ? format(startDate, "dd MMM yyyy") : "";
  const formattedEnd = endDate ? format(endDate, "dd MMM yyyy") : "";
  const dateRangeLabel =
    formattedStart && formattedEnd
      ? `${formattedStart} – ${formattedEnd}`
      : "Current Range";

  // Action Plan Banner visibility: Display ONLY IF valid actionable data exists (due today or overdue)
  const hasActionPlanData = Boolean(
    !loading &&
    data &&
    ((data.dueTodayCount || 0) > 0 || (data.overdue || 0) > 0),
  );

  return (
    <div className="space-y-5">
      {/* ─── Dashboard Header & Controls ─────────────────────── */}
      <header className="flex flex-col gap-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2 text-foreground">
              <Activity className="h-6 w-6 text-primary" />
              Calibration Action Center
              {loading && (
                <Loader2 className="h-4 w-4 text-primary animate-spin ml-1" />
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Real-time calibration monitoring & action dashboard ·{" "}
              {dateRangeLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold rounded-lg shadow-xs hover:border-primary/50"
              onClick={() => {
                setData(null);
                setLoading(true);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Data
            </Button>
          </div>
        </div>

        {/* ─── Action Plan Banner (Highlights Today & Critical Actions - Motion & Gradient Enabled) ── */}
        <AnimatePresence>
          {hasActionPlanData && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={cn(
                "rounded-2xl p-4 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border backdrop-blur-md relative overflow-hidden",
                (data?.overdue || 0) > 0
                  ? "bg-gradient-to-r from-rose-500/15 via-red-500/10 to-amber-500/10 border-rose-500/30"
                  : "bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-violet-500/10 border-blue-500/30",
              )}
            >
              {/* Animated background glow */}
              <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

              <div className="flex items-center gap-3.5 z-10">
                <div
                  className={cn(
                    "p-3 rounded-2xl text-white shadow-lg shrink-0",
                    (data?.overdue || 0) > 0
                      ? "bg-gradient-to-tr from-red-600 to-rose-500 shadow-red-500/30"
                      : "bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-blue-500/30",
                  )}
                >
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      Today's Action Plan
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono font-bold bg-background/80 text-primary border-primary/30 px-2 py-0.5 rounded-md"
                    >
                      {format(new Date(), "EEEE, dd MMM yyyy")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                    {data?.dueTodayCount
                      ? `${data.workingDueTodayCount || 0} Gauge(s) · ${data.referenceDueTodayCount || 0} Ref Standard(s) due today`
                      : "No calibrations due today"}{" "}
                    ·{" "}
                    {data?.overdue
                      ? `${data.workingOverdue || 0} Gauge(s) · ${data.referenceOverdue || 0} Ref Standard(s) overdue`
                      : "0 overdue"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto z-10">
                {(data?.dueTodayCount || 0) > 0 && (
                  <Button
                    size="sm"
                    onClick={() => handleCardClick("today")}
                    className="flex-1 md:flex-initial h-9 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md gap-1.5 transition-transform hover:scale-102"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    View Today's ({data?.dueTodayCount || 0})
                  </Button>
                )}

                {(data?.overdue || 0) > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCardClick("overdue")}
                    className="flex-1 md:flex-initial h-9 px-4 text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl shadow-md shadow-red-500/20 gap-1.5 transition-transform hover:scale-102"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Resolve Overdue ({data?.overdue})
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Filter Toolbar ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2.5 bg-card/90 backdrop-blur-md border border-border/70 rounded-xl p-2.5 shadow-xs">
          {/* Filter Icon Only with Badge at Top-Right Corner */}
          <div
            className="relative inline-flex items-center justify-center p-1.5 rounded-lg bg-primary/10 text-primary shrink-0 mr-1"
            title="Filters"
          >
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-extrabold text-primary-foreground shadow-sm tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-border/70 hidden sm:block" />

          {/* Category Filter (Working Gauges vs Ref Standards) */}
          <Select
            value={category}
            onValueChange={(val) => {
              setCategory(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7 w-[155px] text-xs font-medium border-primary/40 bg-primary/5">
              <Gauge className="h-3 w-3 mr-1 text-primary" />
              <SelectValue placeholder="All Inventory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">
                All Inventory ({data?.total ?? "—"})
              </SelectItem>
              <SelectItem value="Working">
                Working Gauges ({data?.workingTotal ?? "—"})
              </SelectItem>
              <SelectItem value="Reference">
                Ref Standards ({data?.referenceTotal ?? "—"})
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="h-4 w-px bg-border/70 hidden sm:block" />

          {/* Quick Date Presets */}
          <DatePresets
            activePreset={activePreset}
            onSelect={(presetLabel, s, e) => {
              setActivePreset(presetLabel);
              setStartDate(s);
              setEndDate(e);
              setPage(1);
            }}
          />

          <div className="h-4 w-px bg-border/70 hidden sm:block" />

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-medium hover:border-primary/50 transition-all px-2.5"
                >
                  <CalendarIcon className="mr-1 h-3 w-3 text-muted-foreground" />
                  {startDate ? format(startDate, "dd MMM yyyy") : "Start"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    setStartDate(date);
                    setActivePreset(null);
                    setPage(1);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-medium hover:border-primary/50 transition-all px-2.5"
                >
                  <CalendarIcon className="mr-1 h-3 w-3 text-muted-foreground" />
                  {endDate ? format(endDate, "dd MMM yyyy") : "End"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    setEndDate(date);
                    setActivePreset(null);
                    setPage(1);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="h-4 w-px bg-border/70 hidden sm:block" />

          {/* Item Status Filter */}
          <Select
            value={itemStatus || "Active"}
            onValueChange={(val) => {
              setItemStatus(val === "All" ? undefined : val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7 w-[130px] text-xs font-medium">
              <Activity className="h-3 w-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Active Only" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              {itemStatuses.length > 0 ? (
                itemStatuses
                  .filter((s) => s && s.trim() !== "")
                  .map((st) => (
                    <SelectItem key={st} value={st}>
                      {st === "Active" ? "Active Only" : st}
                    </SelectItem>
                  ))
              ) : (
                <SelectItem value="Active">Active Only</SelectItem>
              )}
            </SelectContent>
          </Select>

          {/* Location Filter */}
          <Select
            value={location || "All"}
            onValueChange={(val) => {
              setLocation(val === "All" ? undefined : val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7 w-[130px] text-xs font-medium">
              <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="All Plants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Plants</SelectItem>
              {locations
                .filter((loc) => loc && loc.trim() !== "")
                .map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Clear Filters (Icon Only) */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              title="Clear filters"
              onClick={handleClearFilters}
              className="h-7 w-7 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50/70 border border-red-200/50 dark:border-red-900/30 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </header>

      {/* ─── Error State ──────────────────────────────────────── */}
      {error && !loading && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-red-600">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLoading(true)}
              className="h-7 text-xs"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Interactive 6-Card KPI Summary Grid (Equal-Height Compact Grid with Staggered Motion) ─ */}
      <section
        aria-label="Key performance indicators"
        className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
      >
        {/* 1. Overdue Instruments */}
        <KPICard
          index={0}
          title="Overdue"
          value={loading ? "—" : data?.overdue || 0}
          icon={AlertTriangle}
          variant="critical"
          subtitle={
            loading
              ? "Past due date"
              : `${data?.workingOverdue || 0} Gauges · ${data?.referenceOverdue || 0} Master(s)`
          }
          actionLabel="Click to view list"
          onClick={() => handleCardClick("overdue")}
          loading={loading}
          pulse={(data?.overdue || 0) > 0}
        />

        {/* 2. Today's Calibrations */}
        <KPICard
          index={1}
          title="Due Today"
          value={loading ? "—" : data?.dueTodayCount || 0}
          icon={Calendar}
          variant="primary"
          subtitle={
            loading
              ? "Scheduled today"
              : `${data?.workingDueTodayCount || 0} Gauges · ${data?.referenceDueTodayCount || 0} Master(s)`
          }
          actionLabel="Click to view list"
          onClick={() => handleCardClick("today")}
          loading={loading}
          pulse={(data?.dueTodayCount || 0) > 0}
        />

        {/* 3. Monthly Calibration Target Plan (Progress Ratio 10/50) */}
        <KPICard
          index={2}
          title="Period Progress"
          value={loading ? "—" : `${completedCount} / ${plannedCount}`}
          icon={Target}
          variant="info"
          subtitle={
            loading
              ? "Completed / Planned"
              : `${completedCount} of ${plannedCount} completed`
          }
          progressPercent={targetProgressPercent}
          actionLabel="Click to view list"
          onClick={() => handleCardClick("calibrated")}
          loading={loading}
        />

        {/* 4. Due Soon (Next 30 Days) */}
        <KPICard
          index={3}
          title="Due Soon"
          value={
            loading
              ? "—"
              : (data?.dueSoonCount ?? data?.dueSoonList?.length ?? 0)
          }
          icon={Clock}
          variant="warning"
          subtitle={
            loading
              ? "Next 30 days"
              : `${data?.workingDueSoonCount || 0} Gauges · ${data?.referenceDueSoonCount || 0} Master(s)`
          }
          actionLabel="Click to view schedule"
          onClick={() => navigate("/calendar")}
          loading={loading}
        />

        {/* 5. Calibration Compliance % */}
        <KPICard
          index={4}
          title="Compliance"
          value={loading ? "—" : `${complianceRate}%`}
          icon={ShieldCheck}
          variant="success"
          subtitle={
            loading
              ? "Compliant"
              : `${(data?.total || 0) - (data?.overdue || 0)} of ${data?.total || 0} compliant`
          }
          actionLabel="Click to inspect"
          onClick={() => navigate("/instruments")}
          loading={loading}
        />

        {/* 6. Total Master Inventory */}
        <KPICard
          index={5}
          title="Total Master"
          value={loading ? "—" : data?.total || 0}
          icon={Package}
          variant="neutral"
          subtitle={
            loading
              ? "Registered inventory"
              : `${data?.workingTotal || 0} Gauges · ${data?.referenceTotal || 0} Ref Standard(s)`
          }
          actionLabel="Click to view all"
          onClick={() => handleCardClick("total")}
          loading={loading}
        />
      </section>

      {/* ─── Grid Row 1: Calibration Workload Bar & Status Donut Charts ── */}
      <section
        aria-label="Calibration analytics charts"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {loading ? (
          <Skeleton className="h-[360px] rounded-xl" />
        ) : (
          <DashboardChart data={chartData} />
        )}
        {loading ? (
          <Skeleton className="h-[360px] rounded-xl" />
        ) : (
          <ModuleDistributionCard
            data={data?.moduleDistribution || []}
            loading={loading}
            onModuleClick={(moduleName) => {
              const params = new URLSearchParams();
              if (category === "Working") params.append("is_reference_standard", "false");
              if (category === "Reference") params.append("is_reference_standard", "true");
              if (itemStatus && itemStatus !== "All") params.append("item_status", itemStatus);
              if (location && location !== "All") params.append("location", location);

              if (moduleName === "Others") {
                const topModules = (data?.moduleDistribution || [])
                  .filter((m) => m.name !== "Others")
                  .map((m) => m.name);
                params.append("module", "Others");
                params.append("exclude_modules", topModules.join(","));
              } else {
                params.append("module", moduleName);
              }

              navigate(`/instruments?${params.toString()}`);
            }}
          />
        )}
      </section>

      {/* ─── Grid Row 2: Progress Chart & Module Distribution Donut Chart ── */}
      <section
        aria-label="Completed calibrations and module distribution"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {!loading ? (
          <CalibrationProgressChart
            weeklyData={data?.weeklyCompleted || []}
            dailyData={data?.dailyCompleted || []}
          />
        ) : (
          <Skeleton className="h-[360px] rounded-xl" />
        )}

        <DashboardPieChart
          calibrationStatusData={calibrationStatusData}
          itemStatusData={itemStatusData}
          currentItemStatus={itemStatus}
          onItemStatusChange={(status) => {
            setItemStatus(status);
            setPage(1);
          }}
          currentCalibrationStatus={calibrationStatus}
          onCalibrationStatusChange={(status) => {
            setCalibrationStatus(status);
            setPage(1);
          }}
        />
      </section>

      {/* ─── Grid Row 3: Recent Activity Logs ── */}
      <section aria-label="Recent logs" className="grid grid-cols-1 gap-4">
        {/* Recent Activity Card */}
        <Card className="h-full border border-border/70 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-extrabold tracking-tight flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Recent Activity Logs
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Last 10 calibration events
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[9px] font-mono">
                Real-time
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 rounded-lg" />
                ))}
              </div>
            ) : !data?.recentActivity?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Activity className="h-10 w-10 opacity-20 mb-2" />
                <p className="text-sm font-medium">No recent activity</p>
                <p className="text-xs opacity-60 mt-0.5">
                  Calibration events will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {data.recentActivity.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-primary/5 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/instruments`)}
                  >
                    <div
                      className={cn(
                        "p-1.5 rounded-lg shrink-0 border",
                        r.action === "Calibrated" || r.action === "OK"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : r.action === "Overdue"
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : r.action === "Due Soon"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : "bg-blue-500/10 text-blue-500 border-blue-500/20",
                      )}
                    >
                      <Gauge className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">
                          {r.name}
                        </span>
                        {r.idCode && (
                          <Badge
                            variant="outline"
                            className="text-[9px] font-mono px-1 py-0 shrink-0 bg-background"
                          >
                            {r.idCode}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                        <span className="font-semibold text-foreground/80">
                          {r.action}
                        </span>
                        {r.location && (
                          <>
                            <span>·</span>
                            <span>{r.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 font-medium">
                      {new Date(r.at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── Grid Row 3: Due Soon / Due in Selected Range Instruments Table ── */}
      <section aria-label="Instruments due soon">
        <Card className="border border-border/70 shadow-xs hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-extrabold tracking-tight flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-500" />
                  {startDate || endDate
                    ? "Instruments Due in Selected Range"
                    : "Instruments Due Soon — Next 30 Days"}
                </CardTitle>
                <CardDescription className="text-[11px]">
                  List of instruments requiring calibration within the selected
                  time window
                </CardDescription>
              </div>
              {(data?.dueSoonList?.length || 0) > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] font-mono font-bold tabular-nums"
                >
                  {data?.dueSoonList?.length} instruments
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 rounded-lg" />
                ))}
              </div>
            ) : !data?.dueSoonList?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 opacity-20 mb-2 text-emerald-500" />
                <p className="text-sm font-medium">
                  All instruments up to date
                </p>
                <p className="text-xs opacity-60 mt-0.5">
                  No calibrations due in this period
                </p>
              </div>
            ) : (
              <>
                <Table aria-label="Due soon instruments">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider py-2">
                        Instrument
                      </TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider py-2">
                        Location
                      </TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider py-2 text-right">
                        Due Date
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageData.map(
                      ({ id, name, dueDate, location: loc }) => {
                        const due = new Date(dueDate);
                        const isOverdue = due < new Date();
                        return (
                          <TableRow
                            key={id}
                            className="group cursor-pointer hover:bg-primary/5 transition-colors"
                            onClick={() => navigate("/instruments")}
                          >
                            <TableCell className="py-2">
                              <span className="text-xs font-semibold group-hover:text-primary transition-colors">
                                {name}
                              </span>
                            </TableCell>
                            <TableCell className="py-2">
                              <span className="text-xs text-muted-foreground">
                                {loc || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <span
                                className={cn(
                                  "text-xs font-mono tabular-nums",
                                  isOverdue
                                    ? "text-red-500 font-bold"
                                    : "text-muted-foreground",
                                )}
                              >
                                {due.toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      },
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground tabular-nums font-medium">
                      Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="h-6 text-[11px] px-2"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="h-6 text-[11px] px-2"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Index;
