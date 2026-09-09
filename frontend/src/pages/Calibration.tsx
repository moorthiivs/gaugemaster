import { useState, useEffect, useMemo } from "react";
import { getAuditFieldLabel, formatAuditValue } from "@/lib/auditFormatters";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Activity, CheckCircle2, XCircle, FileText, Download, TrendingUp, Clock, Eye, Trash2, Edit, History, Layers, Loader2, Search, X, MoreVertical, Gauge, Thermometer, Ruler, RotateCw, Zap, Scale, Droplets, AlertTriangle, PlayCircle, ChevronRight, Calendar, Building2, MapPin } from "lucide-react";
import { listCalibrations, getCalibrationStats, downloadCertificate, getAllDrafts, deleteDraft, getCalibrationAuditLogs, deleteCalibration } from "@/lib/calibrationActions";
import { listInstruments, getDashboardSummary } from "@/lib/instrumentActions";
import { CalibrationRecord, CalibrationStats, CALIBRATION_TYPES, CalibrationAuditLog } from "@/types/calibration";
import { Instrument } from "@/types/instrument";
import { VerdictBadge } from "@/components/calibration/VerdictBadge";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const quickLinkIconMap: Record<string, React.ElementType> = {
  Gauge,
  Thermometer,
  Ruler,
  RotateCw,
  Zap,
  Scale,
  Droplets,
};

