// DashboardPieChart.tsx
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PieData {
    name: string;
    value: number;
}

interface DashboardPieChartProps {
    data: PieData[];
    title?: string;
    description?: string;
    colors?: string[];
}

export function DashboardPieChart({
    data,
    title = 'Calibration Status',
    description = 'Distribution of instruments by status',
    colors = ['#3b82f6', '#ef4444', '#fbbf24', '#10b981'], // blue, red, yellow, green
}: DashboardPieChartProps) {
    return (
        <Card className="animate-in">
            <CardHeader>
                <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                fill="hsl(var(--primary))"
                                label
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
