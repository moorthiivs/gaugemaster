import { useEffect, useState, useMemo } from "react";
import { DashboardSummary } from "@/types/instrument";
import { getDashboardSummary, getDashboardList, getFilterParams } from "@/lib/instrumentActions";
import { DataTable } from "@/components/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSEO } from "@/hooks/useSEO";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, AlertTriangle, CalendarClock, Package, CheckCircle2, Calendar, CalendarIcon, Filter, Loader2 } from "lucide-react";
import { DashboardChart } from "@/components/DashboardChart";
import { useAuth } from "@/lib/auth";
import { DashboardPieChart } from "@/components/DashboardPieChart";
import { CalibrationProgressChart } from "@/components/CalibrationProgressChart";
import { Button } from "@/components/ui/button";
import { CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

const StatCard = ({ title, value, icon: Icon, helper, onClick }: { title: string; value: string | number; icon: any; helper?: string; onClick?: () => void }) => (
  <Card className={`hover:shadow-lg transition-shadow border-l-4 border-l-blue-500 ${onClick ? 'cursor-pointer' : ''}`} aria-label={title} onClick={onClick}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
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

  // Date range filters
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  });
  const [itemStatus, setItemStatus] = useState<string | undefined>("Active");
  const [calibrationStatus, setCalibrationStatus] = useState<string | undefined>(undefined);
  const [location, setLocation] = useState<string | undefined>(undefined);
  const [locations, setLocations] = useState<string[]>([]);

  const [listModalOpen, setListModalOpen] = useState(false);
  const [listType, setListType] = useState<'total' | 'due' | 'overdue' | 'calibrated' | null>(null);
  const [listData, setListData] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listPage, setListPage] = useState(1);
  const listPageSize = 10;

  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    async function fetchDashboard() {
      setLoading(true);
      try {
        const filters = await getFilterParams(user?.id);
        setLocations(filters.location || []);

        const startStr = startDate ? format(startDate, "yyyy-MM-dd") : undefined;
        const endStr = endDate ? format(endDate, "yyyy-MM-dd") : undefined;
        const d = await getDashboardSummary(user?.id, startStr, endStr, itemStatus, calibrationStatus, location);
        setData(d);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [user?.id, startDate, endDate, itemStatus, calibrationStatus, location]);

  const navigate = useNavigate();

  const handleCardClick = (type: 'total' | 'due' | 'overdue' | 'calibrated') => {
    const params = new URLSearchParams();

    // Preserve global dashboard filters when navigating
    if (location) params.append('location', location);
    if (itemStatus) params.append('item_status', itemStatus);
    if (calibrationStatus) params.append('status', calibrationStatus);

    if (type === 'overdue') {
      params.set('status', 'Overdue');
    } else if (type === 'calibrated') {
      params.set('status', 'OK');
      if (startDate) params.append('last_cal_start', format(startDate, "yyyy-MM-dd"));
      if (endDate) params.append('last_cal_end', format(endDate, "yyyy-MM-dd"));
    } else if (type === 'due') {
      // Due in range or this month
      if (startDate) params.append('due_date_start', format(startDate, "yyyy-MM-dd"));
      else {
        // Due this month by default
        const now = new Date();
        params.append('due_date_start', format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"));
      }

      if (endDate) params.append('due_date_end', format(endDate, "yyyy-MM-dd"));
      else {
        const now = new Date();
        params.append('due_date_end', format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd"));
      }
    }

    navigate(`/instruments?${params.toString()}`);
  };




  const calibrationStatusData = data?.statusDistribution || [];
  const itemStatusData = data?.itemStatusDistribution || [];

  const chartData = data?.dueDatesByMonth || [];
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil((data?.dueSoonList?.length || 0) / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const currentPageData = data?.dueSoonList?.slice(startIndex, startIndex + itemsPerPage) || [];

  const formattedStart = startDate ? startDate.toLocaleDateString() : "";
  const formattedEnd = endDate ? endDate.toLocaleDateString() : "";

  // Dynamic titles for the StatCards depending on date filter state
  const dueCardTitle = (startDate || endDate) ? "Completed / Due in range" : "Completed / Due this month";
  const calibratedCardTitle = (startDate || endDate) ? "Calibrated in range" : "Calibrated this month";
  const calibratedHelper = (formattedStart && formattedEnd)
    ? `From ${formattedStart} to ${formattedEnd}`
    : formattedStart
      ? `Since ${formattedStart}`
      : formattedEnd
        ? `Until ${formattedEnd}`
        : "Based on last calibration date";

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            Dashboard
            {loading && <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />}
          </h1>
          <p className="text-muted-foreground">Calibration overview and upcoming due dates.</p>
        </div>

        {/* Modern Date Range Selector */}
        <div className="flex flex-wrap items-center gap-3 bg-card border rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Filter range:</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">From:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium hover:border-primary/50 transition-all"
                >
                  <CalendarIcon className="mr-1 h-3 w-3 text-muted-foreground" />
                  {startDate ? format(startDate, "dd MMM yyyy") : "Pick start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    setStartDate(date);
                    setPage(1);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">To:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium hover:border-primary/50 transition-all"
                >
                  <CalendarIcon className="mr-1 h-3 w-3 text-muted-foreground" />
                  {endDate ? format(endDate, "dd MMM yyyy") : "Pick end date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    setEndDate(date);
                    setPage(1);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Location:</span>
            <Select value={location || "All"} onValueChange={(val) => {
              setLocation(val === "All" ? undefined : val);
              setPage(1);
            }}>
              <SelectTrigger className="h-8 w-[140px] text-xs font-medium">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Locations</SelectItem>
                {locations.filter(loc => loc && loc.trim() !== "").map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(startDate || endDate || itemStatus !== "Active" || calibrationStatus || location) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate(undefined);
                setEndDate(undefined);
                setItemStatus("Active");
                setCalibrationStatus(undefined);
                setLocation(undefined);
                setPage(1);
              }}
              className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50/50"
            >
              Clear
            </Button>
          )}
        </div>
      </header>

      {/* Grid of 5 StatCards */}
      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 animate-in fade-in duration-300">
            <StatCard title="Total instruments" value={data?.total || 0} icon={Package} onClick={() => handleCardClick('total')} />
            <StatCard title={dueCardTitle} value={`${data?.calibratedCount || 0} / ${data?.dueThisMonth || 0}`} icon={CalendarClock} onClick={() => handleCardClick('due')} />
            <StatCard title="Overdue" value={data?.overdue || 0} icon={AlertTriangle} onClick={() => handleCardClick('overdue')} />
            <StatCard
              title={calibratedCardTitle}
              value={data?.calibratedCount || 0}
              icon={CheckCircle2}
              helper={calibratedHelper}
              onClick={() => handleCardClick('calibrated')}
            />
          <StatCard title="Next calibration" value={data?.nextCalibrationDate ? new Date(data.nextCalibrationDate).toLocaleDateString() : "—"} icon={BarChart3} />
        </div>
      )}

      {/* Dynamic charts section */}
      <section aria-label="Upcoming due dates by month" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <Skeleton className="h-[360px] rounded-xl" />
        ) : (
          <DashboardChart data={chartData} />
        )}
        {loading ? (
          <Skeleton className="h-[360px] rounded-xl" />
        ) : (
          <DashboardPieChart
            calibrationStatusData={calibrationStatusData}
            itemStatusData={itemStatusData}
            currentItemStatus={itemStatus}
            onItemStatusChange={(status) => {
              setItemStatus(status);
              setPage(1);
            }}
            currentCalibrationStatus={calibrationStatus}
            onCalibrationStatusChange={(status) => {
              setCalibrationStatus(status);
              setPage(1);
            }}
          />
        )}
      </section>

      {/* Week / Day completed calibrations chart */}
      {!loading && (
        <section aria-label="Completed calibrations breakdown">
          <CalibrationProgressChart
            weeklyData={data?.weeklyCompleted || []}
            dailyData={data?.dailyCompleted || []}
          />
        </section>
      )}

      {/* Bottom tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-label="Recent activity">
          <Card className="h-full hover:shadow-sm transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recent activity</CardTitle>
              <CardDescription>Last 10 calibration events or status changes</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : !data?.recentActivity?.length ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No recent activity found.</p>
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
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.action}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(r.at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-label="Instruments due soon">
          <Card className="h-full hover:shadow-sm transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                {(startDate || endDate) ? "Instruments Due in Selected Range" : "Instruments Due Soon (Next 30 Days)"}
              </CardTitle>
              <CardDescription>
                List of instruments requiring calibration within the selected time window.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Skeleton className="h-4 w-[150px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-[100px]" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : !data?.dueSoonList?.length ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">No instruments due in this period.</p>
                ) : (
                  <>
                    <Table aria-label="Due soon instruments">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Instrument</TableHead>
                          <TableHead>Due Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentPageData.map(({ id, name, dueDate }) => (
                          <TableRow key={id}>
                            <TableCell className="font-medium">{name}</TableCell>
                            <TableCell className="text-muted-foreground">{new Date(dueDate).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                        </TableBody>
                      </Table>

                  {/* Pagination controls */}
                  {totalPages > 1 && (
                    <div className="flex justify-end gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground self-center">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>


    </div>
  );
};

export default Index;
