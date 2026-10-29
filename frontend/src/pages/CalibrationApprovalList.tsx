import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { getRoleName } from "@/lib/utils";
import httpClient from "@/lib/httpClient";
import {
  listCalibrations,
  getCalibration,
  getApprovalStats,
  ApprovalStats,
  deleteCalibration,
  getResequencePreview,
  ResequencePreviewData,
  revertCalibrationStage,
} from "@/lib/calibrationActions";
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
import { CertificatePreview, CanvasBlocksRenderer, formatUncertainty } from "@/components/calibration/CertificatePreview";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
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
  RotateCcw,
  LayoutDashboard,
  Loader2,
  Trash2,
  Undo2,
  Hash,
  Ruler,
} from "lucide-react";

export default function CalibrationApprovalList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAccess } = usePermissions();
  const [calibrations, setCalibrations] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const roleName = getRoleName(user?.role || (user as any)?.userRole).toLowerCase();
  const isAdmin = roleName.includes("admin") || !!user?.isSuperAdmin;
  const isApprover = roleName.includes("approv") || roleName.includes("quality") || roleName.includes("manager") || isAdmin;
  const isReviewer = roleName.includes("review") || isAdmin;

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilterTab, setStatusFilterTab] = useState(
    isApprover && !roleName.includes("review") ? "Reviewed" : "Pending Review"
  );
  const [reviewTab, setReviewTab] = useState("readings");
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dashboard toggle state (persisted, defaults to false for full page view)
  const [showDashboard, setShowDashboard] = useState<boolean>(() => {
    const saved = localStorage.getItem("gaugemaster_cal_approval_show_dashboard");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("gaugemaster_cal_approval_show_dashboard", String(showDashboard));
  }, [showDashboard]);

  const [stats, setStats] = useState<ApprovalStats>({
    pendingReview: 0,
    reviewed: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });

  // Debounce search input to avoid spamming the backend
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPageIndex(1);
  }, [debouncedSearchQuery, statusFilterTab]);

  // Dialog & Detail states
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [loadingRecordId, setLoadingRecordId] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [reviewRecommendationDialogOpen, setReviewRecommendationDialogOpen] = useState(false);

  // Deletion modal state for rejected records
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [calibrationToDelete, setCalibrationToDelete] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [resequenceChoice, setResequenceChoice] = useState<"resequence" | "keep">("resequence");
  const [resequencePreview, setResequencePreview] = useState<ResequencePreviewData | null>(null);
  const [loadingDeletePreview, setLoadingDeletePreview] = useState(false);

  // Revert stage modal state for rejected records
  const [revertModalOpen, setRevertModalOpen] = useState(false);
  const [calibrationToRevert, setCalibrationToRevert] = useState<any | null>(null);
  const [revertNote, setRevertNote] = useState("");
  const [revertingStage, setRevertingStage] = useState(false);

  const certScrollRef = useRef<HTMLDivElement>(null);
  const readingsScrollRef = useRef<HTMLDivElement>(null);

  // Automatically reset scroll to top whenever review dialog opens
  useEffect(() => {
    if (reviewDialogOpen) {
      if (certScrollRef.current) certScrollRef.current.scrollTop = 0;
      if (readingsScrollRef.current) readingsScrollRef.current.scrollTop = 0;
    }
  }, [reviewDialogOpen, selectedRecord]);

  // Review & Approval form states
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewerRemarks, setReviewerRemarks] = useState("");
  const [approverRemarks, setApproverRemarks] = useState("");
  const [reviewerName, setReviewerName] = useState(user?.name || "");
  const [reviewerDesignation, setReviewerDesignation] = useState("Calibration Reviewer");
  const [reviewerSignature, setReviewerSignature] = useState(user?.name || "");
  const [submitting, setSubmitting] = useState(false);

  const fetchStats = async () => {
    try {
      const data = await getApprovalStats({
        companyId: user?.companyId,
        userId: user?.id,
      });
      if (data) {
        setStats(data);
      }
    } catch (e) {
      console.warn("Could not fetch approval stats:", e);
    }
  };

  const fetchCalibrations = async () => {
    setLoading(true);
    try {
      const res = await listCalibrations({
        companyId: user?.companyId,
        userId: user?.id,
        approvalStatus: statusFilterTab !== "All" ? statusFilterTab : undefined,
        search: debouncedSearchQuery.trim() ? debouncedSearchQuery.trim() : undefined,
        page: pageIndex,
        pageSize: pageSize,
      });

      const items = res?.data || res?.items || (Array.isArray(res) ? res : []);
      setCalibrations(items);
      setTotalItems(res?.total ?? items.length);
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
    if (user?.id) {
      fetchCalibrations();
    }
  }, [user?.id, user?.companyId, pageIndex, pageSize, statusFilterTab, debouncedSearchQuery]);

  useEffect(() => {
    if (user?.id) {
      fetchStats();
    }
  }, [user?.id, user?.companyId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCalibrations();
    fetchStats();
  };

  // Workflow Stage counts from single SQL aggregation
  const pendingReviewCount = stats.pendingReview;
  const reviewedCount = stats.reviewed;
  const approvedCount = stats.approved;
  const rejectedCount = stats.rejected;
  const allCount = stats.total;

  // Handle Review & Recommend Submission (Stage 1)
  const handleConfirmReview = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      await httpClient.post(`/calibrations/${selectedRecord.id}/review`, {
        reviewerId: user?.id,
        reviewerName: user?.name || reviewerName || "Reviewer",
        reviewerDesignation: getRoleName(user?.role) || reviewerDesignation || "Calibration Reviewer",
        signature: (user as any)?.signature || reviewerSignature || undefined,
        remarks: reviewerRemarks.trim() || undefined,
      });

      toast({
        title: "Calibration Reviewed & Recommended",
        description: `Calibration ${selectedRecord.certificate_number} has been reviewed and forwarded for Final Approval.`,
        variant: "success",
      });

      setReviewRecommendationDialogOpen(false);
      setReviewDialogOpen(false);
      setSelectedRecord(null);
      setReviewerRemarks("");
      fetchCalibrations();
      fetchStats();
    } catch (err: any) {
      console.error("Failed to review calibration:", err);
      toast({
        title: "Review Action Failed",
        description: err.response?.data?.message || "Could not complete review.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Final Approve Submission (Stage 2)
  const handleConfirmApprove = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    try {
      await httpClient.post(`/calibrations/${selectedRecord.id}/approve`, {
        approverId: user?.id,
        approverName: user?.name || "Quality Manager",
        approverDesignation: getRoleName(user?.role) || "Quality Manager / Approver",
        signature: (user as any)?.signature || undefined,
        approverRemarks: approverRemarks.trim() || undefined,
      });

      toast({
        title: "Calibration Approved",
        description: `Certificate ${selectedRecord.certificate_number} has been final approved and released.`,
        variant: "success",
      });

      setApproveDialogOpen(false);
      setReviewDialogOpen(false);
      setSelectedRecord(null);
      setApproverRemarks("");
      fetchCalibrations();
      fetchStats();
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
        reviewerName: user?.name || "Reviewer / Approver",
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
      fetchStats();
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

  // Open Delete Modal with sequence preview
  const handleOpenDeleteModal = async (cal: any) => {
    setCalibrationToDelete(cal);
    setResequenceChoice("resequence");
    setResequencePreview(null);
    setDeleteReason("");
    setDeleteModalOpen(true);
    setLoadingDeletePreview(true);
    try {
      const data = await getResequencePreview(cal.id);
      setResequencePreview(data);
    } catch (err) {
      console.warn("Could not fetch resequence preview:", err);
      setResequencePreview(null);
    } finally {
      setLoadingDeletePreview(false);
    }
  };

  // Confirm soft-delete & instrument rollback with mandatory note
  const handleConfirmDelete = async () => {
    if (!calibrationToDelete) return;
    if (!deleteReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please enter a note / reason for deleting this rejected calibration.",
        variant: "destructive",
      });
      return;
    }
    setDeleting(true);
    try {
      const shouldResequence = resequenceChoice === "resequence";
      await deleteCalibration(calibrationToDelete.id, shouldResequence, deleteReason.trim());
      const affectedCount = resequencePreview?.affectedCalibrations?.length || 0;
      toast({
        title: "Calibration Deleted & Rolled Back",
        description:
          shouldResequence && affectedCount > 0
            ? `Calibration ${calibrationToDelete.certificate_number || ""} moved to Trash & ${affectedCount} certificates renumbered. Instrument restored to previous stage.`
            : `Calibration ${calibrationToDelete.certificate_number || ""} moved to Trash. Instrument restored to previous stage.`,
        variant: "success",
      });
      setDeleteModalOpen(false);
      if (reviewDialogOpen) setReviewDialogOpen(false);
      setCalibrationToDelete(null);
      setDeleteReason("");
      setResequencePreview(null);
      fetchCalibrations();
      fetchStats();
    } catch (err: any) {
      console.error("Failed to delete calibration:", err);
      toast({
        title: "Deletion Failed",
        description: err.response?.data?.message || "Could not delete calibration record.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Open Return to Before Stage Modal
  const handleOpenRevertModal = (cal: any) => {
    setCalibrationToRevert(cal);
    setRevertNote("");
    setRevertModalOpen(true);
  };

  // Confirm Return to Before Stage with mandatory note
  const handleConfirmRevertStage = async () => {
    if (!calibrationToRevert) return;
    if (!revertNote.trim()) {
      toast({
        title: "Note Required",
        description: "Please enter a note explaining why this calibration is being returned to the previous stage.",
        variant: "destructive",
      });
      return;
    }
    setRevertingStage(true);
    try {
      await revertCalibrationStage(calibrationToRevert.id, revertNote.trim(), "Pending Review");
      toast({
        title: "Returned to Before Stage",
        description: `Calibration ${calibrationToRevert.certificate_number || ""} returned to Pending Review stage.`,
        variant: "success",
      });
      setRevertModalOpen(false);
      if (reviewDialogOpen) setReviewDialogOpen(false);
      setCalibrationToRevert(null);
      setRevertNote("");
      fetchCalibrations();
      fetchStats();
    } catch (err: any) {
      console.error("Failed to revert stage:", err);
      toast({
        title: "Action Failed",
        description: err.response?.data?.message || "Could not return calibration to previous stage.",
        variant: "destructive",
      });
    } finally {
      setRevertingStage(false);
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
    if (status === "Reviewed" || status === "Pending Approval") {
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1.5 font-medium">
          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Reviewed (Pending Approver)</span>
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
        <span>Pending Review</span>
      </Badge>
    );
  };

  const pageCount = Math.ceil(totalItems / pageSize) || 1;

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "certificate_number",
        header: "Certificate No",
        cell: ({ row }) => {
          const cal = row.original;
          return (
            <div>
              <div className="font-semibold text-primary tabular-nums">
                {cal.certificate_number}
              </div>
              {cal.ulr_number && (
                <div className="text-[10px] text-muted-foreground tracking-tight tabular-nums">
                  {cal.ulr_number}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "instrument",
        header: "Instrument",
        cell: ({ row }) => {
          const inst = row.original.instrument;
          return (
            <div>
              <div className="font-medium text-foreground">{inst?.name || "Unknown Instrument"}</div>
              <div className="text-[10px] text-muted-foreground tracking-tight">{inst?.id_code}</div>
            </div>
          );
        },
      },
      {
        accessorKey: "calibrated_by",
        header: "Calibrated By",
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">{row.original.calibrated_by || "Calibration Engineer"}</div>
            <div className="text-[10px] text-muted-foreground">
              {row.original.calibration_date
                ? new Date(row.original.calibration_date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "Engineer"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "reviewed_by",
        header: "Reviewed By",
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-foreground">
              {row.original.reviewed_by || (
                <span className="text-muted-foreground/60 italic text-xs">Pending Review</span>
              )}
            </div>
            {row.original.reviewed_at && (
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {new Date(row.original.reviewed_at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "verdict",
        header: "Verdict",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.verdict === "PASS"
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                : "bg-red-500/10 text-red-700 border-red-500/30"
            }
          >
            {row.original.verdict || "PASS"}
          </Badge>
        ),
      },
      {
        accessorKey: "approval_status",
        header: "Approval Status",
        cell: ({ row }) => renderStatusBadge(row.original.approval_status || "Calibration Completed"),
      },
      {
        id: "actions",
        header: "Actions",
        meta: { align: "right" },
        cell: ({ row }) => {
          const cal = row.original;
          const status = cal.approval_status || "Calibration Completed";
          const isPendingReview = status === "Calibration Completed" || status === "Pending Review";
          const isReviewedStatus = status === "Reviewed" || status === "Pending Approval";
          const isApprovedStatus = status === "Approved";

          let buttonLabel = "View";
          let isHighlighted = false;

          if (isPendingReview) {
            buttonLabel = isReviewer ? "Review" : "View";
            isHighlighted = isReviewer;
          } else if (isReviewedStatus) {
            buttonLabel = isApprover ? "Inspect & Approve" : "View";
            isHighlighted = isApprover;
          } else if (isApprovedStatus) {
            buttonLabel = "View Cert";
            isHighlighted = false;
          } else {
            buttonLabel = "View";
            isHighlighted = false;
          }

          return (
            <div className="flex items-center justify-end gap-2">
              {cal.approval_status === "Rejected" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 font-medium"
                    onClick={() => handleOpenRevertModal(cal)}
                    title="Return certificate to previous stage (Pending Review) with note"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Return Stage</span>
                  </Button>
                  {(canAccess("calibrations", "delete") || canAccess("calibration_approvals", "delete") || isAdmin || isApprover) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 font-medium"
                      onClick={() => handleOpenDeleteModal(cal)}
                      title="Delete rejected certificate and restore instrument to before stage"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </Button>
                  )}
                </>
              )}
              {cal.approval_status === "Rejected" && canAccess("calibrations", "create") && (
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs"
                  onClick={() => navigate(`/calibration/new?recalibrateId=${cal.id}`)}
                  title="Recalibrate this rejected instrument"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Recalibrate</span>
                </Button>
              )}
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
                variant={isHighlighted ? "default" : "outline"}
                size="sm"
                disabled={loadingRecordId === cal.id}
                className={`h-8 text-xs gap-1.5 ${
                  isHighlighted && isReviewedStatus
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    : isHighlighted && isPendingReview
                    ? "bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    : ""
                }`}
                onClick={async () => {
                  try {
                    setLoadingRecordId(cal.id);
                    const full = await getCalibration(cal.id);
                    setSelectedRecord(full || cal);
                    setReviewDialogOpen(true);
                  } catch (e) {
                    console.error("Failed to load full calibration record:", e);
                    setSelectedRecord(cal);
                    setReviewDialogOpen(true);
                  } finally {
                    setLoadingRecordId(null);
                  }
                }}
              >
                {loadingRecordId === cal.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>{loadingRecordId === cal.id ? "Loading..." : buttonLabel}</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [canAccess, navigate, isReviewer, isApprover, isAdmin, loadingRecordId]
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Calibration Approval"
        description="Review completed calibration records, inspect reading accuracy & certificate drafts, and issue Manager Approval."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={showDashboard ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowDashboard((prev) => !prev)}
              className="h-8 px-3 text-xs font-semibold gap-1.5 transition-colors shadow-2xs"
              title={showDashboard ? "Hide approval KPI metrics" : "Show approval KPI metrics"}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{showDashboard ? "Hide Dashboard" : "Show Dashboard"}</span>
              {!showDashboard && (
                <Badge variant="secondary" className="ml-1 text-[10px] font-mono px-1.5 py-0 h-4 bg-muted text-muted-foreground">
                  {pendingReviewCount + reviewedCount}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="h-8 gap-1.5 text-xs font-semibold shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-primary ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        }
      />

      {/* Summary KPI Cards (Collapsible) */}
      {showDashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in-50 duration-200">
          <Card className="rounded-xl border border-border bg-card shadow-2xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Pending Review</span>
                <div className="p-1.5 rounded-lg bg-warning/10 text-warning">
                  <Clock className="w-4 h-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{pendingReviewCount}</div>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Awaiting Reviewer action</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card shadow-2xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Reviewed (Awaiting Final)</span>
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <UserCheck className="w-4 h-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{reviewedCount}</div>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Recommended for Approver sign-off</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card shadow-2xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Approved Certificates</span>
                <div className="p-1.5 rounded-lg bg-success/10 text-success">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{approvedCount}</div>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Verified & released for production</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card shadow-2xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Returned / Rejected</span>
                <div className="p-1.5 rounded-lg bg-destructive/10 text-destructive">
                  <XCircle className="w-4 h-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{rejectedCount}</div>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Returned to Engineer for rework</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border">
        <Tabs value={statusFilterTab} onValueChange={setStatusFilterTab} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-5 h-9">
            <TabsTrigger value="Pending Review" className="text-xs gap-1.5">
              <span>Pending Review</span>
              {pendingReviewCount > 0 && (
                <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  {pendingReviewCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="Reviewed" className="text-xs gap-1.5">
              <span>Reviewed</span>
              {reviewedCount > 0 && (
                <span className="bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  {reviewedCount}
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
              <span>All ({allCount})</span>
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
      <DataTable
        columns={columns}
        data={calibrations}
        loading={loading}
        pageCount={pageCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={setPageIndex}
        onPageSizeChange={(s) => { setPageSize(s); setPageIndex(1); }}
        hideSearch={true}
        hideColumnToggle={false}
        emptyTitle="No Calibration Records Found"
        emptyDescription={
          statusFilterTab === "Pending Review"
            ? "All calibration submissions have been reviewed."
            : statusFilterTab === "Reviewed"
            ? "No reviewed calibrations awaiting final approver sign-off."
            : statusFilterTab === "Approved"
            ? "No approved calibrations found."
            : statusFilterTab === "Rejected"
            ? "No rejected records found."
            : "No matching records found for your filter."
        }
        emptyIcon={FileCheck}
      />

      {/* Main Review & Approval Modal */}
      {selectedRecord && (
        <Dialog
          open={reviewDialogOpen}
          onOpenChange={(open) => {
            setReviewDialogOpen(open);
            if (!open) {
              setSelectedRecord(null);
            }
          }}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col space-y-4">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between pr-6">
                <div>
                  <DialogTitle className="text-xl flex items-center gap-2">
                    <span>Review Calibration: {selectedRecord.certificate_number}</span>
                    {renderStatusBadge(selectedRecord.approval_status || "Calibration Completed")}
                  </DialogTitle>
                  {(() => {
                    const headerInst = selectedRecord.instrument || {};
                    const headerIdCode = headerInst.id_code || (selectedRecord as any).instrument_id_code || "-";
                    const headerName = headerInst.name || (selectedRecord as any).instrument_name || "N/A";
                    const headerPart = [headerInst.part_name || (selectedRecord as any).part_name, headerInst.part_no || (selectedRecord as any).part_no].filter(Boolean).join(" / ");

                    return (
                      <DialogDescription className="text-xs mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-muted-foreground">Gauge / Instrument:</span>
                          <span className="font-semibold text-foreground">{headerName}</span>
                        </span>

                        <span className="flex items-center gap-1">
                          <span className="font-medium text-muted-foreground">ID Code:</span>
                          <Badge
                            variant="outline"
                            className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted/50 border-border/80 text-foreground flex items-center gap-1"
                          >
                            <Hash className="w-3 h-3 text-primary/70 shrink-0" />
                            <span>{headerIdCode}</span>
                          </Badge>
                        </span>

                        {headerPart && (
                          <span className="flex items-center gap-1 text-xs">
                            <span className="font-medium text-muted-foreground">Part:</span>
                            <span className="font-medium text-foreground">{headerPart}</span>
                          </span>
                        )}
                      </DialogDescription>
                    );
                  })()}
                </div>
              </div>
            </DialogHeader>

            {/* Rejection Alert if record was previously rejected */}
            {selectedRecord.approval_status === "Rejected" && selectedRecord.rejection_reason && (
              <div className="bg-destructive/15 border border-destructive/30 text-destructive p-3 rounded-lg flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Rejection Comment from Reviewer / Approver ({selectedRecord.rejected_by || "Reviewer"}):</div>
                  <div className="mt-0.5">{selectedRecord.rejection_reason}</div>
                </div>
              </div>
            )}

            {/* Reviewer Sign-off Banner if reviewed */}
            {selectedRecord.reviewed_by && (
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300 p-3 rounded-lg flex items-start gap-2.5 text-xs">
                <UserCheck className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      Reviewed & Recommended by: {selectedRecord.reviewed_by}
                      {selectedRecord.reviewed_by_designation ? ` (${selectedRecord.reviewed_by_designation})` : " (Reviewer)"}
                    </span>
                    {selectedRecord.reviewed_at && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {new Date(selectedRecord.reviewed_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                  {selectedRecord.reviewer_remarks && (
                    <div className="mt-1 text-muted-foreground italic">
                      "{selectedRecord.reviewer_remarks}"
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Approver Sign-off Banner if approved */}
            {selectedRecord.approval_status === "Approved" && selectedRecord.approved_by && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300 p-3 rounded-lg flex items-start gap-2.5 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      Approved & Released by: {selectedRecord.approved_by}
                      {selectedRecord.approved_by_designation ? ` (${selectedRecord.approved_by_designation})` : " (Approver)"}
                    </span>
                    {selectedRecord.approved_at && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {new Date(selectedRecord.approved_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                  {selectedRecord.approver_remarks && (
                    <div className="mt-1 text-muted-foreground italic">
                      "{selectedRecord.approver_remarks}"
                    </div>
                  )}
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
              <TabsContent
                value="readings"
                ref={readingsScrollRef}
                className="flex-1 overflow-y-auto max-h-[68vh] space-y-4 pr-1 scrollbar-thin"
              >
                {(() => {
                  const layoutBlocks =
                    (selectedRecord as any).layout_blocks ||
                    ((selectedRecord as any).template as any)?.layout_blocks;
                  const hasLayoutBlocks = Array.isArray(layoutBlocks) && layoutBlocks.length > 0;

                  const points = selectedRecord.calibration_points || [];
                  const inst = selectedRecord.instrument || {};
                  const instIdCode = inst.id_code || (selectedRecord as any).instrument_id_code || "-";
                  const instName = inst.name || (selectedRecord as any).instrument_name || "-";
                  const instRange = inst.range || (selectedRecord as any).range || (selectedRecord as any).specification || "-";
                  const instPart = [inst.part_name || (selectedRecord as any).part_name, inst.part_no || (selectedRecord as any).part_no].filter(Boolean).join(" / ") || "-";
                  const unit = points[0]?.unit || "mm";

                  const calibratedBy = selectedRecord.calibrated_by || selectedRecord.created_by?.name || selectedRecord.created_by?.email || "N/A";
                  const calDate = selectedRecord.calibration_date
                    ? new Date(selectedRecord.calibration_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "N/A";

                  const envTemp = selectedRecord.environmental_conditions?.temperature ?? "20";
                  const envHum = selectedRecord.environmental_conditions?.humidity ?? "55";
                  const tempStr = String(envTemp).includes("°") ? envTemp : `${envTemp}°C`;
                  const humStr = String(envHum).includes("%") ? envHum : `${envHum}%`;
                  const envDisplay = `${tempStr} / ${humStr}`;

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
                  const hidden = new Set(
                    selectedRecord.hidden_columns ||
                    (selectedRecord.template as any)?.hidden_columns ||
                    []
                  );
                  const showStatusColumn = !hidden.has("status");
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
                      {/* Gauge / Instrument Metrology & Specifications Card */}
                      <div className="bg-card rounded-xl border border-border/80 shadow-2xs overflow-hidden">
                        {/* Top: Core Gauge Identity */}
                        <div className="p-3.5 sm:p-4 bg-muted/20 border-b border-border/60">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-center">
                            <div>
                              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase block mb-1">
                                Gauge / Instrument ID
                              </span>
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border/80 shadow-2xs">
                                <Hash className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="font-mono font-bold text-sm text-foreground tracking-tight select-all">
                                  {instIdCode}
                                </span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase block mb-1">
                                Gauge / Instrument Name
                              </span>
                              <span className="font-semibold text-foreground text-sm block" title={instName}>
                                {instName}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase block mb-1">
                                Part Name / Number
                              </span>
                              <span className="font-medium text-foreground text-sm block" title={instPart}>
                                {instPart}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Middle: Dedicated Specification & Range (Full Width, Zero Truncation, High Readability) */}
                        <div className="p-3.5 sm:p-4 bg-primary/[0.02] border-b border-border/60">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Ruler className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-[10px] font-bold tracking-wider text-primary uppercase">
                              Specification / Range
                            </span>
                          </div>
                          <div className="bg-background rounded-lg p-3 border border-primary/20 shadow-2xs">
                            <p className="text-sm font-medium text-foreground leading-relaxed whitespace-pre-wrap break-words select-text">
                              {instRange}
                            </p>
                          </div>
                        </div>

                        {/* Bottom: Environmental & Execution Audit Trail */}
                        <div className="p-3 sm:p-3.5 bg-muted/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Calibrated By</span>
                            <span className="font-medium text-foreground text-xs mt-0.5 block">{calibratedBy}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Calibration Date</span>
                            <span className="font-medium text-foreground text-xs tabular-nums mt-0.5 block">{calDate}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Temperature / Humidity</span>
                            <span className="font-medium text-foreground text-xs mt-0.5 block">{envDisplay}</span>
                          </div>
                          {uncertaintyStr && (
                            <div>
                              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Uncertainty</span>
                              <span className="font-mono font-semibold text-foreground text-xs mt-0.5 block">{uncertaintyStr}</span>
                            </div>
                          )}
                        </div>
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

                      {/* Optional Diagram / Schematic Image */}
                      {(() => {
                        const hasDiagramInBlocks = hasLayoutBlocks && layoutBlocks.some((b: any) => b.type === "diagram_block" || b.type === "diagram");
                        if (hasDiagramInBlocks) return null;

                        const diagramImg =
                          selectedRecord.diagram_image ||
                          ((selectedRecord as any).template as any)?.diagram_image;
                        if (!diagramImg) return null;
                        const diagramWidth =
                          selectedRecord.diagram_image_width ||
                          ((selectedRecord as any).template as any)?.diagram_image_width ||
                          240;
                        const diagramHeight =
                          selectedRecord.diagram_image_height ||
                          ((selectedRecord as any).template as any)?.diagram_image_height ||
                          140;
                        const diagramAlign =
                          selectedRecord.diagram_image_alignment ||
                          ((selectedRecord as any).template as any)?.diagram_image_alignment ||
                          "center";

                        return (
                          <div className="border rounded-lg p-2 bg-card space-y-1">
                            <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                              Instrument Schematic / Measurement Diagram
                            </div>
                            <div
                              className={`flex ${
                                diagramAlign === "left"
                                  ? "justify-start"
                                  : diagramAlign === "right"
                                  ? "justify-end"
                                  : "justify-center"
                              } p-1 bg-muted/20 rounded`}
                            >
                              <img
                                src={diagramImg}
                                alt="Instrument Diagram"
                                style={{
                                  width: `${diagramWidth}px`,
                                  maxHeight: `${diagramHeight}px`,
                                  objectFit: "contain",
                                }}
                                className="rounded border bg-background"
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Calibration Readings / Test Points */}
                      {hasLayoutBlocks ? (
                        <div className="border rounded-lg overflow-hidden bg-card">
                          <div className="bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground border-b flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-primary" />
                              <span>Calibration Measurement Data &amp; Specifications</span>
                              <Badge variant="secondary" className="text-[10px]">
                                Canvas Template
                              </Badge>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                selectedRecord.verdict === "PASS"
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-bold"
                                  : "bg-red-500/10 text-red-700 border-red-500/30 font-bold"
                              }
                            >
                              Verdict: {selectedRecord.verdict || "PASS"}
                            </Badge>
                          </div>
                          <div className="p-3 bg-card overflow-x-auto space-y-3">
                            <CanvasBlocksRenderer blocks={layoutBlocks} isScreen={true} />
                          </div>
                        </div>
                      ) : (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground border-b flex justify-between items-center">
                            <span>Calibration Test Points ({points.length} points)</span>
                            <Badge
                              variant="outline"
                              className={
                                selectedRecord.verdict === "PASS"
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-bold"
                                  : "bg-red-500/10 text-red-700 border-red-500/30 font-bold"
                              }
                            >
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
                                {showStatusColumn && <th className="px-3 py-2">Status</th>}
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
                                    {showStatusColumn && (
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
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>

              {/* Certificate Preview Tab */}
              <TabsContent
                value="certificate"
                ref={certScrollRef}
                className="flex-1 overflow-y-auto max-h-[68vh] p-3 bg-muted/30 border rounded-xl scrollbar-thin"
              >
                <CertificatePreview
                  calibration={selectedRecord}
                  instrumentName={selectedRecord.instrument?.name}
                />
              </TabsContent>
            </Tabs>

            {/* Calibration Review & Approval Action Footer */}
            <DialogFooter className="border-t pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>Current User:</span>
                <span className="font-semibold text-foreground">{user?.name}</span>
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {getRoleName(user?.role) || "User"}
                </Badge>
              </div>

              <div className="flex items-center justify-end gap-2 flex-wrap">
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
                  Close
                </Button>

                {/* Stage 1: Pending Review */}
                {((selectedRecord.approval_status || "Calibration Completed") === "Calibration Completed" ||
                  selectedRecord.approval_status === "Pending Review") &&
                  canAccess("calibration_approvals", "edit") && (
                    <>
                      {isReviewer ? (
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
                            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                            onClick={() => {
                              setReviewerRemarks("");
                              setReviewRecommendationDialogOpen(true);
                            }}
                          >
                            <UserCheck className="w-4 h-4" />
                            <span>Review & Recommend</span>
                          </Button>
                        </>
                      ) : (
                        <Badge variant="secondary" className="text-xs py-1.5 px-3 text-muted-foreground">
                          Awaiting Calibration Reviewer
                        </Badge>
                      )}
                    </>
                  )}

                {/* Stage 2: Reviewed (Awaiting Final Approver Sign-off) */}
                {(selectedRecord.approval_status === "Reviewed" ||
                  selectedRecord.approval_status === "Pending Approval") &&
                  canAccess("calibration_approvals", "edit") && (
                    <>
                      {isApprover ? (
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
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            onClick={() => {
                              setApproverRemarks("");
                              setApproveDialogOpen(true);
                            }}
                          >
                            <Check className="w-4 h-4" />
                            <span>Final Approve & Release</span>
                          </Button>
                        </>
                      ) : (
                        <Badge variant="secondary" className="text-xs py-1.5 px-3 text-muted-foreground">
                          Reviewed - Awaiting Final Approver
                        </Badge>
                      )}
                    </>
                  )}

                {/* Stage 3: Approved */}
                {selectedRecord.approval_status === "Approved" && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1.5 py-1.5 px-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Certificate Released</span>
                  </Badge>
                )}

                {/* Stage: Rejected / Rework */}
                {selectedRecord.approval_status === "Rejected" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="destructive" className="gap-1.5 py-1.5 px-3">
                      <X className="w-4 h-4" />
                      <span>Returned for Rework</span>
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 font-semibold"
                      onClick={() => handleOpenRevertModal(selectedRecord)}
                      title="Return certificate to previous stage (Pending Review) with note"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Return to Previous Stage</span>
                    </Button>
                    {(canAccess("calibrations", "delete") || canAccess("calibration_approvals", "delete") || isAdmin || isApprover) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 font-semibold"
                        onClick={() => handleOpenDeleteModal(selectedRecord)}
                        title="Delete rejected certificate and restore instrument to before stage"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Certificate</span>
                      </Button>
                    )}
                    {canAccess("calibrations", "create") && (
                      <Button
                        size="sm"
                        className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs"
                        onClick={() => {
                          setReviewDialogOpen(false);
                          navigate(`/calibration/new?recalibrateId=${selectedRecord.id}`);
                        }}
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Recalibrate Instrument</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Review Recommendation Confirmation Modal (Stage 1) */}
      <Dialog open={reviewRecommendationDialogOpen} onOpenChange={setReviewRecommendationDialogOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <UserCheck className="w-5 h-5" />
              <span>Complete Review & Recommend</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm that you have verified the measurement readings, formula calculations, master standard traceability, and uncertainty budgets for certificate{" "}
              <span className="font-bold text-foreground">{selectedRecord?.certificate_number}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 space-y-2.5 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-blue-500/20">
              <span className="text-muted-foreground font-medium">Instrument:</span>
              <span className="font-semibold text-foreground">
                {selectedRecord?.instrument?.name || "Instrument"}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-blue-500/20">
              <span className="text-muted-foreground font-medium">Calibrated By:</span>
              <span className="font-semibold text-foreground">
                {selectedRecord?.calibrated_by || "Calibration Engineer"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Reviewer:</span>
              <span className="font-semibold text-blue-700 dark:text-blue-400">
                {user?.name || "Calibration Reviewer"} ({getRoleName(user?.role) || "Reviewer"})
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-xs text-foreground block">
              Reviewer Remarks / Verification Notes (Optional)
            </label>
            <Textarea
              placeholder="e.g. Verified test points, environmental parameters, and master gauge calibration validity. Recommended for final approval."
              value={reviewerRemarks}
              onChange={(e) => setReviewerRemarks(e.target.value)}
              className="h-24 text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewRecommendationDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmReview}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-semibold"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
              <span>Complete Review & Forward</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Approve Confirmation Modal (Stage 2) */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              <span>Confirm Final Approval & Release</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to approve and release calibration certificate <span className="font-bold text-foreground">{selectedRecord?.certificate_number}</span>? This will officially issue the certificate.
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

            {/* Reviewed By Info */}
            {selectedRecord?.reviewed_by && (
              <div className="flex justify-between items-center pb-2 border-b border-emerald-500/20">
                <span className="text-muted-foreground font-medium">Reviewed By:</span>
                <span className="font-semibold text-blue-700 dark:text-blue-400 text-xs">
                  {selectedRecord.reviewed_by}
                  {selectedRecord.reviewed_by_designation ? ` (${selectedRecord.reviewed_by_designation})` : ""}
                </span>
              </div>
            )}

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

            {/* Approver identity */}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Approver:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs">
                {user?.name || "Quality Manager"} ({getRoleName(user?.role) || "Approver"})
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-xs text-foreground block">
              Approver Remarks / Authorization Note (Optional)
            </label>
            <Textarea
              placeholder="e.g. Certificate verified and authorized for release to customer / shop floor."
              value={approverRemarks}
              onChange={(e) => setApproverRemarks(e.target.value)}
              className="h-20 text-xs"
            />
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
              <span>Final Approve & Release</span>
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

      {/* Delete Rejected Certificate Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-lg space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-bold">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>Delete Rejected Calibration</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Delete calibration record{" "}
              <strong className="font-mono text-foreground font-bold">
                {calibrationToDelete?.certificate_number || calibrationToDelete?.id}
              </strong>{" "}
              and restore the instrument to its before stage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Info Notice */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Moved to Trash & Recovery Center</span>
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                This rejected calibration will be moved to the <strong>Recovery Center</strong> and can be restored if needed.
              </p>
            </div>

            {/* Instrument Master Rollback Notice */}
            <div className="p-3 rounded-lg border border-blue-500/25 bg-blue-500/10 text-xs text-blue-900 dark:text-blue-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Automatic Instrument Stage Rollback</span>
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                The instrument ({calibrationToDelete?.instrument?.name || "Instrument"} - {calibrationToDelete?.instrument?.id_code}) will be moved back to its previous operational stage before this calibration attempt, clearing the REJECTED block and restoring prior calibration/due dates.
              </p>
            </div>

            {/* Resequence Notice if sequence affects others */}
            {loadingDeletePreview ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Checking certificate sequence impact...</span>
              </div>
            ) : resequencePreview && resequencePreview.affectedCalibrations.length > 0 ? (
              <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/20 text-xs space-y-2">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Subsequent Certificate Renumbering Available
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Deleting this certificate leaves a sequence gap affecting{" "}
                  <strong>{resequencePreview.affectedCalibrations.length}</strong> subsequent certificate(s).
                </p>
                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="cal-app-reseq"
                      checked={resequenceChoice === "resequence"}
                      onChange={() => setResequenceChoice("resequence")}
                    />
                    <span>Resequence subsequent certificates (shift down by 1)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="cal-app-reseq"
                      checked={resequenceChoice === "keep"}
                      onChange={() => setResequenceChoice("keep")}
                    />
                    <span>Keep existing certificate numbers</span>
                  </label>
                </div>
              </div>
            ) : null}

            {/* Mandatory Reason Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Note / Reason for Deletion & Rollback</span>
                <span className="text-[11px] text-red-500 font-medium">Required</span>
              </label>
              <Textarea
                placeholder="e.g. Invalid test run, readings entered in error, returning instrument to previous operational state."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="h-20 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
              onClick={handleConfirmDelete}
              disabled={deleting || !deleteReason.trim()}
              className="gap-1.5 font-semibold"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>Delete & Roll Back</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return to Before Stage Dialog */}
      <Dialog open={revertModalOpen} onOpenChange={setRevertModalOpen}>
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600 font-bold">
              <Undo2 className="w-5 h-5 text-blue-600" />
              <span>Return to Before Stage</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Return rejected certificate{" "}
              <strong className="font-mono text-foreground font-bold">
                {calibrationToRevert?.certificate_number || calibrationToRevert?.id}
              </strong>{" "}
              to the <strong>Pending Review</strong> stage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-1.5 border-b border-blue-500/20">
                <span className="text-muted-foreground font-medium">Instrument:</span>
                <span className="font-semibold text-foreground">
                  {calibrationToRevert?.instrument?.name || "Instrument"} ({calibrationToRevert?.instrument?.id_code})
                </span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-blue-500/20">
                <span className="text-muted-foreground font-medium">Current Status:</span>
                <Badge variant="destructive" className="text-[10px] py-0 px-2">Rejected / Rework</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Target Stage:</span>
                <Badge variant="outline" className="text-[10px] py-0 px-2 bg-amber-500/10 text-amber-700 border-amber-500/30">
                  Pending Review (Stage 1)
                </Badge>
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 text-[11px] text-amber-900 dark:text-amber-200">
              Returning this record resets the rejection flag and updates the instrument status back to <strong>Under Calibration (Review Pending)</strong> so it can be re-evaluated.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Note / Remarks for Returning Stage</span>
                <span className="text-[11px] text-red-500 font-medium">Required</span>
              </label>
              <Textarea
                placeholder="e.g. Rejection reconsidered after supplementary test documents provided. Returning to reviewer for verification."
                value={revertNote}
                onChange={(e) => setRevertNote(e.target.value)}
                className="h-20 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevertModalOpen(false)}
              disabled={revertingStage}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmRevertStage}
              disabled={revertingStage || !revertNote.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-semibold"
            >
              {revertingStage ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Undo2 className="w-4 h-4" />
              )}
              <span>Return to Review Stage</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
