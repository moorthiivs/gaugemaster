import { useState } from 'react';
import Chart from 'react-apexcharts';
import { useTheme } from 'next-themes';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

interface ModuleData {
  name: string;
  value: number;
}

interface ModuleDistributionCardProps {
  data?: ModuleData[];
  loading?: boolean;
  onModuleClick?: (moduleName: string) => void;
}

const MODULE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#f97316', // orange
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#64748b', // slate for Others
];

export function ModuleDistributionCard({ data = [], loading = false, onModuleClick }: ModuleDistributionCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const totalCount = data.reduce((sum, item) => sum + item.value, 0);

  const handleModuleClick = (moduleName: string) => {
    if (onModuleClick) {
      onModuleClick(moduleName);
    } else {
      if (moduleName === 'Others') {
        navigate('/instruments');
      } else {
        navigate(`/instruments?search=${encodeURIComponent(moduleName)}`);
      }
    }
  };

  const chartColors = data.map((d, i) =>
    d.name === 'Others' ? '#64748b' : MODULE_COLORS[i % (MODULE_COLORS.length - 1)]
  );

  const series = data.map((d) => d.value);

  const options: ApexOptions = {
    chart: {
      type: 'donut',
      fontFamily: 'Inter, sans-serif',
      background: 'transparent',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        dynamicAnimation: {
          enabled: true,
          speed: 350,
        },
      },
      events: {
        dataPointSelection: (event, chartContext, config) => {
          const selectedIndex = config.dataPointIndex;
          if (selectedIndex !== undefined && data[selectedIndex]) {
            handleModuleClick(data[selectedIndex].name);
          }
        },
      },
    },
    labels: data.map((d) => d.name),
    colors: chartColors,
    plotOptions: {
      pie: {
        donut: {
          size: '68%',
          labels: {
            show: true,
            name: {
              show: true,
              color: isDark ? '#e2e8f0' : '#475569',
              fontSize: '13px',
              fontWeight: 600,
            },
            value: {
              show: true,
              color: isDark ? '#f8fafc' : '#0f172a',
              fontSize: '24px',
              fontWeight: 800,
              fontFamily: 'Inter, monospace',
              formatter: (val) => String(val),
            },
            total: {
              show: true,
              showAlways: true,
              label: 'Total',
              color: isDark ? '#94a3b8' : '#64748b',
              fontSize: '12px',
              fontWeight: 600,
              formatter: () => String(totalCount),
            },
          },
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      colors: [isDark ? '#0f172a' : '#ffffff'],
      width: 3,
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: (val) => {
          const pct = totalCount > 0 ? ((val / totalCount) * 100).toFixed(1) : '0';
          return `${val} instruments (${pct}%)`;
        },
      },
    },
    legend: {
      show: false,
    },
  };

  if (loading) {
    return (
      <Card className="h-full border border-border/70 shadow-xs">
        <CardHeader className="pb-2 pt-3 px-4">
          <Skeleton className="h-5 w-40 mb-1" />
          <Skeleton className="h-3 w-56" />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-[320px] w-full flex items-center justify-center">
            <Skeleton className="h-44 w-44 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isEmpty = !data || data.length === 0 || totalCount === 0;

  return (
    <Card className="h-full border border-border/70 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Module Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              Distribution of instruments by Module
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-between">
        {isEmpty ? (
          <div className="h-[300px] w-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-muted rounded-xl bg-muted/20">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Layers className="h-6 w-6 text-primary/60" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">No Module Data Available</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-[250px]">
              No instruments with assigned modules match the current filter criteria.
            </p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-4 h-full">
            {/* Donut Chart */}
            <div className="w-full md:w-1/2 h-[240px] flex items-center justify-center">
              <Chart options={options} series={series} type="donut" height="100%" width="100%" />
            </div>

            {/* Structured Legend with Name, Count, Percentage */}
            <div className="w-full md:w-1/2 max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
              {data.map((item, idx) => {
                const percentage = totalCount > 0 ? ((item.value / totalCount) * 100).toFixed(1) : '0';
                const color = chartColors[idx];

                return (
                  <div
                    key={item.name}
                    onClick={() => handleModuleClick(item.name)}
                    className="flex items-center justify-between p-1.5 px-2 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer text-xs group"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium text-foreground truncate group-hover:text-primary transition-colors" title={item.name}>
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className="font-bold text-foreground">{item.value}</span>
                      <span className="text-[11px] text-muted-foreground min-w-[42px] text-right">
                        ({percentage}%)
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}

              {/* Total Count Row (Always Last) */}
              <div
                onClick={() => navigate('/instruments')}
                className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-muted/40 font-bold border-t border-border mt-1.5 text-xs hover:bg-muted/70 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-primary" />
                  <span className="font-extrabold text-foreground group-hover:text-primary transition-colors">
                    Total
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                  <span className="font-extrabold text-foreground">{totalCount}</span>
                  <span className="text-[11px] text-muted-foreground min-w-[42px] text-right font-semibold">
                    (100%)
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
