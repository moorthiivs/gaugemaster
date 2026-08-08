import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarInstrument, CalendarResponse } from "@/types/instrument";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Gauge, Activity, MapPin } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/lib/auth";
import httpClient from "@/lib/httpClient";
import { getFilterParams } from "@/lib/instrumentActions";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getLoadLevel(cellDate: Date, today: Date, dayInstruments?: CalendarInstrument[]): "low" | "medium" | "high" {
  if (!dayInstruments || dayInstruments.length === 0) return "low";

  const cellTime = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate()).getTime();
  const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = (cellTime - todayTime) / (1000 * 60 * 60 * 24);

  const hasOverdueStatus = dayInstruments.some(
    (inst) => inst.status?.toLowerCase().includes("over") || inst.status === "OVER DUE"
  );

  if (hasOverdueStatus || diffDays < 0) {
    return "high"; // Overdue -> Red
  }

  const allCompleted = dayInstruments.every((inst) => inst.eventType === "completed");
  if (allCompleted) {
    return "low"; // Completed -> Green
  }

  return "medium"; // Upcoming / Due -> Amber
}

const loadColors = {
  low: "bg-emerald-500 text-white hover:bg-emerald-600",
  medium: "bg-amber-500 text-white hover:bg-amber-600",
  high: "bg-red-500 text-white hover:bg-red-600",
};

