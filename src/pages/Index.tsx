import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSEO } from "@/hooks/useSEO";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, AlertTriangle, CalendarClock, Package } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Tooltip } from "@/components/ui/tooltip";
import { DashboardChart } from "@/components/DashboardChart";
import api from "@/lib/apis";
import { useAuth } from "@/lib/auth";
import { DashboardPieChart } from "@/components/DashboardPieChart";


interface DashboardSummary {
  total: number;
  dueThisMonth: number;
  overdue: number;
  nextCalibrationDate: string | null;
  dueDatesByMonth: { month: string; count: number }[];
  dueSoonList: { id: string; name: string; dueDate: string }[];
  recentActivity: { id: string; name: string; action: string; at: string }[];
}

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

  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return;

    async function fetchDashboard() {
      try {
        const d = await api.get(`/dashboard/${user?.id}`);
        setData(d.data);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [user?.id]);


  const pieData = data
    ? [
      { name: 'Calibrated', value: data.total - data.overdue - data.dueThisMonth },
      { name: 'Due This Month', value: data.dueThisMonth },
      { name: 'Overdue', value: data.overdue },
    ]
    : [];

  const chartData = data?.dueDatesByMonth || [];


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


      <section aria-label="Upcoming due dates by month" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashboardChart data={chartData} />
        <DashboardPieChart data={pieData} />
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



      <section>
        <Card>
          <CardHeader>
            <CardTitle>Instruments Due Soon (Next 30 Days)</CardTitle>
            <CardDescription>List of instruments with calibration due dates in the next 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40" />
            ) : !data?.dueSoonList.length ? (
              <p className="text-muted-foreground">No instruments due soon.</p>
            ) : (
              <Table aria-label="Due soon instruments">
                <TableHeader>
                  <TableRow>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.dueSoonList.map(({ id, name, dueDate }) => (
                    <TableRow key={id}>
                      <TableCell>{name}</TableCell>
                      <TableCell>{new Date(dueDate).toLocaleDateString()}</TableCell>
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
