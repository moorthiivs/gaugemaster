import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { CalendarPicker } from "@/components/ui/calendar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CalendarIcon, FileText, Download, Filter, Settings2, Loader2, MapPin, Activity, Sparkles, Calendar } from "lucide-react";
import httpClient from "@/lib/httpClient";
import { useAuth } from "@/lib/auth";
import { DataTable } from "@/components/DataTable";
import { Instrument } from "@/types/instrument";
import { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [fromDate, setFromDate] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [toDate, setToDate] = useState<Date | undefined>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  });
  const [formatType, setFormatType] = useState<"xlsx" | "html">("xlsx");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("default");

  // Status & Location Filters for download and preview
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [selectedLocation, setSelectedLocation] = useState<string>("All");

  const [reportData, setReportData] = useState<Instrument[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{ location: string[]; status: string[] }>({ location: [], status: [] });
  const [columnFilters, setColumnFilters] = useState<any[]>([]);
  const [validationRules, setValidationRules] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      httpClient
        .get("/report-templates", { params: { userId: user.id } })
        .then((res) => setTemplates(res.data || []))
        .catch((err) => console.error("Error fetching report templates", err));

      httpClient
        .get(`/instruments/filters/${user.id}`)
        .then((res) => setFilterOptions(res.data || { location: [], status: [] }))
        .catch((err) => console.error("Error fetching instrument filter options", err));
    }

    if (user?.companyId) {
      httpClient
        .get(`/validation/rules?companyId=${user.companyId}`)
        .then((res) => {
          const rules: any[] = res.data || [];
          setValidationRules(rules);
          const custom = rules.filter((r) => r.isCustom);
          if (custom.length > 0) {
            setColumnVisibility((prev) => {
              const updated = { ...prev };
              custom.forEach((c) => {
                if (updated[c.fieldName] === undefined) {
                  updated[c.fieldName] = false;
                }
              });
              return updated;
            });
          }
        })
        .catch((err) => console.error("Error fetching validation rules", err));
    }
  }, [user?.id, user?.companyId]);

  // Quick Preset Handlers
  const handlePresetMonth = () => {
    const now = new Date();
    setFromDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setToDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  };

  const handlePresetQuarter = () => {
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    setFromDate(new Date(now.getFullYear(), currentQuarter * 3, 1));
    setToDate(new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0));
  };

  const handlePresetYear = () => {
    const now = new Date();
    setFromDate(new Date(now.getFullYear(), 0, 1));
    setToDate(new Date(now.getFullYear(), 11, 31));
  };

  // Initialize with all columns
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    sino: true,
    name: true,
    id_code: true,
    location: true,
    due_date: true,
    status: true,
    item_status: true,
    last_calibration_date: false,
    frequency: false,
    agency: false,
    range: false,
    serial_no: false,
    least_count: false,
    notes: false,
    make: false,
    item_type: false,
    part_no: false,
    part_name: false,
    module: false,
    calibration_source: false,
    customer: false,
    sector: false,
    criticality_level: false,
    cert_no: false,
    remarks: false,
    gauge_issue_date: false,
    gauges_received_by: false,
    gauges_issued_by: false,
    calibration_procedure: false,
    traceable: false,
  });

  const from = fromDate ? format(fromDate, "yyyy-MM-dd") : "";
  const to = toDate ? format(toDate, "yyyy-MM-dd") : "";

  const fetchPreview = async () => {
    if (!from || !to || !user?.id) return;
    setLoading(true);

    const filters: Record<string, string> = {};
    columnFilters.forEach((f) => {
      filters[f.id] = f.value;
    });

    if (selectedStatus && selectedStatus !== "All") filters.status = selectedStatus;
    if (selectedLocation && selectedLocation !== "All") filters.location = selectedLocation;

    try {
      const res = await httpClient.get("/reports/preview", {
        params: {
          from,
          to,
          userid: user.id,
          page,
          pageSize,
          ...filters,
        },
      });
      setReportData(res.data.items);
      setTotalItems(res.data.total);
    } catch (error) {
      console.error("Failed to fetch report preview", error);
      toast({
        title: "Preview Failed",
        description: "Could not load report preview data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchPreview();
  }, [from, to, user?.id, columnFilters, selectedStatus, selectedLocation, pageSize]);

  useEffect(() => {
    fetchPreview();
  }, [page]);

  const totalPages = Math.ceil(totalItems / pageSize);

  const onGenerate = async () => {
    if (!from || !to)
      return toast({
        title: "Dates Required",
        description: "Please select both from and to dates",
        variant: "destructive",
      });

    const visibleColumns = Object.entries(columnVisibility)
      .filter(([_, isVisible]) => isVisible)
      .map(([columnId]) => columnId);

    setIsGenerating(true);
    try {
      const userId = user?.id || (user as any)?.sub;
      const paramsObj: any = {
        from,
        to,
        format: formatType,
        userid: userId,
        columns: visibleColumns.join(","),
        templateId: selectedTemplateId !== "default" ? selectedTemplateId : undefined,
      };

      if (selectedStatus && selectedStatus !== "All") paramsObj.status = selectedStatus;
      if (selectedLocation && selectedLocation !== "All") paramsObj.location = selectedLocation;

      if (formatType === "html") {
        const response = await httpClient.get("/reports", {
          params: paramsObj,
          responseType: "text",
        });

        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(response.data);
          printWindow.document.close();
          printWindow.focus();
          printWindow.setTimeout(() => printWindow.print(), 500);
        } else {
          toast({
            title: "Pop-up Blocked",
            description: "Please allow pop-ups to print the report.",
            variant: "destructive",
          });
        }
      } else {
        const response = await httpClient.get("/reports", {
          params: paramsObj,
          responseType: "blob",
        });

        const url = URL.createObjectURL(new Blob([response.data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = `report_${from}_${to}.${formatType}`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: "Report Generated",
          description: `Your ${formatType.toUpperCase()} report is ready for download.`,
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Failed to generate report", error);
      toast({
        title: "Generation Failed",
        description: "Could not generate the report file.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const customRules = useMemo(() => validationRules.filter((r) => r.isCustom), [validationRules]);

  const columns: ColumnDef<Instrument>[] = useMemo(() => {
    const baseCols: ColumnDef<Instrument>[] = [
      {
        accessorKey: "sino",
        header: "S.No",
        cell: ({ row }) => <span className="font-medium text-muted-foreground">{row.original.sino || "-"}</span>,
      },
      {
        accessorKey: "name",
        header: "Instrument Name",
        meta: { enableFilter: true },
      },
      {
        accessorKey: "id_code",
        header: "ID Code",
        meta: { enableFilter: true },
      },
      {
        accessorKey: "location",
        header: "Location",
        meta: {
          enableFilter: true,
          filterOptions: filterOptions.location,
        },
      },
      {
        accessorKey: "due_date",
        header: "Due Date",
        cell: ({ row }) => (row.getValue("due_date") ? format(new Date(row.getValue("due_date")), "dd/MM/yyyy") : "-"),
      },
      {
        accessorKey: "last_calibration_date",
        header: "Last Cal Date",
        cell: ({ row }) =>
          row.getValue("last_calibration_date") ? format(new Date(row.getValue("last_calibration_date")), "dd/MM/yyyy") : "-",
      },
      {
        accessorKey: "status",
        header: "Calib Status",
        meta: {
          enableFilter: true,
          filterOptions: filterOptions.status,
        },
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          return (
            <Badge
              variant={status === "OK" ? "success" : status === "Overdue" ? "destructive" : status === "Sent for Calibration" ? "premium" : "warning"}
              className="font-bold"
            >
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "item_status",
        header: "Item Status",
        cell: ({ row }) => (
          <Badge variant="outline" className="opacity-80">
            {row.getValue("item_status") || "Active"}
          </Badge>
        ),
      },
      { accessorKey: "frequency", header: "Frequency" },
      {
        accessorKey: "agency",
        header: "Agency",
        meta: { enableFilter: true },
      },
      { accessorKey: "range", header: "Range" },
      { accessorKey: "serial_no", header: "Serial Number" },
      { accessorKey: "least_count", header: "Least Count" },
      { accessorKey: "make", header: "Make" },
      { accessorKey: "item_type", header: "Item Type" },
      { accessorKey: "part_no", header: "Part Number" },
      { accessorKey: "part_name", header: "Part Name" },
      { accessorKey: "module", header: "Module" },
      { accessorKey: "calibration_source", header: "Calib Source" },
      { accessorKey: "customer", header: "Customer" },
      { accessorKey: "sector", header: "Sector" },
      { accessorKey: "criticality_level", header: "Criticality" },
      { accessorKey: "cert_no", header: "Certificate No" },
      {
        accessorKey: "gauge_issue_date",
        header: "Issue Date",
        cell: ({ row }) =>
          row.getValue("gauge_issue_date") ? format(new Date(row.getValue("gauge_issue_date")), "dd/MM/yyyy") : "-",
      },
      { accessorKey: "gauges_received_by", header: "Received By" },
      { accessorKey: "gauges_issued_by", header: "Issued By" },
      { accessorKey: "calibration_procedure", header: "Procedure" },
      { accessorKey: "traceable", header: "Traceable" },
      { accessorKey: "remarks", header: "Remarks" },
      { accessorKey: "notes", header: "Notes" },
    ];

    // Append custom columns
    customRules.forEach((rule) => {
      baseCols.push({
        id: rule.fieldName,
        accessorKey: `custom_${rule.fieldName}`,
        header: rule.displayName,
        cell: ({ row }) => row.original.custom_parameters?.[rule.fieldName] ?? (row.original as any)[rule.fieldName] ?? "-",
      } as ColumnDef<Instrument>);
    });

    return baseCols;
  }, [page, pageSize, filterOptions, customRules]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-muted/20">
        <CardHeader className="border-b border-muted/20 bg-muted/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Generate Calibration Report</CardTitle>
                <CardDescription>Filter by Date Range, Status, and Location to customize and export your instrument data</CardDescription>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground mr-1">Presets:</span>
              <Button size="sm" variant="outline" onClick={handlePresetMonth} className="h-8 text-xs font-medium">
                This Month
              </Button>
              <Button size="sm" variant="outline" onClick={handlePresetQuarter} className="h-8 text-xs font-medium">
                This Quarter
              </Button>
              <Button size="sm" variant="outline" onClick={handlePresetYear} className="h-8 text-xs font-medium">
                This Year
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-6 items-end">
            {/* From date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                From Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left h-10 font-medium transition-all hover:border-primary/50 text-xs ${!fromDate ? "text-muted-foreground" : ""}`}
                  >
                    {fromDate ? format(fromDate, "dd MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={fromDate}
                    onSelect={(date) => date && setFromDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* To date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                To Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left h-10 font-medium transition-all hover:border-primary/50 text-xs ${!toDate ? "text-muted-foreground" : ""}`}
                  >
                    {toDate ? format(toDate, "dd MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={toDate}
                    onSelect={(date) => date && setToDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Status Filter
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-10 text-xs font-medium hover:border-primary/50">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="OK">OK / Calibrated</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                  <SelectItem value="Sent for Calibration">Sent for Calibration</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Location Filter
              </label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="h-10 text-xs font-medium hover:border-primary/50">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Locations</SelectItem>
                  {filterOptions.location.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <Filter className="h-3.5 w-3.5 text-primary" />
                Export Format
              </label>
              <Select value={formatType} onValueChange={(value: "xlsx" | "html") => setFormatType(value)}>
                <SelectTrigger className="h-10 text-xs font-medium hover:border-primary/50">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx) Download</SelectItem>
                  <SelectItem value="html">Print / PDF View</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generate button */}
            <Button
              onClick={onGenerate}
              variant="hero"
              className="h-10 w-full gap-2 font-bold text-xs"
              disabled={loading || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Download Report</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold">Report Preview</h3>
            <Badge variant="outline" className="bg-primary/5">{totalItems} Records Found</Badge>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={reportData}
          loading={loading}
          pageCount={totalPages}
          pageIndex={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
        />
      </div>
    </div>
  );
}
