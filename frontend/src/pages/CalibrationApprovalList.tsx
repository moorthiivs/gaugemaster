import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { getRoleName } from "@/lib/utils";
import httpClient from "@/lib/httpClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { CertificatePreview, formatUncertainty } from "@/components/calibration/CertificatePreview";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  FileCheck,
  Search,
  RefreshCw,
  UserCheck,
  FileText,
  AlertTriangle,
  PenTool,
  Check,
  X,
  Edit,
} from "lucide-react";

export default function CalibrationApprovalList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAccess } = usePermissions();
  const [calibrations, setCalibrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilterTab, setStatusFilterTab] = useState("Pending Approval");
  const [reviewTab, setReviewTab] = useState("readings");

  // Dialog & Detail states
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  // Review form states
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewerName, setReviewerName] = useState(user?.name || "");
  const [reviewerDesignation, setReviewerDesignation] = useState("Quality Manager");
  const [reviewerSignature, setReviewerSignature] = useState(user?.name || "");
  const [submitting, setSubmitting] = useState(false);

  const fetchCalibrations = async () => {
    setLoading(true);
    try {
      const res = await httpClient.get("/calibrations", {
        params: {
          companyId: user?.companyId,
          userId: user?.id,
          pageSize: 100,
        },
      });

      const items = res.data?.data || res.data?.items || (Array.isArray(res.data) ? res.data : []);
      setCalibrations(items);
    } catch (err: any) {
      console.error("Failed to fetch calibrations for approval:", err);
      toast({
        title: "Error Loading Approvals",
        description: "Could not fetch calibration records for review.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCalibrations();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCalibrations();
  };

  // Filter items based on statusFilterTab & search
  const filteredCalibrations = calibrations.filter((cal) => {
    const status = cal.approval_status || "Calibration Completed";
    let matchesTab = true;
    if (statusFilterTab === "Pending Approval") {
      matchesTab = status === "Calibration Completed" || status === "Pending Approval";
    } else if (statusFilterTab === "Approved") {
      matchesTab = status === "Approved";
    } else if (statusFilterTab === "Rejected") {
      matchesTab = status === "Rejected";
    }

    const instName = cal.instrument?.name?.toLowerCase() || "";
    const instCode = cal.instrument?.id_code?.toLowerCase() || "";
    const certNo = cal.certificate_number?.toLowerCase() || "";
    const engName = cal.calibrated_by?.toLowerCase() || "";
    const q = searchQuery.toLowerCase();

    const matchesSearch =
      !q ||
      instName.includes(q) ||
      instCode.includes(q) ||
      certNo.includes(q) ||
      engName.includes(q);

    return matchesTab && matchesSearch;
  });

  // Approval counts
  const pendingCount = calibrations.filter(
    (c) =>
      (c.approval_status || "Calibration Completed") === "Calibration Completed" ||
      c.approval_status === "Pending Approval"
  ).length;

  const approvedCount = calibrations.filter((c) => c.approval_status === "Approved").length;
  const rejectedCount = calibrations.filter((c) => c.approval_status === "Rejected").length;

  // Handle Approve Submission
  const handleConfirmApprove = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      await httpClient.post(`/calibrations/${selectedRecord.id}/approve`, {
        reviewerId: user?.id,
        reviewerName: user?.name || reviewerName || "Quality Manager",
        reviewerDesignation: getRoleName(user?.role) || reviewerDesignation || "Quality Manager",
        signature: (user as any)?.signature || reviewerSignature || user?.name || "Quality Manager",
      });

      toast({
        title: "Calibration Approved",
        description: `Certificate ${selectedRecord.certificate_number} has been approved and released.`,
        variant: "success",
      });

      setApproveDialogOpen(false);
      setReviewDialogOpen(false);
      setSelectedRecord(null);
      fetchCalibrations();
    } catch (err: any) {
      console.error("Failed to approve calibration:", err);
      toast({
        title: "Approval Failed",
        description: err.response?.data?.message || "Could not complete approval.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Reject Submission
  const handleConfirmReject = async () => {
    if (!selectedRecord) return;
    if (!rejectionReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please enter a reason for rejecting this calibration.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await httpClient.post(`/calibrations/${selectedRecord.id}/reject`, {
        reviewerId: user?.id,
        reviewerName: user?.name || "Quality Manager",
        rejectionReason: rejectionReason.trim(),
      });

      toast({
        title: "Calibration Returned for Rework",
        description: `Calibration ${selectedRecord.certificate_number} has been rejected and returned to engineer.`,
      });

      setRejectDialogOpen(false);
      setReviewDialogOpen(false);
      setRejectionReason("");
      setSelectedRecord(null);
      fetchCalibrations();
    } catch (err: any) {
      console.error("Failed to reject calibration:", err);
      toast({
        title: "Rejection Failed",
        description: err.response?.data?.message || "Could not complete rejection.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    if (status === "Approved") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1.5 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Approved</span>
        </Badge>
      );
    }
    if (status === "Rejected") {
      return (
        <Badge variant="destructive" className="gap-1.5 font-medium">
          <XCircle className="w-3.5 h-3.5" />
          <span>Rejected / Rework</span>
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1.5 font-medium">
        <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
        <span>Pending Approval</span>
      </Badge>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-primary" />
            <span>Calibration Approval</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review completed calibration records, inspect reading accuracy & certificate drafts, and issue Manager Approval.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-between">
              <span>Pending Review</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-[11px] text-muted-foreground">Awaiting Manager / Reviewer action</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
              <span>Approved Certificates</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
            <p className="text-[11px] text-muted-foreground">Verified & released for production</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-gradient-to-br from-destructive/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-destructive flex items-center justify-between">
              <span>Returned / Rejected</span>
              <XCircle className="w-4 h-4 text-destructive" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedCount}</div>
            <p className="text-[11px] text-muted-foreground">Returned to Engineer for rework</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
        <Tabs value={statusFilterTab} onValueChange={setStatusFilterTab} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-4 h-9">
            <TabsTrigger value="Pending Approval" className="text-xs gap-1.5">
              <span>Pending</span>
              {pendingCount > 0 && (
                <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="Approved" className="text-xs gap-1.5">
              <span>Approved</span>
              <span className="text-[10px] opacity-70">({approvedCount})</span>
            </TabsTrigger>
            <TabsTrigger value="Rejected" className="text-xs gap-1.5">
              <span>Rejected</span>
              <span className="text-[10px] opacity-70">({rejectedCount})</span>
            </TabsTrigger>
            <TabsTrigger value="All" className="text-xs">
              <span>All ({calibrations.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search certificate, instrument..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Calibrations Approval List Table */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-semibold border-b">
              <tr>
                <th className="px-4 py-3">Certificate No</th>
                <th className="px-4 py-3">Instrument</th>
                <th className="px-4 py-3">Calibrated By</th>
                <th className="px-4 py-3">Cal. Date</th>
                <th className="px-4 py-3">Verdict</th>
                <th className="px-4 py-3">Approval Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading calibration approvals...</span>
                  </td>
                </tr>
              ) : filteredCalibrations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-sm text-foreground">No Calibration Records Found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {statusFilterTab === "Pending Approval"
                        ? "All completed calibrations have been reviewed and processed."
                        : "No matching records found for your filter."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCalibrations.map((cal) => {
                  const status = cal.approval_status || "Calibration Completed";
                  const inst = cal.instrument;

                  return (
                    <tr key={cal.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-primary">
                        {cal.certificate_number}
                        {cal.ulr_number && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {cal.ulr_number}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{inst?.name || "Unknown Instrument"}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{inst?.id_code}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{cal.calibrated_by || "Calibration Engineer"}</div>
                        <div className="text-[10px] text-muted-foreground">Engineer</div>
                      </td>

                      <td className="px-4 py-3 font-mono">
                        {cal.calibration_date
                          ? new Date(cal.calibration_date).toLocaleDateString("en-IN")
                          : "-"}
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            cal.verdict === "PASS"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                              : "bg-red-500/10 text-red-700 border-red-500/30"
                          }
                        >
                          {cal.verdict || "PASS"}
                        </Badge>
                      </td>

                      <td className="px-4 py-3">{renderStatusBadge(status)}</td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canAccess("calibrations", "edit") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => navigate(`/calibration/new?editId=${cal.id}`)}
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            onClick={() => {
                              setSelectedRecord(cal);
                              setReviewDialogOpen(true);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Review & Approval Modal */}
      {selectedRecord && (
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col space-y-4">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between pr-6">
                <div>
                  <DialogTitle className="text-xl flex items-center gap-2">
                    <span>Review Calibration: {selectedRecord.certificate_number}</span>
                    {renderStatusBadge(selectedRecord.approval_status || "Calibration Completed")}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-1">
                    Instrument: <span className="font-semibold text-foreground">{selectedRecord.instrument?.name}</span> ({selectedRecord.instrument?.id_code})
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Rejection Alert if record was previously rejected */}
            {selectedRecord.approval_status === "Rejected" && selectedRecord.rejection_reason && (
              <div className="bg-destructive/15 border border-destructive/30 text-destructive p-3 rounded-lg flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Rejection Comment from Reviewer ({selectedRecord.rejected_by}):</div>
                  <div className="mt-0.5">{selectedRecord.rejection_reason}</div>
                </div>
              </div>
            )}

            <Tabs value={reviewTab} onValueChange={setReviewTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid grid-cols-2 w-72 h-9 mb-2">
                <TabsTrigger value="readings" className="text-xs gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Readings & Specs</span>
                </TabsTrigger>
                <TabsTrigger value="certificate" className="text-xs gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Certificate Preview</span>
                </TabsTrigger>
              </TabsList>

              {/* Readings & Specs Tab */}
              <TabsContent value="readings" className="flex-1 overflow-y-auto max-h-[68vh] space-y-4 pr-1 scrollbar-thin">
                {(() => {
                  const points = selectedRecord.calibration_points || [];
                  const unit = points[0]?.unit || "mm";

                  const calibratedBy = selectedRecord.calibrated_by || selectedRecord.created_by?.name || selectedRecord.created_by?.email || "N/A";
                  const calDate = selectedRecord.calibration_date
                    ? new Date(selectedRecord.calibration_date).toLocaleDateString("en-IN")
                    : "N/A";

                  const envTemp = selectedRecord.environmental_conditions?.temperature ?? "20";
                  const envHum = selectedRecord.environmental_conditions?.humidity ?? "55";
                  const envPress = selectedRecord.environmental_conditions?.pressure ?? "1013";
                  const tempStr = String(envTemp).includes("°") ? envTemp : `${envTemp}°C`;
                  const humStr = String(envHum).includes("%") ? envHum : `${envHum}%`;
                  const pressStr = envPress ? ` / ${envPress}` : "";
                  const envDisplay = `${tempStr} / ${humStr}${pressStr}`;

                  const uncertaintyStr = selectedRecord.uncertainty && selectedRecord.uncertainty.trim()
                    ? formatUncertainty(selectedRecord.uncertainty, unit)
                    : null;

                  const refStandardsList = Array.isArray(selectedRecord.reference_standards) && selectedRecord.reference_standards.length > 0
                    ? selectedRecord.reference_standards
                    : null;

                  const hasDescription = points.some(
                    (pt: any) => pt.description && String(pt.description).trim() !== ""
                  );
                  const hasDescending = points.some(
                    (pt: any) => pt.descending_reading !== undefined && pt.descending_reading !== null && pt.descending_reading !== 0
                  );

                  // Custom column extraction
                  const customColMap = new Map<string, string>();
                  points.forEach((pt: any) => {
                    if (pt.customFields && typeof pt.customFields === "object") {
                      Object.entries(pt.customFields).forEach(([key, val]) => {
                        if (val && typeof val === "object" && "name" in val) {
                          customColMap.set(key, (val as any).name);
                        } else if (typeof val !== "object" && val !== null && val !== undefined) {
                          customColMap.set(key, key);
                        }
                      });
                    }
                  });
                  const customKeys = Array.from(customColMap.keys());

                  // Column ordering & hidden columns matching CertificatePreview & CalibrationWizard
                  const hidden = new Set(selectedRecord.hidden_columns || []);
                  const columnOrder = selectedRecord.column_order && selectedRecord.column_order.length > 0
                    ? selectedRecord.column_order
                    : [
                        hasDescription ? "description" : "",
                        "nominal",
                        "tolerance",
                        "ascending_reading",
                        hasDescending ? "descending_reading" : "",
                        ...customKeys,
                        "error",
                      ].filter(Boolean);

                  const activeColumns = columnOrder.filter(
                    (k: string) => k !== "pt" && k !== "actions" && !hidden.has(k)
                  );

                  const stdColConfig = (selectedRecord as any).standard_columns_config || {};

                  const getColumnTitle = (k: string) => {
                    const stdCfg = stdColConfig[k];
                    if (stdCfg) {
                      const stdName = stdCfg.name || stdCfg.label || stdCfg.title || stdCfg.header;
                      if (stdName && !stdName.startsWith("col_")) return stdName;
                    }
                    if (k === "description") return "Description";
                    if (k === "nominal") return `Nominal (${unit})`;
                    if (k === "tolerance") return "Tolerance";
                    if (k === "ascending_reading") return hasDescending ? `Ascending (${unit})` : `Actual (${unit})`;
                    if (k === "descending_reading") return `Descending (${unit})`;
                    if (k === "error") return "Error";
                    return customColMap.get(k) || k;
                  };

                  const getCellValue = (pt: any, k: string) => {
                    if (k === "description") return pt.description || "-";
                    if (k === "nominal") return pt.nominal !== undefined && pt.nominal !== null ? pt.nominal : "-";
                    if (k === "tolerance") return pt.tolerance !== undefined && pt.tolerance !== null ? pt.tolerance : "-";
                    if (k === "ascending_reading") return pt.ascending_reading !== undefined && pt.ascending_reading !== null ? pt.ascending_reading : "-";
                    if (k === "descending_reading") return pt.descending_reading !== undefined && pt.descending_reading !== null ? pt.descending_reading : "-";
                    if (k === "error") return pt.error !== undefined && pt.error !== null ? pt.error : "-";
                    const valObj = pt.customFields?.[k];
                    const val = typeof valObj === "object" && valObj !== null && "value" in valObj ? valObj.value : valObj;
                    return val !== undefined && val !== null ? String(val) : "-";
                  };

                  return (
                    <div className="space-y-4">
                      {/* Meta details grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg border text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Calibrated By</span>
                          <span className="font-medium text-foreground">{calibratedBy}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Calibration Date</span>
                          <span className="font-mono text-foreground">{calDate}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Temperature / Humidity</span>
                          <span className="font-medium text-foreground">{envDisplay}</span>
                        </div>
                        {uncertaintyStr && (
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Uncertainty</span>
                            <span className="font-mono font-semibold text-foreground">{uncertaintyStr}</span>
                          </div>
                        )}
                      </div>

                      {/* Standard & Procedure References */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-card p-3 rounded-lg border text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Procedure Reference</span>
                          <span className="font-medium font-mono text-foreground">{selectedRecord.procedure_reference || "AE/CAL-SOP/01"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Standard Reference</span>
                          <span className="font-medium font-mono text-foreground">{selectedRecord.standard_reference || "Standard calibration per ISO/IEC 17025"}</span>
                        </div>
                      </div>

                      {/* Reference Standard Info */}
                      <div className="border rounded-lg p-3 bg-card text-xs space-y-2">
                        <div className="font-semibold text-primary uppercase tracking-wider text-[10px] flex items-center justify-between">
                          <span>Reference Standard / Master Used</span>
                          {refStandardsList && <Badge variant="outline" className="text-[10px]">{refStandardsList.length} Masters</Badge>}
                        </div>

                        {refStandardsList ? (
                          <div className="overflow-x-auto border rounded-md">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] border-b">
                                <tr>
                                  <th className="p-2">Master Name</th>
                                  <th className="p-2">Make</th>
                                  <th className="p-2">ID / Sr No</th>
                                  <th className="p-2">Cert No</th>
                                  <th className="p-2">Cal Agency</th>
                                  <th className="p-2">Validity</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {refStandardsList.map((ref: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-muted/20">
                                    <td className="p-2 font-medium">{ref.name || selectedRecord.reference_standard_name || "SPECIAL GAUGE"}</td>
                                    <td className="p-2">{ref.make || "-"}</td>
                                    <td className="p-2 font-mono">{ref.id || selectedRecord.reference_standard_id || "SPG953/01"}</td>
                                    <td className="p-2 font-mono">{ref.cert_no || "AE/CC/REF/01"}</td>
                                    <td className="p-2">{ref.agency || "NABL Lab"}</td>
                                    <td className="p-2 font-mono">
                                      {ref.validity ? new Date(ref.validity).toLocaleDateString("en-IN") : selectedRecord.reference_standard_validity ? new Date(selectedRecord.reference_standard_validity).toLocaleDateString("en-IN") : "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                            <div><span className="text-muted-foreground">Standard Name:</span> <span className="font-medium">{selectedRecord.reference_standard_name || "SPECIAL GAUGE"}</span></div>
                            <div><span className="text-muted-foreground">Standard ID:</span> <span className="font-mono">{selectedRecord.reference_standard_id || "SPG953/01"}</span></div>
                            <div><span className="text-muted-foreground">Traceable To:</span> <span className="font-medium">{selectedRecord.reference_standard_traceable_to || "NABL Lab"}</span></div>
                          </div>
                        )}
                      </div>

                      {/* Acceptance Criteria Banner */}
                      {selectedRecord.acceptance_criteria?.enabled && (
                        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 p-2.5 rounded-lg text-xs font-medium flex items-center justify-between">
                          <span>Acceptance Criteria Rule Enabled</span>
                          <span className="font-bold">
                            {selectedRecord.acceptance_criteria.value} {selectedRecord.acceptance_criteria.type === "percentage" ? "%" : unit}
                          </span>
                        </div>
                      )}

                      {/* Test Points Table */}
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground border-b flex justify-between items-center">
                          <span>Calibration Test Points ({points.length} points)</span>
                          <Badge variant="outline" className={selectedRecord.verdict === "PASS" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-bold" : "bg-red-500/10 text-red-700 border-red-500/30 font-bold"}>
                            Verdict: {selectedRecord.verdict || "PASS"}
                          </Badge>
                        </div>
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/30 text-muted-foreground text-[10px] uppercase border-b">
                            <tr>
                              <th className="px-3 py-2 w-12">Point</th>
                              {activeColumns.map((colKey: string) => (
                                <th key={colKey} className="px-3 py-2">{getColumnTitle(colKey)}</th>
                              ))}
                              <th className="px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y font-mono">
                            {points.map((pt: any, idx: number) => {
                              const ptStatus = pt.status || "PASS";
                              return (
                                <tr key={idx} className="hover:bg-muted/20">
                                  <td className="px-3 py-2 font-semibold text-foreground">{pt.point_number || idx + 1}</td>
                                  {activeColumns.map((colKey: string) => (
                                    <td key={colKey} className={`px-3 py-2 ${colKey === "description" ? "font-sans font-medium" : ""}`}>
                                      {getCellValue(pt, colKey)}
                                    </td>
                                  ))}
                                  <td className="px-3 py-2 font-sans">
                                    <Badge
                                      variant="outline"
                                      className={
                                        ptStatus === "PASS"
                                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]"
                                          : "bg-red-500/10 text-red-700 border-red-500/30 text-[10px]"
                                      }
                                    >
                                      {ptStatus}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>

              {/* Certificate Preview Tab */}
              <TabsContent value="certificate" className="flex-1 overflow-y-auto max-h-[68vh] p-3 bg-muted/30 border rounded-xl scrollbar-thin">
                <CertificatePreview
                  calibration={selectedRecord}
                  instrumentName={selectedRecord.instrument?.name}
                />
              </TabsContent>
            </Tabs>

            {/* Manager Review Action Footer */}
            <DialogFooter className="border-t pt-3 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Reviewer: <span className="font-semibold text-foreground">{user?.name}</span> ({getRoleName(user?.role) || "Quality Manager"})
              </div>

              <div className="flex items-center gap-2">
                {canAccess("calibrations", "edit") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    onClick={() => navigate(`/calibration/new?editId=${selectedRecord.id}`)}
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Calibration</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setReviewDialogOpen(false)}>
                  Cancel
                </Button>

                {selectedRecord.approval_status !== "Approved" && canAccess("calibrations", "edit") && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setRejectDialogOpen(true)}
                    >
                      <X className="w-4 h-4" />
                      <span>Reject & Return</span>
                    </Button>

                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setApproveDialogOpen(true)}
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve Certificate</span>
                    </Button>
                  </>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Approve Confirmation Modal */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              <span>Confirm Calibration Approval</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to approve and release calibration certificate <span className="font-bold text-foreground">{selectedRecord?.certificate_number}</span>?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 space-y-2.5 text-xs">
            {/* Instrument Name & ID */}
            <div className="flex justify-between items-center pb-2 border-b border-emerald-500/20">
              <span className="text-muted-foreground font-medium">Instrument:</span>
              <span className="font-semibold text-foreground text-xs">
                {selectedRecord?.instrument?.name || selectedRecord?.instrument_name || "Instrument"}
                {(selectedRecord?.instrument?.id_code || selectedRecord?.instrument_id_code) &&
                  ` (${selectedRecord?.instrument?.id_code || selectedRecord?.instrument_id_code})`}
              </span>
            </div>

            {/* Verdict Status Pass / Fail */}
            <div className="flex justify-between items-center pb-2 border-b border-emerald-500/20">
              <span className="text-muted-foreground font-medium">Verdict Status:</span>
              <Badge
                className={
                  selectedRecord?.verdict === "FAIL"
                    ? "bg-red-500/20 text-red-700 dark:text-red-300 font-bold border-red-500/30"
                    : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border-emerald-500/30"
                }
              >
                {selectedRecord?.verdict || "PASS"}
              </Badge>
            </div>

            {/* Certificate Preview Action */}
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-muted-foreground font-medium">Certificate Document:</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 border-primary/40 hover:bg-primary/10 text-primary font-semibold"
                onClick={() => {
                  setApproveDialogOpen(false);
                  setReviewTab("certificate");
                }}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Certificate Preview</span>
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setApproveDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmApprove} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold">
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Yes, Approve Certificate</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Modal */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              <span>Reject Calibration & Require Rework</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide a mandatory rejection reason to return certificate <span className="font-semibold">{selectedRecord?.certificate_number}</span> to the Calibration Engineer for correction.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="font-semibold text-xs block">Rejection Reason / Comments *</label>
            <Textarea
              placeholder="Detail what readings, tolerances, or certificate fields require correction..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="h-28 text-xs"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejectDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmReject} disabled={submitting} className="gap-1.5">
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
              <span>Reject & Send Rework</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
