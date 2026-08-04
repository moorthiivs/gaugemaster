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
import { PlusCircle, Upload, FileSpreadsheet, Search, CalendarDays, Activity, Mail, RefreshCw, History, Trash2, Edit, Printer, X, ArrowUp, ArrowDown, Settings2, FileCheck, Check, GripVertical, RotateCcw } from "lucide-react";
import { PrintLabelModal } from "@/components/PrintLabelModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";

import TooltipProv from "@/components/TooltipProv";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { InstrumentDateFilter } from "@/components/InstrumentDateFilter";

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_INSTRUMENT_COLUMNS: ColumnConfig[] = [
  { id: "sino", label: "S.No", visible: true },
  { id: "name", label: "Name", visible: true },
  { id: "id_code", label: "ID Code", visible: true },
  { id: "location", label: "Location", visible: true },
  { id: "last_calibration_date", label: "Last Calibration Date", visible: true },
  { id: "due_date", label: "Due Date", visible: true },
  { id: "frequency", label: "Frequency", visible: true },
  { id: "status", label: "Status", visible: true },
  { id: "item_status", label: "Item Status", visible: true },
  { id: "range", label: "Range", visible: false },
  { id: "serial_no", label: "Serial No", visible: false },
  { id: "least_count", label: "Least Count", visible: false },
  { id: "make", label: "Make", visible: false },
  { id: "item_type", label: "Item Type", visible: false },
  { id: "part_no", label: "Part No", visible: false },
  { id: "part_name", label: "Part Name", visible: false },
  { id: "calibration_source", label: "Calibration Source", visible: false },
  { id: "customer", label: "Customer", visible: false },
  { id: "sector", label: "Sector", visible: false },
  { id: "criticality_level", label: "Criticality Level", visible: false },
  { id: "cert_no", label: "Cert. No.", visible: false },
  { id: "remarks", label: "Remarks", visible: false },
  { id: "gauge_issue_date", label: "Gauge Issue Date", visible: false },
  { id: "gauges_received_by", label: "Gauges Received By", visible: false },
  { id: "gauges_issued_by", label: "Gauges Issued By", visible: false },
  { id: "calibration_procedure", label: "Calibration Procedure", visible: false },
  { id: "traceable", label: "Traceable", visible: false },
  { id: "certificate", label: "Certificate", visible: true },
];

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
  const initialCalibratedInRangeStart = searchParams.get("calibrated_in_range_start") || "";
  const initialCalibratedInRangeEnd = searchParams.get("calibrated_in_range_end") || "";
  const initialCalibrationSource = searchParams.get("calibration_source") || "All";
  const initialItemStatus = searchParams.get("item_status") || "Active";
  const initialLocation = searchParams.get("location") || "All";
  const initialModule = searchParams.get("module") || "All";
  const initialExcludeModules = searchParams.get("exclude_modules") || "";
  
  const initialIsReferenceStandard = searchParams.get("is_reference_standard") || "All";

  const [filters, setFilters] = useState<InstrumentQuery>({ 
    status: initialStatus as any, item_status: initialItemStatus as any, location: initialLocation, frequency: "All", calibration_source: initialCalibrationSource, module: initialModule, exclude_modules: initialExcludeModules, search: initialSearch, 
    due_date: initialDueDate, due_date_start: initialDueDateStart, due_date_end: initialDueDateEnd,
    last_cal_start: initialLastCalStart, last_cal_end: initialLastCalEnd,
    calibrated_in_range_start: initialCalibratedInRangeStart, calibrated_in_range_end: initialCalibratedInRangeEnd,
    is_reference_standard: initialIsReferenceStandard,
    page: 1, pageSize, limit: 10 
  });
  const [data, setData] = useState<{ items: Instrument[]; total: number }>({ items: [], total: 0 });
  const [allData, setAllData] = useState<Instrument[]>([]); // store original data
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectedObjects, setSelectedObjects] = useState<Record<string, Instrument>>({});
  const [selectedReviewModalOpen, setSelectedReviewModalOpen] = useState(false);
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

  const [StatusFillter, setStatusFilter] = useState<string[]>([]);
  const [ItemStatusFilter, setItemStatusFilter] = useState<string[]>([]);
  const [FrequencyFillter, setFrequencyFilter] = useState<string[]>([]);
  const [LocationFillter, setLocationFilter] = useState<string[]>([]);
  const [CalibrationSourceFilter, setCalibrationSourceFilter] = useState<string[]>([]);

  const [isOpenupload, setisOpenupload] = useState(false);
  const [rejectedFile, setRejectedFile] = useState<Blob | null>(null);

  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [instrumentsToPrint, setInstrumentsToPrint] = useState<Instrument[]>([]);

  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem("gaugemaster_instrument_columns_config");
      if (saved) {
        const parsed: ColumnConfig[] = JSON.parse(saved);
        const existingIds = new Set(parsed.map((c) => c.id));
        const missing = DEFAULT_INSTRUMENT_COLUMNS.filter((c) => !existingIds.has(c.id));
        return [...parsed, ...missing];
      }
    } catch (e) {
      console.error("Failed to load saved column config", e);
    }
    return DEFAULT_INSTRUMENT_COLUMNS;
  });

  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [tempColumnConfigs, setTempColumnConfigs] = useState<ColumnConfig[]>([]);
  const [columnSearchQuery, setColumnSearchQuery] = useState("");

  const handleOpenColumnModal = () => {
    setTempColumnConfigs([...columnConfigs]);
    setColumnSearchQuery("");
    setColumnModalOpen(true);
  };

  const handleSaveColumnConfigs = () => {
    setColumnConfigs(tempColumnConfigs);
    try {
      localStorage.setItem(
        "gaugemaster_instrument_columns_config",
        JSON.stringify(tempColumnConfigs)
      );
    } catch (e) {
      console.error("Failed to save column config", e);
    }
    setColumnModalOpen(false);
    toast({
      title: "Column Preferences Saved",
      description: "Your column selection and order have been updated.",
      variant: "success",
    });
  };

  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);

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
      if (filters.calibration_source && filters.calibration_source !== "All") queryParams.append("calibration_source", filters.calibration_source);
      if (filters.module && filters.module !== "All") queryParams.append("module", filters.module);
      if (filters.exclude_modules) queryParams.append("exclude_modules", filters.exclude_modules);
      if (filters.search) queryParams.append("search", filters.search);
      if (filters.due_date) queryParams.append("due_date", filters.due_date);
      if (filters.due_date_start) queryParams.append("due_date_start", filters.due_date_start);
      if (filters.due_date_end) queryParams.append("due_date_end", filters.due_date_end);
      if (filters.last_cal_start) queryParams.append("last_cal_start", filters.last_cal_start);
      if (filters.last_cal_end) queryParams.append("last_cal_end", filters.last_cal_end);
      if (filters.calibrated_in_range_start) queryParams.append("calibrated_in_range_start", filters.calibrated_in_range_start);
      if (filters.calibrated_in_range_end) queryParams.append("calibrated_in_range_end", filters.calibrated_in_range_end);
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
      // Cache loaded items if they are currently selected
      setSelectedObjects((prev) => {
        const next = { ...prev };
        result.data.forEach((item: Instrument) => {
          if (selected[item.id]) {
            next[item.id] = item;
          }
        });
        return next;
      });
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
      setItemStatusFilter(["All", ...(filterData.item_status || [])]);
      setFrequencyFilter(["All", ...filterData.frequency]);
      setLocationFilter(["All", ...filterData.location]);
      setCalibrationSourceFilter(["All", ...(filterData.calibration_source || [])]);
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
    setFilters(f => ({
      ...f,
      search: searchParams.get("search") || "",
      due_date: searchParams.get("due_date") || "",
      status: (searchParams.get("status") || "All") as any,
      due_date_start: searchParams.get("due_date_start") || "",
      due_date_end: searchParams.get("due_date_end") || "",
      last_cal_start: searchParams.get("last_cal_start") || "",
      last_cal_end: searchParams.get("last_cal_end") || "",
      calibrated_in_range_start: searchParams.get("calibrated_in_range_start") || "",
      calibrated_in_range_end: searchParams.get("calibrated_in_range_end") || "",
      item_status: (searchParams.get("item_status") || "Active") as any,
      location: searchParams.get("location") || "All",
      calibration_source: searchParams.get("calibration_source") || "All",
      module: searchParams.get("module") || "All",
      exclude_modules: searchParams.get("exclude_modules") || "",
      is_reference_standard: searchParams.get("is_reference_standard") || "All",
      page: 1
    }));
  }, [searchParams]);

  const handleApplyDateFilter = (updatedFilters: Partial<InstrumentQuery>) => {
    setFilters((prev) => {
      const next = { ...prev, ...updatedFilters, page: 1 };
      const queryParams = new URLSearchParams();
      if (next.search) queryParams.append("search", next.search);
      if (next.status && next.status !== "All") queryParams.append("status", next.status);
      if (next.item_status && next.item_status !== "All") queryParams.append("item_status", next.item_status);
      if (next.location && next.location !== "All") queryParams.append("location", next.location);
      if (next.frequency && next.frequency !== "All") queryParams.append("frequency", next.frequency);
      if (next.calibration_source && next.calibration_source !== "All") queryParams.append("calibration_source", next.calibration_source);
      if (next.module && next.module !== "All") queryParams.append("module", next.module);
      if (next.due_date) queryParams.append("due_date", next.due_date);
      if (next.due_date_start) queryParams.append("due_date_start", next.due_date_start);
      if (next.due_date_end) queryParams.append("due_date_end", next.due_date_end);
      if (next.last_cal_start) queryParams.append("last_cal_start", next.last_cal_start);
      if (next.last_cal_end) queryParams.append("last_cal_end", next.last_cal_end);
      if (next.is_reference_standard && next.is_reference_standard !== "All") queryParams.append("is_reference_standard", next.is_reference_standard);

      navigate(`/instruments?${queryParams.toString()}`, { replace: true });
      return next;
    });
  };

  const handleClearDateFilter = () => {
    handleApplyDateFilter({
      due_date: "",
      due_date_start: "",
      due_date_end: "",
      last_cal_start: "",
      last_cal_end: "",
    });
  };

  useEffect(() => {
    fetchData();
  }, [filters.page, filters.status, filters.item_status, filters.location, filters.frequency, filters.calibration_source, filters.module, filters.exclude_modules, filters.pageSize, filters.search, filters.due_date, filters.due_date_start, filters.due_date_end, filters.is_reference_standard, filters.last_cal_start, filters.last_cal_end, filters.calibrated_in_range_start, filters.calibrated_in_range_end]);

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
      setItemStatusFilter(["All", ...(data.item_status || [])]);
      setFrequencyFilter(["All", ...data.frequency]);
      setLocationFilter(["All", ...data.location]);
      setCalibrationSourceFilter(["All", ...(data.calibration_source || [])]);
    });
  }, [user]);

  const handleRowSelectionChange = (
    updaterOrValue: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => {
    setSelected((prevSelected) => {
      const nextSelected = typeof updaterOrValue === "function" ? updaterOrValue(prevSelected) : updaterOrValue;
      
      setSelectedObjects((prevObjects) => {
        const nextObjects = { ...prevObjects };
        // Sync items currently loaded in data.items
        data.items.forEach((item) => {
          if (nextSelected[item.id]) {
            nextObjects[item.id] = item;
          } else {
            delete nextObjects[item.id];
          }
        });
        
        // Clean up any items explicitly falsy in nextSelected
        Object.keys(nextSelected).forEach((id) => {
          if (!nextSelected[id]) {
            delete nextObjects[id];
          }
        });

        return nextObjects;
      });

      return nextSelected;
    });
  };

  const handleDeselectItem = (id: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelectedObjects((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleClearAllSelections = () => {
    setSelected({});
    setSelectedObjects({});
  };

  const toggleAll = (checked: boolean) => {
    const map: Record<string, boolean> = { ...selected };
    for (const i of data.items) {
      if (checked) {
        map[i.id] = true;
      } else {
        delete map[i.id];
      }
    }
    handleRowSelectionChange(map);
  };

  const selectedIds = useMemo(() => Object.keys(selectedObjects), [selectedObjects]);
  const selectedItemsList = useMemo(() => Object.values(selectedObjects), [selectedObjects]);

  const handleExportData = async (
    exportType: "all" | "selected", 
    specificItems?: Instrument[], 
    selectedFieldIds?: string[]
  ) => {
    try {
      let itemsToExport: Instrument[] = [];
      if (specificItems) {
        itemsToExport = specificItems;
      } else if (exportType === "selected") {
        itemsToExport = selectedItemsList;
      } else {
        const res = await listInstruments({
          ...filters,
          page: 1,
          pageSize: 99999,
          limit: 99999,
          createdBy: user?.id,
        });
        itemsToExport = res.data || res.items || [];
      }

      if (!itemsToExport || itemsToExport.length === 0) {
        toast({ title: "No data to export", variant: "destructive" });
        return;
      }

      let exportCols: { id: string; label: string }[] = [];

      if (selectedFieldIds && selectedFieldIds.length > 0) {
        const labelMap: Record<string, string> = {
          sino: "S.No",
          id_code: "ID Code",
          name: "Name",
          location: "Location",
          last_calibration_date: "Last Calibration Date",
          due_date: "Due Date",
          frequency: "Frequency",
          status: "Status",
          item_status: "Item Status",
          make: "Make",
          range: "Range",
          serial_no: "Serial No.",
          least_count: "Least Count",
          calibration_source: "Calibration Source",
          cert_no: "Cert. No.",
          item_type: "Item Type",
          part_no: "Part No",
          part_name: "Part Name",
          customer: "Customer",
          sector: "Sector",
          criticality_level: "Criticality Level",
          remarks: "Remarks",
        };

        exportCols = [
          { id: "sino", label: "S.No" },
          ...selectedFieldIds.map((id) => ({
            id,
            label: labelMap[id] || columnConfigs.find((c) => c.id === id)?.label || id,
          })),
        ];
      } else {
        // Fallback to active visible table columns in configured order
        exportCols = columnConfigs
          .filter((c) => c.visible && c.id !== "select" && c.id !== "certificate")
          .map((c) => ({ id: c.id, label: c.label }));
      }

      const exportRows = itemsToExport.map((item, idx) => {
        const rowObj: Record<string, any> = {};
        exportCols.forEach((col) => {
          let val: any = "";
          if (col.id === "sino") {
            val = idx + 1;
          } else if (col.id === "last_calibration_date") {
            val = item.last_calibration_date ? format(new Date(item.last_calibration_date), "dd-MM-yyyy") : "";
          } else if (col.id === "due_date") {
            val = item.due_date ? format(new Date(item.due_date), "dd-MM-yyyy") : "";
          } else if (col.id === "gauge_issue_date") {
            val = item.gauge_issue_date ? format(new Date(item.gauge_issue_date), "dd-MM-yyyy") : "";
          } else {
            val = (item as any)[col.id] ?? "";
          }
          rowObj[col.label] = val;
        });
        return rowObj;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Instruments");
      XLSX.writeFile(
        workbook,
        `Instruments_Export_${exportType}_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`
      );
      toast({ title: "Export Successful", description: `Exported ${itemsToExport.length} instrument(s) to Excel.` });
    } catch (err: any) {
      console.error("Export error:", err);
      toast({ title: "Export Failed", description: err?.message || "Failed to export data", variant: "destructive" });
    }
  };

  const handleSendMail = async () => {
    setisSendCalibration(true);
    try {
      const payload = {
        to: selectedAgency,
        description,
        instruments: selectedItemsList,
        userId: user.id,
        columns: selectedEmailColumns,
      };

      await httpClient.post(`/instruments/send-calibration-agency`, payload);
      setisOpenCalibagency(false);

      toast({
        title: "Mail Sent Successfully",
        description: "Calibration request has been sent to the selected agency.",
        variant: "success",
      });
      setisSendCalibration(false);
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
      setisSendCalibration(false);
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
    
    let baseDate = new Date();
    if (inst.due_date) {
      const parsedDue = new Date(inst.due_date);
      if (!isNaN(parsedDue.getTime())) {
        baseDate = parsedDue;
      }
    }
    
    setNewLastCalDate(format(baseDate, 'yyyy-MM-dd'));
    setCertificateFile(null);

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
        description: "Selected instruments deleted successfully.",
      });
      setSelected({});
      setSelectedObjects({});
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

  const COLUMN_DEF_MAP: Record<string, Partial<ColumnDef<Instrument>>> = {
    sino: {
      header: "S.No",
      cell: ({ row }) => {
        const index = row.index;
        return row.original.sino || (filters.page - 1) * (filters.pageSize || 10) + index + 1;
      },
    },
    name: { accessorKey: "name", header: "Name" },
    id_code: { accessorKey: "id_code", header: "ID Code" },
    location: { accessorKey: "location", header: "Location" },
    last_calibration_date: {
      accessorKey: "last_calibration_date",
      header: "Last Calibration",
      cell: ({ row }) => {
        if (!row.original.last_calibration_date) return "-";
        const d = new Date(row.original.last_calibration_date);
        return isNaN(d.getTime()) ? "-" : format(d, 'dd-MM-yyyy');
      },
    },
    due_date: {
      accessorKey: "due_date",
      header: "Due Date",
      cell: ({ row }) => {
        if (!row.original.due_date) return "-";
        const d = new Date(row.original.due_date);
        return isNaN(d.getTime()) ? "-" : format(d, 'dd-MM-yyyy');
      },
    },
    frequency: { accessorKey: "frequency", header: "Frequency" },
    status: {
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
    item_status: {
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
    range: { accessorKey: "range", header: "Range" },
    serial_no: { accessorKey: "serial_no", header: "Serial No" },
    least_count: { accessorKey: "least_count", header: "Least Count" },
    make: { accessorKey: "make", header: "Make" },
    item_type: { accessorKey: "item_type", header: "Item Type" },
    part_no: { accessorKey: "part_no", header: "Part No" },
    part_name: { accessorKey: "part_name", header: "Part Name" },
    calibration_source: { accessorKey: "calibration_source", header: "Calibration Source" },
    customer: { accessorKey: "customer", header: "Customer" },
    sector: { accessorKey: "sector", header: "Sector" },
    criticality_level: { accessorKey: "criticality_level", header: "Criticality Level" },
    cert_no: { accessorKey: "cert_no", header: "Cert. No." },
    remarks: { accessorKey: "remarks", header: "Remarks" },
    gauge_issue_date: {
      accessorKey: "gauge_issue_date",
      header: "Gauge Issue Date",
      cell: ({ row }) => {
        if (!row.original.gauge_issue_date) return "-";
        const d = new Date(row.original.gauge_issue_date);
        return isNaN(d.getTime()) ? "-" : format(d, 'dd-MM-yyyy');
      },
    },
    gauges_received_by: { accessorKey: "gauges_received_by", header: "Gauges Received By" },
    gauges_issued_by: { accessorKey: "gauges_issued_by", header: "Gauges Issued By" },
    calibration_procedure: { accessorKey: "calibration_procedure", header: "Calibration Procedure" },
    traceable: { accessorKey: "traceable", header: "Traceable" },
    certificate: {
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
                accept="application/pdf,image/*,.xlsx,.xls,.doc,.docx"
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
    action: {
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
        );
      }
    }
  };

  const columns: ColumnDef<Instrument>[] = useMemo(() => {
    const activeCols: ColumnDef<Instrument>[] = [
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
    ];

    columnConfigs
      .filter((c) => c.visible)
      .forEach((c) => {
        const def = COLUMN_DEF_MAP[c.id];
        if (def) {
          activeCols.push({
            id: c.id,
            accessorKey: (def as any).accessorKey || c.id,
            header: c.label,
            cell: def.cell || (({ row }: any) => {
              const val = (row.original as any)[c.id];
              return val !== undefined && val !== null && val !== "" ? String(val) : "-";
            }),
          } as ColumnDef<Instrument>);
        }
      });

    if (COLUMN_DEF_MAP.action) {
      activeCols.push({
        id: "action",
        header: COLUMN_DEF_MAP.action.header,
        cell: COLUMN_DEF_MAP.action.cell,
      } as ColumnDef<Instrument>);
    }
    return activeCols;
  }, [columnConfigs, filters.page, filters.pageSize, uploadingId]);

  return (
    <>
      <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
        {/* ─── Header Banner (Industrial Precision + Subtle Glass) ─── */}
        <header className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border border-primary/20 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Instruments Inventory</h1>
              <Badge variant="outline" className="text-[10px] font-mono font-bold bg-background text-primary border-primary/30">
                {data.total} Total
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              Manage and track your calibration inventory with precision.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
              size="sm" 
              className="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-xs gap-2 w-full sm:w-auto" 
              onClick={() => navigate("/instruments/new")}
            >
              <PlusCircle className="h-4 w-4" /> Add Instrument
            </Button>
          </div>
        </header>

        {/* ─── Filter Inventory Section ─── */}
        <div className="bg-card/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-border/70 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3 border-border/50">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-primary rounded-full" />
              <h2 className="text-base font-bold text-foreground">Filter Inventory</h2>
              {(filters.status !== "All" || filters.item_status !== "Active" || filters.location !== "All" || filters.frequency !== "All" || filters.calibration_source !== "All" || localSearch || filters.due_date || filters.due_date_start) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-red-600 hover:bg-red-50/50 gap-1 transition-colors"
                  onClick={() => {
                    setLocalSearch("");
                    setFilters({ status: "All", item_status: "Active", location: "All", frequency: "All", calibration_source: "All", search: "", due_date: "", due_date_start: "", due_date_end: "", last_cal_start: "", last_cal_end: "", calibrated_in_range_start: "", calibrated_in_range_end: "", is_reference_standard: "All", page: 1, pageSize: filters.pageSize, limit: 10 });
                    navigate("/instruments", { replace: true });
                  }}
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
              )}
            </div>
            
            <div className="bg-muted p-1 rounded-lg inline-flex items-center self-stretch sm:self-auto justify-center">
              <button 
                onClick={() => setFilters(f => ({ ...f, is_reference_standard: "false", page: 1 }))}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${(!filters.is_reference_standard || filters.is_reference_standard === "false") ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Instruments
              </button>
              <button 
                onClick={() => setFilters(f => ({ ...f, is_reference_standard: "true", page: 1 }))}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${filters.is_reference_standard === "true" ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Reference Standards
              </button>
              <button 
                onClick={() => setFilters(f => ({ ...f, is_reference_standard: "All", page: 1 }))}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${filters.is_reference_standard === "All" ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-end gap-3">
            {/* Search Input - Increased Width! */}
            <div className="flex-1 min-w-[240px] sm:min-w-[280px] relative">
              <Label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-primary" /> Search
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
                      className="h-9 text-xs bg-background border-border/70 focus:ring-primary/20 transition-all pl-8 pr-8 rounded-lg"
                    />
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
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
                        className="absolute right-2.5 top-2.5 h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] p-0 border-border/70 shadow-lg bg-popover text-popover-foreground z-[100]" 
                  align="start" 
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="max-h-60 overflow-auto divide-y divide-border/30">
                    {suggestions.map((code, idx) => (
                      <div 
                        key={idx} 
                        className="px-3 py-2 hover:bg-primary/10 cursor-pointer text-xs transition-colors"
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
            
            {/* Status Filter */}
            <div className="w-full sm:w-[130px] md:w-[140px]">
              <Label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Badge className="h-3.5 w-3.5 p-0 flex items-center justify-center text-[9px]">S</Badge> Status
              </Label>
              <Select
                value={filters.status as any}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v as any, page: 1 }))}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border/70 rounded-lg">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  {StatusFillter.filter(s => s && s.trim() !== "").map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item Status Filter */}
            <div className="w-full sm:w-[130px] md:w-[140px]">
              <Label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Badge className="h-3.5 w-3.5 p-0 flex items-center justify-center text-[9px]">I</Badge> Item Status
              </Label>
              <Select
                value={filters.item_status as any}
                onValueChange={(v) => setFilters((f) => ({ ...f, item_status: v as any, page: 1 }))}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border/70 rounded-lg">
                  <SelectValue placeholder="All Item Status" />
                </SelectTrigger>
                <SelectContent>
                  {ItemStatusFilter.filter(s => s && s.trim() !== "").map((itemSt) => (
                    <SelectItem key={itemSt} value={itemSt}>{itemSt === "All" ? "All Item Status" : itemSt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Frequency Filter */}
            <div className="w-full sm:w-[130px] md:w-[140px]">
              <Label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-primary" /> Frequency
              </Label>
              <Select value={filters.frequency as any} onValueChange={(v) => setFilters((f) => ({ ...f, frequency: v as any, page: 1 }))}>
                <SelectTrigger className="h-9 text-xs bg-background border-border/70 rounded-lg">
                  <SelectValue placeholder="All Frequencies" />
                </SelectTrigger>
                <SelectContent>
                  {FrequencyFillter.filter(f => f && f.trim() !== "").map((freq) => (
                    <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Filter */}
            <div className="w-full sm:w-[130px] md:w-[140px]">
              <Label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" /> Location
              </Label>
              <Select value={filters.location as any} onValueChange={(v) => setFilters((f) => ({ ...f, location: v as any, page: 1 }))}>
                <SelectTrigger className="h-9 text-xs bg-background border-border/70 rounded-lg">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  {LocationFillter.filter(l => l && l.trim() !== "").map((loc) => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Calibration Source Filter */}
            <div className="w-full sm:w-[130px] md:w-[140px]">
              <Label className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Badge className="h-3.5 w-3.5 p-0 flex items-center justify-center text-[9px]">C</Badge> Source
              </Label>
              <Select value={filters.calibration_source as any} onValueChange={(v) => setFilters((f) => ({ ...f, calibration_source: v as any, page: 1 }))}>
                <SelectTrigger className="h-9 text-xs bg-background border-border/70 rounded-lg">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  {CalibrationSourceFilter.filter(c => c && c.trim() !== "").map((source) => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Additional Date Filter (Due Date or Last Calibration Date - Single or Range) */}
            <InstrumentDateFilter
              filters={filters}
              onApplyDateFilter={handleApplyDateFilter}
              onClearDateFilter={handleClearDateFilter}
            />

            {/* Compact Reset Icon Button */}
            <div className="flex items-end">
              <Button 
                variant="outline" 
                size="icon"
                title="Reset all filters"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50/50 border-border/70 rounded-lg transition-all"
                onClick={() => {
                  setLocalSearch("");
                  setFilters({ status: "All", item_status: "Active", location: "All", frequency: "All", calibration_source: "All", search: "", due_date: "", due_date_start: "", due_date_end: "", last_cal_start: "", last_cal_end: "", calibrated_in_range_start: "", calibrated_in_range_end: "", is_reference_standard: "All", page: 1, pageSize: filters.pageSize, limit: 10 });
                  navigate("/instruments", { replace: true });
                }}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
            
          {filters.due_date && !filters.due_date_start && (
            <div className="flex items-center mt-1">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 px-2.5 py-1 text-xs flex gap-2 items-center">
                <CalendarDays className="h-3.5 w-3.5" />
                Showing instruments due on: {new Date(filters.due_date).toLocaleDateString()}
                <button onClick={handleClearDateFilter} className="ml-1 hover:text-amber-800 focus:outline-none font-bold">×</button>
              </Badge>
            </div>
          )}

          {(filters.due_date_start || filters.due_date_end) && (
            <div className="flex items-center mt-1">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 px-2.5 py-1 text-xs flex gap-2 items-center">
                <CalendarDays className="h-3.5 w-3.5" />
                {filters.due_date_start && filters.due_date_end && filters.due_date_start === filters.due_date_end ? (
                  <>Showing instruments due on: {new Date(filters.due_date_start).toLocaleDateString()}</>
                ) : (
                  <>Showing instruments due from: {filters.due_date_start ? new Date(filters.due_date_start).toLocaleDateString() : 'Any'} to {filters.due_date_end ? new Date(filters.due_date_end).toLocaleDateString() : 'Any'}</>
                )}
                <button onClick={handleClearDateFilter} className="ml-1 hover:text-amber-800 focus:outline-none font-bold">×</button>
              </Badge>
            </div>
          )}

          {(filters.last_cal_start || filters.last_cal_end) && (
            <div className="flex items-center mt-1">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 px-2.5 py-1 text-xs flex gap-2 items-center">
                <CalendarDays className="h-3.5 w-3.5" />
                {filters.last_cal_start && filters.last_cal_end && filters.last_cal_start === filters.last_cal_end ? (
                  <>Showing calibrated on: {new Date(filters.last_cal_start).toLocaleDateString()}</>
                ) : (
                  <>Showing calibrated from: {filters.last_cal_start ? new Date(filters.last_cal_start).toLocaleDateString() : 'Any'} to {filters.last_cal_end ? new Date(filters.last_cal_end).toLocaleDateString() : 'Any'}</>
                )}
                <button onClick={handleClearDateFilter} className="ml-1 hover:text-blue-800 focus:outline-none font-bold">×</button>
              </Badge>
            </div>
          )}

          {(filters.calibrated_in_range_start || filters.calibrated_in_range_end) && (
            <div className="flex items-center mt-1">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 px-2.5 py-1 text-xs flex gap-2 items-center">
                <CalendarDays className="h-3.5 w-3.5" />
                Showing instruments calibrated in range: {filters.calibrated_in_range_start ? new Date(filters.calibrated_in_range_start).toLocaleDateString() : 'Any'} to {filters.calibrated_in_range_end ? new Date(filters.calibrated_in_range_end).toLocaleDateString() : 'Any'}
                <button onClick={() => {
                  setFilters(f => ({ ...f, calibrated_in_range_start: "", calibrated_in_range_end: "", page: 1 }));
                  navigate("/instruments", { replace: true });
                }} className="ml-1 hover:text-emerald-800 focus:outline-none font-bold">×</button>
              </Badge>
            </div>
          )}
        </div>

        {/* ─── Data Table & Header Actions Bar ─── */}
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
          onRowSelectionChange={handleRowSelectionChange}
          hideSearch={true}
          hideColumnToggle={true}
          headerActions={
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold gap-1.5"
                  onClick={handleRefresh}
                  disabled={refreshing || loading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold gap-1.5"
                  onClick={() => setisOpenupload(true)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Bulk Upload</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold gap-1.5"
                      disabled={!data.items.length}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Export</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => handleExportData("all")} className="gap-2 cursor-pointer text-xs">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Export All Data ({data.total})</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={selectedIds.length === 0}
                      onClick={() => handleExportData("selected")}
                      className="gap-2 cursor-pointer text-xs"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                      <span>Export Selected ({selectedIds.length})</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {selectedIds.length > 0 && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs font-bold animate-in fade-in gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      onClick={() => setSelectedReviewModalOpen(true)}
                    >
                      <FileCheck className="h-3.5 w-3.5" />
                      <span>Selected Items ({selectedIds.length})</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs font-semibold animate-in fade-in slide-in-from-left-2 gap-1.5 text-primary hover:bg-primary/5 border-primary/30"
                      onClick={() => setisOpenCalibagency(true)}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Send {selectedIds.length} Selected</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold animate-in fade-in gap-1.5 border-border/70 hover:bg-muted/50 text-foreground"
                      onClick={() => {
                        setInstrumentsToPrint(selectedItemsList);
                        setPrintModalOpen(true);
                      }}
                    >
                      <Printer className="h-3.5 w-3.5 text-primary" />
                      <span>Print {selectedIds.length} Labels</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs font-semibold animate-in fade-in gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete {selectedIds.length} Selected</span>
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleOpenColumnModal} 
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Columns
                </Button>
              </div>
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
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.add("border-primary", "bg-primary/10");
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove("border-primary", "bg-primary/10");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove("border-primary", "bg-primary/10");
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const droppedFile = e.dataTransfer.files[0];
                      setCertificateFile(droppedFile);
                    }
                  }}
                  className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium transition-all border-2 border-dashed rounded-lg cursor-pointer border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 text-muted-foreground"
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
                      <TableHead>Source</TableHead>
                      <TableHead>Certificate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.created_at ? new Date(record.created_at).toLocaleString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {record.last_calibration_date ? new Date(record.last_calibration_date).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {record.due_date ? new Date(record.due_date).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={record.calibration_source === 'In-House' ? 'bg-blue-50 text-blue-700' : record.calibration_source === 'External' ? 'bg-amber-50 text-amber-700' : ''}>
                            {record.calibration_source || 'Unknown'}
                          </Badge>
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
      
      {/* ─── Selected Instruments Review & Action Modal ─── */}
      <Dialog open={selectedReviewModalOpen} onOpenChange={setSelectedReviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary" />
                <span>Review Selected Instruments ({selectedItemsList.length})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                onClick={handleClearAllSelections}
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All
              </Button>
            </DialogTitle>
            <DialogDescription>
              Review all items selected across search & pagination. Deselect any item not required, then print labels or download in XLSX format.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto border rounded-xl max-h-[50vh] scrollbar-thin">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-12 text-center">S.No</TableHead>
                  <TableHead>ID Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last Cal. Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedItemsList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-xs">
                      No items selected. Select items from the inventory table to review or print.
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedItemsList.map((item, idx) => (
                    <TableRow key={item.id} className="hover:bg-muted/30 text-xs">
                      <TableCell className="text-center font-mono text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-semibold text-foreground">{item.id_code}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.location || "-"}</TableCell>
                      <TableCell>
                        {item.last_calibration_date ? format(new Date(item.last_calibration_date), "dd-MM-yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        {item.due_date ? format(new Date(item.due_date), "dd-MM-yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === "OK" ? "success" : item.status === "Overdue" ? "destructive" : "warning"} className="text-[10px]">
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Deselect this item"
                          onClick={() => handleDeselectItem(item.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
            <div className="text-xs text-muted-foreground font-medium">
              {selectedItemsList.length} item(s) selected
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedReviewModalOpen(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedItemsList.length === 0}
                onClick={() => handleExportData("selected")}
                className="gap-1.5 text-emerald-600 hover:text-emerald-700 border-emerald-600/30 hover:bg-emerald-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Download XLSX ({selectedItemsList.length})</span>
              </Button>
              <Button
                disabled={selectedItemsList.length === 0}
                size="sm"
                onClick={() => {
                  setInstrumentsToPrint(selectedItemsList);
                  setPrintModalOpen(true);
                }}
                className="gap-1.5 bg-primary text-primary-foreground"
              >
                <Printer className="w-4 h-4" />
                <span>Print Labels ({selectedItemsList.length})</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintLabelModal 
        open={printModalOpen}
        onOpenChange={setPrintModalOpen}
        instruments={instrumentsToPrint}
        onExportXlsx={(items, selectedFields) => handleExportData("selected", items, selectedFields)}
      />

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
                  onClick={() => setTempColumnConfigs(prev => prev.map(c => ({ ...c, visible: true })))}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-muted-foreground"
                  onClick={() => setTempColumnConfigs(prev => prev.map(c => ({ ...c, visible: c.id === "sino" || c.id === "name" || c.id === "id_code" })))}
                >
                  Deselect All
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-primary font-medium"
                onClick={() => setTempColumnConfigs([...DEFAULT_INSTRUMENT_COLUMNS])}
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
                    <label htmlFor={`col-cfg-${col.id}`} className="font-medium text-xs truncate cursor-pointer select-none">
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
    </>

  );
}
