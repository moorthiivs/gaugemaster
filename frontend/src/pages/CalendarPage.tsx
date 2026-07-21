import { useEffect, useState } from "react";
import { CalendarInstrument, CalendarResponse } from "@/types/instrument";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/lib/auth";
import httpClient from "@/lib/httpClient";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];



function getLoadLevel(cellDate: Date, today: Date): "low" | "medium" | "high" {
  const cellTime = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate()).getTime();
  const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = (cellTime - todayTime) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return "high";      // Overdue (past date)
  if (diffDays <= 7) return "medium";   // Due within 7 days
  return "low";                          // Due later (safe)
}

const loadColors = {
  low: "bg-emerald-500 text-white hover:bg-emerald-600",
  medium: "bg-amber-500 text-white hover:bg-amber-600",
  high: "bg-red-500 text-white hover:bg-red-600",
};

const loadLegend = [
  { key: "low", label: "UPCOMING", color: "bg-emerald-500" },
  { key: "medium", label: "DUE SOON", color: "bg-amber-500" },
  { key: "high", label: "OVERDUE", color: "bg-red-500" },
];

export default function CalendarPage() {
  useSEO({
    title: "Calibration Schedule — Calibration Alerts",
    description: "Monitor and manage instrument calibration due dates.",
  });

  const { user } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedInstruments, setSelectedInstruments] = useState<CalendarInstrument[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    httpClient
      .get(`/instruments/calendar-due/${user.id}?year=${year}&month=${month}`)
      .then((res) => setData(res.data))
      .catch((err) => console.error("Calendar fetch error:", err))
      .finally(() => setLoading(false));
  }, [user?.id, year, month]);

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const calendarCells: { day: number; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarCells.push({ day: prevMonthDays - i, isCurrentMonth: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push({ day: d, isCurrentMonth: true });
  }
  // Next month leading days to fill remaining cells
  const remaining = 7 - (calendarCells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      calendarCells.push({ day: d, isCurrentMonth: false });
    }
  }

  // Split into weeks
  const weeks: { day: number; isCurrentMonth: boolean }[][] = [];
  for (let i = 0; i < calendarCells.length; i += 7) {
    weeks.push(calendarCells.slice(i, i + 7));
  }

  const isToday = (day: number) =>
    year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate();

  const handleDayClick = (day: number) => {
    const dayData = data?.days?.[day];
    if (!dayData || dayData.count === 0) return;
    setSelectedDay(day);
    setSelectedInstruments(dayData.instruments);
    setDialogOpen(true);
  };

  const yearOptions = Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-none bg-transparent">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Calibration Schedule</h1>
              <p className="text-sm text-muted-foreground">
                Monitor and manage instrument calibration due dates
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">YEAR</span>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Month tabs + Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
            {/* Month tabs */}
            <div className="flex flex-wrap gap-1">
              {MONTHS.map((m, idx) => {
                const monthNum = idx + 1;
                const isActive = month === monthNum;
                return (
                  <button
                    key={m}
                    onClick={() => setMonth(monthNum)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs">
              {loadLegend.map((l) => (
                <div key={l.key} className="flex items-center gap-1.5">
                  <span className={cn("w-2.5 h-2.5 rounded-full", l.color)} />
                  <span className="text-muted-foreground font-medium">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <Skeleton key={j} className="h-24 rounded-lg" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 bg-muted/50">
                {DAYS_OF_WEEK.map((d, idx) => (
                  <div
                    key={d}
                    className={cn(
                      "py-3 text-center text-sm font-semibold border-b",
                      idx === 4 ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Week rows */}
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7">
                  {week.map((cell, ci) => {
                    const dayData = cell.isCurrentMonth ? data?.days?.[cell.day] : undefined;
                    const count = dayData?.count || 0;
                    const today = cell.isCurrentMonth && isToday(cell.day);
                    const cellDate = new Date(year, month - 1, cell.day);
                    const load = count > 0 ? getLoadLevel(cellDate, now) : null;

                    return (
                      <div
                        key={ci}
                        className={cn(
                          "min-h-[90px] border-b border-r last:border-r-0 p-2 transition-colors relative",
                          cell.isCurrentMonth ? "bg-background" : "bg-muted/20",
                          today && "bg-amber-50 dark:bg-amber-950/20",
                          count > 0 && cell.isCurrentMonth && "cursor-pointer hover:bg-muted/30"
                        )}
                        onClick={() => cell.isCurrentMonth && handleDayClick(cell.day)}
                      >
                        <span
                          className={cn(
                            "text-sm",
                            !cell.isCurrentMonth && "text-muted-foreground/40",
                            cell.isCurrentMonth && "text-foreground",
                            today && "font-bold text-primary"
                          )}
                        >
                          {cell.day}
                        </span>

                        {count > 0 && cell.isCurrentMonth && load && (
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                            <span
                              className={cn(
                                "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shadow-sm transition-transform hover:scale-110",
                                loadColors[load]
                              )}
                            >
                              {count}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instrument Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle>
              Instruments Due on {MONTHS[month - 1]} {selectedDay}, {year}
            </DialogTitle>
            <Button 
              size="sm" 
              variant="secondary" 
              className="h-8"
              onClick={() => {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
                navigate(`/instruments?due_date=${dateStr}`);
              }}
            >
              View All in Table (Bulk)
            </Button>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>ID Code</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedInstruments.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">{inst.name}</TableCell>
                    <TableCell>{inst.id_code}</TableCell>
                    <TableCell>{inst.location}</TableCell>
                    <TableCell>{inst.agency}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inst.status?.toLowerCase().includes("over")
                            ? "destructive"
                            : inst.status?.toLowerCase() === "ok" || inst.status?.toLowerCase() === "active"
                            ? "success"
                            : "warning"
                        }
                        className="whitespace-nowrap uppercase text-[10px]"
                      >
                        {inst.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => navigate(`/instruments?search=${encodeURIComponent(inst.id_code)}`)}
                        size="sm"
                      >
                        Update
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
