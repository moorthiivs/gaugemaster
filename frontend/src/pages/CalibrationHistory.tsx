import { useState, useEffect } from "react";
import { getAuditFieldLabel, formatAuditValue } from "@/lib/auditFormatters";
import { useParams, useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Calendar, User, Edit, History } from "lucide-react";
import { getCalibrationHistory, downloadCertificate, getCalibrationAuditLogs } from "@/lib/calibrationActions";
import { getInstrument } from "@/lib/instrumentActions";
import { CalibrationRecord, CalibrationAuditLog } from "@/types/calibration";
import { Instrument } from "@/types/instrument";
import { VerdictBadge } from "@/components/calibration/VerdictBadge";
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

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    try {
      return format(new Date(d), "dd-MMM-yyyy");
    } catch {
      return "-";
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
    <div className="max-w-[1600px] mx-auto py-6 px-4 space-y-6">
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
      ) : history.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-4">
            {history.map((cal, idx) => (
              <div key={cal.id} className="relative pl-14">
                {/* Timeline dot */}
                <div className={`absolute left-4 top-5 w-5 h-5 rounded-full border-2 border-background shadow-sm flex items-center justify-center ${
                  cal.verdict === "PASS" ? "bg-emerald-500" : cal.verdict === "FAIL" ? "bg-red-500" : "bg-amber-500"
                }`}>
                  <span className="text-white text-[8px] font-bold">{idx + 1}</span>
                </div>

                <Card className="transition-all hover:shadow-md">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-primary">{cal.certificate_number}</span>
                          <VerdictBadge verdict={cal.verdict} size="sm" />
                          {cal.ulr_number && (
                            <Badge variant="outline" className="text-[10px]">ULR: {cal.ulr_number}</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] capitalize">{cal.calibration_type}</Badge>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fmtDate(cal.calibration_date)}
                          </span>
                          {cal.next_calibration_date && (
                            <span>Next Due: {fmtDate(cal.next_calibration_date)}</span>
                          )}
                          {cal.calibrated_by && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
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
                          onClick={() => navigate(`/calibration/new?editId=${cal.id}`)}
                          className="gap-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAuditLogs(cal)}
                          className="gap-1 text-xs text-slate-600 hover:text-slate-900"
                        >
                          <History className="w-3 h-3" />
                          Audit Log
                        </Button>
                        {cal.certificate_generated && (
                          <Button variant="outline" size="sm" onClick={() => handleDownload(cal)} className="gap-1 text-xs">
                            <Download className="w-3 h-3" />
                            PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No calibration history for this instrument</p>
          <Button onClick={() => navigate(`/calibration/new/${id}`)} className="mt-4 gap-2">
            Start First Calibration
          </Button>
        </div>
      )}

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
