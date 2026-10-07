import { useState, useEffect, useMemo } from "react";
import { getAuditFieldLabel, formatAuditValue } from "@/lib/auditFormatters";
import { useParams, useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Download,
  FileText,
  Calendar,
  User,
  Edit,
  History,
  Eye,
  Trash2,
  Printer,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  getCalibrationHistory,
  downloadCertificate,
  getCalibrationAuditLogs,
  deleteCalibration,
  getResequencePreview,
  ResequencePreviewData,
} from "@/lib/calibrationActions";
import { getInstrument } from "@/lib/instrumentActions";
import { CalibrationRecord, CalibrationAuditLog } from "@/types/calibration";
import { Instrument } from "@/types/instrument";
import { VerdictBadge } from "@/components/calibration/VerdictBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CertificatePreview } from "@/components/calibration/CertificatePreview";
import { PageHeader } from "@/components/common/PageHeader";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CalibrationPointsDiff = ({
  oldPoints,
  newPoints,
}: {
  oldPoints?: any;
  newPoints?: any;
}) => {
  if (
    !oldPoints ||
    !newPoints ||
    !Array.isArray(oldPoints) ||
    !Array.isArray(newPoints)
  ) {
    return (
      <span className="text-muted-foreground italic">Data format changed</span>
    );
  }

  const changes = [];
  const maxLen = Math.max(oldPoints.length, newPoints.length);

  for (let i = 0; i < maxLen; i++) {
    const oldP = oldPoints[i];
    const newP = newPoints[i];

    if (!oldP && newP) {
      changes.push(
        <div key={i} className="text-emerald-600 mb-1 font-mono">
          Added Point {i + 1}: Nominal {newP.nominal}, Actual{" "}
          {newP.ascending_reading}
        </div>,
      );
    } else if (oldP && !newP) {
      changes.push(
        <div key={i} className="text-red-500 line-through mb-1 font-mono">
          Removed Point {i + 1}: Nominal {oldP.nominal}
        </div>,
      );
    } else if (oldP && newP) {
      const diffs = [];
      if (oldP.nominal !== newP.nominal)
        diffs.push(`Nominal: ${oldP.nominal} → ${newP.nominal}`);
      if (oldP.ascending_reading !== newP.ascending_reading)
        diffs.push(
          `Actual: ${oldP.ascending_reading} → ${newP.ascending_reading}`,
        );
      if (oldP.descending_reading !== newP.descending_reading)
        diffs.push(
          `Desc: ${oldP.descending_reading} → ${newP.descending_reading}`,
        );
      if (oldP.error !== newP.error)
        diffs.push(`Error: ${oldP.error} → ${newP.error}`);
      if (oldP.status !== newP.status)
        diffs.push(`Status: ${oldP.status} → ${newP.status}`);

      if (diffs.length > 0) {
        changes.push(
          <div
            key={i}
            className="text-[10px] mb-1.5 p-1.5 bg-slate-50 border rounded font-mono"
          >
            <span className="font-bold text-slate-700">
              Point {newP.point_number || i + 1}
            </span>
            : {diffs.join(", ")}
          </div>,
        );
      }
    }
  }

  if (changes.length === 0)
    return (
      <span className="text-muted-foreground italic">
        No values changed in points
      </span>
    );

  return <div className="space-y-1 mt-1">{changes}</div>;
};

