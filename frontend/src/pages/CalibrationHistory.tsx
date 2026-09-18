import { useState, useEffect, useMemo } from "react";
import { getAuditFieldLabel, formatAuditValue } from "@/lib/auditFormatters";
import { useParams, useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, FileText, Calendar, User, Edit, History, Eye, Trash2, Printer, Clock } from "lucide-react";
import { getCalibrationHistory, downloadCertificate, getCalibrationAuditLogs, deleteCalibration } from "@/lib/calibrationActions";
import { getInstrument } from "@/lib/instrumentActions";
import { CalibrationRecord, CalibrationAuditLog } from "@/types/calibration";
import { Instrument } from "@/types/instrument";
import { VerdictBadge } from "@/components/calibration/VerdictBadge";
import { CertificatePreview } from "@/components/calibration/CertificatePreview";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const CalibrationPointsDiff = ({ oldPoints, newPoints }: { oldPoints: any[], newPoints: any[] }) => {
  if (!oldPoints || !newPoints || !Array.isArray(oldPoints) || !Array.isArray(newPoints)) {
    return <span className="text-muted-foreground italic">Data format changed</span>;
  }

  const changes = [];
  const maxLen = Math.max(oldPoints.length, newPoints.length);

  for (let i = 0; i < maxLen; i++) {
    const oldP = oldPoints[i];
    const newP = newPoints[i];
    
    if (!oldP && newP) {
      changes.push(<div key={i} className="text-emerald-600 mb-1 font-mono">Added Point {i + 1}: Nominal {newP.nominal}, Actual {newP.ascending_reading}</div>);
    } else if (oldP && !newP) {
      changes.push(<div key={i} className="text-red-500 line-through mb-1 font-mono">Removed Point {i + 1}: Nominal {oldP.nominal}</div>);
    } else if (oldP && newP) {
      const diffs = [];
      if (oldP.nominal !== newP.nominal) diffs.push(`Nominal: ${oldP.nominal} → ${newP.nominal}`);
      if (oldP.ascending_reading !== newP.ascending_reading) diffs.push(`Actual: ${oldP.ascending_reading} → ${newP.ascending_reading}`);
      if (oldP.descending_reading !== newP.descending_reading) diffs.push(`Desc: ${oldP.descending_reading} → ${newP.descending_reading}`);
      if (oldP.error !== newP.error) diffs.push(`Error: ${oldP.error} → ${newP.error}`);
      if (oldP.status !== newP.status) diffs.push(`Status: ${oldP.status} → ${newP.status}`);

      if (diffs.length > 0) {
        changes.push(
          <div key={i} className="text-[10px] mb-1.5 p-1.5 bg-slate-50 border rounded font-mono">
            <span className="font-bold text-slate-700">Point {newP.point_number || i + 1}</span>: {diffs.join(", ")}
          </div>
        );
      }
    }
  }

  if (changes.length === 0) return <span className="text-muted-foreground italic">No values changed in points</span>;

  return <div className="space-y-1 mt-1">{changes}</div>;
};

