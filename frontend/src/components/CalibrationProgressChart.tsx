import { useState } from 'react';
import Chart from 'react-apexcharts';
import { useTheme } from 'next-themes';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, BarChart3, TrendingUp } from 'lucide-react';

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
      fontFamily: 'inherit',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 600,
      },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        borderRadiusApplication: 'end',
        barHeight: '60%',
        distributed: true,
      },
    },
    colors: weeklyData.map((_, i) => {
      const palette = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#7c3aed'];
      return palette[i % palette.length];
    }),
    dataLabels: {
      enabled: true,
      formatter: (val) => `${val}`,
      style: {
        fontSize: '12px',
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
        },
      },
    },
    grid: {
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      strokeDashArray: 3,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
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
      fontFamily: 'inherit',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 600,
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
          { offset: 0, color: '#10b981', opacity: 0.4 },
          { offset: 100, color: '#10b981', opacity: 0.02 },
        ],
      },
    },
    markers: {
      size: 5,
      colors: ['#10b981'],
      strokeColors: isDark ? '#1e293b' : '#fff',
      strokeWidth: 2,
      hover: { size: 7 },
    },
    xaxis: {
      categories: dailyData.map(d => {
        const [year, month, day] = d.date.split('-');
        return `${d.day}\n${day}-${month}-${year.slice(2)}`;
      }),
      labels: {
        style: {
          colors: isDark ? '#94a3b8' : '#64748b',
          fontSize: '11px',
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
        },
        formatter: (val: number) => Math.floor(val).toString(),
      },
      min: 0,
      forceNiceScale: false,
      stepSize: 1,
    },
    grid: {
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => val > 0 ? `${val}` : '',
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
    <Card className="animate-in border-none shadow-md overflow-hidden bg-gradient-to-b from-card to-card/50 hover:shadow-lg transition-all duration-300">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/70">
            Completed Calibrations
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {view === 'week' ? 'Calibrations completed per week' : 'Calibrations completed per day (last 7 days)'}
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          {/* Total badge */}
          <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <TrendingUp className="h-4 w-4" />
            {totalCompleted} Total
          </div>

          {/* View toggle */}
          <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
            <Button
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 px-3 text-xs font-medium transition-all ${view === 'week' ? 'shadow-sm' : 'hover:bg-muted'}`}
              onClick={() => setView('week')}
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Weekly
            </Button>
            <Button
              variant={view === 'day' ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 px-3 text-xs font-medium transition-all ${view === 'day' ? 'shadow-sm' : 'hover:bg-muted'}`}
              onClick={() => setView('day')}
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Daily
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full transition-all duration-300" style={{ minHeight: `${Math.min(chartHeight, 360)}px` }}>
          {view === 'week' ? (
            weeklyData.length === 0 || weeklyData.every(w => w.completed === 0) ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <BarChart3 className="h-12 w-12 opacity-20 mb-3" />
                <p className="text-sm font-medium">No completed calibrations in this period</p>
                <p className="text-xs opacity-60 mt-1">Select a range with calibration activity</p>
              </div>
            ) : (
              <Chart options={weekOptions} series={weekSeries} type="bar" height={Math.min(chartHeight, 360)} />
            )
          ) : (
            dailyData.length === 0 || dailyData.every(d => d.completed === 0) ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CalendarDays className="h-12 w-12 opacity-20 mb-3" />
                <p className="text-sm font-medium">No completed calibrations in the last 7 days</p>
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