const loadLegend = [
  { key: "completed", label: "COMPLETED", color: "bg-emerald-500" },
  { key: "due", label: "UPCOMING / DUE", color: "bg-amber-500" },
  { key: "overdue", label: "OVERDUE", color: "bg-red-500" },
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
  const [category, setCategory] = useState<string>("Working");
  const [itemStatus, setItemStatus] = useState<string>("Active");
  const [location, setLocation] = useState<string>("All");
  const [locations, setLocations] = useState<string[]>([]);
  const [itemStatuses, setItemStatuses] = useState<string[]>([]);

  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedInstruments, setSelectedInstruments] = useState<CalendarInstrument[]>([]);
  const [modalFilter, setModalFilter] = useState<"ALL" | "OK" | "DUE_SOON" | "OVERDUE">("ALL");

  useEffect(() => {
    if (!user?.id) return;
    getFilterParams(user.id).then((f) => {
      setLocations(f.location || []);
      setItemStatuses(f.item_status || []);
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);

    const isRefParam =
      category === "Working"
        ? "false"
        : category === "Reference"
          ? "true"
          : undefined;

    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });

    if (isRefParam) params.append("is_reference_standard", isRefParam);
    if (itemStatus && itemStatus !== "All") params.append("item_status", itemStatus);
    if (location && location !== "All") params.append("location", location);

    httpClient
      .get(`/instruments/calendar-due/${user.id}?${params.toString()}`)
      .then((res) => setData(res.data))
      .catch((err) => console.error("Calendar fetch error:", err))
      .finally(() => setLoading(false));
  }, [user?.id, year, month, category, itemStatus, location]);

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
    setModalFilter("ALL");
    setDialogOpen(true);
  };

  const yearOptions = Array.from({ length: 11 }, (_, i) => now.getFullYear() - 5 + i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-none bg-transparent">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Calibration Schedule</h1>
              <p className="text-sm text-muted-foreground">
                Monitor and manage instrument calibration due dates
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-[150px] text-xs font-medium bg-background">
                <Gauge className="h-3.5 w-3.5 mr-1 text-primary" />
                <SelectValue placeholder="All Inventory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Inventory</SelectItem>
                <SelectItem value="Working">Working Gauges</SelectItem>
                <SelectItem value="Reference">Ref Standards</SelectItem>
              </SelectContent>
            </Select>

            {/* Item Status Filter */}
            <Select value={itemStatus} onValueChange={setItemStatus}>
              <SelectTrigger className="h-9 w-[130px] text-xs font-medium bg-background">
                <Activity className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Active Only" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Statuses</SelectItem>
                {itemStatuses.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st === "Active" ? "Active Only" : st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location Filter */}
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="h-9 w-[130px] text-xs font-medium bg-background">
                <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="All Plants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Plants</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year Selector */}
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9 w-[90px] text-xs font-semibold bg-background">
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
                    const dayInstruments = dayData?.instruments || [];
                    const count = dayData?.count || 0;
                    const today = cell.isCurrentMonth && isToday(cell.day);
                    const cellDate = new Date(year, month - 1, cell.day);

                    const cellTime = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate()).getTime();
                    const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    const isPastCell = cellTime < todayTime;

                    const okCount = dayInstruments.filter(
                      (inst) => inst.eventType === "completed"
                    ).length;

                    const overdueCount = dayInstruments.filter((inst) => {
                      if (inst.eventType === "completed") return false;
                      const isOverdueStatus = inst.status?.toLowerCase().includes("over") || inst.status === "OVER DUE";
                      return isOverdueStatus || cellTime <= todayTime;
                    }).length;

                    const dueSoonCount = Math.max(0, dayInstruments.length - okCount - overdueCount);

                    return (
                      <div
                        key={ci}
                        className={cn(
                          "min-h-[90px] border-b border-r last:border-r-0 p-2 transition-colors relative flex flex-col justify-between",
                          cell.isCurrentMonth ? "bg-background" : "bg-muted/20",
                          today && "bg-amber-50 dark:bg-amber-950/20",
                          count > 0 && cell.isCurrentMonth && "cursor-pointer hover:bg-muted/30"
                        )}
                        onClick={() => cell.isCurrentMonth && handleDayClick(cell.day)}
                      >
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            !cell.isCurrentMonth && "text-muted-foreground/40",
                            cell.isCurrentMonth && "text-foreground",
                            today && "font-extrabold text-primary"
                          )}
                        >
                          {cell.day}
                        </span>

                        {count > 0 && cell.isCurrentMonth && (
                          <div className="flex items-center justify-center gap-1 flex-wrap mt-auto pt-1">
                            {okCount > 0 && (
                              <span
                                title={`${okCount} Completed / OK`}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold bg-emerald-500 text-white shadow-xs transition-transform hover:scale-110 shrink-0"
                              >
                                {okCount}
                              </span>
                            )}
                            {dueSoonCount > 0 && (
                              <span
                                title={`${dueSoonCount} Upcoming / Due Soon`}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold bg-amber-500 text-white shadow-xs transition-transform hover:scale-110 shrink-0"
                              >
                                {dueSoonCount}
                              </span>
                            )}
                            {overdueCount > 0 && (
                              <span
                                title={`${overdueCount} Overdue`}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold bg-red-500 text-white shadow-xs transition-transform hover:scale-110 shrink-0"
                              >
                                {overdueCount}
                              </span>
                            )}
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
        <DialogContent className="max-w-5xl">
          <DialogHeader className="flex flex-col gap-3 pb-2 border-b">
            <div className="flex flex-row items-center justify-between pr-8">
              <DialogTitle className="text-xl font-bold">
                Instruments Due on {MONTHS[month - 1]} {selectedDay}, {year}
              </DialogTitle>
              <Button 
                size="sm" 
                variant="secondary" 
                className="h-8 text-xs font-semibold"
                onClick={() => {
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
                  navigate(`/instruments?due_date=${dateStr}`);
                }}
              >
                View All in Table (Bulk)
              </Button>
            </div>

            {/* Summary Badges & Interactive Filter Tabs */}
            {(() => {
              const totalModalCount = selectedInstruments.length;
              const okModalCount = selectedInstruments.filter(
                (inst) => inst.eventType === "completed"
              ).length;
              const overdueModalCount = selectedInstruments.filter((inst) => {
                if (inst.eventType === "completed") return false;
                const isOverdueStatus = inst.status?.toLowerCase().includes("over") || inst.status === "OVER DUE";
                const instTime = new Date(inst.due_date).getTime();
                return isOverdueStatus || instTime <= now.getTime();
              }).length;
              const dueSoonModalCount = Math.max(0, totalModalCount - overdueModalCount - okModalCount);

              return (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">Filter View:</span>

                  <Button
                    size="sm"
                    variant={modalFilter === "ALL" ? "default" : "outline"}
                    className="h-7 text-xs font-bold rounded-lg px-2.5"
                    onClick={() => setModalFilter("ALL")}
                  >
                    All ({totalModalCount})
                  </Button>

                  <Button
                    size="sm"
                    variant={modalFilter === "OK" ? "default" : "outline"}
                    className={cn(
                      "h-7 text-xs font-bold rounded-lg px-2.5 gap-1.5",
                      modalFilter === "OK" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-500/40 text-emerald-600 hover:bg-emerald-50"
                    )}
                    onClick={() => setModalFilter("OK")}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Completed / OK ({okModalCount})
                  </Button>

                  <Button
                    size="sm"
                    variant={modalFilter === "DUE_SOON" ? "default" : "outline"}
                    className={cn(
                      "h-7 text-xs font-bold rounded-lg px-2.5 gap-1.5",
                      modalFilter === "DUE_SOON" ? "bg-amber-600 hover:bg-amber-700 text-white" : "border-amber-500/40 text-amber-600 hover:bg-amber-50"
                    )}
                    onClick={() => setModalFilter("DUE_SOON")}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    Due Soon / Upcoming ({dueSoonModalCount})
                  </Button>

                  <Button
                    size="sm"
                    variant={modalFilter === "OVERDUE" ? "default" : "outline"}
                    className={cn(
                      "h-7 text-xs font-bold rounded-lg px-2.5 gap-1.5",
                      modalFilter === "OVERDUE" ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-500/40 text-red-600 hover:bg-red-50"
                    )}
                    onClick={() => setModalFilter("OVERDUE")}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    Overdue ({overdueModalCount})
                  </Button>
                </div>
              );
            })()}
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] mt-2">
            {(() => {
              const displayedModalInstruments = selectedInstruments.filter((inst) => {
                const isCalibrated = inst.eventType === "completed";
                const isOverdue = !isCalibrated && (inst.status?.toLowerCase().includes("over") || inst.status === "OVER DUE" || new Date(inst.due_date).getTime() <= now.getTime());

                if (modalFilter === "OVERDUE") return isOverdue;
                if (modalFilter === "OK") return isCalibrated;
                if (modalFilter === "DUE_SOON") return !isOverdue && !isCalibrated;
                return true;
              });

              const formatDateVal = (dateStr?: string | null) => {
                if (!dateStr) return "—";
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return "—";
                return format(d, "dd MMM yyyy");
              };

              if (displayedModalInstruments.length === 0) {
                return (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No instruments match the selected status filter.
                  </div>
                );
              }

              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>ID Code</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Agency</TableHead>
                      <TableHead>Last Cal Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedModalInstruments.map((inst) => {
                      const isCalibrated = inst.eventType === "completed";
                      const isOverdue = !isCalibrated && (inst.status?.toLowerCase().includes("over") || inst.status === "OVER DUE" || new Date(inst.due_date).getTime() <= now.getTime());
                      
                      const rowClass = isOverdue
                        ? "bg-rose-500/10 hover:bg-rose-500/20 border-l-4 border-l-rose-500"
                        : isCalibrated
                        ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-l-4 border-l-emerald-500"
                        : "bg-amber-500/15 hover:bg-amber-500/25 border-l-4 border-l-amber-500";

                      return (
                        <TableRow key={inst.id} className={rowClass}>
                          <TableCell className="font-medium">{inst.name}</TableCell>
                          <TableCell>{inst.id_code}</TableCell>
                          <TableCell>{inst.location}</TableCell>
                          <TableCell>{inst.agency || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatDateVal(inst.last_calibration_date)}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs font-bold">{formatDateVal(inst.due_date)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                isOverdue
                                  ? "destructive"
                                  : isCalibrated
                                  ? "success"
                                  : "warning"
                              }
                              className="whitespace-nowrap uppercase text-[10px] font-bold"
                            >
                              {isCalibrated ? "COMPLETED" : isOverdue ? "OVERDUE" : "DUE SOON"}
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
                      );
                    })}
                  </TableBody>
                </Table>
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
