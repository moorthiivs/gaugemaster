import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import httpClient from "@/lib/httpClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Printer,
  FileSpreadsheet,
  Eye,
  History,
  Search,
  RefreshCw,
  Clock,
  User as UserIcon,
  Copy,
  Check,
  Download,
  Layers,
  ArrowLeft,
  Loader2,
  Calendar,
  Sparkles,
} from "lucide-react";

export interface LabelPrintHistoryItem {
  id: string;
  companyId: string;
  userId?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
  action: "PRINT_LABEL" | "DOWNLOAD_XLSX" | string;
  status: string;
  itemsCount: number;
  selectedFields?: string[];
  labelConfig?: {
    presetId?: string;
    presetName?: string;
    width?: number;
    height?: number;
    columns?: number;
    layoutMode?: string;
    fontSize?: number;
    showBorder?: boolean;
    [key: string]: any;
  };
  items: Array<Record<string, any>>;
  createdAt: string;
}

interface LabelPrintHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LabelPrintHistoryModal({ open, onOpenChange }: LabelPrintHistoryModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [historyList, setHistoryList] = useState<LabelPrintHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<"ALL" | "PRINT_LABEL" | "DOWNLOAD_XLSX">("ALL");

  // Selected entry for detailed inspection
  const [selectedEntry, setSelectedEntry] = useState<LabelPrintHistoryItem | null>(null);
  const [detailTab, setDetailTab] = useState<"table" | "json">("table");
  const [copiedJson, setCopiedJson] = useState(false);
  const [detailSearch, setDetailSearch] = useState("");

  const fetchHistory = useCallback(async () => {
    if (!open) return;
    try {
      setLoading(true);
      const res = await httpClient.get("/label-print-history", {
        params: {
          companyId: user?.companyId,
          pageSize: 100,
        },
      });
      setHistoryList(res.data?.items || []);
    } catch (err: any) {
      console.error("Failed to load label print history", err);
      toast({
        title: "Error",
        description: "Failed to load label history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [open, user?.companyId, toast]);

  useEffect(() => {
    if (open) {
      fetchHistory();
      setSelectedEntry(null);
    }
  }, [open, fetchHistory]);

  const filteredHistory = useMemo(() => {
    return historyList.filter((item) => {
      if (actionFilter !== "ALL" && item.action !== actionFilter) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const userName = item.user?.name?.toLowerCase() || "";
      const userEmail = item.user?.email?.toLowerCase() || "";
      const statusText = item.status?.toLowerCase() || "";
      const preset = item.labelConfig?.presetName?.toLowerCase() || "";

      // Also check inside items (ID Code or Name)
      const matchesItem = item.items?.some((inst) =>
        (inst.id_code && String(inst.id_code).toLowerCase().includes(q)) ||
        (inst.name && String(inst.name).toLowerCase().includes(q)) ||
        (inst.location && String(inst.location).toLowerCase().includes(q))
      );

      return (
        userName.includes(q) ||
        userEmail.includes(q) ||
        statusText.includes(q) ||
        preset.includes(q) ||
        matchesItem
      );
    });
  }, [historyList, actionFilter, searchQuery]);

  // Export historical batch to XLSX
  const handleExportHistoryXlsx = (entry: LabelPrintHistoryItem) => {
    try {
      const items = entry.items || [];
      if (items.length === 0) {
        toast({ title: "No items", description: "This history entry contains no items." });
        return;
      }

      const rows = items.map((item, idx) => {
        const row: Record<string, any> = {
          "S.No": item.sino || idx + 1,
          "ID Code": item.id_code || "",
          Name: item.name || "",
          Location: item.location || "",
          "Last Cal. Date": item.last_calibration_date
            ? format(new Date(item.last_calibration_date), "dd-MM-yyyy")
            : "",
          "Due Date": item.due_date ? format(new Date(item.due_date), "dd-MM-yyyy") : "",
          Frequency: item.frequency || "",
          Status: item.status || "",
          "Item Status": item.item_status || "",
          Make: item.make || "",
          Range: item.range || "",
          "Serial No": item.serial_no || "",
          "Least Count": item.least_count || "",
          Module: item.module || "",
          Agency: item.agency || "",
        };

        // If specific fields were selected, keep them prominent
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Instruments");
      const dateStr = format(new Date(entry.createdAt), "yyyyMMdd_HHmm");
      XLSX.writeFile(workbook, `Label_History_${entry.action}_${dateStr}.xlsx`);

      toast({
        title: "Export Complete",
        description: `Exported ${items.length} items from history.`,
      });
    } catch (e: any) {
      toast({
        title: "Export Failed",
        description: e?.message || "Could not export items",
        variant: "destructive",
      });
    }
  };

  const handleCopyJson = () => {
    if (!selectedEntry) return;
    const jsonStr = JSON.stringify(selectedEntry.items, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
    toast({ title: "Copied", description: "JSON items copied to clipboard." });
  };

  const filteredDetailItems = useMemo(() => {
    if (!selectedEntry?.items) return [];
    if (!detailSearch.trim()) return selectedEntry.items;
    const q = detailSearch.toLowerCase().trim();
    return selectedEntry.items.filter(
      (inst) =>
        (inst.id_code && String(inst.id_code).toLowerCase().includes(q)) ||
        (inst.name && String(inst.name).toLowerCase().includes(q)) ||
        (inst.location && String(inst.location).toLowerCase().includes(q)) ||
        (inst.module && String(inst.module).toLowerCase().includes(q)) ||
        (inst.make && String(inst.make).toLowerCase().includes(q))
    );
  }, [selectedEntry, detailSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <History className="h-5 w-5 text-primary" />
              <span>Label Print & Download History</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Complete audit trail of all labels printed and XLSX spreadsheets generated from Label Studio.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHistory}
              disabled={loading}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </DialogHeader>

        {/* ── MAIN CONTENT: LIST OR DETAIL ── */}
        {!selectedEntry ? (
          <div className="flex flex-col flex-1 overflow-hidden space-y-4 pt-2">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by User, ID Code, Name, or Format..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Action Filter Pills */}
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border text-xs">
                <button
                  onClick={() => setActionFilter("ALL")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    actionFilter === "ALL"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({historyList.length})
                </button>
                <button
                  onClick={() => setActionFilter("PRINT_LABEL")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    actionFilter === "PRINT_LABEL"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Printer className="h-3 w-3" />
                  <span>Print Labels</span>
                </button>
                <button
                  onClick={() => setActionFilter("DOWNLOAD_XLSX")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                    actionFilter === "DOWNLOAD_XLSX"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  <span>Download XLSX</span>
                </button>
              </div>
            </div>

            {/* History Table */}
            <div className="flex-1 overflow-y-auto border rounded-xl bg-card">
              {loading && historyList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Loading label print history...</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <History className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">No History Records Found</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mt-1">
                      Whenever you print labels or download XLSX from the Label Studio, records with full JSON item snapshots will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-xs font-bold w-[180px]">Date & Time</TableHead>
                      <TableHead className="text-xs font-bold">Action / Status</TableHead>
                      <TableHead className="text-xs font-bold text-center">Items</TableHead>
                      <TableHead className="text-xs font-bold">Format / Preset</TableHead>
                      <TableHead className="text-xs font-bold">User</TableHead>
                      <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((entry) => {
                      const isPrint = entry.action === "PRINT_LABEL";
                      const dateObj = new Date(entry.createdAt);
                      const formattedDate = isNaN(dateObj.getTime())
                        ? entry.createdAt
                        : format(dateObj, "dd-MM-yyyy hh:mm a");

                      return (
                        <TableRow key={entry.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-xs font-medium whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-foreground">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{formattedDate}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isPrint ? (
                              <Badge
                                variant="outline"
                                className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 gap-1.5 text-xs py-0.5"
                              >
                                <Printer className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                <span>{entry.status || "Print Label"}</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 gap-1.5 text-xs py-0.5"
                              >
                                <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span>{entry.status || "Download XLSX"}</span>
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="font-mono text-xs px-2">
                              {entry.itemsCount || (entry.items?.length || 0)} items
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {entry.labelConfig?.presetName || "Custom Preset"}
                              </span>
                              {entry.labelConfig?.width && entry.labelConfig?.height ? (
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  {entry.labelConfig.width} × {entry.labelConfig.height} mm (
                                  {entry.labelConfig.layoutMode === "roll" ? "Roll" : "Grid"})
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="truncate max-w-[140px]" title={entry.user?.email}>
                                {entry.user?.name || entry.user?.email || "System"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedEntry(entry)}
                                className="h-7 text-xs gap-1 hover:bg-primary/10 hover:text-primary px-2"
                                title="Inspect JSON items snapshot"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>View Items</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExportHistoryXlsx(entry)}
                                className="h-7 text-xs gap-1 border-emerald-600/30 text-emerald-600 hover:bg-emerald-50 px-2"
                                title="Re-download XLSX file"
                              >
                                <Download className="h-3.5 w-3.5 text-emerald-600" />
                                <span>XLSX</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        ) : (
          /* ── DETAIL VIEW FOR SELECTED BATCH ── */
          <div className="flex flex-col flex-1 overflow-hidden space-y-4 pt-1">
            {/* Header info bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/40 border">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEntry(null)}
                  className="h-8 gap-1.5 text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to List</span>
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      Batch Details ({selectedEntry.items?.length || 0} Instruments)
                    </span>
                    {selectedEntry.action === "PRINT_LABEL" ? (
                      <Badge className="bg-blue-600 text-white text-[10px]">🖨️ Print Label</Badge>
                    ) : (
                      <Badge className="bg-emerald-600 text-white text-[10px]">📊 Download XLSX</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Recorded on {format(new Date(selectedEntry.createdAt), "dd-MM-yyyy hh:mm a")} by{" "}
                    <strong>{selectedEntry.user?.name || selectedEntry.user?.email || "User"}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-background border rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setDetailTab("table")}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      detailTab === "table" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    Table View
                  </button>
                  <button
                    onClick={() => setDetailTab("json")}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      detailTab === "json" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportHistoryXlsx(selectedEntry)}
                  className="h-8 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 border-emerald-600/30 hover:bg-emerald-50"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Export XLSX</span>
                </Button>
              </div>
            </div>

            {/* Content pane: Table or JSON */}
            {detailTab === "table" ? (
              <div className="flex flex-col flex-1 overflow-hidden space-y-3">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search inside this batch (ID Code, Name, Module)..."
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                <div className="flex-1 overflow-y-auto border rounded-xl bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-xs font-bold w-12">#</TableHead>
                        <TableHead className="text-xs font-bold">ID Code</TableHead>
                        <TableHead className="text-xs font-bold">Name</TableHead>
                        <TableHead className="text-xs font-bold">Module</TableHead>
                        <TableHead className="text-xs font-bold">Location</TableHead>
                        <TableHead className="text-xs font-bold">Last Cal.</TableHead>
                        <TableHead className="text-xs font-bold">Due Date</TableHead>
                        <TableHead className="text-xs font-bold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDetailItems.map((inst, idx) => (
                        <TableRow key={inst.id || idx} className="hover:bg-muted/20 text-xs">
                          <TableCell className="text-muted-foreground font-mono">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-foreground">{inst.id_code || "-"}</TableCell>
                          <TableCell className="font-medium">{inst.name || "-"}</TableCell>
                          <TableCell>{inst.module || "-"}</TableCell>
                          <TableCell>{inst.location || "-"}</TableCell>
                          <TableCell>
                            {inst.last_calibration_date
                              ? format(new Date(inst.last_calibration_date), "dd-MM-yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {inst.due_date ? format(new Date(inst.due_date), "dd-MM-yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {inst.status || "OK"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Stored JSON representation ({selectedEntry.items?.length || 0} objects)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyJson}
                    className="h-7 text-xs gap-1.5"
                  >
                    {copiedJson ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedJson ? "Copied!" : "Copy JSON"}</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-auto border rounded-xl bg-slate-950 text-slate-100 p-4 font-mono text-xs">
                  <pre>{JSON.stringify(selectedEntry.items, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
