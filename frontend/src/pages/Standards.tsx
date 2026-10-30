import { useState, useEffect, useId, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { useSEO } from "@/hooks/useSEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/DataTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PlusCircle,
  Search,
  Eye,
  Edit2,
  Trash2,
  History,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Download,
  Upload,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  X,
  Filter,
  RotateCcw,
} from "lucide-react";
import {
  Standard,
  StandardHistory,
} from "@/types/documentation";
import {
  getStandards,
  getStandardTypes,
  createStandard,
  updateStandard,
  deleteStandard,
  getStandardHistory,
} from "@/lib/documentationActions";
import { DocumentViewerModal } from "@/components/documentation/DocumentViewerModal";
import { DocumentHistoryModal } from "@/components/documentation/DocumentHistoryModal";
import { isExcelFile, downloadFileFromUrl } from "@/lib/tokenStorage";

const COMMON_STANDARD_TYPES = [
  "International Standard (ISO)",
  "National Standard (IS)",
  "German Standard (DIN)",
  "American Standard (ASME)",
  "ASTM Standard",
  "British Standard (BS)",
  "Japanese Standard (JIS)",
  "Primary Reference Standard",
  "Working / Secondary Standard",
];

const MAX_DOC_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_DOC_FILE_SIZE_MB = 50;

