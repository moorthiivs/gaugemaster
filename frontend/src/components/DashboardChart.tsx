import { useTheme } from 'next-themes';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  title = 'Upcoming Calibrations',
  description = 'Monthly calibration schedule for the next 6 months',
}: DashboardChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const series = [
    {
      name: 'Plan (Due)',
      data: data.map(d => d.plan),
      color: '#3b82f6'
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
      fontFamily: 'inherit',
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '40%', // Fixed to prevent extremely wide columns when data is scarce
        borderRadius: 4,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: {
      enabled: false,
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
          fontSize: '12px'
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark ? '#94a3b8' : '#64748b',
          fontSize: '12px'
        }
      }
    },
    grid: {
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
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
        formatter: (val) => `${val}`
      }
    },
    legend: {
      position: 'bottom',
      labels: {
        colors: isDark ? '#cbd5e1' : '#334155'
      },
      markers: {
        shape: 'circle'
      }
    }
  };

  return (
    <Card className="animate-in border-none shadow-md overflow-hidden bg-gradient-to-b from-card to-card/50 hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/70">{title}</CardTitle>
          <CardDescription className="text-muted-foreground">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full">
          <Chart options={options} series={series} type="bar" height="100%" />
        </div>
      </CardContent>
    </Card>
  );
}