export default function CalibrationHistory() {
  useSEO({ title: "Calibration History — GaugeMaster", description: "View calibration history" });
  const { id } = useParams(); // This is the instrument ID
  const navigate = useNavigate();

  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [history, setHistory] = useState<CalibrationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Audit Log state
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedCertNo, setSelectedCertNo] = useState("");
  const [auditLogs, setAuditLogs] = useState<CalibrationAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // View Certificate state
  const [viewCertModalOpen, setViewCertModalOpen] = useState(false);
  const [selectedViewCalibration, setSelectedViewCalibration] = useState<CalibrationRecord | null>(null);

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedDeleteCalibration, setSelectedDeleteCalibration] = useState<CalibrationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleOpenAuditLogs = async (cal: CalibrationRecord) => {
    setSelectedCertNo(cal.certificate_number || cal.id);
    setAuditModalOpen(true);
    setLoadingAudit(true);
    try {
      const logs = await getCalibrationAuditLogs(cal.id);
      setAuditLogs(logs || []);
    } catch {
      toast.error("Failed to load audit trail");
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleDeleteCalibration = async () => {
    if (!selectedDeleteCalibration || !id) return;
    setDeleting(true);
    try {
      await deleteCalibration(selectedDeleteCalibration.id);
      toast.success("Calibration record deleted and instrument dates rolled back");
      setDeleteModalOpen(false);
      setSelectedDeleteCalibration(null);
      const [inst, hist] = await Promise.all([getInstrument(id), getCalibrationHistory(id)]);
      setInstrument(inst);
      setHistory(hist);
    } catch (err: any) {
      toast.error("Failed to delete calibration record");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getInstrument(id),
      getCalibrationHistory(id),
    ])
      .then(([inst, hist]) => {
        setInstrument(inst);
        setHistory(hist);
      })
      .catch(() => toast.error("Failed to load calibration history"))
      .finally(() => setLoading(false));
  }, [id]);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sorted history: Most recent calibrations at top
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      const timeA = new Date(a.calibration_date || a.created_at || 0).getTime();
      const timeB = new Date(b.calibration_date || b.created_at || 0).getTime();
      if (timeA !== timeB) return timeB - timeA;
      const createA = new Date(a.created_at || 0).getTime();
      const createB = new Date(b.created_at || 0).getTime();
      return createB - createA;
    });
  }, [history]);

  // Paginated history
  const paginatedHistory = useMemo(() => {
    return sortedHistory.slice((page - 1) * pageSize, page * pageSize);
  }, [sortedHistory, page, pageSize]);

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try {
      return format(new Date(d), "dd-MMM-yyyy");
    } catch {
      return "-";
    }
  };

  const fmtDateWithTime = (dateStr?: string, createdAtStr?: string) => {
    if (!dateStr && !createdAtStr) return "-";
    try {
      const mainStr = dateStr || createdAtStr!;
      const d = new Date(mainStr);
      const datePart = format(d, "dd-MMM-yyyy");

      // Strip trailing 'Z' if timestamp was stored as local wall-clock time in DB
      const timeSourceStr = (createdAtStr || dateStr || "").replace(/Z$/i, "");
      const timeObj = new Date(timeSourceStr);
      const timePart = format(timeObj, "hh:mm a");

      return `${datePart} (${timePart})`;
    } catch {
      return dateStr || "-";
    }
  };

  const handleDownload = async (cal: CalibrationRecord) => {
    try {
      const blob = await downloadCertificate(cal.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Certificate-${cal.certificate_number?.replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Certificate not available");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Calibration History</h1>
          {instrument && (
            <p className="text-sm text-muted-foreground">
              {instrument.name} ({instrument.id_code})
            </p>
          )}
        </div>
      </div>

      {/* Instrument Details */}
      {instrument && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-xs text-muted-foreground block">Name</span><span className="font-medium">{instrument.name}</span></div>
              <div><span className="text-xs text-muted-foreground block">ID Code</span><span className="font-medium">{instrument.id_code}</span></div>
              <div><span className="text-xs text-muted-foreground block">Make</span><span className="font-medium">{instrument.make || "-"}</span></div>
              <div><span className="text-xs text-muted-foreground block">Range</span><span className="font-medium">{instrument.range || "-"}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : sortedHistory.length > 0 ? (
        <>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-4">
              {paginatedHistory.map((cal, idx) => {
                const itemIndex = (page - 1) * pageSize + idx + 1;
                return (
                  <div key={cal.id} className="relative pl-14">
                    {/* Timeline dot */}
                    <div className={`absolute left-4 top-5 w-5 h-5 rounded-full border-2 border-background shadow-sm flex items-center justify-center ${
                      cal.verdict === "PASS" ? "bg-emerald-500" : cal.verdict === "FAIL" ? "bg-red-500" : "bg-amber-500"
                    }`}>
                      <span className="text-white text-[8px] font-bold">{itemIndex}</span>
                    </div>

                    <Card className="transition-all hover:shadow-md">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-bold text-primary">{cal.certificate_number}</span>
                              {itemIndex === 1 && (
                                <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 shadow-2xs">
                                  Recent / Latest
                                </Badge>
                              )}
                              <VerdictBadge verdict={cal.verdict} size="sm" />
                              {cal.ulr_number && (
                                <Badge variant="outline" className="text-[10px] font-mono">ULR: {cal.ulr_number}</Badge>
                              )}
                              <Badge variant="outline" className="text-[10px] capitalize">{cal.calibration_type}</Badge>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                {fmtDateWithTime(cal.calibration_date, cal.created_at)}
                              </span>
                              {cal.next_calibration_date && (
                                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                                  <Clock className="w-3.5 h-3.5" />
                                  Next Due: {fmtDate(cal.next_calibration_date)}
                                </span>
                              )}
                              {cal.calibrated_by && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3.5 h-3.5" />
                                  {cal.calibrated_by}
                                </span>
                              )}
                            </div>

                            {cal.uncertainty && (
                              <p className="text-xs"><b>Uncertainty:</b> {cal.uncertainty}</p>
                            )}
                            {cal.remarks && (
                              <p className="text-xs text-muted-foreground">{cal.remarks}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedViewCalibration(cal);
                                setViewCertModalOpen(true);
                              }}
                              className="gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-semibold"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/calibration/new?editId=${cal.id}`)}
                              className="gap-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-semibold"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAuditLogs(cal)}
                              className="gap-1 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                            >
                              <History className="w-3.5 h-3.5" />
                              Audit Log
                            </Button>
                            {cal.certificate_generated && (
                              <Button variant="outline" size="sm" onClick={() => handleDownload(cal)} className="gap-1 text-xs font-semibold">
                                <Download className="w-3.5 h-3.5" />
                                PDF
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedDeleteCalibration(cal);
                                setDeleteModalOpen(true);
                              }}
                              className="gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Enhanced Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t text-[13px]">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                Showing <strong>{sortedHistory.length === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to <strong>{Math.min(page * pageSize, sortedHistory.length)}</strong> of <strong>{sortedHistory.length}</strong> calibration records
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
              {Array.from({ length: Math.ceil(sortedHistory.length / pageSize) || 1 }).map((_, idx) => {
                const pNum = idx + 1;
                const totalPages = Math.ceil(sortedHistory.length / pageSize) || 1;
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
                disabled={page * pageSize >= sortedHistory.length}
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
          <p className="text-sm text-muted-foreground">No calibration history for this instrument</p>
          <Button onClick={() => navigate(`/calibration/new/${id}`)} className="mt-4 gap-2">
            Start First Calibration
          </Button>
        </div>
      )}

      {/* View Certificate Dialog */}
      <Dialog open={viewCertModalOpen} onOpenChange={setViewCertModalOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden bg-background text-foreground border shadow-2xl rounded-2xl">
          {/* Header */}
          <div className="p-4 sm:px-6 border-b bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                  Certificate Preview
                </h3>
                <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/20">
                  {selectedViewCalibration?.certificate_number}
                </Badge>
                {selectedViewCalibration?.verdict && (
                  <VerdictBadge verdict={selectedViewCalibration.verdict} size="sm" />
                )}
              </div>
              <p className="text-xs text-muted-foreground pl-8">
                Instrument: <span className="font-semibold text-foreground">{instrument?.name}</span> ({instrument?.id_code}) — Calibrated on {fmtDate(selectedViewCalibration?.calibration_date)}
              </p>
            </div>

            <div className="flex items-center gap-2 pr-10 shrink-0">
              <Button
                variant="default"
                size="sm"
                onClick={() => selectedViewCalibration && handleDownload(selectedViewCalibration)}
                className="gap-1.5 text-xs font-semibold shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF Certificate
              </Button>
            </div>
          </div>

          {/* Certificate Content Container with explicit max height for scroll */}
          <div className="w-full flex-1 max-h-[calc(90vh-80px)] overflow-y-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-950 flex justify-center">
            {selectedViewCalibration && (
              <CertificatePreview
                calibration={selectedViewCalibration}
                instrumentName={instrument?.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Delete Calibration Record?
            </DialogTitle>
            <DialogDescription className="text-sm pt-2 space-y-2">
              <span>
                Are you sure you want to delete calibration record <span className="font-bold text-foreground">{selectedDeleteCalibration?.certificate_number}</span>?
              </span>
              <span className="block text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                ⚠️ <b>Automatic Rollback:</b> Deleting this calibration history record will not delete the instrument master, but if this was the latest calibration, the instrument's last calibration date and due date will automatically roll back to the previous calibration record.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteCalibration} disabled={deleting}>
              {deleting ? "Deleting..." : "Confirm Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                              {log.changes_summary.map((change, idx) => {
                                if (change.field === "calibration_points") {
                                  return (
                                    <tr key={idx} className="border-t border-muted/40 hover:bg-muted/20 transition-colors">
                                      <td className="px-3 py-2 font-semibold text-primary align-top pt-3 whitespace-nowrap">{getAuditFieldLabel(change.field)}</td>
                                      <td colSpan={3} className="px-3 py-2">
                                        <CalibrationPointsDiff oldPoints={change.oldValue} newPoints={change.newValue} />
                                      </td>
                                    </tr>
                                  );
                                }
                                return (
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
                                );
                              })}
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
    </div>
  );
}
