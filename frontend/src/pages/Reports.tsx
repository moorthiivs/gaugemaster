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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarIcon,
  FileText,
  Download,
  Filter,
  Settings2,
  Loader2,
  MapPin,
  CheckCircle2,
  Search,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Check,
  Activity,
} from "lucide-react";
import httpClient from "@/lib/httpClient";
import { useAuth } from "@/lib/auth";
import { DataTable } from "@/components/DataTable";
import { Instrument } from "@/types/instrument";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { deduplicateItemStatuses } from "@/lib/itemStatus";
import { StatusBadge } from "@/components/common/StatusBadge";

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_REPORT_COLUMNS: ColumnConfig[] = [
  { id: "sino", label: "S.No", visible: true },
  { id: "name", label: "Instrument Name", visible: true },
  { id: "id_code", label: "ID Code", visible: true },
  { id: "location", label: "Location", visible: true },
  { id: "due_date", label: "Due Date", visible: true },
  { id: "status", label: "Calib Status", visible: true },
  { id: "item_status", label: "Item Status", visible: true },
  { id: "last_calibration_date", label: "Last Cal Date", visible: true },
  { id: "frequency", label: "Frequency", visible: false },
  { id: "device_type", label: "Device Type", visible: false },
  { id: "agency", label: "Agency", visible: false },
  { id: "range", label: "Range", visible: false },
  { id: "serial_no", label: "Serial Number", visible: false },
  { id: "least_count", label: "Least Count", visible: false },
  { id: "make", label: "Make", visible: false },
  { id: "item_type", label: "Item Type", visible: false },
  { id: "part_no", label: "Part Number", visible: false },
  { id: "part_name", label: "Part Name", visible: false },
  { id: "module", label: "Module", visible: false },
  { id: "calibration_source", label: "Calibration Source", visible: false },
  { id: "customer", label: "Customer", visible: false },
  { id: "sector", label: "Sector", visible: false },
  { id: "criticality_level", label: "Criticality Level", visible: false },
  { id: "cert_no", label: "Certificate No", visible: false },
  { id: "gauge_issue_date", label: "Gauge Issue Date", visible: false },
  { id: "gauges_received_by", label: "Gauges Received By", visible: false },
  { id: "gauges_issued_by", label: "Gauges Issued By", visible: false },
  { id: "calibration_procedure", label: "Calibration Procedure", visible: false },
  { id: "traceable", label: "Traceable", visible: false },
  { id: "remarks", label: "Remarks", visible: false },
  { id: "notes", label: "Notes", visible: false },
  { id: "is_reference_standard", label: "Reference Standard", visible: false },
];

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

  // Status, Item Status & Location Filters for download and preview
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [selectedItemStatus, setSelectedItemStatus] = useState<string>("All");
  const [selectedLocation, setSelectedLocation] = useState<string>("All");

  const [reportData, setReportData] = useState<Instrument[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{ location: string[]; status: string[]; item_status?: string[] }>({ location: [], status: [], item_status: [] });
  const [columnFilters, setColumnFilters] = useState<any[]>([]);
  const [validationRules, setValidationRules] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      httpClient
        .get("/report-templates", { params: { userId: user.id } })
        .then((res) => setTemplates(res.data || []))
        .catch((err) => console.error("Error fetching report templates", err));

      httpClient
        .get(`/instruments/filters/${user.id}`, {
          params: { companyId: user.companyId },
        })
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
            setColumnConfigs((prev) => {
              const existingIds = new Set(prev.map((c) => c.id));
              const missingCustoms = custom
                .filter((r) => !existingIds.has(r.fieldName))
                .map((r) => ({ id: r.fieldName, label: r.displayName || r.fieldName, visible: false }));
              if (missingCustoms.length === 0) return prev;
              return [...prev, ...missingCustoms];
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

  // Customizable Instrument Columns Configuration (Persisted & Re-orderable)
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(() => {
    try {
      const saved =
        localStorage.getItem("gaugemaster_report_columns_config") ||
        localStorage.getItem("gaugemaster_instrument_columns_config");
      if (saved) {
        const parsed: ColumnConfig[] = JSON.parse(saved);
        const existingIds = new Set(parsed.map((c) => c.id));
        const missing = DEFAULT_REPORT_COLUMNS.filter((c) => !existingIds.has(c.id));
        return [...parsed, ...missing];
      }
    } catch (e) {
      console.error("Failed to load saved report column config", e);
    }
    return DEFAULT_REPORT_COLUMNS;
  });

  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [tempColumnConfigs, setTempColumnConfigs] = useState<ColumnConfig[]>([]);
  const [columnSearchQuery, setColumnSearchQuery] = useState("");
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);

  const handleOpenColumnModal = () => {
    setTempColumnConfigs([...columnConfigs]);
    setColumnSearchQuery("");
    setColumnModalOpen(true);
  };

  const handleSaveColumnConfigs = () => {
    setColumnConfigs(tempColumnConfigs);
    try {
      localStorage.setItem(
        "gaugemaster_report_columns_config",
        JSON.stringify(tempColumnConfigs)
      );
    } catch (e) {
      console.error("Failed to save report column config", e);
    }
    setColumnModalOpen(false);
    toast({
      title: "Column Preferences Saved",
      description: "Your report column selection and order have been updated.",
      variant: "success",
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedColIndex === null || draggedColIndex === targetIndex) return;

    setTempColumnConfigs((prev) => {
      const updated = [...prev];
      const draggedItem = updated[draggedColIndex];
      updated.splice(draggedColIndex, 1);
      updated.splice(targetIndex, 0, draggedItem);
      return updated;
    });
    setDraggedColIndex(targetIndex);
  };

  const handleDragEnd = () => {
    setDraggedColIndex(null);
  };

  const handleMoveColumn = (index: number, direction: "up" | "down") => {
    const newConfigs = [...tempColumnConfigs];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newConfigs.length) return;
    const temp = newConfigs[index];
    newConfigs[index] = newConfigs[targetIndex];
    newConfigs[targetIndex] = temp;
    setTempColumnConfigs(newConfigs);
  };

  const handleToggleColumnVisibility = (id: string, checked: boolean) => {
    setTempColumnConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: checked } : c))
    );
  };

  const from = fromDate ? format(fromDate, "yyyy-MM-dd") : "";
  const to = toDate ? format(toDate, "yyyy-MM-dd") : "";

  // Dynamic filter options derived from database
  const statusOptions = useMemo(() => {
    const raw = filterOptions.status || [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of raw) {
      if (!s || !s.trim()) continue;
      const key = s.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(s.trim());
      }
    }
    if (list.length === 0) {
      return ["OK", "Overdue", "Sent for Calibration", "REJECTED"];
    }
    return list;
  }, [filterOptions.status]);

  const itemStatusOptions = useMemo(() => {
    const raw = filterOptions.item_status || ["Active", "SPARE", "Inactive", "STOCK"];
    return deduplicateItemStatuses(raw);
  }, [filterOptions.item_status]);

  // Safe DD-MM-YYYY date formatter for preview & display
  const formatDateDisplay = (dateVal: any) => {
    if (!dateVal) return "-";
    if (typeof dateVal === "string") {
      const trimmed = dateVal.trim();
      if (!trimmed || trimmed === "-") return "-";
      if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return trimmed;
      const dmySlashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (dmySlashMatch) return `${dmySlashMatch[1]}-${dmySlashMatch[2]}-${dmySlashMatch[3]}`;
      const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
      if (ymdMatch) {
        return `${ymdMatch[3]}-${ymdMatch[2]}-${ymdMatch[1]}`;
      }
    }
    try {
      const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
      if (isNaN(d.getTime())) return "-";
      return format(d, "dd-MM-yyyy");
    } catch {
      return "-";
    }
  };

  const fetchPreview = async () => {
    if (!from || !to || !user?.id) return;
    setLoading(true);

    const filters: Record<string, string> = {};
    columnFilters.forEach((f) => {
      filters[f.id] = f.value;
    });

    if (selectedStatus && selectedStatus !== "All") filters.status = selectedStatus;
    if (selectedItemStatus && selectedItemStatus !== "All") filters.item_status = selectedItemStatus;
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
  }, [from, to, user?.id, columnFilters, selectedStatus, selectedItemStatus, selectedLocation, pageSize]);

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

    const visibleColumns = columnConfigs
      .filter((c) => c.visible)
      .map((c) => c.id);

    if (visibleColumns.length === 0) {
      return toast({
        title: "No Columns Selected",
        description: "Please select at least one column to export using Customize Columns.",
        variant: "destructive",
      });
    }

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
      if (selectedItemStatus && selectedItemStatus !== "All") paramsObj.item_status = selectedItemStatus;
      if (selectedLocation && selectedLocation !== "All") paramsObj.location = selectedLocation;

      if (formatType === "html") {
        const response = await httpClient.get("/reports", {
          params: paramsObj,
          responseType: "text",
        });

        const blob = new Blob([response.data], { type: "text/html;charset=utf-8" });
        const blobUrl = URL.createObjectURL(blob);
        const printWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.focus();
            try {
              printWindow.print();
            } catch (err) {
              console.error("Print invocation failed:", err);
            }
            URL.revokeObjectURL(blobUrl);
          };
          printWindow.setTimeout(() => {
            try {
              printWindow.focus();
              printWindow.print();
            } catch {
              // Ignore if already printed
            }
            URL.revokeObjectURL(blobUrl);
          }, 600);
        } else {
          URL.revokeObjectURL(blobUrl);
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
    const colDefMap: Record<string, ColumnDef<Instrument>> = {
      sino: {
        id: "sino",
        accessorKey: "sino",
        header: "S.No",
        cell: ({ row }) => <span className="font-medium text-muted-foreground">{row.original.sino || "-"}</span>,
      },
      name: {
        id: "name",
        accessorKey: "name",
        header: "Instrument Name",
        meta: { enableFilter: true },
      },
      id_code: {
        id: "id_code",
        accessorKey: "id_code",
        header: "ID Code",
        meta: { enableFilter: true },
      },
      location: {
        id: "location",
        accessorKey: "location",
        header: "Location",
        meta: {
          enableFilter: true,
          filterOptions: filterOptions.location,
        },
      },
      due_date: {
        id: "due_date",
        accessorKey: "due_date",
        header: "Due Date",
        cell: ({ row }) => formatDateDisplay(row.getValue("due_date")),
      },
      last_calibration_date: {
        id: "last_calibration_date",
        accessorKey: "last_calibration_date",
        header: "Last Cal Date",
        cell: ({ row }) => formatDateDisplay(row.getValue("last_calibration_date")),
      },
      status: {
        id: "status",
        accessorKey: "status",
        header: "Calib Status",
        meta: {
          enableFilter: true,
          filterOptions: statusOptions,
        },
        cell: ({ row }) => <StatusBadge status={row.getValue("status") as string} />,
      },
      item_status: {
        id: "item_status",
        accessorKey: "item_status",
        header: "Item Status",
        meta: {
          enableFilter: true,
          filterOptions: itemStatusOptions,
        },
        cell: ({ row }) => <StatusBadge status={row.getValue("item_status") || "Active"} />,
      },
      frequency: { id: "frequency", accessorKey: "frequency", header: "Frequency" },
      device_type: { id: "device_type", accessorKey: "device_type", header: "Device Type" },
      agency: {
        id: "agency",
        accessorKey: "agency",
        header: "Agency",
        meta: { enableFilter: true },
      },
      range: { id: "range", accessorKey: "range", header: "Range" },
      serial_no: { id: "serial_no", accessorKey: "serial_no", header: "Serial Number" },
      least_count: { id: "least_count", accessorKey: "least_count", header: "Least Count" },
      make: { id: "make", accessorKey: "make", header: "Make" },
      item_type: { id: "item_type", accessorKey: "item_type", header: "Item Type" },
      part_no: { id: "part_no", accessorKey: "part_no", header: "Part Number" },
      part_name: { id: "part_name", accessorKey: "part_name", header: "Part Name" },
      module: { id: "module", accessorKey: "module", header: "Module" },
      calibration_source: { id: "calibration_source", accessorKey: "calibration_source", header: "Calib Source" },
      customer: { id: "customer", accessorKey: "customer", header: "Customer" },
      sector: { id: "sector", accessorKey: "sector", header: "Sector" },
      criticality_level: { id: "criticality_level", accessorKey: "criticality_level", header: "Criticality" },
      cert_no: { id: "cert_no", accessorKey: "cert_no", header: "Certificate No" },
      gauge_issue_date: {
        id: "gauge_issue_date",
        accessorKey: "gauge_issue_date",
        header: "Issue Date",
        cell: ({ row }) => formatDateDisplay(row.getValue("gauge_issue_date")),
      },
      gauges_received_by: { id: "gauges_received_by", accessorKey: "gauges_received_by", header: "Received By" },
      gauges_issued_by: { id: "gauges_issued_by", accessorKey: "gauges_issued_by", header: "Issued By" },
      calibration_procedure: { id: "calibration_procedure", accessorKey: "calibration_procedure", header: "Procedure" },
      traceable: { id: "traceable", accessorKey: "traceable", header: "Traceable" },
      remarks: { id: "remarks", accessorKey: "remarks", header: "Remarks" },
      notes: { id: "notes", accessorKey: "notes", header: "Notes" },
      is_reference_standard: {
        id: "is_reference_standard",
        accessorKey: "is_reference_standard",
        header: "Reference Standard",
        cell: ({ row }) => (row.original.is_reference_standard ? "Yes" : "No"),
      },
    };

    // Add custom fields from validation rules
    customRules.forEach((rule) => {
      colDefMap[rule.fieldName] = {
        id: rule.fieldName,
        accessorKey: `custom_${rule.fieldName}`,
        header: rule.displayName || rule.fieldName,
        cell: ({ row }) => {
          const val = row.original.custom_parameters?.[rule.fieldName] ?? (row.original as any)[rule.fieldName];
          if (rule.fieldName.toLowerCase().includes("date") && val) {
            return formatDateDisplay(val);
          }
          return val !== undefined && val !== null && val !== "" ? String(val) : "-";
        },
      } as ColumnDef<Instrument>;
    });

    // Build ordered list according to columnConfigs
    const activeCols: ColumnDef<Instrument>[] = [];
    columnConfigs
      .filter((c) => c.visible)
      .forEach((c) => {
        const def = colDefMap[c.id];
        if (def) {
          activeCols.push(def);
        } else {
          // Dynamic custom column
          activeCols.push({
            id: c.id,
            accessorKey: `custom_${c.id}`,
            header: c.label,
            cell: ({ row }: any) => {
              const val = row.original.custom_parameters?.[c.id] ?? (row.original as any)[c.id];
              if (c.id.toLowerCase().includes("date") && val) {
                return formatDateDisplay(val);
              }
              return val !== undefined && val !== null && val !== "" ? String(val) : "-";
            },
          } as ColumnDef<Instrument>);
        }
      });

    return activeCols;
  }, [columnConfigs, filterOptions, statusOptions, itemStatusOptions, customRules]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="overflow-hidden border border-border shadow-2xs bg-card rounded-xl">
        <CardHeader className="border-b border-border bg-muted/30 p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Generate Calibration Report</CardTitle>
                <CardDescription>Filter by Date Range, Status, and Location to customize and export your instrument data</CardDescription>
              </div>
            </div>

            {/* Quick Presets & Customize Columns */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenColumnModal}
                className="h-8 text-xs font-semibold gap-1.5 bg-background hover:border-primary/50 shadow-2xs border-primary/30 text-primary"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span>Customize Columns ({columnConfigs.filter((c) => c.visible).length})</span>
              </Button>
              <div className="h-4 w-px bg-border/60 mx-1 hidden sm:block" />
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 items-end">
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
                  {statusOptions.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st === "OK" ? "OK / Calibrated" : st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item Status Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <Badge className="h-3.5 w-3.5 p-0 flex items-center justify-center text-[9px]">I</Badge>
                Item Status
              </label>
              <Select value={selectedItemStatus} onValueChange={setSelectedItemStatus}>
                <SelectTrigger className="h-10 text-xs font-medium hover:border-primary/50">
                  <SelectValue placeholder="All Item Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Item Status</SelectItem>
                  {itemStatusOptions.map((itemSt) => (
                    <SelectItem key={itemSt} value={itemSt}>
                      {itemSt}
                    </SelectItem>
                  ))}
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
            <Badge variant="secondary" className="text-xs font-normal">
              {columnConfigs.filter((c) => c.visible).length} Columns Active
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenColumnModal}
            className="h-8 text-xs font-semibold gap-1.5 hover:border-primary/50 shadow-2xs"
          >
            <Settings2 className="h-3.5 w-3.5 text-primary" />
            <span>Customize Columns</span>
          </Button>
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
          hideColumnToggle={true}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
        />
      </div>

      {/* Customize Instrument Columns Modal */}
      <Dialog open={columnModalOpen} onOpenChange={setColumnModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <span>Customize Instrument Columns</span>
            </DialogTitle>
            <DialogDescription>
              Drag & drop columns to re-order, or use the checkboxes to toggle visibility.
            </DialogDescription>
          </DialogHeader>

          {/* Search & Quick Actions */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search columns..."
                value={columnSearchQuery}
                onChange={(e) => setColumnSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setTempColumnConfigs((prev) => prev.map((c) => ({ ...c, visible: true })))}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-muted-foreground"
                  onClick={() =>
                    setTempColumnConfigs((prev) =>
                      prev.map((c) => ({
                        ...c,
                        visible: c.id === "sino" || c.id === "name" || c.id === "id_code",
                      }))
                    )
                  }
                >
                  Deselect All
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-primary font-medium"
                onClick={() => setTempColumnConfigs([...DEFAULT_REPORT_COLUMNS])}
              >
                Reset Default
              </Button>
            </div>
          </div>

          {/* Drag & Drop Re-orderable & Selectable Columns List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 border rounded-xl p-2 max-h-[45vh] scrollbar-thin">
            {tempColumnConfigs
              .map((col, index) => ({ col, originalIndex: index }))
              .filter(({ col }) => col.label.toLowerCase().includes(columnSearchQuery.toLowerCase()))
              .map(({ col, originalIndex }) => (
                <div
                  key={col.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, originalIndex)}
                  onDragOver={(e) => handleDragOver(e, originalIndex)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all duration-150 select-none ${
                    draggedColIndex === originalIndex
                      ? "bg-primary/10 border-primary shadow-md scale-[1.01] z-10"
                      : col.visible
                      ? "bg-card border-border hover:border-primary/40 shadow-2xs"
                      : "bg-muted/30 border-transparent opacity-60 hover:opacity-80"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <Checkbox
                      id={`col-cfg-${col.id}`}
                      checked={col.visible}
                      onCheckedChange={(checked) => handleToggleColumnVisibility(col.id, !!checked)}
                    />
                    <label
                      htmlFor={`col-cfg-${col.id}`}
                      className="font-medium text-xs truncate cursor-pointer select-none"
                    >
                      {col.label}
                    </label>
                  </div>

                  {/* Up / Down Re-order Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      disabled={originalIndex === 0}
                      onClick={() => handleMoveColumn(originalIndex, "up")}
                      title="Move Up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      disabled={originalIndex === tempColumnConfigs.length - 1}
                      onClick={() => handleMoveColumn(originalIndex, "down")}
                      title="Move Down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>

          {/* Footer Actions */}
          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setColumnModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveColumnConfigs} className="gap-1.5">
              <Check className="w-4 h-4" />
              <span>Save Configuration</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
