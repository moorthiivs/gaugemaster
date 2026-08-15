import { useState } from 'react';
import Chart from 'react-apexcharts';
import { useTheme } from 'next-themes';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, ChevronRight, PieChart } from 'lucide-react';
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
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#f97316', // orange
  '#14b8a6', // teal
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
      fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
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
          size: '70%',
          labels: {
            show: true,
            name: {
              show: true,
              color: isDark ? '#cbd5e1' : '#475569',
              fontSize: '12px',
              fontWeight: 700,
            },
            value: {
              show: true,
              color: isDark ? '#f8fafc' : '#0f172a',
              fontSize: '24px',
              fontWeight: 800,
              fontFamily: "'Plus Jakarta Sans', monospace",
              formatter: (val) => String(val),
            },
            total: {
              show: true,
              showAlways: true,
              label: 'Total',
              color: isDark ? '#94a3b8' : '#64748b',
              fontSize: '11px',
              fontWeight: 700,
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
      colors: [isDark ? '#0b1120' : '#ffffff'],
      width: 3,
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      style: { fontSize: '12px', fontFamily: 'inherit' },
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
      <Card className="world-class-card-static h-full">
        <CardHeader className="pb-2 pt-3 px-4">
          <Skeleton className="h-5 w-40 mb-1" />
          <Skeleton className="h-3 w-56" />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-[310px] w-full flex items-center justify-center">
            <Skeleton className="h-44 w-44 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isEmpty = !data || data.length === 0 || totalCount === 0;

  return (
    <Card className="world-class-card-static h-full flex flex-col justify-between">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
                <Layers className="h-4 w-4" />
              </div>
              <span>Module Distribution</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Distribution of instruments across plant modules
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-between">
        {isEmpty ? (
          <div className="h-[300px] w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/70 rounded-2xl bg-muted/20">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Layers className="h-6 w-6 text-primary/70" />
            </div>
            <h4 className="text-sm font-bold text-foreground">No Module Data Available</h4>
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
                    className="flex items-center justify-between p-1.5 px-2.5 rounded-xl hover:bg-muted/70 transition-all cursor-pointer text-xs group border border-transparent hover:border-border/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold text-foreground/90 truncate group-hover:text-primary transition-colors" title={item.name}>
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className="font-extrabold text-foreground">{item.value}</span>
                      <span className="text-[11px] text-muted-foreground min-w-[42px] text-right font-medium">
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
                className="flex items-center justify-between p-2 px-2.5 rounded-xl bg-muted/40 font-bold border border-border/60 mt-2 text-xs hover:bg-muted/70 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-primary" />
                  <span className="font-extrabold text-foreground group-hover:text-primary transition-colors">
                    Total
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                  <span className="font-black text-foreground">{totalCount}</span>
                  <span className="text-[11px] text-muted-foreground min-w-[42px] text-right font-bold">
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