export default function CalibrationHistory() {
  useSEO({
    title: "Calibration History — GaugeMaster",
    description: "View calibration history",
  });
  const { id } = useParams(); // This is the instrument ID
  const navigate = useNavigate();
  const { canAccess } = usePermissions();

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
  const [selectedViewCalibration, setSelectedViewCalibration] =
    useState<CalibrationRecord | null>(null);

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedDeleteCalibration, setSelectedDeleteCalibration] =
    useState<CalibrationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resequenceChoice, setResequenceChoice] = useState<
    "resequence" | "keep"
  >("resequence");
  const [resequencePreview, setResequencePreview] =
    useState<ResequencePreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleOpenDeleteModal = async (cal: CalibrationRecord) => {
    setSelectedDeleteCalibration(cal);
    setResequenceChoice("resequence");
    setResequencePreview(null);
    setDeleteModalOpen(true);
    setLoadingPreview(true);
    try {
      const data = await getResequencePreview(cal.id);
      setResequencePreview(data);
    } catch (err) {
      console.warn("Could not fetch resequence preview:", err);
      setResequencePreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

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
      const shouldResequence = resequenceChoice === "resequence";
      await deleteCalibration(selectedDeleteCalibration.id, shouldResequence);
      const affectedCount =
        resequencePreview?.affectedCalibrations?.length || 0;
      if (shouldResequence && affectedCount > 0) {
        toast.success(
          `Calibration ${selectedDeleteCalibration.certificate_number || ""} deleted & ${affectedCount} subsequent certificates renumbered.`,
        );
      } else {
        toast.success(
          "Calibration record deleted and instrument dates rolled back",
        );
      }
      setDeleteModalOpen(false);
      setSelectedDeleteCalibration(null);
      setResequencePreview(null);
      const [inst, hist] = await Promise.all([
        getInstrument(id),
        getCalibrationHistory(id),
      ]);
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
    Promise.all([getInstrument(id), getCalibrationHistory(id)])
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

  // Sorted history: Most recent calibrations at top (by database creation timestamp)
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      const createA = new Date(
        a.created_at || a.calibration_date || 0,
      ).getTime();
      const createB = new Date(
        b.created_at || b.calibration_date || 0,
      ).getTime();
      if (createA !== createB) return createB - createA;
      const timeA = new Date(a.calibration_date || 0).getTime();
      const timeB = new Date(b.calibration_date || 0).getTime();
      return timeB - timeA;
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

      // Format time in local timezone if createdAtStr exists
      if (createdAtStr) {
        const timePart = format(new Date(createdAtStr), "hh:mm a");
        return `${datePart} (${timePart})`;
      }

      // Fallback to just the date if no created_at timestamp exists
      return datePart;
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
      {/* Page Header */}
      <PageHeader
        title="Calibration History"
        description={
          instrument
            ? `${instrument.name} (${instrument.id_code})`
            : "View historical calibration audit trail and certificates"
        }
        breadcrumbs={[
          { label: "Instruments", href: "/instruments" },
          { label: "Calibration", href: "/calibration" },
          { label: "History" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </Button>
        }
      />

      {/* Instrument Details */}
      {instrument && (
        <Card className="rounded-xl border border-border bg-card shadow-2xs">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground block font-medium">
                  Name
                </span>
                <span className="font-semibold text-foreground">
                  {instrument.name}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block font-medium">
                  ID Code
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {instrument.id_code}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block font-medium">
                  Make
                </span>
                <span className="font-medium text-foreground">
                  {instrument.make || "—"}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block font-medium">
                  Range
                </span>
                <span className="font-medium text-foreground">
                  {instrument.range || "—"}
                </span>
              </div>
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
                    <div
                      className={`absolute left-4 top-5 w-5 h-5 rounded-full border-2 border-background shadow-sm flex items-center justify-center ${
                        cal.verdict === "PASS"
                          ? "bg-emerald-500"
                          : cal.verdict === "FAIL"
                            ? "bg-red-500"
                            : "bg-amber-500"
                      }`}
                    >
                      <span className="text-white text-[8px] font-bold">
                        {itemIndex}
                      </span>
                    </div>

                    <Card className="transition-all hover:shadow-md">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-bold text-primary">
                                {cal.certificate_number}
                              </span>
                              {itemIndex === 1 && (
                                <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 shadow-2xs">
                                  Recent / Latest
                                </Badge>
                              )}
                              <VerdictBadge verdict={cal.verdict} size="sm" />
                              {cal.approval_status === "Approved" ? (
                                <StatusBadge status="OK" size="xs" />
                              ) : cal.approval_status === "Reviewed" ||
                                cal.approval_status === "Pending Approval" ? (
                                <StatusBadge
                                  status="Under Calibration"
                                  subStatus="Approve Pending"
                                  size="xs"
                                />
                              ) : cal.approval_status === "Rejected" ? (
                                <StatusBadge status="REJECTED" size="xs" />
                              ) : (
                                <StatusBadge
                                  status="Under Calibration"
                                  subStatus="Review Pending"
                                  size="xs"
                                />
                              )}
                              {cal.ulr_number && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono"
                                >
                                  ULR: {cal.ulr_number}
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className="text-[10px] capitalize"
                              >
                                {cal.calibration_type}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                {fmtDateWithTime(
                                  cal.calibration_date,
                                  cal.created_at,
                                )}
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
                              <p className="text-xs">
                                <b>Uncertainty:</b> {cal.uncertainty}
                              </p>
                            )}
                            {cal.remarks && (
                              <p className="text-xs text-muted-foreground">
                                {cal.remarks}
                              </p>
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
                            {canAccess("calibrations", "edit") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  navigate(`/calibration/new?editId=${cal.id}`)
                                }
                                className="gap-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-semibold"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Edit
                              </Button>
                            )}
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(cal)}
                                className="gap-1 text-xs font-semibold"
                              >
                                <Download className="w-3.5 h-3.5" />
                                PDF
                              </Button>
                            )}
                            {canAccess("calibrations", "delete") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDeleteModal(cal)}
                                className="gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </Button>
                            )}
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
                Showing{" "}
                <strong>
                  {sortedHistory.length === 0 ? 0 : (page - 1) * pageSize + 1}
                </strong>{" "}
                to{" "}
                <strong>
                  {Math.min(page * pageSize, sortedHistory.length)}
                </strong>{" "}
                of <strong>{sortedHistory.length}</strong> calibration records
              </span>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-muted-foreground">Per page:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setPage(1);
                  }}
                >
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
              {Array.from({
                length: Math.ceil(sortedHistory.length / pageSize) || 1,
              }).map((_, idx) => {
                const pNum = idx + 1;
                const totalPages =
                  Math.ceil(sortedHistory.length / pageSize) || 1;
                if (
                  pNum === 1 ||
                  pNum === totalPages ||
                  Math.abs(pNum - page) <= 1
                ) {
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
                if (pNum === 2 && page > 3)
                  return (
                    <span
                      key="dots-left"
                      className="px-1 text-muted-foreground"
                    >
                      ...
                    </span>
                  );
                if (pNum === totalPages - 1 && page < totalPages - 2)
                  return (
                    <span
                      key="dots-right"
                      className="px-1 text-muted-foreground"
                    >
                      ...
                    </span>
                  );
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
          <p className="text-sm text-muted-foreground">
            No calibration history for this instrument
          </p>
          {canAccess("calibrations", "create") && (
            <Button
              onClick={() => navigate(`/calibration/new/${id}`)}
              className="mt-4 gap-2"
            >
              Start First Calibration
            </Button>
          )}
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
                <Badge
                  variant="outline"
                  className="font-mono text-xs bg-primary/10 text-primary border-primary/20"
                >
                  {selectedViewCalibration?.certificate_number}
                </Badge>
                {selectedViewCalibration?.verdict && (
                  <VerdictBadge
                    verdict={selectedViewCalibration.verdict}
                    size="sm"
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground pl-8">
                Instrument:{" "}
                <span className="font-semibold text-foreground">
                  {instrument?.name}
                </span>{" "}
                ({instrument?.id_code}) — Calibrated on{" "}
                {fmtDate(selectedViewCalibration?.calibration_date)}
              </p>
            </div>

            <div className="flex items-center gap-2 pr-10 shrink-0">
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  selectedViewCalibration &&
                  handleDownload(selectedViewCalibration)
                }
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

      {/* Smart Delete Confirmation Modal with Resequence Options & Preview */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-red-50/50 dark:bg-red-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-red-700 dark:text-red-400">
                  Delete Calibration Record
                </DialogTitle>
                <DialogDescription className="text-xs pt-0.5 text-muted-foreground">
                  Certificate:{" "}
                  <strong className="font-mono text-foreground font-bold">
                    {selectedDeleteCalibration?.certificate_number ||
                      selectedDeleteCalibration?.id}
                  </strong>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {loadingPreview ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs">
                  Analyzing certificate sequence and subsequent records...
                </p>
              </div>
            ) : resequencePreview &&
              resequencePreview.canResequence &&
              resequencePreview.affectedCalibrations.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    Sequence Reassignment Options
                  </p>
                  <p className="text-muted-foreground text-xs">
                    This calibration is followed by{" "}
                    <strong>
                      {resequencePreview.affectedCalibrations.length}
                    </strong>{" "}
                    subsequent certificate(s). Select how you would like to
                    handle downstream sequence numbers:
                  </p>
                </div>

                {/* Option Choice Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    onClick={() => setResequenceChoice("resequence")}
                    className={`cursor-pointer p-3 rounded-xl border-2 transition-all ${
                      resequenceChoice === "resequence"
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border hover:border-primary/40 bg-card"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="resequenceChoiceHistory"
                        checked={resequenceChoice === "resequence"}
                        onChange={() => setResequenceChoice("resequence")}
                        className="mt-0.5 cursor-pointer"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-foreground">
                            Reassign Sequence
                          </p>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold px-1.5 py-0"
                          >
                            Recommended
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-normal">
                          Shifts downstream certificate numbers back by 1 from
                          deleted record to end. Prevents sequence gaps.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setResequenceChoice("keep")}
                    className={`cursor-pointer p-3 rounded-xl border-2 transition-all ${
                      resequenceChoice === "keep"
                        ? "border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs"
                        : "border-border hover:border-amber-400/40 bg-card"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="resequenceChoiceHistory"
                        checked={resequenceChoice === "keep"}
                        onChange={() => setResequenceChoice("keep")}
                        className="mt-0.5 cursor-pointer"
                      />
                      <div className="space-y-1">
                        <p className="font-bold text-foreground">
                          Keep Existing Numbers
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-normal">
                          Leaves downstream certificates as-is. Creates an
                          intentional gap in the certificate number sequence.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Diff Table if resequence selected */}
                {resequenceChoice === "resequence" ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                        Sequence Number Shift Preview (
                        {resequencePreview.affectedCalibrations.length + 1}{" "}
                        Records)
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        Next Counter:{" "}
                        <strong className="text-foreground font-mono">
                          {resequencePreview.currentNextSeq}
                        </strong>{" "}
                        →{" "}
                        <strong className="text-primary font-mono">
                          {resequencePreview.newNextSeq}
                        </strong>
                      </span>
                    </div>

                    <div className="border rounded-xl overflow-hidden shadow-2xs">
                      <Table className="text-xs">
                        <TableHeader className="bg-muted/70">
                          <TableRow>
                            <TableHead className="py-2 font-bold text-foreground">
                              Instrument
                            </TableHead>
                            <TableHead className="py-2 font-bold text-foreground">
                              Current Cert No
                            </TableHead>
                            <TableHead className="py-2 w-6 text-center"></TableHead>
                            <TableHead className="py-2 font-bold text-foreground">
                              Updated Cert No
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Deleted Target Row */}
                          <TableRow className="bg-red-50/30 dark:bg-red-950/20 border-b">
                            <TableCell className="py-2 font-medium">
                              <div>
                                <p className="font-semibold text-foreground">
                                  {resequencePreview.targetCalibration
                                    .instrumentName ||
                                    instrument?.name ||
                                    "Selected Item"}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  {resequencePreview.targetCalibration.idCode ||
                                    instrument?.id_code ||
                                    ""}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="py-2 font-mono font-bold text-red-600">
                              {
                                resequencePreview.targetCalibration
                                  .certificate_number
                              }
                            </TableCell>
                            <TableCell className="py-2 text-center text-muted-foreground">
                              →
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge
                                variant="destructive"
                                className="text-[10px] font-bold"
                              >
                                DELETED (REMOVED)
                              </Badge>
                            </TableCell>
                          </TableRow>

                          {/* Downstream Affected Rows */}
                          {resequencePreview.affectedCalibrations.map(
                            (item) => (
                              <TableRow
                                key={item.id}
                                className="hover:bg-muted/30 transition-colors"
                              >
                                <TableCell className="py-2 font-medium">
                                  <div>
                                    <p className="font-semibold text-foreground">
                                      {item.instrumentName || "Instrument"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                      {item.idCode || ""}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 font-mono text-muted-foreground line-through">
                                  {item.oldCertificateNumber}
                                </TableCell>
                                <TableCell className="py-2 text-center text-muted-foreground font-bold">
                                  →
                                </TableCell>
                                <TableCell className="py-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300">
                                    {item.newCertificateNumber}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs">
                    <p className="font-semibold">Gap Notice:</p>
                    <p className="text-[11px] mt-0.5">
                      Subsequent records will retain current numbers (
                      {resequencePreview.affectedCalibrations
                        .map((c) => c.oldCertificateNumber)
                        .join(", ")}
                      ). The number{" "}
                      <strong>
                        {resequencePreview.targetCalibration.certificate_number}
                      </strong>{" "}
                      will be skipped permanently.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Are you sure you want to permanently delete calibration record{" "}
                  <strong className="font-mono text-foreground font-bold">
                    {selectedDeleteCalibration?.certificate_number ||
                      selectedDeleteCalibration?.id}
                  </strong>
                  ? This action cannot be undone.
                </p>
                {resequencePreview &&
                  resequencePreview.affectedCalibrations.length === 0 && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-1">
                      <p className="font-semibold text-primary">
                        Sequence Counter Adjustment
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        This is the latest issued certificate in the current
                        series. Deleting it will adjust the next sequence
                        counter from{" "}
                        <strong>{resequencePreview.currentNextSeq}</strong> to{" "}
                        <strong>{resequencePreview.newNextSeq}</strong>.
                      </p>
                    </div>
                  )}
              </div>
            )}

            {/* Instrument Master Rollback Notice */}
            <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-[11px] space-y-0.5">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Automatic Instrument History Rollback
              </p>
              <p className="text-muted-foreground text-[10px] leading-relaxed">
                If this calibration was the instrument's latest record, its last
                calibration date and due date in Instrument Master will roll
                back automatically to the prior calibration.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 border-t bg-muted/30">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteCalibration}
              disabled={deleting}
              className="gap-1.5 font-bold"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {resequencePreview &&
              resequencePreview.canResequence &&
              resequencePreview.affectedCalibrations.length > 0 &&
              resequenceChoice === "resequence"
                ? "Confirm & Reassign Sequence"
                : "Delete Record"}
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
              Complete modification history showing who edited the calibration,
              when it was edited, and what values were changed.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {loadingAudit ? (
              <div className="space-y-3 py-6">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-muted animate-pulse rounded-lg"
                  />
                ))}
              </div>
            ) : auditLogs.length > 0 ? (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 border rounded-xl bg-card space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          Edited by{" "}
                          {log.edited_by_name ||
                            (typeof log.edited_by === "object" &&
                            log.edited_by &&
                            "name" in log.edited_by
                              ? String((log.edited_by as any).name)
                              : typeof log.edited_by === "string"
                                ? log.edited_by
                                : "User")}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {log.edited_at
                          ? format(
                              new Date(log.edited_at),
                              "dd-MMM-yyyy hh:mm a",
                            )
                          : "-"}
                      </span>
                    </div>

                    {log.changes_summary && log.changes_summary.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        <p className="font-semibold text-[11px] text-muted-foreground">
                          Changes Made:
                        </p>
                        <div className="rounded-lg overflow-hidden border">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="bg-muted/60">
                                <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">
                                  Field
                                </th>
                                <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">
                                  Previous Value
                                </th>
                                <th className="text-center px-1 py-1.5 w-6"></th>
                                <th className="text-left px-3 py-1.5 font-semibold text-muted-foreground">
                                  Updated Value
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {log.changes_summary.map((change, idx) => {
                                if (change.field === "calibration_points") {
                                  return (
                                    <tr
                                      key={idx}
                                      className="border-t border-muted/40 hover:bg-muted/20 transition-colors"
                                    >
                                      <td className="px-3 py-2 font-semibold text-primary align-top pt-3 whitespace-nowrap">
                                        {getAuditFieldLabel(change.field)}
                                      </td>
                                      <td colSpan={3} className="px-3 py-2">
                                        <CalibrationPointsDiff
                                          oldPoints={change.oldValue}
                                          newPoints={change.newValue}
                                        />
                                      </td>
                                    </tr>
                                  );
                                }
                                return (
                                  <tr
                                    key={idx}
                                    className="border-t border-muted/40 hover:bg-muted/20 transition-colors"
                                  >
                                    <td className="px-3 py-2 font-semibold text-primary whitespace-nowrap">
                                      {getAuditFieldLabel(change.field)}
                                    </td>
                                    <td className="px-3 py-2 text-red-500/80 max-w-[200px]">
                                      <span className="line-through">
                                        {formatAuditValue(
                                          change.field,
                                          change.oldValue,
                                        )}
                                      </span>
                                    </td>
                                    <td className="px-1 py-2 text-center text-muted-foreground">
                                      →
                                    </td>
                                    <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-semibold max-w-[200px]">
                                      {formatAuditValue(
                                        change.field,
                                        change.newValue,
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-[11px]">
                        Calibration saved with updated parameters.
                      </p>
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