export default function Standards() {
  useSEO({
    title: "Standards Master — GaugeMaster",
    description: "Manage calibration reference standards, standard numbers, types, and specification documents",
  });

  const { user } = useAuth();
  const { canAccess } = usePermissions();
  const [standards, setStandards] = useState<Standard[]>([]);
  const [serverTypes, setServerTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("All");
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStandardNumber, setCreateStandardNumber] = useState("");
  const [createStandardName, setCreateStandardName] = useState("");
  const [createStandardType, setCreateStandardType] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Post-upload immediate view state
  const [lastUploadedItem, setLastUploadedItem] = useState<Standard | null>(null);
  const [isSuccessPromptOpen, setIsSuccessPromptOpen] = useState(false);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Standard | null>(null);
  const [editStandardNumber, setEditStandardNumber] = useState("");
  const [editStandardName, setEditStandardName] = useState("");
  const [editStandardType, setEditStandardType] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editActionDetails, setEditActionDetails] = useState("");

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  // Viewer Modal State
  const [viewerDoc, setViewerDoc] = useState<{
    isOpen: boolean;
    title: string;
    documentName?: string;
    filePath?: string;
    fileType?: string;
    version?: number;
  }>({ isOpen: false, title: "" });

  // History Modal State
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    itemName: string;
    itemId: string;
    list: StandardHistory[];
    isLoading: boolean;
  }>({
    isOpen: false,
    itemName: "",
    itemId: "",
    list: [],
    isLoading: false,
  });

  const typeDataListId = useId();

  const fetchStandards = async () => {
    setLoading(true);
    try {
      const [data, types] = await Promise.all([
        getStandards({
          companyId: user?.companyId,
          search: searchQuery.trim() || undefined,
        }),
        getStandardTypes(user?.companyId).catch(() => []),
      ]);
      setStandards(data || []);
      setServerTypes(types || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load standards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandards();
  }, [user?.companyId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPageIndex(1);
    fetchStandards();
  };

  // Dynamically aggregate all distinct standard types from database/server & loaded records
  const dynamicStandardTypes = useMemo(() => {
    const typeCounts = new Map<string, number>();

    // Count types from loaded standards
    standards.forEach((std) => {
      const t = std.standard_type?.trim();
      if (t) {
        const existingKey = Array.from(typeCounts.keys()).find(
          (k) => k.toLowerCase() === t.toLowerCase()
        );
        if (existingKey) {
          typeCounts.set(existingKey, (typeCounts.get(existingKey) || 0) + 1);
        } else {
          typeCounts.set(t, 1);
        }
      }
    });

    // Also include types reported by server if not yet populated
    serverTypes.forEach((st) => {
      const t = st?.trim();
      if (t) {
        const existingKey = Array.from(typeCounts.keys()).find(
          (k) => k.toLowerCase() === t.toLowerCase()
        );
        if (!existingKey) {
          typeCounts.set(t, 0);
        }
      }
    });

    // Sort alphabetically
    const sortedTypes = Array.from(typeCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [
      { name: "All", count: standards.length },
      ...sortedTypes,
    ];
  }, [standards, serverTypes]);

  // Combined dynamic filtering & responsive live search
  const filteredStandards = useMemo(() => {
    return standards.filter((item) => {
      // 1. Dynamic Type Filter
      if (selectedTypeFilter !== "All") {
        const itemType = (item.standard_type || "").trim().toLowerCase();
        const targetType = selectedTypeFilter.trim().toLowerCase();
        if (itemType !== targetType && !itemType.includes(targetType)) {
          return false;
        }
      }

      // 2. Client-side search for instant live typing responsiveness
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesNumber = (item.standard_number || "").toLowerCase().includes(q);
        const matchesName = (item.standard_name || "").toLowerCase().includes(q);
        const matchesType = (item.standard_type || "").toLowerCase().includes(q);
        const matchesDesc = (item.description || "").toLowerCase().includes(q);
        const matchesDoc = (item.document_name || "").toLowerCase().includes(q);
        if (!matchesNumber && !matchesName && !matchesType && !matchesDesc && !matchesDoc) {
          return false;
        }
      }

      return true;
    });
  }, [standards, selectedTypeFilter, searchQuery]);

  // Ensure pageIndex resets when filter or search changes
  useEffect(() => {
    setPageIndex(1);
  }, [selectedTypeFilter, searchQuery]);

  // Pagination calculation
  const totalItems = filteredStandards.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedStandards = useMemo(() => {
    return filteredStandards.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);
  }, [filteredStandards, pageIndex, pageSize]);

  // Handle Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createStandardNumber.trim()) {
      toast.error("Standard Number is required (e.g. ISO 3650, IS 2984)");
      return;
    }
    if (!createStandardName.trim()) {
      toast.error("Standard Name is required (e.g. Gauge Blocks)");
      return;
    }
    if (!createStandardType.trim()) {
      toast.error("Standard Type is required (e.g. International, IS, DIN, test)");
      return;
    }

    if (createFile && createFile.size > MAX_DOC_FILE_SIZE_BYTES) {
      toast.error(`File size exceeds ${MAX_DOC_FILE_SIZE_MB}MB limit (Selected: ${(createFile.size / 1024 / 1024).toFixed(1)}MB). Please choose a file up to 50MB.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("standard_number", createStandardNumber.trim());
      formData.append("standard_name", createStandardName.trim());
      formData.append("standard_type", createStandardType.trim());
      if (createDescription.trim()) {
        formData.append("description", createDescription.trim());
      }
      if (user?.companyId) {
        formData.append("companyId", user.companyId);
      }
      if (createFile) {
        formData.append("file", createFile);
      }

      const created = await createStandard(formData);
      toast.success("Standard created successfully");
      setIsCreateOpen(false);
      setCreateStandardNumber("");
      setCreateStandardName("");
      setCreateStandardType("");
      setCreateDescription("");
      setCreateFile(null);

      // Offer immediate view prompt if file was uploaded
      if (created.file_path) {
        setLastUploadedItem(created);
        setIsSuccessPromptOpen(true);
      }
      fetchStandards();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create standard");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (item: Standard) => {
    setEditingItem(item);
    setEditStandardNumber(item.standard_number);
    setEditStandardName(item.standard_name);
    setEditStandardType(item.standard_type);
    setEditDescription(item.description || "");
    setEditFile(null);
    setEditActionDetails("");
    setIsEditOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editStandardNumber.trim()) {
      toast.error("Standard Number is required");
      return;
    }
    if (!editStandardName.trim()) {
      toast.error("Standard Name is required");
      return;
    }
    if (!editStandardType.trim()) {
      toast.error("Standard Type is required");
      return;
    }

    if (editFile && editFile.size > MAX_DOC_FILE_SIZE_BYTES) {
      toast.error(`File size exceeds ${MAX_DOC_FILE_SIZE_MB}MB limit (Selected: ${(editFile.size / 1024 / 1024).toFixed(1)}MB). Please choose a file up to 50MB.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("standard_number", editStandardNumber.trim());
      formData.append("standard_name", editStandardName.trim());
      formData.append("standard_type", editStandardType.trim());
      if (editDescription !== undefined) {
        formData.append("description", editDescription.trim());
      }
      if (editActionDetails.trim()) {
        formData.append("actionDetails", editActionDetails.trim());
      }
      if (editFile) {
        formData.append("file", editFile);
      }

      await updateStandard(editingItem.id, formData);
      toast.success("Standard updated successfully");
      setIsEditOpen(false);
      setEditingItem(null);
      fetchStandards();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update standard");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    try {
      await deleteStandard(deletingId, deleteReason.trim() || undefined);
      toast.success("Standard moved to Recovery Center");
      setDeletingId(null);
      setDeleteReason("");
      fetchStandards();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete standard");
    }
  };

  // View Document
  const handleView = (item: Standard) => {
    if (!item.file_path) {
      toast.error("No document uploaded for this standard");
      return;
    }
    const isExcel = isExcelFile(item.file_path, item.document_name, item.file_type);
    if (isExcel) {
      downloadFileFromUrl(item.file_path, item.document_name);
      toast.success(`Downloading ${item.document_name || "standard.xlsx"} to view in Excel`);
    }
    setViewerDoc({
      isOpen: true,
      title: `${item.standard_number} - ${item.standard_name}`,
      documentName: item.document_name,
      filePath: item.file_path,
      fileType: item.file_type,
      version: item.version,
    });
  };

  // Open History
  const handleOpenHistory = async (item: Standard) => {
    setHistoryModal({
      isOpen: true,
      itemName: `${item.standard_number} - ${item.standard_name}`,
      itemId: item.id,
      list: [],
      isLoading: true,
    });

    try {
      const history = await getStandardHistory(item.id);
      setHistoryModal((prev) => ({
        ...prev,
        list: history,
        isLoading: false,
      }));
    } catch (err: any) {
      toast.error("Failed to load standard revision history");
      setHistoryModal((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const standardColumns = useMemo<ColumnDef<Standard>[]>(
    () => [
      {
        id: "sno",
        header: "S.No",
        cell: ({ row }) => (
          <span className="text-center font-mono text-xs text-muted-foreground block">
            {(pageIndex - 1) * pageSize + row.index + 1}
          </span>
        ),
      },
      {
        accessorKey: "standard_number",
        header: "Standard Number",
        cell: ({ row }) => {
          const std = row.original;
          return (
            <div className="flex flex-col items-start gap-1">
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {std.standard_number}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "standard_name",
        header: "Standard Name",
        cell: ({ row }) => {
          const std = row.original;
          return (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {std.standard_name}
              </span>
              {std.description && (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {std.description}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "standard_type",
        header: "Standard Type",
        cell: ({ row }) => {
          const std = row.original;
          return (
            <Badge
              variant="outline"
              className="text-xs font-semibold border-border/80 bg-muted/50 text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => {
                if (std.standard_type) {
                  setSelectedTypeFilter(std.standard_type.trim());
                  setPageIndex(1);
                }
              }}
              title="Click to filter by this standard type"
            >
              {std.standard_type}
            </Badge>
          );
        },
      },
      {
        accessorKey: "document_name",
        header: "Document",
        cell: ({ row }) => {
          const std = row.original;
          const isExcel = isExcelFile(std.file_path, std.document_name, std.file_type);
          const isPdf =
            !isExcel &&
            (std.file_type?.toLowerCase().includes("pdf") ||
              std.document_name?.toLowerCase().endsWith(".pdf"));

          return std.document_name ? (
            <div className="flex items-center gap-2">
              {isExcel ? (
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : isPdf ? (
                <FileText className="h-4 w-4 text-red-500 shrink-0" />
              ) : (
                <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
              )}
              <span className="text-xs font-medium truncate max-w-[180px]" title={std.document_name}>
                {std.document_name}
              </span>
              {isExcel && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-mono">
                  EXCEL
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">No document</span>
          );
        },
      },
      {
        accessorKey: "version",
        header: "Version",
        cell: ({ row }) => (
          <div className="text-center">
            <Badge variant="secondary" className="font-mono text-[11px] font-bold">
              v{row.original.version}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: "updated_at",
        header: "Last Updated",
        cell: ({ row }) => {
          const std = row.original;
          return (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              <span className="text-foreground font-medium flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                {std.updated_by_name || std.created_by_name || "User"}
              </span>
              <span className="flex items-center gap-1 text-[11px]">
                <Clock className="h-2.5 w-2.5" />
                {std.updated_at ? format(new Date(std.updated_at), "dd MMM yyyy, hh:mm a") : "-"}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Action",
        meta: { align: "right" },
        cell: ({ row }) => {
          const std = row.original;
          const isExcel = isExcelFile(std.file_path, std.document_name, std.file_type);
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="outline"
                size="sm"
                className={`h-8 px-2.5 text-xs gap-1 ${
                  isExcel
                    ? "text-emerald-600 hover:text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    : "hover:text-primary hover:border-primary/50"
                }`}
                onClick={() => handleView(std)}
                disabled={!std.file_path}
                title={isExcel ? "Download Excel to view in local system" : "View Document inside application"}
              >
                {isExcel ? <Download className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isExcel ? "Download" : "View"}</span>
              </Button>
              {canAccess("standards", "edit") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => handleOpenEdit(std)}
                  title="Edit standard details or upload a new version"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => handleOpenHistory(std)}
                title="View revision history & previous document downloads"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
              {canAccess("standards", "delete") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                  onClick={() => {
                    setDeletingId(std.id);
                    setDeleteReason("");
                  }}
                  title="Move to Recovery Center"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [pageIndex, pageSize, canAccess],
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Standards Master
            </h1>
            <Badge variant="outline" className="font-mono text-xs font-semibold">
              {standards.length} Total
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Centralized repository of international, national, and company calibration standards with version control
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStandards}
            disabled={loading}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canAccess("standards", "create") && (
            <Button
              size="sm"
              className="h-9 gap-1.5 shadow-sm"
              onClick={() => setIsCreateOpen(true)}
            >
              <PlusCircle className="h-4 w-4" />
              Add Standard
            </Button>
          )}
        </div>
      </div>

      {/* Main Card with Search and Dynamic Filters */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Technical Standards Repository</CardTitle>
              <CardDescription className="text-xs">
                Search by Standard Number (e.g. ISO 3650), Standard Name, Type, or filter by category
              </CardDescription>
            </div>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search standards..."
                  className="pl-8 h-9 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setPageIndex(1);
                    }}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button type="submit" size="sm" variant="secondary" className="h-9 text-xs">
                Search
              </Button>
            </form>
          </div>

          {/* Dynamic Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-primary" />
              Filter by Type:
            </span>
            {dynamicStandardTypes.map((tab) => {
              const isSelected = selectedTypeFilter.toLowerCase() === tab.name.toLowerCase();
              return (
                <button
                  key={tab.name}
                  type="button"
                  onClick={() => {
                    setSelectedTypeFilter(tab.name);
                    setPageIndex(1);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  <span>{tab.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}

            {/* Quick Reset if filters are active */}
            {(selectedTypeFilter !== "All" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedTypeFilter("All");
                  setSearchQuery("");
                  setPageIndex(1);
                }}
                className="h-6 px-2 text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 ml-1 gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Filter
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <DataTable
            columns={standardColumns}
            data={paginatedStandards}
            loading={loading}
            pageCount={pageCount}
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setPageIndex}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPageIndex(1);
            }}
            hideSearch={true}
            hideColumnToggle={false}
            emptyTitle="No standards found"
            emptyDescription={
              searchQuery || selectedTypeFilter !== "All"
                ? "No standards match your filter criteria. Try adjusting or resetting your filter."
                : "Click 'Add Standard' to register your first standard."
            }
            emptyIcon={ShieldCheck}
          />
        </CardContent>
      </Card>

      {/* CREATE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Add Standard
              </DialogTitle>
              <DialogDescription>
                Register a new calibration standard, compliance standard, or reference document.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="standard-number" className="text-xs font-semibold">
                    Standard Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="standard-number"
                    placeholder="e.g. ISO 3650, IS 2984"
                    value={createStandardNumber}
                    onChange={(e) => setCreateStandardNumber(e.target.value)}
                    className="text-xs h-9"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="standard-type" className="text-xs font-semibold">
                    Standard Type <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="standard-type"
                    list={typeDataListId}
                    placeholder="e.g. International, IS, DIN, test"
                    value={createStandardType}
                    onChange={(e) => setCreateStandardType(e.target.value)}
                    className="text-xs h-9"
                    required
                  />
                  <datalist id={typeDataListId}>
                    {/* Combine common presets + existing dynamic types */}
                    {Array.from(new Set([...dynamicStandardTypes.filter(t => t.name !== 'All').map(t => t.name), ...COMMON_STANDARD_TYPES])).map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="standard-name" className="text-xs font-semibold">
                  Standard Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="standard-name"
                  placeholder="e.g. Gauge Blocks, Vernier Callipers"
                  value={createStandardName}
                  onChange={(e) => setCreateStandardName(e.target.value)}
                  className="text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-desc" className="text-xs font-semibold">
                  Description / Scope (Optional)
                </Label>
                <Textarea
                  id="create-desc"
                  placeholder="Enter specifications, scope, or applicability details..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="create-file" className="text-xs font-semibold">
                    Standard Document Attachment (Optional)
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Max 50MB (PDF, Image, Excel)
                  </span>
                </div>
                <div className="border-2 border-dashed rounded-lg p-3 text-center bg-muted/20 hover:bg-muted/40 transition-colors">
                  <Input
                    id="create-file"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.xlsx,.xls,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.size > MAX_DOC_FILE_SIZE_BYTES) {
                        toast.error(`File size exceeds ${MAX_DOC_FILE_SIZE_MB}MB limit (Selected: ${(file.size / 1024 / 1024).toFixed(1)}MB). Please choose a file up to 50MB.`);
                        e.target.value = "";
                        setCreateFile(null);
                        return;
                      }
                      setCreateFile(file);
                    }}
                    className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                  {createFile && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Selected: {createFile.name} ({(createFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Standard"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-primary" />
                Edit Standard
              </DialogTitle>
              <DialogDescription>
                Update details or upload a new document revision. Uploading a document increments the version number.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-std-num" className="text-xs font-semibold">
                    Standard Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-std-num"
                    value={editStandardNumber}
                    onChange={(e) => setEditStandardNumber(e.target.value)}
                    className="text-xs h-9"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-std-type" className="text-xs font-semibold">
                    Standard Type <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-std-type"
                    list={typeDataListId}
                    value={editStandardType}
                    onChange={(e) => setEditStandardType(e.target.value)}
                    className="text-xs h-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-std-name" className="text-xs font-semibold">
                  Standard Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-std-name"
                  value={editStandardName}
                  onChange={(e) => setEditStandardName(e.target.value)}
                  className="text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-desc" className="text-xs font-semibold">
                  Description / Scope
                </Label>
                <Textarea
                  id="edit-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              {/* Version revision upload */}
              <div className="space-y-1.5 p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-file" className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                    <Upload className="h-3.5 w-3.5" />
                    Upload New Revision (Optional)
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Current Version: <strong className="font-mono">v{editingItem?.version}</strong>
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Selecting a file will increment this standard to <strong>v{(editingItem?.version || 1) + 1}</strong> and archive the previous revision.
                </p>
                <Input
                  id="edit-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.xlsx,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > MAX_DOC_FILE_SIZE_BYTES) {
                      toast.error(`File size exceeds ${MAX_DOC_FILE_SIZE_MB}MB limit (Selected: ${(file.size / 1024 / 1024).toFixed(1)}MB). Please choose a file up to 50MB.`);
                      e.target.value = "";
                      setEditFile(null);
                      return;
                    }
                    setEditFile(file);
                  }}
                  className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary"
                />

                <div className="mt-2 space-y-1">
                  <Label htmlFor="edit-reason" className="text-[11px] text-muted-foreground">
                    Reason for revision / Revision notes
                  </Label>
                  <Input
                    id="edit-reason"
                    placeholder="e.g. Updated tolerance specifications according to 2026 amendment"
                    value={editActionDetails}
                    onChange={(e) => setEditActionDetails(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Standard"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION ALERT DIALOG */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingId(null);
            setDeleteReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Move Standard to Recovery Center?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This standard will be soft-deleted and moved to the Recovery Center. It will no longer appear in active lists, but can be safely restored anytime by an authorized administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2 space-y-1.5">
            <Label htmlFor="del-reason" className="text-xs font-medium">
              Reason for deletion (Optional)
            </Label>
            <Input
              id="del-reason"
              placeholder="e.g. Standard withdrawn or superseded by newer specification"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* POST-UPLOAD IMMEDIATE VIEW PROMPT */}
      <Dialog open={isSuccessPromptOpen} onOpenChange={setIsSuccessPromptOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 mb-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <DialogTitle className="text-center">Standard Uploaded Successfully!</DialogTitle>
            <DialogDescription className="text-center text-xs">
              <strong>{lastUploadedItem?.standard_number} - {lastUploadedItem?.standard_name}</strong> has been saved with document attachment{" "}
              <strong>{lastUploadedItem?.document_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-center gap-2 sm:justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSuccessPromptOpen(false)}
            >
              Close
            </Button>
            {lastUploadedItem && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setIsSuccessPromptOpen(false);
                  handleView(lastUploadedItem);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
                View Document Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DOCUMENT VIEWER MODAL */}
      <DocumentViewerModal
        isOpen={viewerDoc.isOpen}
        onClose={() => setViewerDoc({ isOpen: false, title: "" })}
        title={viewerDoc.title}
        documentName={viewerDoc.documentName}
        filePath={viewerDoc.filePath}
        fileType={viewerDoc.fileType}
        version={viewerDoc.version}
      />

      {/* DOCUMENT HISTORY MODAL */}
      <DocumentHistoryModal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal((prev) => ({ ...prev, isOpen: false }))}
        itemName={historyModal.itemName}
        itemId={historyModal.itemId}
        historyList={historyModal.list.map((h) => ({
          id: h.id,
          version: h.version,
          document_name: h.document_name,
          file_path: h.file_path,
          file_type: h.file_type,
          action_details: h.action_details,
          created_by_name: h.created_by_name,
          created_at: h.created_at,
        }))}
        isLoading={historyModal.isLoading}
      />
    </div>
  );
}
