import { useState, useMemo } from 'react';
import Chart from 'react-apexcharts';
import { useTheme } from 'next-themes';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, CheckCircle2, ChevronRight, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface PieData {
    name: string;
    value: number;
}

interface DashboardPieChartProps {
    calibrationStatusData: PieData[];
    itemStatusData: PieData[];
    colors?: string[];
    currentItemStatus?: string;
    onItemStatusChange?: (status: string | undefined) => void;
    currentCalibrationStatus?: string;
    onCalibrationStatusChange?: (status: string | undefined) => void;
}

// Highly differentiated, vibrant color mapping for every status
// Uses strongly contrasting hues (Blue, Orange, Green, Purple, Red, Gray) so no two statuses look similar
const STATUS_COLORS: Record<string, string> = {
    // Item / Inventory Statuses (High-contrast palette across the color wheel)
    'Active': '#2563eb',          // Vibrant Royal Blue
    'SPARE': '#f97316',           // Bright Sunset Orange (strongly contrasts with Blue)
    'Spare': '#f97316',
    'STOCK': '#10b981',           // Emerald Green (strongly contrasts with Blue & Orange)
    'Stock': '#10b981',
    'Inactive': '#64748b',        // Slate Neutral Gray
    'Scrapped': '#dc2626',        // Deep Crimson Red
    'Under Repair': '#9333ea',    // Vivid Violet Purple
    'Lost': '#ec4899',            // Hot Pink / Magenta
    'Rejected': '#991b1b',        // Dark Burgundy

    // Calibration Statuses
    'OK': '#10b981',              // Emerald Green
    'Calibrated': '#10b981',
    'Pass': '#10b981',
    'Overdue': '#ef4444',         // Bright Crimson Red
    'OVER DUE': '#ef4444',
    'NOT OK': '#ef4444',
    'Fail': '#ef4444',
    'Due Soon': '#f59e0b',        // Amber Yellow
    'DUE SOON': '#f59e0b',
    'Sent for Calibration': '#6366f1', // Royal Indigo
    'Under Calibration': '#0284c7',   // Vibrant Ocean Blue
    'In Calibration': '#0284c7',
};

// Fallback high-contrast palette
const DEFAULT_COLORS = [
    '#2563eb', // Royal Blue
    '#f97316', // Sunset Orange
    '#10b981', // Emerald Green
    '#9333ea', // Violet Purple
    '#ec4899', // Hot Pink
    '#06b6d4', // Cyan
    '#eab308', // Amber Yellow
    '#64748b', // Slate Gray
];

