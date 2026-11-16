import { useState, useMemo } from 'react';
import Chart from 'react-apexcharts';
import { useTheme } from 'next-themes';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, ChevronRight, Search, X, ArrowUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

const CURATED_PALETTE = [
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
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
  '#ef4444', // red
  '#22c55e', // green
  '#eab308', // yellow
  '#a855f7', // violet
  '#059669', // dark emerald
  '#d97706', // dark amber
  '#4f46e5', // dark indigo
  '#c026d3', // dark fuchsia
  '#0284c7', // dark sky
  '#e11d48', // rose
  '#16a34a', // vibrant green
  '#ca8a04', // gold
];

function getModuleColor(name: string, index: number, isDark: boolean): string {
  const lower = name.toLowerCase().trim();
  if (lower === 'unassigned' || lower === 'others') {
    return isDark ? '#64748b' : '#94a3b8';
  }
  if (index < CURATED_PALETTE.length) {
    return CURATED_PALETTE[index];
  }
  // Golden ratio HSL generation ensures well-spaced, deterministic hues
  const goldenRatio = 0.618033988749895;
  const hue = Math.round(((index * goldenRatio) % 1) * 360);
  const saturation = isDark ? 70 : 80;
  const lightness = isDark ? 58 : 46;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function ModuleDistributionCard({ data = [], loading = false, onModuleClick }: ModuleDistributionCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count');

  const totalCount = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  // Color map keyed by original module name so colors never shift during search/sort
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((d, i) => {
      map.set(d.name, getModuleColor(d.name, i, isDark));
    });
    return map;
  }, [data, isDark]);

  const handleModuleClick = (moduleName: string) => {
    if (onModuleClick) {
      onModuleClick(moduleName);
    } else {
      if (moduleName.toLowerCase() === 'unassigned') {
        navigate('/instruments?module=Unassigned');
      } else if (moduleName.toLowerCase() === 'others') {
        navigate('/instruments');
      } else {
        navigate(`/instruments?module=${encodeURIComponent(moduleName)}`);
      }
    }
  };

  // Filter and sort for the legend list
  const filteredAndSortedData = useMemo(() => {
    let list = data;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => item.name.toLowerCase().includes(q));
    }

    const sorted = [...list];
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Default: count descending, then name ascending
      sorted.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    }
    return sorted;
  }, [data, searchQuery, sortBy]);

  const chartColors = useMemo(
    () => data.map((d) => colorMap.get(d.name) || '#3b82f6'),
    [data, colorMap]
  );

  const series = useMemo(() => data.map((d) => d.value), [data]);

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'donut',
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
                color: isDark ? '#cbd5e1' : '#475569',
                fontSize: '12px',
                fontWeight: 700,
              },
              value: {
                show: true,
                color: isDark ? '#f8fafc' : '#0f172a',
                fontSize: '24px',
                fontWeight: 800,
                fontFamily: "'Geist Mono', ui-monospace, monospace",
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
        width: 1.5,
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        style: { fontSize: '12px', fontFamily: 'inherit' },
        y: {
          formatter: (val) => {
            const pct = totalCount > 0 ? ((val / totalCount) * 100).toFixed(1) : '0';
            return `${val} instrument${val === 1 ? '' : 's'} (${pct}%)`;
          },
        },
      },
      legend: {
        show: false,
      },
    }),
    [data, chartColors, isDark, totalCount]
  );

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
        <div className="flex items-center justify-between gap-2">
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
          {!isEmpty && (
            <Badge variant="outline" className="text-[11px] font-bold bg-muted/40 border-border/70 tabular-nums shrink-0">
              {data.length} Modules
            </Badge>
          )}
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
            <div className="w-full md:w-1/2 h-[250px] flex items-center justify-center">
              <Chart options={options} series={series} type="donut" height="100%" width="100%" />
            </div>

            {/* Structured Legend with Search & Sort */}
            <div className="w-full md:w-1/2 flex flex-col h-[280px]">
              {/* Search and Sort Toolbar */}
              <div className="flex items-center gap-1.5 mb-2 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${data.length} modules...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 pl-8 pr-7 text-xs bg-muted/40 border-border/60 focus-visible:ring-1"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSortBy(sortBy === 'count' ? 'name' : 'count')}
                  className="h-7 px-2 text-[11px] font-bold gap-1 shrink-0 border-border/60 hover:bg-muted"
                  title={sortBy === 'count' ? 'Sorting by count (click for A-Z)' : 'Sorting alphabetically (click for count)'}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  <span>{sortBy === 'count' ? 'Count' : 'A–Z'}</span>
                </Button>
              </div>

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
                {filteredAndSortedData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center text-muted-foreground">
                    <p className="text-xs font-semibold">No modules match "{searchQuery}"</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className="text-xs h-6 px-1 mt-1 text-primary"
                    >
                      Clear search
                    </Button>
                  </div>
                ) : (
                  filteredAndSortedData.map((item) => {
                    const percentage = totalCount > 0 ? ((item.value / totalCount) * 100).toFixed(1) : '0';
                    const color = colorMap.get(item.name) || '#3b82f6';

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
                          <span
                            className="font-semibold text-foreground/90 truncate group-hover:text-primary transition-colors"
                            title={item.name}
                          >
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
                  })
                )}
              </div>

              {/* Total Count Row (Always Last) */}
              <div
                onClick={() => navigate('/instruments')}
                className="flex items-center justify-between p-2 px-2.5 rounded-xl bg-muted/40 font-bold border border-border/60 mt-1.5 text-xs hover:bg-muted/70 transition-colors cursor-pointer group shrink-0"
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
