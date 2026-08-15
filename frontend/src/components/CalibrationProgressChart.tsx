import { useState } from 'react';
import Chart from 'react-apexcharts';
import { useTheme } from 'next-themes';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, BarChart3, TrendingUp, CheckCircle2 } from 'lucide-react';

interface WeeklyData {
  week: string;
  completed: number;
}

interface DailyData {
  day: string;
  date: string;
  completed: number;
}

interface CalibrationProgressChartProps {
  weeklyData: WeeklyData[];
  dailyData: DailyData[];
}

export function CalibrationProgressChart({ weeklyData, dailyData }: CalibrationProgressChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [view, setView] = useState<'week' | 'day'>('week');

  const totalCompleted = view === 'week'
    ? weeklyData.reduce((sum, w) => sum + w.completed, 0)
    : dailyData.reduce((sum, d) => sum + d.completed, 0);

  // Week view — horizontal bar chart
  const weekSeries = [{
    name: 'Completed',
    data: weeklyData.map(w => w.completed),
  }];

  const weekOptions: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 700,
      },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 5,
        borderRadiusApplication: 'end',
        barHeight: '55%',
        distributed: true,
      },
    },
    colors: weeklyData.map((_, i) => {
      const palette = ['#3b82f6', '#06b6d4', '#10b981', '#6366f1', '#8b5cf6', '#a855f7'];
      return palette[i % palette.length];
    }),
    dataLabels: {
      enabled: true,
      formatter: (val) => Number(val) > 0 ? `${val}` : '',
      style: {
        fontSize: '11px',
        fontWeight: 700,
        colors: ['#fff'],
      },
      offsetX: 0,
    },
    xaxis: {
      categories: weeklyData.map(w => w.week),
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
      labels: {
        style: {
          colors: isDark ? '#cbd5e1' : '#475569',
          fontSize: '11px',
          fontWeight: 600,
        },
        maxWidth: 130,
      },
    },
    grid: {
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      style: { fontSize: '12px', fontFamily: 'inherit' },
      y: { formatter: (val) => `${val} calibrations` },
    },
    legend: { show: false },
  };

  // Day view — area chart
  const daySeries = [{
    name: 'Completed',
    data: dailyData.map(d => d.completed),
  }];

  const dayOptions: ApexOptions = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 700,
      },
      sparkline: { enabled: false },
    },
    stroke: {
      curve: 'smooth',
      width: 3,
      colors: ['#10b981'],
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 100],
        colorStops: [
          { offset: 0, color: '#10b981', opacity: 0.45 },
          { offset: 100, color: '#10b981', opacity: 0.02 },
        ],
      },
    },
    markers: {
      size: 5,
      colors: ['#10b981'],
      strokeColors: isDark ? '#0b1120' : '#fff',
      strokeWidth: 2,
      hover: { size: 7 },
    },
    xaxis: {
      categories: dailyData.map(d => {
        const [year, month, day] = d.date.split('-');
        return `${d.day}\n${day}-${month}`;
      }),
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
      labels: {
        style: {
          colors: isDark ? '#94a3b8' : '#64748b',
          fontSize: '11px',
          fontWeight: 600,
        },
        formatter: (val: number) => Math.floor(val).toString(),
      },
      min: 0,
      forceNiceScale: false,
      stepSize: 1,
    },
    grid: {
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => Number(val) > 0 ? `${val}` : '',
      style: {
        fontSize: '11px',
        fontWeight: 700,
        colors: [isDark ? '#e2e8f0' : '#334155'],
      },
      offsetY: -8,
      background: { enabled: false },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      style: { fontSize: '12px', fontFamily: 'inherit' },
      x: {
        formatter: (val, opts) => {
          const index = opts.dataPointIndex;
          const d = dailyData[index];
          if (!d) return '';
          const [year, month, day] = d.date.split('-');
          const fullDayNames: Record<string, string> = {
            'Sun': 'Sunday', 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday'
          };
          const dayName = fullDayNames[d.day] || d.day;
          return `${dayName}, ${day}-${month}-${year}`;
        }
      },
      y: { formatter: (val) => `${val} calibrations` },
    },
    legend: { show: false },
  };

  const chartHeight = view === 'week' ? Math.max(200, weeklyData.length * 48) : 260;

  return (
    <Card className="world-class-card-static h-full flex flex-col justify-between">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span>Completed Calibrations</span>
          </CardTitle>
          <CardDescription className="text-xs">
            {view === 'week' ? 'Calibrations completed per week' : 'Calibrations completed per day (last 7 days)'}
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          {/* Total badge */}
          <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-extrabold tabular-nums bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {totalCompleted} Total
          </Badge>

          {/* View toggle */}
          <div className="flex bg-muted/60 rounded-xl p-0.5 gap-0.5 border border-border/40">
            <Button
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
              className={`h-7 px-3 text-[11px] font-bold rounded-lg transition-all ${view === 'week' ? 'shadow-sm bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              onClick={() => setView('week')}
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1" />
              Weekly
            </Button>
            <Button
              variant={view === 'day' ? 'default' : 'ghost'}
              size="sm"
              className={`h-7 px-3 text-[11px] font-bold rounded-lg transition-all ${view === 'day' ? 'shadow-sm bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              onClick={() => setView('day')}
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1" />
              Daily
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex items-center">
        <div className="w-full transition-all duration-300" style={{ minHeight: `${Math.min(chartHeight, 360)}px` }}>
          {view === 'week' ? (
            weeklyData.length === 0 || weeklyData.every(w => w.completed === 0) ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                  <BarChart3 className="h-6 w-6 opacity-30" />
                </div>
                <p className="text-sm font-semibold">No completed calibrations in this period</p>
                <p className="text-xs opacity-60 mt-1">Select a range with calibration activity</p>
              </div>
            ) : (
              <Chart options={weekOptions} series={weekSeries} type="bar" height={Math.min(chartHeight, 360)} />
            )
          ) : (
            dailyData.length === 0 || dailyData.every(d => d.completed === 0) ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                  <CalendarDays className="h-6 w-6 opacity-30" />
                </div>
                <p className="text-sm font-semibold">No completed calibrations in the last 7 days</p>
                <p className="text-xs opacity-60 mt-1">Complete calibrations to see them here</p>
              </div>
            ) : (
              <Chart options={dayOptions} series={daySeries} type="area" height={260} />
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

