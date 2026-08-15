import { useTheme } from 'next-themes';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp } from 'lucide-react';

interface ChartData {
  month: string;
  plan: number;
  actual: number;
}

interface DashboardChartProps {
  data: ChartData[];
  title?: string;
  description?: string;
}

export function DashboardChart({
  data,
  title = 'Calibration Workload',
  description = 'Monthly planned vs completed calibrations',
}: DashboardChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!data || data.length === 0) {
    return (
      <Card className="world-class-card-static h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            {title}
          </CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
              <BarChart3 className="h-6 w-6 opacity-30" />
            </div>
            <p className="text-sm font-semibold">No workload data available</p>
            <p className="text-xs opacity-60 mt-1">Select a date range with calibration activity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const series = [
    {
      name: 'Plan (Due)',
      data: data.map(d => d.plan),
    },
    {
      name: 'Actual (Completed)',
      data: data.map(d => d.actual),
    }
  ];

  const options: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 700,
        dynamicAnimation: { enabled: true, speed: 350 },
      },
    },
    colors: ['#3b82f6', '#10b981'],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: data.length <= 3 ? '28%' : data.length <= 6 ? '38%' : '52%',
        borderRadius: 5,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: {
      enabled: data.length <= 12,
      formatter: (val) => Number(val) > 0 ? `${val}` : '',
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
      colors: ['transparent']
    },
    xaxis: {
      categories: data.map(d => d.month),
      labels: {
        style: {
          colors: isDark ? '#94a3b8' : '#64748b',
          fontSize: '11px',
          fontWeight: 600,
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      title: {
        text: 'Instruments',
        style: {
          color: isDark ? '#64748b' : '#94a3b8',
          fontSize: '11px',
          fontWeight: 600,
        }
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
      yaxis: { lines: { show: true } }
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
        stops: [0, 100]
      }
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      style: { fontSize: '12px', fontFamily: 'inherit' },
      y: {
        formatter: (val) => `${val} instruments`
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: {
        colors: isDark ? '#cbd5e1' : '#334155'
      },
      markers: {
        shape: 'circle',
      },
      fontSize: '12px',
      fontWeight: 600,
      itemMargin: { horizontal: 10, vertical: 0 }
    }
  };

  return (
    <Card className="world-class-card-static h-full flex flex-col justify-between">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <BarChart3 className="h-4 w-4" />
            </div>
            <span>{title}</span>
          </CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex items-center">
        <div className="h-[310px] w-full">
          <Chart options={options} series={series} type="bar" height="100%" />
        </div>
      </CardContent>
    </Card>
  );
}

