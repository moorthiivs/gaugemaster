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
import { CalendarIcon, FileText, Download, Filter, Settings2, Loader2 } from "lucide-react";
import { generateReport } from "@/lib/instrumentActions";
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

  // const [fromDate, setFromDate] = useState<Date | undefined>(
  //   new Date(new Date().getFullYear(), 0, 1)
  // );
  // const [toDate, setToDate] = useState<Date | undefined>(
  //   new Date(new Date().getFullYear(), 11, 31)
  // );
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

  useEffect(() => {
    if (user?.id) {
      httpClient.get("/report-templates", { params: { userId: user.id } })
        .then((res) => setTemplates(res.data || []))
        .catch((err) => console.error("Error fetching report templates", err));
    }
  }, [user?.id]);

  const [reportData, setReportData] = useState<Instrument[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{ location: string[], status: string[] }>({ location: [], status: [] });
  const [columnFilters, setColumnFilters] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      httpClient.get(`/instruments/filters/${user.id}`).then(res => setFilterOptions(res.data));
    }
  }, [user?.id]);

  // Initialize with all columns. Core columns are true, extended columns are false.
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


  // Convert to ISO strings for API/report generation
  const from = fromDate ? format(fromDate, "yyyy-MM-dd") : "";
  const to = toDate ? format(toDate, "yyyy-MM-dd") : "";

  const fetchPreview = async () => {
    if (!from || !to || !user?.id) return;
    setLoading(true);

    // Map column filters to query params
    const filters: Record<string, string> = {};
    columnFilters.forEach(f => {
      filters[f.id] = f.value;
    });

    try {
      const res = await httpClient.get("/reports/preview", {
        params: {
          from,
          to,
          userid: user.id,
          page,
          pageSize,
          ...filters
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
    // Reset to page 1 when filters change
    setPage(1);
    fetchPreview();
  }, [from, to, user?.id, columnFilters, pageSize]);

  // Special effect for page changes to avoid double fetching on filter change
  useEffect(() => {
    fetchPreview();
  }, [page]);

  const totalPages = Math.ceil(totalItems / pageSize);

  const onGenerate = async () => {
    if (!from || !to) return toast({ title: "Dates Required", description: "Please select both from and to dates", variant: "destructive" });

    // Get list of visible columns
    const visibleColumns = Object.entries(columnVisibility)
      .filter(([_, isVisible]) => isVisible)
      .map(([columnId]) => columnId);

    setIsGenerating(true);
    try {
      const userId = user?.id || (user as any)?.sub;
      if (formatType === 'html') {
          const response = await httpClient.get('/reports', {
            params: {
              from,
              to,
              format: formatType,
              userid: userId,
              columns: visibleColumns.join(','),
              templateId: selectedTemplateId !== "default" ? selectedTemplateId : undefined
            },
            responseType: 'text',
          });
          
          const printWindow = window.open('', '_blank');
          if (printWindow) {
              printWindow.document.write(response.data);
              printWindow.document.close();
              printWindow.focus();
              printWindow.setTimeout(() => printWindow.print(), 500);
          } else {
              toast({ title: "Pop-up Blocked", description: "Please allow pop-ups to print the report.", variant: "destructive" });
          }
      } else {
          const response = await httpClient.get('/reports', {
            params: {
              from,
              to,
              format: formatType,
              userid: userId,
              columns: visibleColumns.join(','),
              templateId: selectedTemplateId !== "default" ? selectedTemplateId : undefined
            },
            responseType: 'blob',
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

  const columns: ColumnDef<Instrument>[] = useMemo(() => [
    {
      accessorKey: "sino",
      header: "S.No",
      cell: ({ row }) => <span className="font-medium text-muted-foreground">{row.index + 1 + (page - 1) * pageSize}</span>,
    },
    {
      accessorKey: "name",
      header: "Instrument Name",
      meta: { enableFilter: true }
    },
    {
      accessorKey: "id_code",
      header: "ID Code",
      meta: { enableFilter: true }
    },
    {
      accessorKey: "location",
      header: "Location",
      meta: {
        enableFilter: true,
        filterOptions: filterOptions.location
      }
    },
    {
      accessorKey: "due_date",
      header: "Due Date",
      cell: ({ row }) => format(new Date(row.getValue("due_date")), "dd/MM/yyyy"),
    },
    {
      accessorKey: "last_calibration_date",
      header: "Last Cal Date",
      cell: ({ row }) => row.getValue("last_calibration_date") ? format(new Date(row.getValue("last_calibration_date")), "dd/MM/yyyy") : "-",
    },
    {
      accessorKey: "status",
      header: "Calib Status",
      meta: {
        enableFilter: true,
        filterOptions: filterOptions.status
      },
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant={status === "OK" ? "success" : status === "Overdue" ? "destructive" : "warning"}
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
      meta: { enableFilter: true }
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
      cell: ({ row }) => row.getValue("gauge_issue_date") ? format(new Date(row.getValue("gauge_issue_date")), "dd/MM/yyyy") : "-",
    },
    { accessorKey: "gauges_received_by", header: "Received By" },
    { accessorKey: "gauges_issued_by", header: "Issued By" },
    { accessorKey: "calibration_procedure", header: "Procedure" },
    { accessorKey: "traceable", header: "Traceable" },
    { accessorKey: "remarks", header: "Remarks" },
    { accessorKey: "notes", header: "Notes" },
  ], [page, pageSize, filterOptions]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-muted/20">
        <CardHeader className="border-b border-muted/20 bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Generate Calibration Report</CardTitle>
              <CardDescription>Select a date range and format to export your instrument data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-5 items-end">
            {/* From date */}
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                From Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left h-11 font-medium transition-all hover:border-primary/50 ${!fromDate ? "text-muted-foreground" : ""}`}
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
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                To Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left h-11 font-medium transition-all hover:border-primary/50 ${!toDate ? "text-muted-foreground" : ""}`}
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

            {/* Format */}
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Export Format
              </label>
              <Select value={formatType} onValueChange={(value: "xlsx" | "html") => setFormatType(value)}>
                <SelectTrigger className="h-11 font-medium hover:border-primary/50 transition-all">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx) Download</SelectItem>
                  <SelectItem value="html">Print View</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Report Template */}
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                Report Template
              </label>
              <Select 
                value={selectedTemplateId} 
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger className="h-11 font-medium hover:border-primary/50 transition-all">
                  <SelectValue placeholder="Select Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Settings Template</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Generate button */}
            <Button
              onClick={onGenerate}
              variant="hero"
              className="h-11 w-full gap-2 font-bold"
              disabled={loading || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  <span>Generate Report</span>
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
