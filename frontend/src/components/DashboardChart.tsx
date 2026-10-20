import { useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Layers, Calendar, ArrowUpRight, Gauge, Wrench, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChartData {
  month: string;
  plan: number;
  actual: number;
}

export interface DeviceTypeWorkload {
  deviceType: string;
  plan: number;
  actual: number;
}

interface DashboardChartProps {
  data: ChartData[];
  deviceTypeData?: DeviceTypeWorkload[];
  title?: string;
  description?: string;
  dateRangeLabel?: string;
  onCategoryClick?: (deviceType: string, type?: 'plan' | 'actual') => void;
}

const STANDARD_CATEGORIES = ['GAUGES', 'INSTRUMENTS', 'EXTERNAL/REF STANDARDS'] as const;

export function DashboardChart({
  data,
  deviceTypeData = [],
  title = 'Calibration Workload',
  description = 'Planned vs completed calibrations breakdown',
  dateRangeLabel,
  onCategoryClick,
}: DashboardChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Toggle view between "By Device Type" (Excel style grouped columns) and "Monthly Trend"
  const [viewMode, setViewMode] = useState<'deviceType' | 'monthly'>('deviceType');

  // ── Normalize Device Type Data ──────────────────────────────────────
  const normalizedDeviceTypeMap = useMemo(() => {
    const map = new Map<string, { plan: number; actual: number }>();
    STANDARD_CATEGORIES.forEach((cat) => map.set(cat, { plan: 0, actual: 0 }));

    if (Array.isArray(deviceTypeData) && deviceTypeData.length > 0) {
      deviceTypeData.forEach((item) => {
        const raw = (item.deviceType || '').trim().toUpperCase();
        let targetKey: string = 'INSTRUMENTS';

        if (raw.includes('REF') || raw.includes('MASTER') || raw.includes('EXTERNAL')) {
          targetKey = 'EXTERNAL/REF STANDARDS';
        } else if (raw.includes('GAUGE')) {
          targetKey = 'GAUGES';
        } else {
          targetKey = 'INSTRUMENTS';
        }

        const existing = map.get(targetKey) || { plan: 0, actual: 0 };
        map.set(targetKey, {
          plan: existing.plan + (Number(item.plan) || 0),
          actual: existing.actual + (Number(item.actual) || 0),
        });
      });
    }

    return map;
  }, [deviceTypeData]);

  // Aggregate totals
  const totalDevicePlan = useMemo(() => {
    let sum = 0;
    normalizedDeviceTypeMap.forEach((v) => (sum += v.plan));
    return sum;
  }, [normalizedDeviceTypeMap]);

  const totalDeviceActual = useMemo(() => {
    let sum = 0;
    normalizedDeviceTypeMap.forEach((v) => (sum += v.actual));
    return sum;
  }, [normalizedDeviceTypeMap]);

  const hasDeviceData = totalDevicePlan > 0 || totalDeviceActual > 0;
  const hasMonthlyData = Array.isArray(data) && data.length > 0 && data.some((d) => d.plan > 0 || d.actual > 0);

  // ── 1. Device Type View Options & Series (Excel Grouped Column Style) ──
  const deviceTypeSeries = useMemo(() => {
    const planSeries = STANDARD_CATEGORIES.map((cat) => normalizedDeviceTypeMap.get(cat)?.plan || 0);
    const actualSeries = STANDARD_CATEGORIES.map((cat) => normalizedDeviceTypeMap.get(cat)?.actual || 0);

    return [
      {
        name: 'Plan',
        data: planSeries,
      },
      {
        name: 'Actual',
        data: actualSeries,
      },
    ];
  }, [normalizedDeviceTypeMap]);

  const deviceTypeOptions: ApexOptions = useMemo(() => {
    // Peak value for head-room calculation so data labels are never clipped
    const maxVal = Math.max(
      ...deviceTypeSeries.flatMap((s) => s.data as number[]),
      10
    );

    return {
      chart: {
        type: 'bar',
        toolbar: { show: false },
        background: 'transparent',
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 650,
          dynamicAnimation: { enabled: true, speed: 300 },
        },
        events: {
          dataPointSelection: (_event, _chartContext, config) => {
            if (config?.dataPointIndex !== undefined && onCategoryClick) {
              const selectedCat = STANDARD_CATEGORIES[config.dataPointIndex];
              const seriesType = config.seriesIndex === 0 ? 'plan' : 'actual';
              if (selectedCat) onCategoryClick(selectedCat, seriesType);
            }
          },
        },
      },
      // Plan: Deep Navy / Slate Indigo, Actual: Forest / Emerald Green
      colors: isDark ? ['#3b82f6', '#10b981'] : ['#1e3a8a', '#15803d'],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '38%',
          borderRadius: 4,
          borderRadiusApplication: 'end',
          dataLabels: {
            position: 'top', // Numbers sit on top of the bars exactly like the Excel chart
          },
        },
      },
      dataLabels: {
        enabled: true,
        offsetY: -22,
        formatter: (val) => (val !== undefined && val !== null ? String(val) : '0'),
        style: {
          fontSize: '11px',
          fontFamily: "'Geist Mono', 'Consolas', monospace",
          fontWeight: 800,
          colors: [isDark ? '#e2e8f0' : '#0f172a'],
        },
      },
      stroke: {
        show: true,
        width: 1.5,
        colors: ['transparent'],
      },
      xaxis: {
        categories: [...STANDARD_CATEGORIES],
        labels: {
          style: {
            colors: isDark ? '#cbd5e1' : '#1e293b',
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: "'Geist', sans-serif",
          },
          offsetY: 2,
        },
        axisBorder: {
          show: true,
          color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
        },
        axisTicks: { show: false },
      },
      yaxis: {
        title: {
          text: 'No. Of Gauges & Instruments',
          style: {
            color: isDark ? '#94a3b8' : '#475569',
            fontSize: '11px',
            fontWeight: 700,
          },
        },
        labels: {
          style: {
            colors: isDark ? '#94a3b8' : '#64748b',
            fontSize: '11px',
            fontWeight: 600,
          },
          formatter: (val) => Math.floor(val).toString(),
        },
        min: 0,
        max: Math.ceil(maxVal * 1.15), // 15% headroom for top-standing numbers
        forceNiceScale: true,
      },
      grid: {
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
        strokeDashArray: 3,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
      },
      fill: {
        opacity: 0.96,
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        style: { fontSize: '12px' },
        y: {
          formatter: (val) => `${val} items`,
        },
      },
      legend: {
        show: true,
        position: 'bottom',
        horizontalAlign: 'center',
        labels: {
          colors: isDark ? '#cbd5e1' : '#334155',
        },
        markers: {
          shape: 'square',
          radius: 2,
          offsetX: -3,
        },
        fontSize: '12px',
        fontWeight: 700,
        itemMargin: { horizontal: 16, vertical: 4 },
      },
    };
  }, [isDark, deviceTypeSeries, onCategoryClick]);

  // ── 2. Monthly Trend View Options & Series (Original Timeline Style) ──
  const monthlySeries = useMemo(() => {
    return [
      {
        name: 'Plan (Due)',
        data: (data || []).map((d) => d.plan),
      },
      {
        name: 'Actual (Completed)',
        data: (data || []).map((d) => d.actual),
      },
    ];
  }, [data]);

  const monthlyOptions: ApexOptions = useMemo(() => {
    return {
      chart: {
        type: 'bar',
        toolbar: { show: false },
        background: 'transparent',
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 650,
          dynamicAnimation: { enabled: true, speed: 300 },
        },
      },
      colors: ['#3b82f6', '#10b981'],
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: (data || []).length <= 3 ? '28%' : (data || []).length <= 6 ? '38%' : '52%',
          borderRadius: 5,
          borderRadiusApplication: 'end',
        },
      },
      dataLabels: {
        enabled: (data || []).length <= 12,
        formatter: (val) => (Number(val) > 0 ? `${val}` : ''),
        style: {
          fontSize: '10px',
          fontWeight: 700,
          colors: ['#fff'],
        },
        offsetY: -2,
      },
      stroke: {
        show: true,
        width: 2,
        colors: ['transparent'],
      },
      xaxis: {
        categories: (data || []).map((d) => d.month),
        labels: {
          style: {
            colors: isDark ? '#94a3b8' : '#64748b',
            fontSize: '11px',
            fontWeight: 600,
          },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        title: {
          text: 'Instruments',
          style: {
            color: isDark ? '#64748b' : '#94a3b8',
            fontSize: '11px',
            fontWeight: 600,
          },
        },
        labels: {
          style: {
            colors: isDark ? '#94a3b8' : '#64748b',
            fontSize: '11px',
            fontWeight: 600,
          },
          formatter: (val) => Math.floor(val).toString(),
        },
        min: 0,
        forceNiceScale: true,
      },
      grid: {
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
      },
      fill: {
        type: 'gradient',
        gradient: {
          shade: isDark ? 'dark' : 'light',
          type: 'vertical',
          shadeIntensity: 0.25,
          gradientToColors: ['#60a5fa', '#34d399'],
          inverseColors: false,
          opacityFrom: 0.95,
          opacityTo: 0.85,
          stops: [0, 100],
        },
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        style: { fontSize: '12px' },
        y: {
          formatter: (val) => `${val} instruments`,
        },
      },
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        labels: {
          colors: isDark ? '#cbd5e1' : '#334155',
        },
        markers: {
          shape: 'circle',
        },
        fontSize: '12px',
        fontWeight: 600,
        itemMargin: { horizontal: 10, vertical: 0 },
      },
    };
  }, [data, isDark]);

  // Category Icon helper
  const getCategoryIcon = (cat: string) => {
    if (cat === 'GAUGES') return Gauge;
    if (cat === 'EXTERNAL/REF STANDARDS') return ShieldCheck;
    return Wrench;
  };

  return (
    <Card className="world-class-card-static h-full flex flex-col justify-between">
      {/* ── Card Header & View Switcher ── */}
      <CardHeader className="pb-2.5 pt-3.5 px-4 sm:px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40">
        <div>
          <CardTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span>{title}</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            {viewMode === 'deviceType'
              ? `INSTRUMENTS & GAUGES CALIBRATION STATUS ${dateRangeLabel ? `(${dateRangeLabel})` : ''}`
              : description}
          </CardDescription>
        </div>

        {/* View Switcher: Device Type vs. Monthly Trend */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 shrink-0 self-start sm:self-auto">
          <Button
            type="button"
            variant={viewMode === 'deviceType' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('deviceType')}
            className={cn(
              'h-7 px-2.5 text-xs font-bold rounded-lg transition-all gap-1.5',
              viewMode === 'deviceType'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>By Device Type</span>
          </Button>

          <Button
            type="button"
            variant={viewMode === 'monthly' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('monthly')}
            className={cn(
              'h-7 px-2.5 text-xs font-bold rounded-lg transition-all gap-1.5',
              viewMode === 'monthly'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Monthly Trend</span>
          </Button>
        </div>
      </CardHeader>

      {/* ── Main Chart Area ── */}
      <CardContent className="p-3 sm:p-5 flex-1 flex flex-col justify-between">
        {viewMode === 'deviceType' ? (
          !hasDeviceData ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground flex-1">
              <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                <Layers className="h-6 w-6 opacity-30" />
              </div>
              <p className="text-sm font-semibold">No device workload data in this range</p>
              <p className="text-xs opacity-60 mt-1">Select a date range with scheduled or completed calibrations</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 justify-between gap-3">
              {/* Excel Inspired Top Banner Pill */}
              <div className="flex items-center justify-between px-2 py-1 bg-muted/40 rounded-lg text-xs font-bold border border-border/40">
                <span className="text-[11px] font-extrabold tracking-wide uppercase text-foreground/90">
                  INSTRUMENTS &amp; GAUGES CALIBRATION STATUS
                </span>
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] bg-background text-primary border-primary/30"
                >
                  {dateRangeLabel || 'Active Filter'}
                </Badge>
              </div>

              {/* ApexCharts Grouped Bar Chart */}
              <div className="h-[250px] sm:h-[260px] w-full">
                <Chart
                  options={deviceTypeOptions}
                  series={deviceTypeSeries}
                  type="bar"
                  height="100%"
                />
              </div>

              {/* ── Category Breakdown Pills (Ref: Excel Summary Metric Cards) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40">
                {STANDARD_CATEGORIES.map((cat) => {
                  const item = normalizedDeviceTypeMap.get(cat) || { plan: 0, actual: 0 };
                  const pct =
                    item.plan > 0
                      ? Math.min(100, Math.round((item.actual / item.plan) * 100))
                      : item.actual > 0
                      ? 100
                      : 0;
                  const Icon = getCategoryIcon(cat);

                  return (
                    <div
                      key={cat}
                      onClick={() => onCategoryClick?.(cat)}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-xl bg-card border border-border/60 transition-all text-xs group select-none',
                        onCategoryClick && 'cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02]'
                      )}
                      title={`Click to view ${cat} in inventory`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded-lg bg-muted text-foreground/80 shrink-0">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-[10px] uppercase text-muted-foreground tracking-tight block truncate">
                            {cat === 'EXTERNAL/REF STANDARDS' ? 'Ref Standards' : cat}
                          </span>
                          <span className="font-mono font-bold text-xs text-foreground tabular-nums">
                            {item.actual} <span className="text-muted-foreground font-normal">/ {item.plan}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-mono font-bold px-1.5 py-0',
                            pct >= 100
                              ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                              : pct >= 50
                              ? 'border-blue-500/30 text-blue-600 bg-blue-500/10'
                              : 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                          )}
                        >
                          {pct}%
                        </Badge>
                        {onCategoryClick && (
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : !hasMonthlyData ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground flex-1">
            <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
              <Calendar className="h-6 w-6 opacity-30" />
            </div>
            <p className="text-sm font-semibold">No monthly timeline data available</p>
            <p className="text-xs opacity-60 mt-1">Select a wider date range with calibration activity</p>
          </div>
        ) : (
          <div className="h-[310px] w-full">
            <Chart options={monthlyOptions} series={monthlySeries} type="bar" height="100%" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
