import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Instrument, InstrumentQuery } from "@/types/instrument";
import { listInstruments, getFilterParams, updateInstrument, deleteInstrument, deleteInstrumentsBulk } from "@/lib/instrumentActions";
import { useSEO } from "@/hooks/useSEO";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import httpClient from "@/lib/httpClient";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import ExcelUpload from "@/components/ExcelUpload";
import { DataTable } from "@/components/DataTable";
import { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Upload, FileSpreadsheet, Search, CalendarDays, Activity, Mail, RefreshCw, History, Trash2, Edit, Printer, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PrintLabelModal } from "@/components/PrintLabelModal";

import TooltipProv from "@/components/TooltipProv";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const pageSize = 10;
const BASE_URL = (httpClient.defaults.baseURL || "http://localhost:5000/api").replace(/\/api$/, "");

export default function Instruments() {
  useSEO({ title: "Instruments — Calibration Alerts", description: "Browse, filter, and manage instruments." });
  const { toast } = useToast();
  const { user } = useAuth()
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const initialSearch = searchParams.get("search") || "";
  const initialDueDate = searchParams.get("due_date") || "";
  const initialStatus = searchParams.get("status") || "All";
  const initialDueDateStart = searchParams.get("due_date_start") || "";
  const initialDueDateEnd = searchParams.get("due_date_end") || "";
  const initialLastCalStart = searchParams.get("last_cal_start") || "";
  const initialLastCalEnd = searchParams.get("last_cal_end") || "";
  const initialItemStatus = searchParams.get("item_status") || "Active";
  const initialLocation = searchParams.get("location") || "All";
  
  const initialIsReferenceStandard = searchParams.get("is_reference_standard") || "All";

  const [filters, setFilters] = useState<InstrumentQuery>({ 
    status: initialStatus as any, item_status: initialItemStatus as any, location: initialLocation, frequency: "All", search: initialSearch, 
    due_date: initialDueDate, due_date_start: initialDueDateStart, due_date_end: initialDueDateEnd,
    last_cal_start: initialLastCalStart, last_cal_end: initialLastCalEnd,
    is_reference_standard: initialIsReferenceStandard,
    page: 1, pageSize, limit: 10 
  });
  const [data, setData] = useState<{ items: Instrument[]; total: number }>({ items: [], total: 0 });
  const [allData, setAllData] = useState<Instrument[]>([]); // store original data
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    range: false,
    serial_no: false,
    least_count: false,
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
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [dateUpdateInstrument, setDateUpdateInstrument] = useState<Instrument | null>(null);
  const [newLastCalDate, setNewLastCalDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [updatingDates, setUpdatingDates] = useState(false);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);


  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [instrumentToDelete, setInstrumentToDelete] = useState<Instrument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [StatusFillter, setStatusFilter] = useState([])

  const [FrequencyFillter, setFrequencyFilter] = useState([])

  const [LocationFillter, setLocationFilter] = useState([])

  const [isOpenupload, setisOpenupload] = useState(false);
  const [rejectedFile, setRejectedFile] = useState<Blob | null>(null);

  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [instrumentsToPrint, setInstrumentsToPrint] = useState<Instrument[]>([]);

  const handleConvertToGoogleSheet = async (id: string) => {
    try {
      setConvertingId(id);
      const res = await httpClient.post(`${BASE_URL}/instruments/${id}/google-sheet/convert`);
      if (res.data?.url) {
        toast({ title: "Opened in Google Sheets" });
        window.open(res.data.url, "_blank");
        fetchData(); // Refresh list to update URL
      }
    } catch (err: any) {
      toast({ 
        title: "Failed to open in Google Sheets", 
        description: err.response?.data?.message || err.message,
        variant: "destructive" 
      });
    } finally {
      setConvertingId(null);
    }
  };
  const [isOpenCalibagency, setisOpenCalibagency] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState("");
  const [description, setDescription] = useState("");
  const EMAIL_COLUMNS = [
    { id: 'sino', label: 'S.No' },
    { id: 'name', label: 'Name' },
    { id: 'id_code', label: 'ID Code' },
    { id: 'location', label: 'Location' },
    { id: 'last_calibration_date', label: 'Last Calibration Date' },
    { id: 'due_date', label: 'Due Date' },
    { id: 'frequency', label: 'Frequency' },
    { id: 'status', label: 'Status' },
    { id: 'item_status', label: 'Item Status' },
    { id: 'range', label: 'Range' },
    { id: 'serial_no', label: 'Serial No' },
    { id: 'least_count', label: 'Least Count' },
    { id: 'make', label: 'Make' },
    { id: 'item_type', label: 'Item Type' },
    { id: 'part_no', label: 'Part No' },
    { id: 'part_name', label: 'Part Name' },
    { id: 'calibration_source', label: 'Calibration Source' },
    { id: 'customer', label: 'Customer' },
    { id: 'sector', label: 'Sector' },
    { id: 'criticality_level', label: 'Criticality Level' },
    { id: 'cert_no', label: 'Cert. No.' },
    { id: 'remarks', label: 'Remarks' },
    { id: 'gauge_issue_date', label: 'Gauge Issue Date' },
    { id: 'gauges_received_by', label: 'Gauges Received By' },
    { id: 'gauges_issued_by', label: 'Gauges Issued By' },
    { id: 'calibration_procedure', label: 'Calibration Procedure' },
    { id: 'traceable', label: 'Traceable' }
  ];
  const [selectedEmailColumns, setSelectedEmailColumns] = useState<string[]>(['name', 'id_code', 'location', 'last_calibration_date', 'due_date', 'frequency', 'status']);

  const [isSendCalibration, setisSendCalibration] = useState(false);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.status && filters.status !== "All") queryParams.append("status", filters.status);
      if (filters.item_status && filters.item_status !== "All") queryParams.append("item_status", filters.item_status);
      if (filters.location && filters.location !== "All") queryParams.append("location", filters.location);
      if (filters.frequency && filters.frequency !== "All") queryParams.append("frequency", filters.frequency);
      if (filters.search) queryParams.append("search", filters.search);
      if (filters.due_date) queryParams.append("due_date", filters.due_date);
      if (filters.due_date_start) queryParams.append("due_date_start", filters.due_date_start);
      if (filters.due_date_end) queryParams.append("due_date_end", filters.due_date_end);
      if (filters.last_cal_start) queryParams.append("last_cal_start", filters.last_cal_start);
      if (filters.last_cal_end) queryParams.append("last_cal_end", filters.last_cal_end);
      if (filters.page) queryParams.append("page", String(filters.page));
      if (filters.pageSize) queryParams.append("pageSize", String(filters.pageSize));
      if (filters.is_reference_standard && filters.is_reference_standard !== "All") queryParams.append("is_reference_standard", filters.is_reference_standard);

      const result = await listInstruments({
        ...filters,
        createdBy: user.id
      });

      setData({
        items: result.data,
        total: result.total
      });
      setAllData(result.data); // keep original copy
      setSelected({});
    } catch (error) {
      toast({ title: 'error', description: String(error), variant: 'destructive' })
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const filterData = await getFilterParams(user.id);
      setStatusFilter(["All", ...filterData.status]);
      setFrequencyFilter(["All", ...filterData.frequency]);
      setLocationFilter(["All", ...filterData.location]);
      await fetchData();
      toast({
        title: "Data Refreshed 🔄",
        description: "Instruments inventory and filter parameters updated successfully.",
        variant: "success"
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Refresh Error",
        description: "Failed to reload inventory data.",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.page, filters.status, filters.item_status, filters.location, filters.frequency, filters.pageSize, filters.search, filters.due_date, filters.is_reference_standard]);

  useEffect(() => {
    const handleUploadComplete = () => {
      fetchData();
    };
    window.addEventListener("background-upload-completed", handleUploadComplete);
    return () => {
      window.removeEventListener("background-upload-completed", handleUploadComplete);
    };
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters((f) => {
        if (f.search === localSearch) return f;
        return { ...f, search: localSearch, page: 1 };
      });
    }, 500);
    return () => clearTimeout(handler);
  }, [localSearch]);

  useEffect(() => {
    if (localSearch.trim().length > 0) {
      const handler = setTimeout(() => {
        listInstruments({ search: localSearch, page: 1, pageSize: 20, createdBy: user.id })
          .then(res => {
            const lowerSearch = localSearch.toLowerCase();
            const results = new Set<string>();
            
            res.data.forEach((item: any) => {
              Object.entries(item).forEach(([key, val]) => {
                if (key === 'id' || key === 'company_id' || key.endsWith('_id') || key === 'created_at' || key === 'updated_at') {
                  return;
                }
                
                if (typeof val === 'string' && val.length > 0 && val.length < 60) {
                  // Exclude ISO date strings entirely, because the backend search doesn't search dates this way
                  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
                    return;
                  } 
                  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
                    return;
                  }
                  
                  if (val.toLowerCase().includes(lowerSearch)) {
                    results.add(val);
                  }
                }
              });
            });
            
            setSuggestions(Array.from(results).slice(0, 8));
          })
          .catch(err => console.error("Error fetching suggestions:", err));
      }, 300);
      return () => clearTimeout(handler);
    } else {
      setSuggestions([]);
    }
  }, [localSearch, user.id]);

  useEffect(() => {
    getFilterParams(user.id).then(data => {
      setStatusFilter(["All", ...data.status]);
      setFrequencyFilter(["All", ...data.frequency]);
      setLocationFilter(["All", ...data.location]);
    });
    
    if (user?.companyId) {
      httpClient.get(`/backup/drive/status?companyId=${user.companyId}`).then(res => {
        setDriveConnected(res.data?.connected || false);
      }).catch(err => console.error("Failed to fetch drive status", err));
    }
  }, [user]);


  const toggleAll = (checked: boolean) => {
    const map: Record<string, boolean> = {};
    for (const i of data.items) map[i.id] = checked;
    setSelected(map);
  };

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([id]) => id), [selected]);

  const markCalibrated = async () => {
    const today = new Date();
    for (const id of selectedIds) {
      await updateInstrument(id, {
        last_calibration_date: today.toISOString(),
        due_date: new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()).toISOString(),
      });
    }
    fetchData();
  };



  const handleSendMail = async () => {
    setisSendCalibration(true)
    try {
      const selectedItems = data.items.filter((i) => selected[i.id]);
      const payload = {
        to: selectedAgency,
        description,
        instruments: selectedItems,
        userId: user.id,
        columns: selectedEmailColumns,
      };

      console.log(payload, "payload");
      const res = await httpClient.post(`/instruments/send-calibration-agency`, payload);
      console.log("Mail Payload:", res);
      setisOpenCalibagency(false);

      toast({
        title: "Mail Sent Successfully",
        description: "Calibration request has been sent to the selected agency.",
        variant: 'success',
      });
      setisSendCalibration(false)
    } catch (error: any) {
      console.log(error);
      const errorMessage = error.response?.data?.message || "Unable to send calibration mail. Please try again.";
      
      toast({
        title: "Sending Failed",
        description: errorMessage.includes("SMTP configuration") 
          ? "SMTP configuration is missing. Please set up your email settings in Settings > Mail Configuration."
          : errorMessage,
        variant: "destructive",
      });
    } finally {
      setisSendCalibration(false)
    }

  };

  const parseFrequencyMonths = (freq: string) => {
    if (!freq) return 0;
    const match = freq.match(/(\d+)/);
    if (!match) return 0;
    let val = parseInt(match[1], 10);
    if (freq.toLowerCase().includes("year")) val *= 12;
    return val;
  };

  const handleOpenHistory = async (inst: Instrument) => {
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await httpClient.get(`/instruments/${inst.id}/history`);
      setHistoryData(res.data || []);
      setDateUpdateInstrument(inst);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch history", variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenDateModal = (inst: Instrument) => {
    setDateUpdateInstrument(inst);
    
    // Default Last Calibration Date to the instrument's current due_date, or today if missing
    let baseDate = new Date();
    if (inst.due_date) {
      const parsedDue = new Date(inst.due_date);
      if (!isNaN(parsedDue.getTime())) {
        baseDate = parsedDue;
      }
    }
    
    setNewLastCalDate(format(baseDate, 'yyyy-MM-dd'));
    setCertificateFile(null);

    // Calculate the next due date based on baseDate + frequency
    const freqMonths = parseFrequencyMonths(inst.frequency);
    if (freqMonths > 0) {
      const due = new Date(baseDate);
      due.setMonth(due.getMonth() + freqMonths);
      setNewDueDate(format(due, 'yyyy-MM-dd'));
    } else {
      setNewDueDate("");
    }
    setDateModalOpen(true);
  };

  const handleUpdateDates = async () => {
    if (!dateUpdateInstrument || !newLastCalDate || !newDueDate) return;
    setUpdatingDates(true);
    try {
      await updateInstrument(dateUpdateInstrument.id, {
        last_calibration_date: new Date(newLastCalDate).toISOString(),
        due_date: new Date(newDueDate).toISOString(),
        status: "OK"
      });

      if (certificateFile) {
        const formData = new FormData();
        formData.append("file", certificateFile);
        await httpClient.post(`/instruments/${dateUpdateInstrument.id}/certificate`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      toast({ title: "Success", description: "Calibration dates updated successfully.", variant: "success" });
      setDateModalOpen(false);
      fetchData();
    } catch (err) {
      toast({ title: "Update Failed", description: "Failed to update dates.", variant: "destructive" });
    } finally {
      setUpdatingDates(false);
    }
  };

  const handleDirectUpload = async (instrumentId: string, file: File) => {
    try {
      setUploadingId(instrumentId);
      const formData = new FormData();
      formData.append('file', file);
      await httpClient.post(`/instruments/${instrumentId}/certificate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast({ title: 'Success', description: 'Certificate uploaded successfully!', variant: 'success' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to upload certificate.', variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  const handleOpenDeleteModal = (instrument: Instrument) => {
    setInstrumentToDelete(instrument);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!instrumentToDelete) return;
    try {
      setDeleting(true);
      await deleteInstrument(instrumentToDelete.id);
      toast({
        title: "Success",
        description: "Instrument deleted successfully.",
      });
      setDeleteModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete instrument.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setInstrumentToDelete(null);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setBulkDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    try {
      setDeleting(true);
      await deleteInstrumentsBulk(selectedIds);
      toast({
        title: "Success",
        description: `${selectedIds.length} instruments deleted successfully.`,
      });
      setSelected({});
      setBulkDeleteModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete instruments.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<Instrument>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "sino",
      header: "S.No",
      cell: ({ row }) => {
        const index = row.index;
        return row.original.sino || (filters.page - 1) * filters.limit + index + 1;
      }
    },
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "id_code",
      header: "ID Code",
    },
    {
      accessorKey: "location",
      header: "Location",
    },
    {
      accessorKey: "last_calibration_date",
      header: "Last Calibration",
      cell: ({ row }) => {
        const d = new Date(row.original.last_calibration_date);
        return isNaN(d.getTime()) ? "-" : format(d, 'dd-MM-yyyy');
      },
    },
    {
      accessorKey: "due_date",
      header: "Due Date",
      cell: ({ row }) => {
        const d = new Date(row.original.due_date);
        return isNaN(d.getTime()) ? "-" : format(d, 'dd-MM-yyyy');
      },
    },
    {
      accessorKey: "frequency",
      header: "Frequency",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant={
              status === "OK"
                ? "success"
                : status === "Overdue"
                  ? "destructive"
                  : status === "Sent for Calibration"
                    ? "premium"
                    : "warning"
            }
            className="capitalize"
          >
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "item_status",
      header: "Item Status",
      cell: ({ row }) => {
        const itemStatus = row.original.item_status || "Active";
        const isActive = itemStatus === "Active";
        return (
          <Badge 
            variant="outline" 
            className={`border-0 ${
              isActive 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
            }`}
          >
            {itemStatus}
          </Badge>
        );
      },
    },
    { accessorKey: "range", header: "Range" },
    { accessorKey: "serial_no", header: "Serial No" },
    { accessorKey: "least_count", header: "Least Count" },
    { accessorKey: "make", header: "Make" },
    { accessorKey: "item_type", header: "Item Type" },
    { accessorKey: "part_no", header: "Part No" },
    { accessorKey: "part_name", header: "Part Name" },
    { accessorKey: "calibration_source", header: "Calibration Source" },
    { accessorKey: "customer", header: "Customer" },
    { accessorKey: "sector", header: "Sector" },
    { accessorKey: "criticality_level", header: "Criticality Level" },
    { accessorKey: "cert_no", header: "Cert. No." },
    { accessorKey: "remarks", header: "Remarks" },
    { accessorKey: "gauge_issue_date", header: "Gauge Issue Date" },
    { accessorKey: "gauges_received_by", header: "Gauges Received By" },
    { accessorKey: "gauges_issued_by", header: "Gauges Issued By" },
    { accessorKey: "calibration_procedure", header: "Calibration Procedure" },
    { accessorKey: "traceable", header: "Traceable" },
    {
      id: "certificate",
      header: "Certificate",
      cell: ({ row }) => {
        const certFile = row.original.certificate_file;
        const instId = row.original.id;

        if (uploadingId === instId) {
          return (
            <div className="flex items-center gap-2 animate-pulse">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-7 w-16" />
            </div>
          );
        }
        
        if (!certFile) {
          return (
            <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
              <input 
                type="file" 
                accept=".xlsx,.xls"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleDirectUpload(instId, e.target.files[0]);
                  }
                }}
              />
              <Button variant="outline" size="sm" className="h-7 text-xs flex gap-1">
                <Upload className="h-3 w-3" />
                Upload
              </Button>
            </div>
          );
        }
        
        const url = certFile.startsWith("http") ? certFile : `${BASE_URL}${certFile}`;
        
        return (
          <div className="flex items-center gap-2">
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1 text-xs font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              <FileSpreadsheet className="h-3 w-3" />
              View
            </a>
            {(driveConnected && certFile.match(/\.(xlsx|xls)$/i)) && (
              <Button
                variant="ghost"
                size="sm"
                disabled={convertingId === instId}
                className="h-6 px-2 text-xs flex gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                onClick={(e) => {
                  e.stopPropagation();
                  handleConvertToGoogleSheet(instId);
                }}
              >
                {convertingId === instId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Edit className="h-3 w-3" />}
                Sheets
              </Button>
            )}
            <div className="relative inline-block ml-1" onClick={(e) => e.stopPropagation()}>
              <input 
                type="file" 
                accept=".xlsx,.xls,.pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="Replace Certificate"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleDirectUpload(instId, e.target.files[0]);
                  }
                }}
              />
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs flex gap-1 text-muted-foreground hover:text-foreground">
                <Upload className="h-3 w-3" />
                Replace
              </Button>
            </div>
          </div>
        );
      }
    },
    {
      id: "update_date",
      header: "Action",
      cell: ({ row }) => {
        const isUploading = uploadingId === row.original.id;
        return (
        <div className="flex items-center gap-2">
          <TooltipProv content="Calibrate Instrument">
            <Button 
              variant="outline" 
              size="icon"
              disabled={isUploading}
              className="h-8 w-8 hover:text-primary hover:bg-primary/10 border-primary/20"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/calibration/new/${row.original.id}`);
              }}
            >
              <Activity className="h-4 w-4 text-primary" />
            </Button>
          </TooltipProv>
          <TooltipProv content="Log External Calibration (Upload Certificate)">
            <Button 
              variant="outline" 
              size="icon"
              disabled={isUploading}
              className="h-8 w-8 hover:text-emerald-600 hover:bg-emerald-50 border-emerald-200"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDateModal(row.original);
              }}
            >
              <Upload className="h-4 w-4 text-emerald-600" />
            </Button>
          </TooltipProv>
          <TooltipProv content="View Calibration History">
            <Button 
              variant="outline" 
              size="icon"
              disabled={isUploading}
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenHistory(row.original);
              }}
            >
              <History className="h-4 w-4 text-muted-foreground" />
            </Button>
          </TooltipProv>
          <TooltipProv content="Print Label">
            <Button 
              variant="outline" 
              size="icon"
              disabled={isUploading}
              className="h-8 w-8 hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                setInstrumentsToPrint([row.original]);
                setPrintModalOpen(true);
              }}
            >
              <Printer className="h-4 w-4" />
            </Button>
          </TooltipProv>
          <TooltipProv content="Delete Instrument">
            <Button 
              variant="outline" 
              size="icon"
              disabled={isUploading}
              className="h-8 w-8 hover:bg-destructive/10 group"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDeleteModal(row.original);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive group-hover:text-destructive" />
            </Button>
          </TooltipProv>
        </div>
      )},
    }
  ];

  return (
    <>
      <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
        <header className="relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/80 text-primary-foreground p-8 rounded-2xl shadow-2xl">
          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-4xl font-extrabold tracking-tight">Instruments</h1>
              <p className="text-primary-foreground/80 text-lg">
                Manage and track your calibration inventory with precision.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                size="lg" 
                variant="secondary"
                className="shadow-lg hover:scale-105 transition-transform font-bold px-8" 
                onClick={() => navigate("/instruments/new")}
              >
                <PlusCircle className="h-5 w-5 mr-2" /> Add Instrument
              </Button>
            </div>
          </div>
          
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 bg-black/10 rounded-full blur-3xl" />
        </header>

        <div className="bg-card/50 backdrop-blur-sm p-6 rounded-2xl border shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4 border-primary/10">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-primary rounded-full" />
              <h2 className="text-xl font-bold">Filter Inventory</h2>
            </div>
            
            <div className="bg-muted p-1 rounded-lg inline-flex items-center">
              <button 
                onClick={() => setFilters(f => ({ ...f, is_reference_standard: "false", page: 1 }))}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${(!filters.is_reference_standard || filters.is_reference_standard === "false") ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Instruments
              </button>
              <button 
                onClick={() => setFilters(f => ({ ...f, is_reference_standard: "true", page: 1 }))}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${filters.is_reference_standard === "true" ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Reference Standards
              </button>
              <button 
                onClick={() => setFilters(f => ({ ...f, is_reference_standard: "All", page: 1 }))}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${filters.is_reference_standard === "All" ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All
              </button>
            </div>
          </div>
          
          <div className="grid gap-6 md:grid-cols-12">
            <div className="md:col-span-3 relative">
              <Label className="text-sm font-bold text-foreground/70 mb-2 flex items-center gap-2">
                <Search className="h-4 w-4" /> Search
              </Label>
              <Popover open={showSuggestions && suggestions.length > 0} onOpenChange={setShowSuggestions}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Input 
                      placeholder="Name, ID Code, or Model..." 
                      value={localSearch}
                      onChange={(e) => {
                        setLocalSearch(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => {
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      className="h-11 bg-background/50 border-muted-foreground/20 focus:ring-primary/20 transition-all pl-10 pr-10"
                    />
                    <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/50" />
                    {localSearch && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLocalSearch("");
                          setFilters(f => ({ ...f, search: "", page: 1 }));
                          setShowSuggestions(false);
                        }}
                        className="absolute right-3 top-3 h-5 w-5 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors focus:outline-none"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] p-0 border-muted-foreground/20 shadow-lg bg-popover text-popover-foreground z-[100]" 
                  align="start" 
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="max-h-60 overflow-auto">
                    {suggestions.map((code, idx) => (
                      <div 
                        key={idx} 
                        className="px-4 py-2 hover:bg-muted cursor-pointer text-sm transition-colors"
                        onClick={() => {
                          setLocalSearch(code);
                          setShowSuggestions(false);
                        }}
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="md:col-span-2">
              <Label className="text-sm font-bold text-foreground/70 mb-2 flex items-center gap-2">
                <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">S</Badge> Status
              </Label>
              <Select
                value={filters.status as any}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v as any, page: 1 }))}
              >
                <SelectTrigger className="h-11 bg-background/50 border-muted-foreground/20">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  {StatusFillter.filter(s => s && s.trim() !== "").map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label className="text-sm font-bold text-foreground/70 mb-2 flex items-center gap-2">
                <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">I</Badge> Item Status
              </Label>
              <Select
                value={filters.item_status as any}
                onValueChange={(v) => setFilters((f) => ({ ...f, item_status: v as any, page: 1 }))}
              >
                <SelectTrigger className="h-11 bg-background/50 border-muted-foreground/20">
                  <SelectValue placeholder="All Item Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Item Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label className="text-sm font-bold text-foreground/70 mb-2 flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Frequency
              </Label>
              <Select value={filters.frequency as any} onValueChange={(v) => setFilters((f) => ({ ...f, frequency: v as any, page: 1 }))}>
                <SelectTrigger className="h-11 bg-background/50 border-muted-foreground/20">
                  <SelectValue placeholder="All Frequencies" />
                </SelectTrigger>
                <SelectContent>
                  {FrequencyFillter.filter(f => f && f.trim() !== "").map((freq) => (
                    <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label className="text-sm font-bold text-foreground/70 mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4" /> Location
              </Label>
              <Select value={filters.location as any} onValueChange={(v) => setFilters((f) => ({ ...f, location: v as any, page: 1 }))}>
                <SelectTrigger className="h-11 bg-background/50 border-muted-foreground/20">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  {LocationFillter.filter(l => l && l.trim() !== "").map((loc) => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1 flex items-end">
              <Button 
                variant="glass" 
                className="w-full h-11 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all flex gap-2 font-bold"
                onClick={() => {
                  setLocalSearch("");
                  setFilters({ status: "All", item_status: "Active", location: "All", frequency: "All", search: "", due_date: "", is_reference_standard: "All", page: 1, pageSize: filters.pageSize, limit: 10 });
                  navigate("/instruments", { replace: true });
                }}
              >
                Reset
              </Button>
            </div>
            
            {filters.due_date && (
              <div className="md:col-span-12 flex items-center">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 px-3 py-1.5 flex gap-2 items-center">
                  <CalendarDays className="h-4 w-4" />
                  Showing instruments due on: {new Date(filters.due_date).toLocaleDateString()}
                  <button onClick={() => {
                    setFilters(f => ({ ...f, due_date: "", page: 1 }));
                    navigate("/instruments", { replace: true });
                  }} className="ml-2 hover:text-amber-800 focus:outline-none font-bold">×</button>
                </Badge>
              </div>
            )}

            {(filters.due_date_start || filters.due_date_end) && (
              <div className="md:col-span-12 flex items-center mt-2">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 px-3 py-1.5 flex gap-2 items-center">
                  <CalendarDays className="h-4 w-4" />
                  Showing instruments due from: {filters.due_date_start ? new Date(filters.due_date_start).toLocaleDateString() : 'Any'} to {filters.due_date_end ? new Date(filters.due_date_end).toLocaleDateString() : 'Any'}
                  <button onClick={() => {
                    setFilters(f => ({ ...f, due_date_start: "", due_date_end: "", page: 1 }));
                    navigate("/instruments", { replace: true });
                  }} className="ml-2 hover:text-amber-800 focus:outline-none font-bold">×</button>
                </Badge>
              </div>
            )}

            {(filters.last_cal_start || filters.last_cal_end) && (
              <div className="md:col-span-12 flex items-center mt-2">
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 px-3 py-1.5 flex gap-2 items-center">
                  <CalendarDays className="h-4 w-4" />
                  Showing calibrated from: {filters.last_cal_start ? new Date(filters.last_cal_start).toLocaleDateString() : 'Any'} to {filters.last_cal_end ? new Date(filters.last_cal_end).toLocaleDateString() : 'Any'}
                  <button onClick={() => {
                    setFilters(f => ({ ...f, last_cal_start: "", last_cal_end: "", page: 1 }));
                    navigate("/instruments", { replace: true });
                  }} className="ml-2 hover:text-blue-800 focus:outline-none font-bold">×</button>
                </Badge>
              </div>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data.items}
          loading={loading}
          pageCount={totalPages}
          pageIndex={filters.page || 1}
          pageSize={filters.pageSize}
          totalItems={data.total}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
          onPageSizeChange={(pageSize) => setFilters((f) => ({ ...f, pageSize, page: 1 }))}
          onRowClick={(row) => navigate(`/instruments/${row.id}/edit`)}
          rowSelection={selected}
          onRowSelectionChange={setSelected}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          hideSearch={true}
          headerActions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 flex gap-2"
                onClick={handleRefresh}
                disabled={refreshing || loading}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 flex gap-2"
                onClick={() => setisOpenupload(true)}
              >
                <Upload className="h-4 w-4" />
                <span>Bulk Upload</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 flex gap-2"
                disabled={!data.items.length}
                onClick={() => {
                  const allPossibleHeaders = [
                    "sino", "name", "id_code", "location", "last_calibration_date", "due_date", "frequency", 
                    "agency", "status", "item_status", "range", "serial_no", "least_count", "make", 
                    "item_type", "part_no", "part_name", "calibration_source", "customer", 
                    "sector", "criticality_level", "cert_no", "remarks", "gauge_issue_date", 
                    "gauges_received_by", "gauges_issued_by", "calibration_procedure", "traceable", "certificate_file"
                  ];
                  
                  // Only export columns that are currently visible in the table
                  const allHeaders = allPossibleHeaders.filter(h => columnVisibility[h as keyof VisibilityState] !== false);

                  const itemsToExport = selectedIds.length > 0 
                    ? data.items.filter((item: Instrument) => selectedIds.includes(item.id)) 
                    : data.items;

                  const headerMap: Record<string, string> = {
                    sino: "S.No", name: "Name", id_code: "ID Code", location: "Location", 
                    last_calibration_date: "Last Calibration Date", due_date: "Due Date", 
                    frequency: "Frequency", agency: "Agency", status: "Status", item_status: "Item Status", 
                    range: "Range", serial_no: "Serial No", least_count: "Least Count", make: "Make", 
                    item_type: "Item Type", part_no: "Part No", part_name: "Part Name", 
                    calibration_source: "Calibration Source", customer: "Customer", sector: "Sector", 
                    criticality_level: "Criticality Level", cert_no: "Cert. No.", remarks: "Remarks", 
                    gauge_issue_date: "Gauge Issue Date", gauges_received_by: "Gauges Received By", 
                    gauges_issued_by: "Gauges Issued By", calibration_procedure: "Calibration Procedure", 
                    traceable: "Traceable", certificate_file: "Certificate File"
                  };

                  const csv = [
                    allHeaders.map(h => `"${headerMap[h] || h}"`).join(","), 
                    ...itemsToExport.map((r: any) => allHeaders.map((h) => {
                      let val = r[h] !== undefined && r[h] !== null ? String(r[h]) : "";
                      if ((h === 'last_calibration_date' || h === 'due_date' || h === 'gauge_issue_date') && val) {
                        try {
                           const d = new Date(val);
                           if (!isNaN(d.getTime())) {
                             val = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                           }
                        } catch(e) {}
                      }
                      val = val.replace(/"/g, '""');
                      return `"${val}"`;
                    }).join(","))
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `instruments_page_${filters.page}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export CSV</span>
              </Button>
              {selectedIds.length > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 animate-in fade-in slide-in-from-left-2 flex gap-2 text-primary hover:bg-primary/5 hover:text-primary border-primary/20"
                    onClick={() => setisOpenCalibagency(true)}
                  >
                    <Mail className="h-4 w-4" />
                    <span>Send {selectedIds.length} Selected</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 animate-in fade-in flex gap-2 border-muted-foreground/30 hover:bg-muted/50"
                    onClick={() => {
                      const selectedItems = data.items.filter((item: Instrument) => selectedIds.includes(item.id));
                      setInstrumentsToPrint(selectedItems);
                      setPrintModalOpen(true);
                    }}
                  >
                    <Printer className="h-4 w-4 text-muted-foreground" />
                    <span>Print {selectedIds.length} Labels</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 animate-in fade-in slide-in-from-left-2 flex gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 hover:border-destructive/50"
                    onClick={handleBulkDelete}
                    disabled={deleting}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete {selectedIds.length} Selected</span>
                  </Button>
                </>
              )}
            </div>
          }
        />
      </div>

      <Dialog open={isOpenupload} onOpenChange={setisOpenupload}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-primary" />
              Bulk Upload Instruments
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file to add multiple instruments at once.
            </DialogDescription>
          </DialogHeader>
          <ExcelUpload
            endpoint="/instruments/bulk-upload"
            mapRow={(row) => ({
              sino: row["P.Sl.No"] || row["S.No"],
              name: row["Description"] || row["NAME OF INSTRUMENT"],
              id_code: row["IMTE"] || row["ID CODE"],
              range: row["RANGE"],
              serial_no: row["Items Sl.No / Model"] || row["SERIAL NO"],
              least_count: row["Least Count"] || row["LEAST COUNT"],
              location: row["Item Location"] || row["LOCATION"],
              frequency: row["CALIB. FREQUENCY in month"] || row["CALIBRATION FREQUENCY"],
              last_calibration_date: row["LAST CALIBRATION DATE"],
              due_date: row["DUE DATE"],
              agency: row["Service Provider"] || row["CALIBRATION AGENCY AND TC No"],
              status: row["Calibration Status"] || row["STATUS"] || row["Status"],
              item_status: row["Item Status"] || row["ITEM STATUS"] || "Active",
              make: row["Item Make"],
              item_type: row["Item Type"],
              part_no: row["PART NO"],
              part_name: row["Part Name"],
              module: row["Module"] || row["Moudle"],
              calibration_source: row["Calibration Source"],
              customer: row["Customer"],
              sector: row["Sector"],
              criticality_level: row["Criticality Level"],
              cert_no: row["Cert. No."],
              remarks: row["Remarks"],
              gauge_issue_date: row["Gauge Issue Date"],
              gauges_received_by: row["Gauges Received By"],
              gauges_issued_by: row["Gauges Issued By"] || row["Gaues Issued By"],
              calibration_procedure: row["Calibration Procedure& Ref Std"],
              traceable: row["Traceable"],
              is_reference_standard: (row["Is Reference Standard"] || row["Is Reference Standar"])?.toString().toLowerCase() === 'yes' || (row["Is Reference Standard"] || row["Is Reference Standar"])?.toString().toLowerCase() === 'true',
              custom_parameters: {},
            })}

            rejectedFile={rejectedFile}
            setRejectedFile={setRejectedFile}
            onRefresh={fetchData}
            onComplete={() => {
              fetchData();
              setisOpenupload(false);
            }}
          />
        </DialogContent>
      </Dialog>



      <Dialog open={isOpenCalibagency} onOpenChange={setisOpenCalibagency}>
        <DialogContent className="max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">

          <DialogHeader>
            <DialogTitle>Send Instruments to Calibration Agency</DialogTitle>
            <DialogDescription>
              Enter agency email, review selected instruments and add description.
            </DialogDescription>
          </DialogHeader>

          {/* Agency Email Input */}
          <div className="space-y-2">
            <Label>Calibration Agency Email</Label>
            <Input
              type="email"
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
              placeholder="Enter agency email"
            />
          </div>

          {/* Columns Selection */}
          <div className="space-y-2">
            <Label>Select Columns to Include in Email</Label>
            <div className="flex flex-wrap gap-4 border p-3 rounded-md max-h-32 overflow-y-auto">
              {EMAIL_COLUMNS.map(col => (
                <div key={col.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`col-${col.id}`} 
                    checked={selectedEmailColumns.includes(col.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedEmailColumns(prev => [...prev, col.id]);
                      } else {
                        setSelectedEmailColumns(prev => prev.filter(c => c !== col.id));
                      }
                    }}
                  />
                  <label htmlFor={`col-${col.id}`} className="text-sm cursor-pointer">
                    {col.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Instruments List */}
          <div className="space-y-2">
            <Label>Selected Instruments ({Object.keys(selected).filter(id => selected[id]).length})</Label>

            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">

              {Object.keys(selected)
                .filter((id) => selected[id])
                .map((id) => {
                  const item = data.items.find((i) => i.id === id);
                  if (!item) return null;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-muted p-2 rounded-md"
                    >
                      <div className="text-sm">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.id_code}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSelected((prev) => {
                            const copy = { ...prev };
                            delete copy[item.id];
                            return copy;
                          })
                        }
                      >
                        ✕
                      </Button>
                    </div>
                  );
                })}

              {Object.keys(selected).filter((id) => selected[id]).length === 0 && (
                <p className="text-sm text-muted-foreground">No instruments selected</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description for the agency…"
            />
          </div>

          <DialogFooter>
            <Button
              disabled={isSendCalibration}
              onClick={handleSendMail}
            >
              {isSendCalibration ? 'Mail Sending...' : 'Send Mail'}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>


      <Dialog open={dateModalOpen} onOpenChange={setDateModalOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle>Log External Calibration</DialogTitle>
            <DialogDescription>
              Upload certificate and update dates for {dateUpdateInstrument?.name} ({dateUpdateInstrument?.id_code}).
              {dateUpdateInstrument?.due_date && (
                <span className="block mt-1 text-xs text-muted-foreground font-medium">
                  Previous Due Date: {format(new Date(dateUpdateInstrument.due_date), 'dd-MM-yyyy')}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Last Calibration Date</Label>
              <Input
                type="date"
                value={newLastCalDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewLastCalDate(val);
                  // Auto calculate due date if frequency exists
                  if (val && dateUpdateInstrument) {
                    const freqMonths = parseFrequencyMonths(dateUpdateInstrument.frequency);
                    if (freqMonths > 0) {
                      const [y, m, d] = val.split('-').map(Number);
                      const due = new Date(y, m - 1, d);
                      due.setMonth(due.getMonth() + freqMonths);
                      setNewDueDate(format(due, 'yyyy-MM-dd'));
                    }
                  }
                }}
              />
            </div>
            
            {newDueDate && (
              <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
                <Label className="text-xs text-muted-foreground">Next Due Date (Auto-calculated)</Label>
                <div className="font-medium flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-600" />
                  {format(new Date(newDueDate), 'dd-MM-yyyy')}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Based on instrument frequency: {dateUpdateInstrument?.frequency || "Not set"}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Attach Certificate (PDF/Image)</Label>
              <div className="relative">
                <input
                  type="file"
                  id="certificate-upload"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setCertificateFile(e.target.files[0]);
                    }
                  }}
                />
                <label
                  htmlFor="certificate-upload"
                  className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium transition-colors border-2 border-dashed rounded-lg cursor-pointer border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 text-muted-foreground"
                >
                  <Upload className="w-5 h-5 mr-2 text-primary/70" />
                  {certificateFile ? (
                    <span className="text-foreground truncate max-w-[200px]">{certificateFile.name}</span>
                  ) : (
                    <span>Click to browse or drag and drop</span>
                  )}
                </label>
              </div>
              {dateUpdateInstrument?.certificate_file && (
                <div className="flex items-center mt-2 text-sm">
                  <span className="text-muted-foreground mr-2">Current file:</span>
                  <a 
                    href={dateUpdateInstrument.certificate_file.startsWith("http") ? dateUpdateInstrument.certificate_file : `${BASE_URL}${dateUpdateInstrument.certificate_file}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-primary hover:underline font-medium"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-1" />
                    View Certificate
                  </a>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDateModalOpen(false)}>Cancel</Button>
            <Button disabled={updatingDates || !newLastCalDate || !certificateFile} onClick={handleUpdateDates}>
              {updatingDates ? "Saving..." : "Save External Calibration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Calibration History
            </DialogTitle>
            <DialogDescription>
              Audit trail for {dateUpdateInstrument?.name} ({dateUpdateInstrument?.id_code})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loadingHistory ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No history records found for this instrument.
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Updated On</TableHead>
                      <TableHead>Last Calibration</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Certificate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.created_at ? new Date(record.created_at.replace('Z', '')).toLocaleString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {record.last_calibration_date ? new Date(record.last_calibration_date).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {record.due_date ? new Date(record.due_date).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {record.certificate_file ? (
                            <a 
                              href={record.certificate_file.startsWith("http") ? record.certificate_file : `${BASE_URL}${record.certificate_file}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center text-sm"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                              View
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setHistoryModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Instrument
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the instrument <strong>{instrumentToDelete?.name}</strong> ({instrumentToDelete?.id_code})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteModalOpen} onOpenChange={setBulkDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Instruments
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedIds.length}</strong> selected instruments? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <PrintLabelModal 
        open={printModalOpen}
        onOpenChange={setPrintModalOpen}
        instruments={instrumentsToPrint}
      />
    </>

  );
}
