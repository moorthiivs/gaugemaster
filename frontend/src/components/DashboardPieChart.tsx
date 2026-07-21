import { useState } from 'react';
import Chart from 'react-apexcharts';
import { useTheme } from 'next-themes';
import { ApexOptions } from 'apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';
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

export function DashboardPieChart({
    calibrationStatusData,
    itemStatusData,
    colors = [
        '#3b82f6', // blue
        '#10b981', // green
        '#fbbf24', // yellow
        '#ef4444', // red
        '#6366f1', // indigo
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#14b8a6', // teal
    ],
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
                    title: 'Item Inventory Status',
                    description: 'Instruments grouped by inventory status (Active, Inactive, Scrapped)',
                };
            case 'calibrationStatus':
            default:
                return {
                    title: 'Calibration Result Distribution',
                    description: 'Instruments grouped by calibration result (OK, NOT OK)',
                };
        }
    };

    const activeData = getActiveData();
    const { title, description } = getHeaderInfo();
    const isFilterActive = filterType === 'calibrationStatus' ? !!currentCalibrationStatus : !!currentItemStatus;

    const series = activeData.map(d => d.value);
    const options: ApexOptions = {
        chart: {
            type: 'donut',
            fontFamily: 'inherit',
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
        colors: colors,
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            color: isDark ? '#e2e8f0' : '#475569',
                            fontSize: '14px',
                        },
                        value: {
                            show: true,
                            color: isDark ? '#f8fafc' : '#0f172a',
                            fontSize: '24px',
                            fontWeight: 700,
                        },
                        total: {
                            show: true,
                            showAlways: true,
                            label: 'Total',
                            color: isDark ? '#94a3b8' : '#64748b',
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
            colors: [isDark ? '#020817' : '#ffffff'],
            width: 2
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
                shape: 'circle'
            }
        }
    };

    return (
        <Card className="animate-in border-none shadow-md overflow-hidden bg-gradient-to-b from-card to-card/50 hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/70">{title}</CardTitle>
                    <CardDescription className="text-muted-foreground">{description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`h-9 w-9 hover:bg-muted/80 ${isFilterActive ? "text-blue-600 bg-blue-50/50 hover:bg-blue-100/50" : "text-muted-foreground"}`}
                                title="Filter chart data"
                            >
                                <Filter className={`h-4 w-4 ${isFilterActive ? "fill-blue-600/20" : ""}`} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            {filterType === 'calibrationStatus' ? (
                                <>
                                    <DropdownMenuLabel>Filter Calibration Result</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuCheckboxItem
                                        checked={!currentCalibrationStatus}
                                        onCheckedChange={() => onCalibrationStatusChange(undefined)}
                                    >
                                        All Results
                                    </DropdownMenuCheckboxItem>
                                    {calibrationStatusData.filter(d => d.name !== 'No Data').map((statusObj) => (
                                        <DropdownMenuCheckboxItem
                                            key={statusObj.name}
                                            checked={currentCalibrationStatus === statusObj.name}
                                            onCheckedChange={() => onCalibrationStatusChange(statusObj.name)}
                                        >
                                            {statusObj.name} Only
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </>
                            ) : (
                                <>
                                    <DropdownMenuLabel>Filter Item Status</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuCheckboxItem
                                        checked={!currentItemStatus}
                                        onCheckedChange={() => onItemStatusChange(undefined)}
                                    >
                                        All Statuses
                                    </DropdownMenuCheckboxItem>
                                    {itemStatusData.filter(d => d.name !== 'No Data').map((statusObj) => (
                                        <DropdownMenuCheckboxItem
                                            key={statusObj.name}
                                            checked={currentItemStatus === statusObj.name}
                                            onCheckedChange={() => onItemStatusChange(statusObj.name)}
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
                        <SelectTrigger className="w-[170px] h-9 text-sm font-medium">
                            <SelectValue placeholder="Select view" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="calibrationStatus">Calibration Status</SelectItem>
                            <SelectItem value="itemStatus">Item Status</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[320px] w-full flex items-center justify-center">
                    {activeData.every(d => d.value === 0) ? (
                        <div className="text-muted-foreground text-sm py-20 flex flex-col items-center justify-center">
                            <div className="h-24 w-24 rounded-full border-4 border-dashed border-muted/50 mb-4 animate-[spin_4s_linear_infinite]"></div>
                            No matching instruments found
                        </div>
                    ) : (
                        <div className="w-full h-full pb-4">
                            <Chart options={options} series={series} type="donut" height="100%" width="100%" />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
