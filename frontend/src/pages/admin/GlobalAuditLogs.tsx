import React, { useEffect, useState } from "react";
import { listCompanies, CompanyListItem } from "@/lib/superAdminActions";
import { AuditLogsTable } from "@/components/admin/AuditLogsTable";
import { Building2, Activity } from "lucide-react";
import { toast } from "sonner";

const GlobalAuditLogs: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const data = await listCompanies();
      setCompanies(data);
    } catch (err: any) {
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* ── Main Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Platform Activity & Audit Logs
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 max-w-xl">
            Centralized enterprise security auditing, mutation tracking, and compliance event stream across all customer environments.
          </p>
        </div>
        
        {/* Company Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 shadow-inner min-w-[320px]">
            <Building2 className="h-4 w-4 text-slate-400 ml-1 shrink-0" />
            <select
              className="w-full bg-transparent border-none text-xs font-semibold focus:ring-0 text-slate-800 py-0.5 cursor-pointer"
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              disabled={loading}
            >
              <option value="" disabled>Select a customer company...</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.companyName} ({company.industry || "General"})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Selected Company Mini-Stats Bar */}
      {selectedCompany && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400">Environment</p>
              <p className="text-sm font-bold text-slate-800 truncate">{selectedCompany.companyName}</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              {selectedCompany.industry || "Corporate"}
            </span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400">Registered Users</p>
              <p className="text-sm font-bold text-slate-800">{selectedCompany.userCount || 0} active</p>
            </div>
            <span className="text-xs text-slate-400">👥</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400">Total Instruments</p>
              <p className="text-sm font-bold text-slate-800">{selectedCompany.instrumentCount || 0} gauges</p>
            </div>
            <span className="text-xs text-slate-400">📏</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400">Access Status</p>
              <p className="text-sm font-bold capitalize text-slate-800">{selectedCompany.accessStatus || "Active"}</p>
            </div>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-solid border-blue-600 border-r-transparent mb-3" />
          <p className="text-sm text-slate-600 font-medium">Connecting to audit stream...</p>
        </div>
      ) : selectedCompanyId ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
          <AuditLogsTable companyId={selectedCompanyId} />
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-xl py-24 px-6 text-center shadow-xs">
          <div className="mx-auto h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 border border-blue-100 shadow-inner">
            <Building2 className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Select Customer Environment</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Choose a customer company from the selector above to load their real-time activity and compliance audit logs.
          </p>
        </div>
      )}
    </div>
  );
};

export default GlobalAuditLogs;
