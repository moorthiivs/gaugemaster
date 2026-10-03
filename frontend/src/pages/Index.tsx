import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardSummary } from "@/types/instrument";
import { getDashboardSummary, getFilterParams } from "@/lib/instrumentActions";
import { deduplicateItemStatuses } from "@/lib/itemStatus";
import httpClient from "@/lib/httpClient";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

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
    const validPercent =
      typeof progressPercent === "number" && !isNaN(progressPercent)
        ? Math.min(100, Math.max(0, progressPercent))
        : 0;
    const strokeDash = 100 - validPercent;

    return (
      <div className="relative w-8 h-8 flex items-center justify-center shrink-0" title={`${validPercent}%`}>
        <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-muted/20"
            strokeWidth="3.5"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <motion.path
            strokeWidth="3.5"
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
        <span className="absolute text-[8px] font-extrabold text-muted-foreground select-none">
          {validPercent > 0 ? `${Math.round(validPercent)}%` : "0%"}
        </span>
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

// ─── Compact & Uniform World-Class KPI Card Component ──────────────────
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
      chartColor: "hsl(var(--destructive))",
      border: "border-border hover:border-destructive/50",
      cardBg: "bg-card hover:bg-destructive/[0.02]",
      badge: "bg-destructive/10 text-destructive border border-destructive/20",
      progressBar: "bg-destructive",
      valueTxt: (val: number) =>
        val > 0
          ? "text-destructive font-black"
          : "text-foreground font-bold",
      footerHover: "group-hover:text-destructive",
    },
    primary: {
      chartType: "bars" as const,
      chartColor: "hsl(var(--primary))",
      border: "border-border hover:border-primary/50",
      cardBg: "bg-card hover:bg-primary/[0.02]",
      badge: "bg-primary/10 text-primary border border-primary/20",
      progressBar: "bg-primary",
      valueTxt: (val: number) =>
        val > 0
          ? "text-primary font-black"
          : "text-foreground font-bold",
      footerHover: "group-hover:text-primary",
    },
    info: {
      chartType: "radial" as const,
      chartColor: "hsl(var(--info))",
      border: "border-border hover:border-info/50",
      cardBg: "bg-card hover:bg-info/[0.02]",
      badge: "bg-info/10 text-info border border-info/20",
      progressBar: "bg-info",
      valueTxt: () => "text-info font-black",
      footerHover: "group-hover:text-info",
    },
    warning: {
      chartType: "curve" as const,
      chartColor: "hsl(var(--warning))",
      border: "border-border hover:border-warning/50",
      cardBg: "bg-card hover:bg-warning/[0.02]",
      badge: "bg-warning/10 text-warning border border-warning/20",
      progressBar: "bg-warning",
      valueTxt: (val: number) =>
        val > 0
          ? "text-warning font-black"
          : "text-foreground font-bold",
      footerHover: "group-hover:text-warning",
    },
    success: {
      chartType: "arc" as const,
      chartColor: "hsl(var(--success))",
      border: "border-border hover:border-success/50",
      cardBg: "bg-card hover:bg-success/[0.02]",
      badge: "bg-success/10 text-success border border-success/20",
      progressBar: "bg-success",
      valueTxt: () => "text-success font-black",
      footerHover: "group-hover:text-success",
    },
    neutral: {
      chartType: "trend" as const,
      chartColor: "hsl(var(--muted-foreground))",
      border: "border-border hover:border-primary/40",
      cardBg: "bg-card hover:bg-muted/30",
      badge: "bg-muted text-muted-foreground border border-border",
      progressBar: "bg-primary/70",
      valueTxt: () => "text-foreground font-bold",
      footerHover: "group-hover:text-foreground",
    },
  };
  const styles = variantStyles[variant];

  if (loading) {
    return <Skeleton className="h-[136px] rounded-xl" />;
  }

  const rawNum =
    typeof value === "number" ? value : parseInt(String(value), 10);
  const numericVal = isNaN(rawNum) ? 0 : rawNum;
  const valueColorClass = styles.valueTxt(numericVal);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="h-[138px]"
    >
      <Card
        className={cn(
          "h-full p-3.5 flex flex-col justify-between rounded-xl shadow-xs transition-all duration-200 group relative overflow-hidden border",
          styles.cardBg,
          styles.border,
          onClick && "cursor-pointer",
        )}
        aria-label={title}
        onClick={onClick}
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5 z-10">
          <span
            className="text-sm font-medium text-muted-foreground truncate"
            title={title}
          >
            {title}
          </span>
          <div
            className={cn(
              "p-1.5 rounded-lg transition-transform shrink-0 relative",
              styles.badge,
              pulse && "pulse-dot",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
          </div>
        </div>

        {/* Main Content Area with Mini Sparkline Chart */}
        <div className="my-auto z-10 w-full">
          <div className="flex items-center justify-between gap-1.5">
            <div
              className={cn(
                "text-2xl font-bold tracking-tight tabular-nums truncate text-foreground",
                typeof value === "string" && value.length > 9 && "text-xl sm:text-2xl",
              )}
              title={String(value)}
            >
              {value}
            </div>
            <MiniSparkline
              type={styles.chartType}
              color={styles.chartColor}
              progressPercent={progressPercent}
            />
          </div>

          {subtitle ? (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1 font-normal" title={subtitle}>
              {subtitle}
            </p>
          ) : null}

          {progressPercent !== undefined && !isNaN(progressPercent) ? (
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-1.5">
              <motion.div
                className={cn("h-full rounded-full", styles.progressBar)}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, Number(progressPercent)))}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          ) : null}
        </div>

        {/* Footer Link / Action Hint */}
        <div
          className={cn(
            "flex items-center justify-between pt-1.5 border-t border-border/50 text-[11px] font-medium text-muted-foreground transition-colors z-10",
            styles.footerHover,
          )}
        >
          <span className="truncate">{actionLabel}</span>
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform shrink-0" />
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
  const [itemStatus, setItemStatus] = useState<string>("All");
  const [category, setCategory] = useState<string>("Working"); // Default to "Working" Gauges
  const [calibrationStatus, setCalibrationStatus] = useState<
    string | undefined
  >(undefined);
  const [location, setLocation] = useState<string | undefined>(undefined);

  const { user } = useAuth();
  const navigate = useNavigate();

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (startDate || endDate) count++;
    if (location && location !== "All") count++;
    if (itemStatus && itemStatus !== "All") count++;
    if (calibrationStatus && calibrationStatus !== "All") count++;
    if (category && category !== "Working") count++;
    return count;
  }, [startDate, endDate, location, itemStatus, calibrationStatus, category]);

  // ── Server State Queries via TanStack React Query ───────────────────
  // 1. Filter parameters query (cached for 5 minutes)
  const { data: filterParams } = useQuery({
    queryKey: ["filterParams", user?.id, user?.companyId],
    queryFn: () => getFilterParams(user?.id, user?.companyId),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const locations = useMemo(() => filterParams?.location || [], [filterParams]);
  const itemStatuses = useMemo(
    () => deduplicateItemStatuses(filterParams?.item_status || []),
    [filterParams]
  );

  // 2. Mail & dashboard configuration query (cached for 10 minutes)
  const { data: mailConfigData } = useQuery({
    queryKey: ["dashboardConfig", user?.id, user?.companyId],
    queryFn: async () => {
      try {
        const res = await httpClient.get('/settings/fetchmailconfig', {
          params: { userId: user?.id, companyId: user?.companyId }
        });
        return res.status === 200 ? (res.data?.dashboardConfig ?? null) : null;
      } catch {
        return null;
      }
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  const dashboardConfig = useMemo(() => ({
    warningDays: mailConfigData?.warningDays ?? 7,
    widgets: {
      overallProgress: true,
      overdue: true,
      dueToday: true,
      periodProgress: true,
      dueSoon: true,
      compliance: true,
      totalMaster: true,
      ...(mailConfigData?.widgets || {}),
    },
  }), [mailConfigData]);

  const visibleWidgetCount = useMemo(() => {
    const keys = [
      "overallProgress",
      "overdue",
      "dueToday",
      "periodProgress",
      "dueSoon",
      "compliance",
      "totalMaster",
    ];
    return keys.filter((k) => dashboardConfig.widgets[k] !== false).length;
  }, [dashboardConfig.widgets]);

  // 3. Main Dashboard Summary Query (cached, automatic background revalidation)
  const startStr = startDate ? format(startDate, "yyyy-MM-dd") : undefined;
  const endStr = endDate ? format(endDate, "yyyy-MM-dd") : undefined;
  const isRefParam =
    category === "Working"
      ? "false"
      : category === "Reference"
        ? "true"
        : undefined;

  const {
    data: queryData,
    isLoading: loading,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: [
      "dashboardSummary",
      user?.id,
      user?.companyId,
      startStr,
      endStr,
      itemStatus,
      calibrationStatus,
      location,
      category,
    ],
    queryFn: () =>
      getDashboardSummary(
        user?.id,
        startStr,
        endStr,
        itemStatus === "All" ? undefined : itemStatus,
        calibrationStatus === "All" ? undefined : calibrationStatus,
        location === "All" ? undefined : location,
        isRefParam,
        user?.companyId,
      ),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const data: DashboardSummary | null = queryData || null;
  const error: string | null = queryError
    ? "Failed to load dashboard data. Please try again."
    : null;


  // Click Handlers for KPI Cards & Action Banners
  const handleCardClick = (
    type:
      | "total"
      | "due"
      | "overdue"
      | "calibrated"
      | "today"
      | "today_completed"
      | "due_soon"
      | "pending",
  ) => {
    const params = new URLSearchParams();
    const todayStr = format(new Date(), "yyyy-MM-dd");

    if (location && location !== "All") params.append("location", location);
    if (itemStatus && itemStatus !== "All") params.append("item_status", itemStatus);
    if (calibrationStatus && calibrationStatus !== "All") params.append("status", calibrationStatus);
    if (category === "Working") params.append("is_reference_standard", "false");
    if (category === "Reference")
      params.append("is_reference_standard", "true");

    if (type === "overdue") {
      params.set("status", "Overdue");
    } else if (type === "due_soon") {
      params.set("status", "Due Soon");
    } else if (type === "today") {
      params.set("due_date_start", todayStr);
      params.set("due_date_end", todayStr);
      params.set("status", "All");
    } else if (type === "today_completed") {
      params.set("calibrated_in_range_start", todayStr);
      params.set("calibrated_in_range_end", todayStr);
    } else if (type === "pending") {
      if (startDate)
        params.append("due_date_start", format(startDate, "yyyy-MM-dd"));
      else
        params.append(
          "due_date_start",
          format(
            new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            "yyyy-MM-dd",
          ),
        );

      if (endDate)
        params.append("due_date_end", format(endDate, "yyyy-MM-dd"));
      else
        params.append(
          "due_date_end",
          format(
            new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
            "yyyy-MM-dd",
          ),
        );
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
    setItemStatus("All");
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
    ((data.dueTodayCount || 0) > 0 ||
      (data.overdue || 0) > 0 ||
      plannedCount - completedCount > 0),
  );

  return (
    <div className="space-y-6">
      {/* ─── Dashboard Page Header ─────────────────────────── */}
      <PageHeader
        title="Calibration Action Center"
        description={`Real-time calibration monitoring & action dashboard · ${dateRangeLabel}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            className="h-8 gap-1.5 text-xs font-semibold"
            onClick={() => refetch()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-primary", isFetching && "animate-spin")} />
            Refresh Data
          </Button>
        }
      />

      {/* ─── Action Plan Banner (Highlights Today & Critical Actions) ── */}
      <AnimatePresence>
        {hasActionPlanData && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "rounded-xl p-4 border relative overflow-hidden flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-2xs",
              (data?.overdue || 0) > 0
                ? "bg-destructive/5 border-destructive/30"
                : "bg-primary/5 border-primary/20",
            )}
          >
            <div className="flex items-start sm:items-center gap-3 z-10 min-w-0">
              <div
                className={cn(
                  "p-2.5 rounded-lg shrink-0",
                  (data?.overdue || 0) > 0
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary",
                )}
              >
                <Target className="h-5 w-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold tracking-tight text-foreground">
                    Today's Action Plan
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[11px] font-mono font-medium bg-background/80 text-foreground border-border px-2 py-0.5"
                  >
                    {format(new Date(), "EEEE, dd MMM yyyy")}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {data?.dueTodayCount
                      ? `${data.workingDueTodayCount || 0} Gauge(s) · ${data.referenceDueTodayCount || 0} Ref Standard(s) due today`
                      : "No calibrations due today"}
                  </span>
                  <span className="hidden sm:inline opacity-40">•</span>
                  <span className={(data?.overdue || 0) > 0 ? "font-semibold text-destructive" : ""}>
                    {data?.overdue
                      ? `${data.workingOverdue || 0} Gauge(s) · ${data.referenceOverdue || 0} Ref Standard(s) overdue`
                      : "0 overdue"}
                  </span>
                  <span className="hidden sm:inline opacity-40">•</span>
                  <span className="font-semibold text-foreground/80">
                    {Math.max(0, plannedCount - completedCount)} Pending ({completedCount} / {plannedCount} Done)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto shrink-0 justify-start xl:justify-end z-10 pt-2 xl:pt-0 border-t xl:border-t-0 border-border/40">
              {(data?.dueTodayCount || 0) > 0 && (
                <Button
                  size="sm"
                  onClick={() => handleCardClick("today")}
                  className="flex-1 sm:flex-initial h-8 px-3.5 text-xs font-semibold gap-1.5"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  View Today ({data?.dueTodayCount || 0})
                </Button>
              )}

              {(data?.overdue || 0) > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleCardClick("overdue")}
                  className="flex-1 sm:flex-initial h-8 px-3.5 text-xs font-semibold gap-1.5"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Resolve Overdue ({data?.overdue})
                </Button>
              )}

              {Math.max(0, plannedCount - completedCount) > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCardClick("pending")}
                  className="flex-1 sm:flex-initial h-8 px-3.5 text-xs font-semibold gap-1.5"
                >
                  <Target className="h-3.5 w-3.5" />
                  View Pending ({Math.max(0, plannedCount - completedCount)})
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* ─── Filter Toolbar ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-xl p-2 shadow-2xs">
          {/* Filter Icon Only with Badge at Top-Right Corner */}
          <div
            className="relative inline-flex items-center justify-center p-1.5 rounded-lg bg-muted text-muted-foreground shrink-0 mr-1"
            title="Filters"
          >
            <Filter className="h-3.5 w-3.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-extrabold text-primary-foreground shadow-2xs tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Category Filter (Working Gauges vs Ref Standards) */}
          <Select
            value={category}
            onValueChange={(val) => {
              setCategory(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs font-medium">
              <Gauge className="h-3.5 w-3.5 mr-1 text-primary" />
              <SelectValue placeholder="All Inventory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">
                All Inventory ({(data as any)?.grandTotal ?? (data ? (data.workingTotal || 0) + (data.referenceTotal || 0) : "—")})
              </SelectItem>
              <SelectItem value="Working">
                Working Gauges ({data?.workingTotal ?? "—"})
              </SelectItem>
              <SelectItem value="Reference">
                Ref Standards ({data?.referenceTotal ?? "—"})
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="h-4 w-px bg-border hidden sm:block" />

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

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium px-2.5"
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
                  className="h-8 text-xs font-medium px-2.5"
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

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Item Status Filter */}
          <Select
            value={itemStatus}
            onValueChange={(val) => {
              setItemStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs font-medium">
              <Activity className="h-3 w-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              {itemStatuses.length > 0 ? (
                itemStatuses
                  .filter((s) => s && s.trim() !== "" && s.toLowerCase() !== "all")
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
            <SelectTrigger className="h-8 w-[130px] text-xs font-medium">
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
              className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

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
              onClick={() => refetch()}
              className="h-7 text-xs"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Interactive KPI Summary Grid (Configurable Widgets) ─ */}
      <section
        aria-label="Key performance indicators"
        className={cn(
          "grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7",
          visibleWidgetCount <= 4 && "2xl:grid-cols-4",
          visibleWidgetCount <= 3 && "2xl:grid-cols-3",
          visibleWidgetCount <= 2 && "2xl:grid-cols-2",
          visibleWidgetCount === 1 && "2xl:grid-cols-1"
        )}
      >
        {/* 1. Calibration Overall Progress KPI Card */}
        {dashboardConfig.widgets.overallProgress !== false && (
          <KPICard
            index={0}
            title="Calibration Overall"
            value={
              loading
                ? "—"
                : `${data?.overallProgress?.calibrated ?? data?.calibratedCount ?? 0} / ${data?.overallProgress?.total ?? data?.total ?? 0}`
            }
            icon={CheckCircle2}
            variant="success"
            subtitle={
              loading
                ? "Total Completed Ratio"
                : `${data?.overallProgress?.percentage ?? 0}% Completed`
            }
            progressPercent={Number(data?.overallProgress?.percentage ?? 0)}
            actionLabel="Click to view list"
            onClick={() => handleCardClick("calibrated")}
            loading={loading}
          />
        )}

        {/* 2. Overdue Instruments */}
        {dashboardConfig.widgets.overdue !== false && (
          <KPICard
            index={1}
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
        )}

        {/* 3. Today's Calibrations */}
        {dashboardConfig.widgets.dueToday !== false && (
          <KPICard
            index={2}
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
        )}

        {/* 4. Period Progress */}
        {dashboardConfig.widgets.periodProgress !== false && (
          <KPICard
            index={3}
            title="Period Progress"
            value={loading ? "—" : `${completedCount} / ${plannedCount}`}
            icon={Target}
            variant="info"
            subtitle={
              loading
                ? "Completed / Planned"
                : `${completedCount} Done · ${Math.max(0, plannedCount - completedCount)} Pending (${targetProgressPercent}%)`
            }
            progressPercent={Number(targetProgressPercent)}
            actionLabel="Click to view list"
            onClick={() => handleCardClick("pending")}
            loading={loading}
          />
        )}

        {/* 5. Due Soon (Next 30 Days) */}
        {dashboardConfig.widgets.dueSoon !== false && (
          <KPICard
            index={4}
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
            actionLabel="Click to view list"
            onClick={() => handleCardClick("due_soon")}
            loading={loading}
          />
        )}

        {/* 6. Calibration Compliance % */}
        {dashboardConfig.widgets.compliance !== false && (
          <KPICard
            index={5}
            title="Compliance"
            value={loading ? "—" : `${complianceRate}%`}
            icon={ShieldCheck}
            variant="success"
            subtitle={
              loading
                ? "Compliant"
                : `${(data?.total || 0) - (data?.overdue || 0)} of ${data?.total || 0} compliant`
            }
            progressPercent={Number(complianceRate)}
            actionLabel="Click to inspect"
            onClick={() => navigate("/instruments")}
            loading={loading}
          />
        )}

        {/* 7. Total Master Inventory */}
        {dashboardConfig.widgets.totalMaster !== false && (
          <KPICard
            index={6}
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
        )}
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
        <Card className="rounded-xl border border-border bg-card shadow-xs h-full flex flex-col justify-between">
          <CardHeader className="pb-3 pt-4 px-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-muted text-foreground">
                    <Activity className="h-4 w-4" />
                  </div>
                  <span>Recent Activity Logs</span>
                </CardTitle>
                <CardDescription className="text-sm mt-1">
                  Last 10 calibration events and updates
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground px-2.5 py-0.5 rounded-full">
                Live Feed
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-4 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-xl" />
                ))}
              </div>
            ) : !data?.recentActivity?.length ? (
              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="Calibration events will appear here as calibrations are performed."
              />
            ) : (
              <div className="space-y-1.5">
                {data.recentActivity.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors group cursor-pointer border border-transparent"
                    onClick={() => navigate(`/instruments`)}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-md shrink-0 border shadow-2xs",
                        r.action === "Calibrated" || r.action === "OK"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                          : r.action === "Overdue"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                            : r.action === "Due Soon"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
                      )}
                    >
                      <Gauge className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {r.name}
                        </span>
                        {r.idCode && (
                          <Badge
                            variant="outline"
                            className="text-xs font-mono font-medium px-1.5 py-0 shrink-0 bg-background/80"
                          >
                            {r.idCode}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground/80">
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
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 font-medium">
                      {new Date(r.at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ─── Grid Row 3: Due Soon / Due in Selected Range Instruments Table ── */}
      <section aria-label="Instruments due soon">
        <Card className="rounded-xl border border-border bg-card shadow-2xs">
          <CardHeader className="pb-2 pt-3.5 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-extrabold tracking-tight flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <span>
                    {startDate || endDate
                      ? "Instruments Due in Selected Range"
                      : "Instruments Due Soon — Next 30 Days"}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  List of instruments requiring calibration within the selected
                  time window
                </CardDescription>
              </div>
              {(data?.dueSoonList?.length || 0) > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs font-mono font-extrabold tabular-nums bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 px-2.5 py-0.5 rounded-lg"
                >
                  {data?.dueSoonList?.length} instruments
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-xl" />
                ))}
              </div>
            ) : !data?.dueSoonList?.length ? (
              <EmptyState
                icon={CheckCircle2}
                title="All instruments up to date"
                description="No instruments require calibration within this time period."
              />
            ) : (
              <>
                <Table aria-label="Due soon instruments">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/60">
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                        Instrument
                      </TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider py-2.5">
                        Location
                      </TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider py-2.5 text-right">
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
                            className="group cursor-pointer hover:bg-muted/60 transition-colors border-border/40"
                            onClick={() => navigate("/instruments")}
                          >
                            <TableCell className="py-2.5">
                              <span className="text-xs font-bold group-hover:text-primary transition-colors">
                                {name}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="text-xs text-muted-foreground font-medium">
                                {loc || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <span
                                className={cn(
                                  "text-xs font-mono tabular-nums font-bold px-2 py-0.5 rounded-md",
                                  isOverdue
                                    ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20"
                                    : "text-muted-foreground bg-muted/40",
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
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
                    <span className="text-xs text-muted-foreground tabular-nums font-semibold">
                      Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="h-7 text-xs px-2.5 rounded-lg"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="h-7 text-xs px-2.5 rounded-lg"
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