export function DashboardPieChart({
    calibrationStatusData = [],
    itemStatusData = [],
    currentItemStatus,
    onItemStatusChange,
    currentCalibrationStatus,
    onCalibrationStatusChange,
}: DashboardPieChartProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const navigate = useNavigate();

    // Default to 'itemStatus' (Inventory Status) as requested by user
    const [filterType, setFilterType] = useState<'itemStatus' | 'calibrationStatus'>('itemStatus');

    const getActiveData = () => {
        if (filterType === 'itemStatus') {
            const filtered = (itemStatusData || []).filter(d => d && d.name && d.name !== 'No Data' && d.value > 0);
            return filtered.length > 0 ? filtered : [];
        } else {
            const filtered = (calibrationStatusData || []).filter(d => d && d.name && d.name !== 'No Data' && d.value > 0);
            return filtered.length > 0 ? filtered : [];
        }
    };

    const activeData = getActiveData();
    const totalCount = activeData.reduce((sum, item) => sum + item.value, 0);

    // Perceptual Minimum Slice Scaling:
    // When a category has a very small count relative to the total (e.g. STOCK with 2 out of 1986 = 0.1%),
    // standard linear angle allocation (0.36 degrees) gets completely swallowed by the border stroke.
    // We allocate a guaranteed minimum visual arc (~3.5% = ~13 degrees) on the circular ring,
    // while preserving the exact true count and percentage in tooltips, structured legend, and total.
    const visualSeries = useMemo(() => {
        if (activeData.length === 0) return [];
        if (totalCount === 0) return activeData.map(() => 0);
        if (activeData.length === 1) return activeData.map(d => d.value);

        const MIN_VISUAL_PERCENT = 3.5; // ~13 degrees minimum arc for clear visual presence
        const minVisualValue = (totalCount * MIN_VISUAL_PERCENT) / 100;

        const hasSubThreshold = activeData.some(
            d => d.value > 0 && (d.value / totalCount) * 100 < MIN_VISUAL_PERCENT
        );

        if (!hasSubThreshold) {
            return activeData.map(d => d.value);
        }

        let reserved = 0;
        let normalTotal = 0;

        activeData.forEach(d => {
            if (d.value <= 0) return;
            const pct = (d.value / totalCount) * 100;
            if (pct < MIN_VISUAL_PERCENT) {
                reserved += minVisualValue;
            } else {
                normalTotal += d.value;
            }
        });

        const remainingBudget = Math.max(0, totalCount - reserved);
        const scaleFactor = normalTotal > 0 ? remainingBudget / normalTotal : 1;

        return activeData.map(d => {
            if (d.value <= 0) return 0;
            const pct = (d.value / totalCount) * 100;
            if (pct < MIN_VISUAL_PERCENT) {
                return Math.max(1, Math.round(minVisualValue));
            }
            return Math.max(1, Math.round(d.value * scaleFactor));
        });
    }, [activeData, totalCount]);

    const handleStatusClick = (statusName: string) => {
        const params = new URLSearchParams();
        if (filterType === 'itemStatus') {
            if (statusName !== 'Total') {
                params.append('item_status', statusName);
                if (onItemStatusChange) onItemStatusChange(statusName);
            } else {
                if (onItemStatusChange) onItemStatusChange(undefined);
            }
            navigate(`/instruments?${params.toString()}`);
        } else {
            if (statusName !== 'Total') {
                params.append('status', statusName);
                if (onCalibrationStatusChange) onCalibrationStatusChange(statusName);
            } else {
                if (onCalibrationStatusChange) onCalibrationStatusChange(undefined);
            }
            navigate(`/instruments?${params.toString()}`);
        }
    };

    const chartColors = activeData.map((d, i) => STATUS_COLORS[d.name] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]);

    const options: ApexOptions = {
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
                    speed: 350
                }
            },
            events: {
                dataPointSelection: (event, chartContext, config) => {
                    const selectedIndex = config.dataPointIndex;
                    if (selectedIndex !== undefined && activeData[selectedIndex]) {
                        handleStatusClick(activeData[selectedIndex].name);
                    }
                }
            }
        },
        labels: activeData.map(d => d.name),
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
                            fontSize: '26px',
                            fontWeight: 800,
                            fontFamily: "'Geist Mono', ui-monospace, monospace",
                            formatter: (val: string) => String(val),
                        },
                        total: {
                            show: true,
                            showAlways: true,
                            label: 'Total',
                            color: isDark ? '#94a3b8' : '#64748b',
                            fontSize: '11px',
                            fontWeight: 700,
                            formatter: () => String(totalCount),
                        }
                    }
                }
            }
        },
        dataLabels: {
            enabled: false,
        },
        stroke: {
            show: true,
            colors: [isDark ? '#0f172a' : '#ffffff'],
            width: 2, // Clean 2px hairline border that does not eat small slices
        },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            style: { fontSize: '12px', fontFamily: 'inherit' },
            y: {
                // Tooltip displays the true real count and true percentage
                formatter: (val, { seriesIndex }) => {
                    const realItem = activeData[seriesIndex];
                    if (!realItem) return '';
                    const realVal = realItem.value;
                    const pct = totalCount > 0 ? ((realVal / totalCount) * 100).toFixed(1) : '0';
                    return `${realVal} instruments (${pct}%)`;
                }
            }
        },
        legend: {
            show: false, // Structured interactive list on the right side provides optimal UX & scannability
        }
    };

    const headerTitle = filterType === 'itemStatus' ? 'Inventory Status' : 'Calibration Status';
    const headerDescription = filterType === 'itemStatus'
        ? 'Instruments by lifecycle status (Active, Inactive, SPARE, STOCK, etc.)'
        : 'Instruments by calibration compliance result (OK, Overdue, Due Soon)';
    const HeaderIcon = filterType === 'itemStatus' ? Package : CheckCircle2;
    const headerColor = filterType === 'itemStatus' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500';

    return (
        <Card className="world-class-card-static h-full flex flex-col justify-between">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-3">
                <div>
                    <CardTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${headerColor}`}>
                            <HeaderIcon className="h-4 w-4" />
                        </div>
                        <span>{headerTitle}</span>
                    </CardTitle>
                    <CardDescription className="text-xs">{headerDescription}</CardDescription>
                </div>

                {/* Segmented View Switch: Clean, prominent pill buttons matching CalibrationProgressChart */}
                <div className="flex bg-muted/60 rounded-xl p-0.5 gap-0.5 border border-border/40 shrink-0">
                    <Button
                        variant={filterType === 'itemStatus' ? 'default' : 'ghost'}
                        size="sm"
                        className={`h-7 px-3 text-[11px] font-bold rounded-lg transition-all ${
                            filterType === 'itemStatus'
                                ? 'shadow-sm bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                        onClick={() => setFilterType('itemStatus')}
                    >
                        <Package className="h-3.5 w-3.5 mr-1" />
                        Item Status
                    </Button>
                    <Button
                        variant={filterType === 'calibrationStatus' ? 'default' : 'ghost'}
                        size="sm"
                        className={`h-7 px-3 text-[11px] font-bold rounded-lg transition-all ${
                            filterType === 'calibrationStatus'
                                ? 'shadow-sm bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                        onClick={() => setFilterType('calibrationStatus')}
                    >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Calibration Status
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-between">
                {activeData.length === 0 || totalCount === 0 ? (
                    <div className="h-[280px] w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/70 rounded-2xl bg-muted/20">
                        <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                            <PieChart className="h-6 w-6 opacity-30 text-primary" />
                        </div>
                        <h4 className="text-sm font-bold text-foreground">No Status Data Available</h4>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[250px]">
                            No registered instruments found matching the current filter criteria.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row items-center gap-4 h-full">
                        {/* Donut Chart with guaranteed slice visibility */}
                        <div className="w-full md:w-1/2 h-[240px] flex items-center justify-center">
                            <Chart options={options} series={visualSeries} type="donut" height="100%" width="100%" />
                        </div>

                        {/* Structured Interactive Breakdown List with High-Contrast Color Indicators */}
                        <div className="w-full md:w-1/2 max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
                            {activeData.map((item, idx) => {
                                const percentage = totalCount > 0 ? ((item.value / totalCount) * 100).toFixed(1) : '0';
                                const color = chartColors[idx];

                                return (
                                    <div
                                        key={item.name}
                                        onClick={() => handleStatusClick(item.name)}
                                        className="flex items-center justify-between p-1.5 px-2.5 rounded-xl hover:bg-muted/70 transition-all cursor-pointer text-xs group border border-transparent hover:border-border/50"
                                        title={`View instruments with status: ${item.name}`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                            <span
                                                className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs"
                                                style={{ backgroundColor: color }}
                                            />
                                            <span className="font-semibold text-foreground/90 truncate group-hover:text-primary transition-colors">
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

                            {/* Total Summary Row (Clickable to view all, neutral indicator distinct from active) */}
                            <div
                                onClick={() => handleStatusClick('Total')}
                                className="flex items-center justify-between p-2 px-2.5 rounded-xl bg-muted/40 font-bold border border-border/60 mt-2 text-xs hover:bg-muted/70 transition-colors cursor-pointer group"
                                title="View all instruments"
                            >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-slate-600 dark:bg-slate-300" />
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
