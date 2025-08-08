import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardSummary, DashboardSummary } from "@/lib/api";
import { useSEO } from "@/hooks/useSEO";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, AlertTriangle, CalendarClock, Package } from "lucide-react";

const StatCard = ({ title, value, icon: Icon, helper }: { title: string; value: string | number; icon: any; helper?: string }) => (
  <Card className="hover:shadow-lg transition-shadow" aria-label={title}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
    </CardContent>
  </Card>
);

const Index = () => {
  useSEO({ title: "Dashboard — Calibration Alerts", description: "Overview of instruments, due dates, and recent calibration activity." });
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardSummary().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Calibration overview and upcoming due dates.</p>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total instruments" value={data?.total || 0} icon={Package} />
          <StatCard title="Due this month" value={data?.dueThisMonth || 0} icon={CalendarClock} />
          <StatCard title="Overdue" value={data?.overdue || 0} icon={AlertTriangle} />
          <StatCard title="Next calibration" value={data?.nextCalibrationDate ? new Date(data.nextCalibrationDate).toLocaleDateString() : "—"} icon={BarChart3} />
        </div>
      )}

      <section aria-label="Upcoming due dates by month">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming due dates</CardTitle>
            <CardDescription>Next 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64" />
            ) : (
              <div className="w-full h-64">
                {/* Using a simple SVG chart to avoid heavy dependencies at first render */}
                <svg role="img" aria-label="Bar chart of upcoming due dates by month" className="w-full h-full">
                  {data?.monthlyUpcoming.map((m, idx) => {
                    const max = Math.max(...(data?.monthlyUpcoming.map((x) => x.count) || [1]));
                    const barW = 100 / (data!.monthlyUpcoming.length * 1.5);
                    const gap = barW / 2;
                    const height = max ? (m.count / max) * 80 : 0;
                    const x = idx * (barW + gap) + gap;
                    const y = 90 - height;
                    return (
                      <g key={m.month}>
                        <rect x={`${x}%`} y={`${y}%`} width={`${barW}%`} height={`${height}%`} rx="4" className="fill-primary/70" />
                        <text x={`${x + barW / 2}%`} y="98%" textAnchor="middle" className="fill-muted-foreground text-[10px]">{m.month}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Last 10 calibration events or status changes</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40" />
            ) : (
              <Table aria-label="Recent activity table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.recentActivity.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.action}</TableCell>
                      <TableCell>{new Date(r.at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Index;
