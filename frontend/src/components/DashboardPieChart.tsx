import { useState } from 'react';
import Chart from 'react-apexcharts';
import { useTheme } from 'next-themes';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PieData {
    name: string;
    value: number;
}

interface DashboardPieChartProps {
    calibrationStatusData: PieData[];
    itemStatusData: PieData[];
    colors?: string[];
    currentItemStatus?: string;
    onItemStatusChange: (status: string | undefined) => void;
    currentCalibrationStatus?: string;
    onCalibrationStatusChange: (status: string | undefined) => void;
}

// Consistent curated color mapping for calibration statuses
const STATUS_COLORS: Record<string, string> = {
    'OK': '#10b981',
    'Calibrated': '#10b981',
    'Pass': '#10b981',
    'NOT OK': '#ef4444',
    'Fail': '#ef4444',
    'Overdue': '#ef4444',
    'OVER DUE': '#ef4444',
    'DUE SOON': '#f59e0b',
    'Due Soon': '#f59e0b',
    'Sent for Calibration': '#6366f1',
    'Active': '#3b82f6',
    'Inactive': '#94a3b8',
    'Scrapped': '#64748b',
    'Under Repair': '#8b5cf6',
};

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899', '#06b6d4'];

export function DashboardPieChart({
    calibrationStatusData,
    itemStatusData,
    currentItemStatus,
    onItemStatusChange,
    currentCalibrationStatus,
    onCalibrationStatusChange,
}: DashboardPieChartProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [filterType, setFilterType] = useState<'calibrationStatus' | 'itemStatus'>('calibrationStatus');

    const getActiveData = () => {
        switch (filterType) {
            case 'itemStatus':
                return itemStatusData.length > 0 
                    ? itemStatusData 
                    : [{ name: 'No Data', value: 0 }];
            case 'calibrationStatus':
            default:
                return calibrationStatusData.length > 0 
                    ? calibrationStatusData 
                    : [{ name: 'No Data', value: 0 }];
        }
    };

    const getHeaderInfo = () => {
        switch (filterType) {
            case 'itemStatus':
                return {
                    title: 'Inventory Status',
                    description: 'Instruments by inventory status (Active, Inactive, Scrapped)',
                };
            case 'calibrationStatus':
            default:
                return {
                    title: 'Status Distribution',
                    description: 'Instruments by calibration result',
                };
        }
    };

    const activeData = getActiveData();
    const { title, description } = getHeaderInfo();
    const isFilterActive = filterType === 'calibrationStatus' ? !!currentCalibrationStatus : !!currentItemStatus;

    // Map colors based on status names
    const chartColors = activeData.map((d, i) => STATUS_COLORS[d.name] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]);

    const series = activeData.map(d => d.value);
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
                    speed: 350
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
                            fontFamily: "'Plus Jakarta Sans', monospace",
                        },
                        total: {
                            show: true,
                            showAlways: true,
                            label: 'Total',
                            color: isDark ? '#94a3b8' : '#64748b',
                            fontSize: '11px',
                            fontWeight: 700,
                            formatter: function (w) {
                                return w.globals.seriesTotals.reduce((a: any, b: any) => {
                                    return a + b
                                }, 0)
                            }
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
            colors: [isDark ? '#0b1120' : '#ffffff'],
            width: 3
        },
        tooltip: {
            theme: isDark ? 'dark' : 'light',
            style: { fontSize: '12px', fontFamily: 'inherit' },
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
        <Card className="world-class-card-static h-full flex flex-col justify-between">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-3">
                <div>
                    <CardTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                            <PieChart className="h-4 w-4" />
                        </div>
                        <span>{title}</span>
                    </CardTitle>
                    <CardDescription className="text-xs">{description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className={`h-8 w-8 p-0 rounded-lg ${isFilterActive ? "text-primary border-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
                                title="Filter chart data"
                            >
                                <Filter className={`h-3.5 w-3.5 ${isFilterActive ? "fill-primary/20" : ""}`} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl backdrop-blur-xl bg-popover/95 border-border/80">
                            {filterType === 'calibrationStatus' ? (
                                <>
                                    <DropdownMenuLabel className="text-xs font-bold">Filter Calibration Result</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuCheckboxItem
                                        checked={!currentCalibrationStatus}
                                        onCheckedChange={() => onCalibrationStatusChange(undefined)}
                                        className="text-xs"
                                    >
                                        All Results
                                    </DropdownMenuCheckboxItem>
                                    {calibrationStatusData.filter(d => d.name !== 'No Data').map((statusObj) => (
                                        <DropdownMenuCheckboxItem
                                            key={statusObj.name}
                                            checked={currentCalibrationStatus === statusObj.name}
                                            onCheckedChange={() => onCalibrationStatusChange(statusObj.name)}
                                            className="text-xs"
                                        >
                                            {statusObj.name} Only
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </>
                            ) : (
                                <>
                                    <DropdownMenuLabel className="text-xs font-bold">Filter Item Status</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuCheckboxItem
                                        checked={!currentItemStatus}
                                        onCheckedChange={() => onItemStatusChange(undefined)}
                                        className="text-xs"
                                    >
                                        All Statuses
                                    </DropdownMenuCheckboxItem>
                                    {itemStatusData.filter(d => d.name !== 'No Data').map((statusObj) => (
                                        <DropdownMenuCheckboxItem
                                            key={statusObj.name}
                                            checked={currentItemStatus === statusObj.name}
                                            onCheckedChange={() => onItemStatusChange(statusObj.name)}
                                            className="text-xs"
                                        >
                                            {statusObj.name} Only
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Select
                        value={filterType}
                        onValueChange={(val: any) => setFilterType(val)}
                    >
                        <SelectTrigger className="w-[150px] h-8 text-xs font-semibold rounded-lg bg-card/60">
                            <SelectValue placeholder="Select view" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl backdrop-blur-xl bg-popover/95 border-border/80 text-xs">
                            <SelectItem value="calibrationStatus">Calibration Status</SelectItem>
                            <SelectItem value="itemStatus">Item Status</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
                <div className="h-[310px] w-full flex items-center justify-center">
                    {activeData.every(d => d.value === 0) ? (
                        <div className="text-muted-foreground text-sm flex flex-col items-center justify-center py-12">
                            <div className="h-12 w-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                                <PieChart className="h-6 w-6 opacity-30" />
                            </div>
                            <p className="text-sm font-semibold">No matching instruments</p>
                            <p className="text-xs opacity-60 mt-1">Adjust filters to see distribution</p>
                        </div>
                    ) : (
                        <div className="w-full h-full pb-2">
                            <Chart options={options} series={series} type="donut" height="100%" width="100%" />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

