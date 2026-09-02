import React, { useEffect, useState, useMemo } from "react";
import { getAuditLogs, AuditLog } from "@/lib/superAdminActions";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { 
  Clock, 
  Eye, 
  Search, 
  Filter, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  Shield, 
  User as UserIcon, 
  Activity, 
  Copy, 
  Check, 
  Terminal, 
  Layers,
  Cpu,
  Globe,
  SlidersHorizontal
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TZ = "Asia/Kolkata";

interface AuditLogsTableProps {
  companyId: string;
}

export const AuditLogsTable: React.FC<AuditLogsTableProps> = ({ companyId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>(dayjs().tz(IST_TZ).format("YYYY-MM-DD"));
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Inspection modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    fetchLogs();
  }, [companyId]);

  const fetchLogs = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const data = await getAuditLogs(companyId, { limit: 300 });
      setLogs(data);
      setError(null);
      if (isManualRefresh) toast.success("Audit logs refreshed");
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
      toast.error("Error loading audit logs");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const copyJson = () => {
    if (!selectedLog) return;
    navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Log JSON copied to clipboard");
  };

  // Filtered logs computation
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Date filter
      if (dateFilter) {
        const logDate = dayjs(log.createdAt).tz(IST_TZ).format("YYYY-MM-DD");
        if (logDate !== dateFilter) return false;
      }

      // Status filter
      if (statusFilter !== "ALL") {
        if (log.status !== statusFilter) return false;
      }

      // Category filter
      if (categoryFilter !== "ALL") {
        const type = log.resourceType || "Other";
        if (categoryFilter === "AUTH" && type !== "Authentication") return false;
        if (categoryFilter === "CALIBRATION" && type !== "Calibration" && type !== "Certificate") return false;
        if (categoryFilter === "INSTRUMENT" && type !== "Instrument") return false;
        if (categoryFilter === "TEMPLATE" && type !== "Template") return false;
        if (categoryFilter === "USER_ROLE" && type !== "User" && type !== "Role") return false;
        if (categoryFilter === "SYSTEM" && type !== "Settings" && type !== "Company" && type !== "Backup") return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const userName = log.user?.name?.toLowerCase() || "";
        const userEmail = log.user?.email?.toLowerCase() || "";
        const action = log.action.toLowerCase();
        const resource = log.resource.toLowerCase();
        const description = (log.description || "").toLowerCase();
        const ip = (log.ipAddress || "").toLowerCase();

        return (
          userName.includes(query) ||
          userEmail.includes(query) ||
          action.includes(query) ||
          resource.includes(query) ||
          description.includes(query) ||
          ip.includes(query)
        );
      }

      return true;
    });
  }, [logs, dateFilter, statusFilter, categoryFilter, searchQuery]);

  const getActionBadge = (action: string, status: string) => {
    if (status === "FAILED") {
      return "bg-rose-100 text-rose-800 border-rose-200";
    }
    if (action.includes("APPROVE") || action === "LOGIN") {
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
    if (action.includes("REJECT") || action.includes("DELETE") || action === "LOGOUT") {
      return "bg-red-100 text-red-800 border-red-200";
    }
    if (action.includes("CREATE") || action.includes("GENERATE") || action.includes("IMPORT") || action.includes("EXPORT")) {
      return "bg-blue-100 text-blue-800 border-blue-200";
    }
    if (action.includes("UPDATE") || action.includes("EDIT") || action.includes("SAVE")) {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  const getCategoryBadge = (resourceType?: string) => {
    switch (resourceType) {
      case "Calibration":
      case "Certificate":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "Instrument":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "Template":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Authentication":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "User":
      case "Role":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Backup":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      {/* ── Top Header Toolbar ── */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Activity & Audit Trail</h3>
              <p className="text-xs text-slate-500">Real-time enterprise event stream and mutation logs</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs(true)}
              disabled={refreshing || loading}
              className="h-9 gap-1.5 text-xs text-slate-700 border-slate-200 shadow-sm hover:bg-white"
            >
              <RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Filters Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search user, action, IP, resource..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            >
              <option value="ALL">All Event Categories</option>
              <option value="CALIBRATION">Calibration & Certs</option>
              <option value="INSTRUMENT">Instruments & Gauges</option>
              <option value="TEMPLATE">Calibration Templates</option>
              <option value="AUTH">Authentication & Sessions</option>
              <option value="USER_ROLE">Users & Permissions</option>
              <option value="SYSTEM">System, Settings & Backups</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            >
              <option value="ALL">All Statuses (Success & Failed)</option>
              <option value="SUCCESS">Success Only (2xx)</option>
              <option value="FAILED">Failed Only (4xx / 5xx)</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium px-1.5"
                title="Clear date filter"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
        <table className="min-w-full divide-y divide-slate-100 text-left">
          <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Action / Event
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Description & Target
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Payload
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400 text-sm">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent mb-2" />
                  <p>Loading audit stream...</p>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-rose-500 text-sm font-medium">
                  {error}
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="mx-auto h-12 w-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-3">
                    <SlidersHorizontal className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">No audit events match your filter</p>
                  <p className="text-xs text-slate-400 mt-1">Try clearing filters or selecting another date</p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isSuccess = log.status !== "FAILED";
                const userRole = typeof log.user?.role === "object" ? log.user.role?.name : log.user?.role;

                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Timestamp */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-900">
                        {dayjs(log.createdAt).tz(IST_TZ).format("DD MMM YYYY")}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {dayjs(log.createdAt).tz(IST_TZ).format("hh:mm:ss A")}
                      </div>
                      {log.durationMs !== undefined && log.durationMs !== null && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ⚡ {log.durationMs}ms
                        </div>
                      )}
                    </td>

                    {/* User */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase border border-slate-200">
                          {log.user?.name ? log.user.name.charAt(0) : <UserIcon className="h-4 w-4 text-slate-400" />}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                            {log.user?.name || "System / Unauthenticated"}
                            {userRole && (
                              <span className="text-[10px] font-medium px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                {userRole}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {log.user?.email || (log.userId ? `ID: ${log.userId.substring(0, 8)}...` : "Public / Internal")}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Action / Event */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 inline-flex text-[11px] font-semibold rounded-md border tracking-wide ${getActionBadge(
                          log.action,
                          log.status
                        )}`}
                      >
                        {log.action}
                      </span>
                      {log.method && (
                        <span className="ml-1.5 text-[10px] font-mono text-slate-400 font-medium">
                          {log.method}
                        </span>
                      )}
                    </td>

                    {/* Description & Target */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {log.resourceType && (
                          <span
                            className={`px-2 py-0.5 text-[10px] font-medium rounded border ${getCategoryBadge(
                              log.resourceType
                            )}`}
                          >
                            {log.resourceType}
                          </span>
                        )}
                        <span className="text-xs font-medium text-slate-800">
                          {log.description || log.resource}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1 truncate max-w-[280px]">
                        {log.resource}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            {log.statusCode || 200} OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="h-3 w-3 text-rose-500" />
                            {log.statusCode || 500} Failed
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Payload Details View */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="h-8 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50/50 gap-1 rounded-md"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Azure-Style JSON & Context Inspector Dialog ── */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
          {selectedLog && (
            <>
              {/* Header */}
              <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
                      Event Details: {selectedLog.action}
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded font-mono ${
                          selectedLog.status !== "FAILED"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {selectedLog.statusCode || 200} {selectedLog.status}
                      </span>
                    </DialogTitle>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Event ID: {selectedLog.id}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyJson}
                  className="h-8 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 gap-1.5"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy JSON"}
                </Button>
              </div>

              {/* Quick Info Grid */}
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 border-b border-slate-800 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500 flex items-center gap-1 mb-1">
                    <UserIcon className="h-3 w-3" /> Caller User
                  </div>
                  <div className="font-semibold text-slate-200 truncate">
                    {selectedLog.user?.name || "System"}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {selectedLog.user?.email || selectedLog.userId || "N/A"}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500 flex items-center gap-1 mb-1">
                    <Globe className="h-3 w-3" /> Client IP
                  </div>
                  <div className="font-mono text-slate-200 truncate">
                    {selectedLog.ipAddress || "127.0.0.1"}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {selectedLog.durationMs ? `${selectedLog.durationMs}ms latency` : "Direct"}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500 flex items-center gap-1 mb-1">
                    <Layers className="h-3 w-3" /> Resource Type
                  </div>
                  <div className="font-semibold text-slate-200">
                    {selectedLog.resourceType || "Generic"}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {selectedLog.method || "MUTATION"}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500 flex items-center gap-1 mb-1">
                    <Clock className="h-3 w-3" /> Recorded Time (IST)
                  </div>
                  <div className="font-mono text-slate-200 text-[11px]">
                    {dayjs(selectedLog.createdAt).tz(IST_TZ).format("DD MMM YYYY, hh:mm:ss A")}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">IST (Chennai / Kolkata)</div>
                </div>
              </div>

              {/* JSON Pre Inspector */}
              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-emerald-400 bg-slate-950 select-text">
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(
                    {
                      id: selectedLog.id,
                      timestamp: selectedLog.createdAt,
                      action: selectedLog.action,
                      status: selectedLog.status,
                      statusCode: selectedLog.statusCode,
                      description: selectedLog.description,
                      resourceType: selectedLog.resourceType,
                      resource: selectedLog.resource,
                      method: selectedLog.method,
                      clientIp: selectedLog.ipAddress,
                      durationMs: selectedLog.durationMs,
                      caller: {
                        userId: selectedLog.userId,
                        name: selectedLog.user?.name,
                        email: selectedLog.user?.email,
                        role: selectedLog.user?.role,
                        companyId: selectedLog.companyId,
                      },
                      details: selectedLog.details,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