const quickLinkColorMap: Record<string, { badge: string; icon: string; border: string }> = {
  pressure: { badge: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400", icon: "text-blue-600 dark:text-blue-400", border: "hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-950/20" },
  temperature: { badge: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/60 dark:text-orange-400", icon: "text-orange-600 dark:text-orange-400", border: "hover:border-orange-400 hover:bg-orange-50/40 dark:hover:bg-orange-950/20" },
  dimensional: { badge: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400", icon: "text-emerald-600 dark:text-emerald-400", border: "hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20" },
  torque: { badge: "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950/60 dark:text-violet-400", icon: "text-violet-600 dark:text-violet-400", border: "hover:border-violet-400 hover:bg-violet-50/40 dark:hover:bg-violet-950/20" },
  electrical: { badge: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400", icon: "text-amber-600 dark:text-amber-400", border: "hover:border-amber-400 hover:bg-amber-50/40 dark:hover:bg-amber-950/20" },
  weight: { badge: "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950/60 dark:text-teal-400", icon: "text-teal-600 dark:text-teal-400", border: "hover:border-teal-400 hover:bg-teal-50/40 dark:hover:bg-teal-950/20" },
  flow: { badge: "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-950/60 dark:text-sky-400", icon: "text-sky-600 dark:text-sky-400", border: "hover:border-sky-400 hover:bg-sky-50/40 dark:hover:bg-sky-950/20" },
};

export default function Calibration() {
  useSEO({ title: "Calibration — GaugeMaster", description: "Calibrate instruments and generate certificates" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAccess } = usePermissions();

  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [stats, setStats] = useState<CalibrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [verdictFilter, setVerdictFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Overdue instruments state
  const [overdueCount, setOverdueCount] = useState<number>(0);
  const [overdueInstruments, setOverdueInstruments] = useState<Instrument[]>([]);
  const [overdueModalOpen, setOverdueModalOpen] = useState(false);
  const [overdueSearchQuery, setOverdueSearchQuery] = useState("");
  const [overdueScope, setOverdueScope] = useState<"current_month" | "all_time">("all_time");
  const [viewMode, setViewMode] = useState<"latest" | "all">("latest");
  const [activeTab, setActiveTab] = useState<string>("recent");

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [calibrationToDelete, setCalibrationToDelete] = useState<CalibrationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Audit trail modal state
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedCertNo, setSelectedCertNo] = useState<string>("");
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditLogs, setAuditLogs] = useState<CalibrationAuditLog[]>([]);

  const handleOpenAuditLogs = async (cal: CalibrationRecord) => {
    setSelectedCertNo(cal.certificate_number || cal.id || "");
    setAuditModalOpen(true);
    setLoadingAudit(true);
    try {
      const logs = await getCalibrationAuditLogs(cal.id);
      setAuditLogs(logs || []);
    } catch {
      toast.error("Failed to load audit logs");
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const query = searchQuery.trim().toLowerCase();
    return calibrations.filter((cal) => {
      const certNo = cal.certificate_number?.toLowerCase() || "";
      const ulr = cal.ulr_number?.toLowerCase() || "";
      const instName = cal.instrument?.name?.toLowerCase() || "";
      const idCode = cal.instrument?.id_code?.toLowerCase() || "";
      return certNo.includes(query) || ulr.includes(query) || instName.includes(query) || idCode.includes(query);
    });
  }, [calibrations, searchQuery]);

  const filteredOverdueInstruments = useMemo(() => {
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);

    let list = overdueInstruments.filter((inst) => {
      const dStr = inst.due_date || inst.next_due_date;
      if (!dStr) return true;
      const d = new Date(dStr);
      if (d > now) return false; // Exclude future-dated instruments

      if (overdueScope === "current_month") {
        return d >= startOfCurrentMonth; // Only include instruments due in the current month
      }
      return true;
    });

    if (overdueSearchQuery.trim()) {
      const q = overdueSearchQuery.trim().toLowerCase();
      list = list.filter(
        (inst) =>
          inst.name?.toLowerCase().includes(q) ||
          inst.id_code?.toLowerCase().includes(q) ||
          inst.location?.toLowerCase().includes(q) ||
          inst.department?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [overdueInstruments, overdueSearchQuery, overdueScope]);

  const currentMonthOverdueCount = useMemo(() => {
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    return overdueInstruments.filter((inst) => {
      const dStr = inst.due_date || inst.next_due_date;
      if (!dStr) return false;
      const d = new Date(dStr);
      return d >= startOfCurrentMonth && d <= now;
    }).length;
  }, [overdueInstruments]);

  const activeOverdueCount = overdueScope === "current_month" ? currentMonthOverdueCount : overdueInstruments.length;

  // Pending Certificates state
  const [certStatusFilter, setCertStatusFilter] = useState<"all" | "pending" | "generated">("all");
  const [pendingCertsModalOpen, setPendingCertsModalOpen] = useState(false);
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [pendingCertsList, setPendingCertsList] = useState<CalibrationRecord[]>([]);
  const [loadingPendingList, setLoadingPendingList] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleGenerateCertificate = async (cal: CalibrationRecord) => {
    try {
      setGeneratingId(cal.id);
      const blob = await downloadCertificate(cal.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Certificate-${cal.certificate_number?.replace(/\//g, "-") || cal.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Certificate generated & downloaded for ${cal.certificate_number || cal.id}`);
      fetchData();
      setPendingCertsList((prev) => prev.filter((c) => c.id !== cal.id));
    } catch {
      toast.error("Failed to generate certificate");
    } finally {
      setGeneratingId(null);
    }
  };

  const filteredPendingCerts = useMemo(() => {
    if (!pendingSearchQuery.trim()) return pendingCertsList;
    const q = pendingSearchQuery.trim().toLowerCase();
    return pendingCertsList.filter(
      (cal) =>
        cal.certificate_number?.toLowerCase().includes(q) ||
        cal.instrument?.name?.toLowerCase().includes(q) ||
        cal.instrument?.id_code?.toLowerCase().includes(q) ||
        cal.ulr_number?.toLowerCase().includes(q)
    );
  }, [pendingCertsList, pendingSearchQuery]);

  const fetchPendingCerts = async () => {
    if (!user?.id) return;
    setLoadingPendingList(true);
    try {
      const data = await listCalibrations({
        userId: user.id,
        companyId: user.companyId,
        pendingCertsOnly: true,
        pageSize: 200,
      });
      setPendingCertsList(data.data || []);
    } catch {
      toast.error("Failed to load pending certificates");
    } finally {
      setLoadingPendingList(false);
    }
  };

  useEffect(() => {
    if (pendingCertsModalOpen) {
      fetchPendingCerts();
    }
  }, [pendingCertsModalOpen, user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const now = new Date();
      const startStr = overdueScope === "current_month" ? format(startOfMonth(now), "yyyy-MM-dd") : undefined;
      const endStr = overdueScope === "current_month" ? format(endOfMonth(now), "yyyy-MM-dd") : undefined;
      const isRefParam = overdueScope === "current_month" ? "false" : undefined;

      const [calData, statsData, draftData, overdueData, summaryData] = await Promise.all([
        listCalibrations({
          userId: user.id,
          companyId: user.companyId,
          verdict: verdictFilter !== "All" ? verdictFilter : undefined,
          calibrationType: typeFilter !== "All" ? typeFilter : undefined,
          pendingCertsOnly: activeTab === "pending" || certStatusFilter === "pending" ? true : undefined,
          search: searchQuery.trim() ? searchQuery.trim() : undefined,
          latestOnly: viewMode === "latest" && activeTab !== "pending",
          page,
          pageSize,
        }),
        getCalibrationStats(user.id),
        getAllDrafts(user.id).catch(() => []),
        listInstruments({
          status: "Overdue",
          item_status: "Active",
          pageSize: 500,
          companyId: user.companyId,
        }).catch(() => ({ data: [] })),
        getDashboardSummary(user.id, startStr, endStr, undefined, undefined, undefined, isRefParam, user.companyId).catch(() => ({} as any)),
      ]);

      setCalibrations(calData.data || []);
      setDrafts(draftData || []);
      setTotal(calData.total || 0);
      setStats(statsData);

      const overdueList = overdueData.data || (Array.isArray(overdueData) ? overdueData : []);
      setOverdueInstruments(overdueList);
      setOverdueCount(summaryData?.overdue || overdueList.length || 0);
    } catch {
      toast.error("Failed to load calibrations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id, page, pageSize, verdictFilter, typeFilter, searchQuery, viewMode, overdueScope, certStatusFilter, activeTab]);

  const handleConfirmDelete = async () => {
    if (!calibrationToDelete) return;
    setDeleting(true);
    try {
      await deleteCalibration(calibrationToDelete.id);
      toast.success(`Calibration record ${calibrationToDelete.certificate_number || ""} deleted`);
      setDeleteModalOpen(false);
      setCalibrationToDelete(null);
      fetchData();
    } catch {
      toast.error("Failed to delete calibration record");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (cal: CalibrationRecord) => {
    try {
      setGeneratingId(cal.id);
      const blob = await downloadCertificate(cal.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Certificate-${cal.certificate_number?.replace(/\//g, "-") || cal.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Certificate generated & downloaded for ${cal.certificate_number || cal.id}`);
      fetchData();
      if (pendingCertsModalOpen) {
        fetchPendingCerts();
      }
    } catch {
      toast.error("Failed to generate or download certificate");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await deleteDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      toast.success("Draft deleted");
    } catch {
      toast.error("Failed to delete draft");
    }
  };

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try {
      return format(new Date(d), "dd-MMM-yyyy");
    } catch {
      return "-";
    }
  };

  return (
    <div className="space-y-6 py-6 px-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Calibration
          </h1>
          <p className="text-sm text-muted-foreground">Calibrate instruments and generate professional certificates</p>
        </div>
        {canAccess("calibrations", "create") && (
          <Button onClick={() => navigate("/calibration/new")} className="gap-2 shadow-lg">
            <PlusCircle className="w-4 h-4" />
            New Calibration
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/15"><Activity className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Calibrations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/15"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.passRate}%</p>
                  <p className="text-xs text-muted-foreground">Pass Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/15"><XCircle className="w-5 h-5 text-red-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            onClick={() => { setActiveTab("pending"); setPage(1); }}
            className="bg-gradient-to-br from-amber-500/15 via-amber-500/10 to-amber-600/5 border-amber-300/80 hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group"
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.pendingCerts}</p>
                    {stats.pendingCerts > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 uppercase bg-amber-100 text-amber-800 border-amber-300">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-0.5">
                    Pending Certificates <ChevronRight className="w-3 h-3 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            onClick={() => { setActiveTab("overdue"); setPage(1); }}
            className="bg-gradient-to-br from-rose-500/15 via-rose-500/10 to-rose-600/5 border-rose-300/80 hover:border-rose-500 hover:shadow-md transition-all cursor-pointer group"
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{activeOverdueCount}</p>
                    {activeOverdueCount > 0 && (
                      <Badge variant="destructive" className="text-[9px] px-1.5 py-0 uppercase animate-pulse">
                        Overdue
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-0.5">
                    Overdue Instruments <ChevronRight className="w-3 h-3 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Instrument Type Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {CALIBRATION_TYPES.map((ct) => {
          const IconComp = quickLinkIconMap[ct.icon] || Gauge;
          const style = quickLinkColorMap[ct.type] || quickLinkColorMap.pressure;

          return (
            <Card
              key={ct.type}
              onClick={() => navigate(`/calibration/new?type=${ct.type}`)}
              className="p-2.5 flex items-center gap-2.5 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group bg-card"
            >
              <div className={`p-2 rounded-xl border ${style.badge} transition-transform group-hover:scale-110 shadow-2xs`}>
                <IconComp className={`w-4 h-4 ${style.icon}`} />
              </div>
              <span className="text-[11px] font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">{ct.label}</span>
            </Card>
          );
        })}
      </div>

        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setPage(1); }} className="w-full">
        <Card>
          <CardHeader className="pb-2 space-y-3">
            {/* Row 1: Full-width Tabs */}
            <TabsList className="w-full justify-start h-11 bg-muted/50 p-1 rounded-xl gap-1">
              <TabsTrigger value="recent" className="text-[13px] font-semibold px-4 py-2 rounded-lg data-[state=active]:shadow-sm">
                Recent Calibrations
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-[13px] font-semibold px-4 py-2 rounded-lg data-[state=active]:shadow-sm gap-2">
                Pending Certificates
                {(stats?.pendingCerts ?? 0) > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-amber-500 text-white tabular-nums">
                    {stats!.pendingCerts}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="overdue" className="text-[13px] font-semibold px-4 py-2 rounded-lg data-[state=active]:shadow-sm gap-2">
                Overdue Instruments
                {activeOverdueCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-rose-500 text-white tabular-nums animate-pulse">
                    {activeOverdueCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="drafts" className="text-[13px] font-semibold px-4 py-2 rounded-lg data-[state=active]:shadow-sm gap-2">
                Unfinished Drafts
                {drafts.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-blue-500 text-white tabular-nums">
                    {drafts.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Row 2: Search + Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[260px] max-w-lg">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Search cert no, instrument, ID, ULR..."
                    className="pl-9 pr-8 h-9 text-[13px] rounded-lg bg-muted/30 border-border/60 font-medium placeholder:text-muted-foreground/50 focus:bg-background transition-colors"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSearchQuery("");
                        setPage(1);
                      }}
                      className="h-5 w-5 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Auto-suggest Dropdown Overlay */}
                {showSuggestions && searchQuery.trim().length >= 2 && (
                  <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-xl border bg-popover max-h-60 overflow-y-auto">
                    <CardContent className="p-1 space-y-0.5 text-xs">
                      {filteredSuggestions.length > 0 ? (
                        filteredSuggestions.map((cal) => (
                          <div
                            key={cal.id}
                            onClick={() => {
                              setSearchQuery(cal.instrument?.id_code || cal.certificate_number || cal.instrument?.name || "");
                              setShowSuggestions(false);
                            }}
                            className="p-2 hover:bg-accent rounded-md cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div>
                              <p className="font-bold text-primary font-mono text-[11px]">{cal.certificate_number || cal.id}</p>
                              <p className="text-[10px] text-muted-foreground font-medium">
                                {cal.instrument?.name || "Instrument"} ({cal.instrument?.id_code || "No ID"})
                              </p>
                            </div>
                            {cal.ulr_number && (
                              <Badge variant="outline" className="text-[9px] font-mono">
                                {cal.ulr_number}
                              </Badge>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground text-center py-2">No matching suggestions</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-7 bg-border/60" />

              {/* Filter Dropdowns */}
              <div className="flex items-center gap-2 flex-wrap">
                {activeTab === "recent" && (
                  <Select value={viewMode} onValueChange={(val: any) => { setViewMode(val); setPage(1); }}>
                    <SelectTrigger className="w-[170px] h-9 text-[13px] font-medium bg-muted/30 border-border/60 rounded-lg">
                      <SelectValue placeholder="View Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Recent Only (Distinct)</SelectItem>
                      <SelectItem value="all">All Historical Records</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {activeTab === "recent" && (
                  <Select value={certStatusFilter} onValueChange={(val: any) => { setCertStatusFilter(val); setPage(1); }}>
                    <SelectTrigger className="w-[150px] h-9 text-[13px] font-medium bg-muted/30 border-border/60 rounded-lg">
                      <SelectValue placeholder="Cert Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cert Status</SelectItem>
                      <SelectItem value="pending">Pending Certs Only</SelectItem>
                      <SelectItem value="generated">Generated Only</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {activeTab === "overdue" && (
                  <Select value={overdueScope} onValueChange={(val: any) => setOverdueScope(val)}>
                    <SelectTrigger className="w-[185px] h-9 text-[13px] font-medium bg-muted/30 border-rose-200/60 rounded-lg">
                      <SelectValue placeholder="Period Scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current_month">Active Period (This Month)</SelectItem>
                      <SelectItem value="all_time">All Time (Total History)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Select value={verdictFilter} onValueChange={setVerdictFilter}>
                  <SelectTrigger className="w-[125px] h-9 text-[13px] font-medium bg-muted/30 border-border/60 rounded-lg">
                    <SelectValue placeholder="Verdict" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Verdicts</SelectItem>
                    <SelectItem value="PASS">Pass</SelectItem>
                    <SelectItem value="FAIL">Fail</SelectItem>
                    <SelectItem value="CONDITIONAL">Conditional</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[130px] h-9 text-[13px] font-medium bg-muted/30 border-border/60 rounded-lg">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    {CALIBRATION_TYPES.map((ct) => (
                      <SelectItem key={ct.type} value={ct.type}>{ct.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <TabsContent value="recent" className="mt-0">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : calibrations.length > 0 ? (
              <>
                <div className="overflow-x-auto border rounded-xl shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">Certificate No</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">Instrument</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">Type</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">Date</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">Verdict</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">ULR</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calibrations.map((cal) => (
                        <TableRow key={cal.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-mono text-[13px] font-bold text-primary px-4 py-3">{cal.certificate_number}</TableCell>
                          <TableCell className="px-4 py-3">
                            <div>
                              <p className="text-[13px] font-semibold text-foreground leading-tight">{cal.instrument?.name || "-"}</p>
                              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{cal.instrument?.id_code || ""}</p>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge variant="outline" className="text-[11px] capitalize font-medium border-primary/20 bg-primary/5 text-primary">
                              {cal.calibration_type || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[13px] whitespace-nowrap font-medium text-muted-foreground px-4 py-3">{fmtDate(cal.calibration_date)}</TableCell>
                          <TableCell className="px-4 py-3"><VerdictBadge verdict={cal.verdict} size="sm" /></TableCell>
                          <TableCell className="text-[13px] font-mono font-medium text-slate-600 px-4 py-3">{cal.ulr_number || "-"}</TableCell>
                          <TableCell className="text-right px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Default Visible Button 1: View */}
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => navigate(`/calibration/history/${cal.instrument_id || cal.instrument?.id}`)} 
                                className="gap-1 text-xs h-7 px-2 bg-background shadow-2xs font-semibold border-primary/30 text-primary hover:bg-primary/5"
                                title="View Calibration History"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </Button>

                              {/* Default Visible Button 2: Audit */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAuditLogs(cal)}
                                className="gap-1 text-xs h-7 px-2 bg-background shadow-2xs font-semibold text-slate-700 hover:bg-slate-100"
                                title="View Audit Trail"
                              >
                                <History className="w-3.5 h-3.5 text-slate-600" />
                                Audit
                              </Button>

                              {/* Dropdown Menu for More Options (PDF, Edit, Delete) */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 text-xs font-medium">
                                  {cal.certificate_generated ? (
                                    <DropdownMenuItem onClick={() => handleDownload(cal)} className="gap-2 cursor-pointer">
                                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                                      Download PDF
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem disabled className="gap-2 text-muted-foreground text-[11px]">
                                      <FileText className="w-3.5 h-3.5" />
                                      No Certificate
                                    </DropdownMenuItem>
                                  )}
                                  {canAccess("calibrations", "edit") && (
                                    <DropdownMenuItem onClick={() => navigate(`/calibration/new?editId=${cal.id}`)} className="gap-2 cursor-pointer text-amber-700">
                                      <Edit className="w-3.5 h-3.5 text-amber-600" />
                                      Edit Calibration
                                    </DropdownMenuItem>
                                  )}
                                  {canAccess("calibrations", "delete") && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setCalibrationToDelete(cal);
                                        setDeleteModalOpen(true);
                                      }}
                                      className="gap-2 cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                      Delete Record
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Enhanced Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t text-[13px]">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      Showing <strong>{total === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to <strong>{Math.min(page * pageSize, total)}</strong> of <strong>{total}</strong> calibrations
                    </span>
                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="text-muted-foreground">Per page:</span>
                      <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setPage(1); }}>
                        <SelectTrigger className="w-[70px] h-8 text-[13px] font-mono font-bold rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-7 text-xs"
                    >
                      Previous
                    </Button>
                    {Array.from({ length: Math.ceil(total / pageSize) || 1 }).map((_, idx) => {
                      const pNum = idx + 1;
                      const totalPages = Math.ceil(total / pageSize) || 1;
                      if (pNum === 1 || pNum === totalPages || Math.abs(pNum - page) <= 1) {
                        return (
                          <Button
                            key={pNum}
                            variant={page === pNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(pNum)}
                            className="h-7 w-7 text-xs p-0 font-mono font-bold"
                          >
                            {pNum}
                          </Button>
                        );
                      }
                      if (pNum === 2 && page > 3) return <span key="dots-left" className="px-1 text-muted-foreground">...</span>;
                      if (pNum === totalPages - 1 && page < totalPages - 2) return <span key="dots-right" className="px-1 text-muted-foreground">...</span>;
                      return null;
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page * pageSize >= total}
                      onClick={() => setPage((p) => p + 1)}
                      className="h-7 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No calibrations found</p>
                <Button onClick={() => navigate("/calibration/new")} className="mt-4 gap-2">
                  <PlusCircle className="w-4 h-4" />
                  Start First Calibration
                </Button>
              </div>
            )}
          </TabsContent>

          {/* PENDING CERTIFICATES TAB */}
          <TabsContent value="pending" className="mt-0">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : calibrations.length > 0 ? (
              <>
                <div className="overflow-x-auto border rounded-xl shadow-sm">
                  <Table>
                    <TableHeader className="bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200/40">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">Certificate No</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">Instrument</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">Type</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">Calibration Date</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">Verdict</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4">Status</TableHead>
                        <TableHead className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground py-3 px-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calibrations.map((cal) => (
                        <TableRow key={cal.id} className="hover:bg-amber-50/20 dark:hover:bg-amber-950/10 transition-colors">
                          <TableCell className="font-mono text-[13px] font-bold text-primary px-4 py-3">{cal.certificate_number || cal.id}</TableCell>
                          <TableCell className="px-4 py-3">
                            <div>
                              <p className="text-[13px] font-semibold text-foreground leading-tight">{cal.instrument?.name || "-"}</p>
                              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{cal.instrument?.id_code || ""}</p>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge variant="outline" className="text-[11px] capitalize font-medium border-primary/20 bg-primary/5 text-primary">
                              {cal.calibration_type || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[13px] whitespace-nowrap font-medium text-muted-foreground px-4 py-3">{fmtDate(cal.calibration_date)}</TableCell>
                          <TableCell className="px-4 py-3"><VerdictBadge verdict={cal.verdict} size="sm" /></TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400">
                              Pending Generation
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Primary Generate Button */}
                              <Button
                                size="sm"
                                onClick={() => handleGenerateCertificate(cal)}
                                disabled={generatingId === cal.id}
                                className="gap-1.5 text-xs h-7 px-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-2xs"
                                title="Generate and Download Official Certificate PDF"
                              >
                                {generatingId === cal.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5" />
                                )}
                                Generate Certificate
                              </Button>

                              {/* View Button */}
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => navigate(`/calibration/history/${cal.instrument_id || cal.instrument?.id}`)} 
                                className="gap-1 text-xs h-7 px-2 bg-background shadow-2xs font-semibold border-primary/30 text-primary hover:bg-primary/5"
                                title="View Calibration History"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </Button>

                              {/* More Options Dropdown */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 text-xs font-medium">
                                  <DropdownMenuItem onClick={() => handleOpenAuditLogs(cal)} className="gap-2 cursor-pointer">
                                    <History className="w-3.5 h-3.5 text-slate-600" />
                                    Audit Trail
                                  </DropdownMenuItem>
                                  {canAccess("calibrations", "edit") && (
                                    <DropdownMenuItem onClick={() => navigate(`/calibration/new?editId=${cal.id}`)} className="gap-2 cursor-pointer text-amber-700">
                                      <Edit className="w-3.5 h-3.5 text-amber-600" />
                                      Edit Calibration
                                    </DropdownMenuItem>
                                  )}
                                  {canAccess("calibrations", "delete") && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setCalibrationToDelete(cal);
                                        setDeleteModalOpen(true);
                                      }}
                                      className="gap-2 cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                      Delete Record
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Enhanced Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t text-[13px]">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      Showing <strong>{total === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to <strong>{Math.min(page * pageSize, total)}</strong> of <strong>{total}</strong> pending certificates
                    </span>
                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="text-muted-foreground">Per page:</span>
                      <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setPage(1); }}>
                        <SelectTrigger className="w-[70px] h-8 text-[13px] font-mono font-bold rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-7 text-xs"
                    >
                      Previous
                    </Button>
                    {Array.from({ length: Math.ceil(total / pageSize) || 1 }).map((_, idx) => {
                      const pNum = idx + 1;
                      const totalPages = Math.ceil(total / pageSize) || 1;
                      if (pNum === 1 || pNum === totalPages || Math.abs(pNum - page) <= 1) {
                        return (
                          <Button
                            key={pNum}
                            variant={page === pNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(pNum)}
                            className="h-7 w-7 text-xs p-0 font-mono font-bold"
                          >
                            {pNum}
                          </Button>
                        );
                      }
                      if (pNum === 2 && page > 3) return <span key="dots-left" className="px-1 text-muted-foreground">...</span>;
                      if (pNum === totalPages - 1 && page < totalPages - 2) return <span key="dots-right" className="px-1 text-muted-foreground">...</span>;
                      return null;
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page * pageSize >= total}
                      onClick={() => setPage((p) => p + 1)}
                      className="h-7 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 flex flex-col items-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                <p className="text-base font-bold text-foreground">All Certificates Generated!</p>
                <p className="text-xs text-muted-foreground">There are no completed calibrations waiting for certificate generation.</p>
              </div>
            )}
          </TabsContent>

          {/* OVERDUE INSTRUMENTS TAB */}
          <TabsContent value="overdue" className="mt-4">
            {filteredOverdueInstruments.length > 0 ? (
              <div className="overflow-x-auto border rounded-xl shadow-2xs">
                <Table>
                  <TableHeader className="bg-rose-50/50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-foreground py-3">Instrument ID</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-foreground py-3">Instrument Name</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-foreground py-3">Location / Dept</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-foreground py-3">Next Due Date</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-foreground py-3">Status</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-foreground py-3 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOverdueInstruments.map((inst) => (
                      <TableRow key={inst.id} className="hover:bg-rose-50/30 dark:hover:bg-rose-950/10 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-primary">{inst.id_code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{inst.name}</p>
                            <p className="text-[10px] text-muted-foreground">{inst.item_type || inst.module || "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inst.location || "-"}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {fmtDate(inst.due_date || inst.next_due_date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                            Overdue
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => navigate(`/calibration/new/${inst.id}`)}
                            className="gap-1.5 h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            Start Calibration
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 flex flex-col items-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                <p className="text-base font-bold text-foreground">No Overdue Instruments!</p>
                <p className="text-xs text-muted-foreground">All instruments are up to date with their calibration schedule.</p>
              </div>
            )}
          </TabsContent>

          {/* DRAFTS TAB */}
          <TabsContent value="drafts" className="mt-4">
            {drafts.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Instrument</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Last Saved</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drafts.map((draft) => {
                      let parsedData = draft.data;
                      if (typeof parsedData === "string") {
                        try { parsedData = JSON.parse(parsedData); } catch (e) {}
                      }
                      const inst = parsedData?.selectedInstrument;
                      const typeLabel = parsedData?.selectedType?.label || "-";
                      
                      return (
                        <TableRow key={draft.id}>
                          <TableCell>
                            <div>
                              <p className="text-xs font-medium">{inst?.name || "Unknown Instrument"}</p>
                              <p className="text-[10px] text-muted-foreground">{inst?.id_code || ""}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {typeLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {draft.updated_at ? format(new Date(draft.updated_at), "dd-MMM-yyyy hh:mm a") : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="default" 
                                size="sm" 
                                className="h-7 text-xs px-3"
                                onClick={() => navigate(`/calibration/new?draftId=${draft.id}`)}
                              >
                                Resume
                              </Button>
                              {canAccess("calibrations", "delete") && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => handleDeleteDraft(draft.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 flex flex-col items-center">
                <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-sm">No pending drafts</p>
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Card>
      </Tabs>

      {/* Audit Trail Dialog */}
      <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <History className="w-5 h-5 text-primary" />
              Audit Trail — Certificate: {selectedCertNo}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete modification history showing who edited the calibration, when it was edited, and what values were changed.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {loadingAudit ? (
              <div className="space-y-3 py-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : auditLogs.length > 0 ? (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 border rounded-xl bg-card space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          Edited by {log.edited_by_name || log.edited_by?.name || "User"}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {log.edited_at ? format(new Date(log.edited_at), "dd-MMM-yyyy hh:mm a") : "-"}
                      </span>
                    </div>

                    {log.changes_summary && log.changes_summary.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        <p className="font-semibold text-[11px] text-muted-foreground">Changes Made:</p>
                        <div className="rounded-lg overflow-hidden border">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="bg-muted/60">
                                <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Field</th>
                                <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Previous Value</th>
                                <th className="text-center px-1 py-1.5 w-6"></th>
                                <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">Updated Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {log.changes_summary.map((change, idx) => (
                                <tr key={idx} className="border-t border-muted/40 hover:bg-muted/20 transition-colors">
                                  <td className="px-3 py-2 font-semibold text-primary whitespace-nowrap">{getAuditFieldLabel(change.field)}</td>
                                  <td className="px-3 py-2 text-red-500/80 max-w-[200px]">
                                    <span className="line-through">{formatAuditValue(change.field, change.oldValue)}</span>
                                  </td>
                                  <td className="px-1 py-2 text-center text-muted-foreground">→</td>
                                  <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold max-w-[200px]">
                                    {formatAuditValue(change.field, change.newValue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-[11px]">Calibration saved with updated parameters.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-xs">
                <History className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                No edit history found for this calibration record.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Calibration Record
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Are you sure you want to permanently delete calibration record{" "}
              <strong className="font-mono text-foreground">{calibrationToDelete?.certificate_number || calibrationToDelete?.id}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={deleting} className="gap-1.5">
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Delete Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Overdue Instruments Dialog Modal */}
      <Dialog open={overdueModalOpen} onOpenChange={setOverdueModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden z-[10000]">
          <DialogHeader className="p-4 border-b bg-rose-50/70 dark:bg-rose-950/40">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg font-bold text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  Overdue Calibrations List ({activeOverdueCount})
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                  Select any overdue instrument below and click <strong>Start Calibration</strong> to perform calibration.
                </DialogDescription>
              </div>
              <Badge variant="destructive" className="text-xs px-2.5 py-1 font-bold">
                {activeOverdueCount} Overdue
              </Badge>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={overdueSearchQuery}
                  onChange={(e) => setOverdueSearchQuery(e.target.value)}
                  placeholder="Filter by instrument code, name, or location..."
                  className="pl-8 text-xs bg-background h-9"
                />
              </div>
              <Select value={overdueScope} onValueChange={(val: any) => setOverdueScope(val)}>
                <SelectTrigger className="w-[190px] h-9 text-xs font-medium bg-background border-rose-200">
                  <SelectValue placeholder="Period Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">Active Period (This Month)</SelectItem>
                  <SelectItem value="all_time">All Time (Total History)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredOverdueInstruments.length > 0 ? (
              <div className="overflow-x-auto border rounded-xl shadow-2xs">
                <Table>
                  <TableHeader className="bg-muted/70">
                    <TableRow>
                      <TableHead className="font-bold text-xs uppercase text-foreground py-2.5">Code / ID</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-foreground py-2.5">Instrument</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-foreground py-2.5">Location / Dept</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-foreground py-2.5">Next Due</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-foreground py-2.5 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOverdueInstruments.map((inst) => (
                      <TableRow key={inst.id} className="hover:bg-rose-50/20 dark:hover:bg-rose-950/10 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-primary">{inst.id_code}</TableCell>
                        <TableCell>
                          <p className="text-xs font-semibold text-foreground">{inst.name}</p>
                          <p className="text-[10px] text-muted-foreground">{inst.item_type || inst.module || "-"}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inst.location || "-"}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {fmtDate(inst.due_date || inst.next_due_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setOverdueModalOpen(false);
                              navigate(`/calibration/new/${inst.id}`);
                            }}
                            className="gap-1.5 h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            Start Calibration
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                No matching overdue instruments found.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Certificates Modal */}
      <Dialog open={pendingCertsModalOpen} onOpenChange={setPendingCertsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 z-[10000]">
          <DialogHeader className="p-4 border-b bg-amber-500/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    Pending Certificates
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-mono text-xs">
                      {pendingCertsList.length} Pending
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Calibrations completed but official certificates not yet generated. Click Generate Certificate to produce official PDF.
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Modal Filter Bar */}
            <div className="pt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={pendingSearchQuery}
                  onChange={(e) => setPendingSearchQuery(e.target.value)}
                  placeholder="Search cert no, instrument, ID code..."
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingPendingList ? (
              <div className="space-y-2 py-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredPendingCerts.length > 0 ? (
              <div className="overflow-x-auto border rounded-xl shadow-2xs">
                <Table>
                  <TableHeader className="bg-muted/70">
                    <TableRow>
                      <TableHead className="font-bold text-xs uppercase text-foreground py-2.5">Cert No</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-foreground py-2.5">Instrument</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-foreground py-2.5">Type</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-foreground py-2.5">Date</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-foreground py-2.5">Verdict</TableHead>
                      <TableHead className="font-bold text-xs uppercase text-foreground py-2.5 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPendingCerts.map((cal) => (
                      <TableRow key={cal.id} className="hover:bg-amber-50/20 dark:hover:bg-amber-950/10 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-primary">{cal.certificate_number || cal.id}</TableCell>
                        <TableCell>
                          <p className="text-xs font-semibold text-foreground">{cal.instrument?.name || "-"}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{cal.instrument?.id_code || "-"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize font-semibold border-primary/20 bg-primary/5 text-primary">
                            {cal.calibration_type || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap font-medium text-muted-foreground">
                          {fmtDate(cal.calibration_date)}
                        </TableCell>
                        <TableCell><VerdictBadge verdict={cal.verdict} size="sm" /></TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleGenerateCertificate(cal)}
                            disabled={generatingId === cal.id}
                            className="gap-1.5 h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm"
                          >
                            {generatingId === cal.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileText className="w-3.5 h-3.5" />
                            )}
                            Generate Certificate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                No pending certificates found. All completed calibrations have certificates!
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
