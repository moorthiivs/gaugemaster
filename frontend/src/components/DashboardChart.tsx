import { useTheme } from 'next-themes';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

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
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BarChart3 className="h-12 w-12 opacity-20 mb-3" />
            <p className="text-sm font-medium">No workload data available</p>
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
      color: isDark ? '#60a5fa' : '#3b82f6'
    },
    {
      name: 'Actual (Completed)',
      data: data.map(d => d.actual),
      color: '#10b981'
    }
  ];

  const options: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'Inter, sans-serif',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 600,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: data.length <= 3 ? '30%' : data.length <= 6 ? '40%' : '55%',
        borderRadius: 4,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: {
      enabled: data.length <= 12,
      formatter: (val) => val > 0 ? `${val}` : '',
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
          fontSize: '11px'
        },
        formatter: (val) => Math.floor(val).toString(),
      },
      min: 0,
      forceNiceScale: true,
    },
    grid: {
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    fill: {
      opacity: 1
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: (val) => `${val} instruments`
      }
    },
    legend: {
      position: 'bottom',
      labels: {
        colors: isDark ? '#cbd5e1' : '#334155'
      },
      markers: {
        shape: 'circle',
      },
      fontSize: '12px',
      fontWeight: 600,
    }
  };

  return (
    <Card className="border border-border/60 shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full">
          <Chart options={options} series={series} type="bar" height="100%" />
        </div>
      </CardContent>
    </Card>
  );
}
