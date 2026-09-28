import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/DataTable";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useSEO } from "@/hooks/useSEO";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Upload,
  Clock,
  User,
  CheckCircle2,
  RefreshCw,
  BookOpen,
  Hash,
  Cog,
  Filter,
  X,
} from "lucide-react";
import { DocumentationFilterCombobox } from "@/components/documentation/DocumentationFilterCombobox";
import {
  WorkInstruction,
  WorkInstructionHistory,
} from "@/types/documentation";
import {
  getWorkInstructions,
  createWorkInstruction,
  updateWorkInstruction,
  deleteWorkInstruction,
  getWorkInstructionHistory,
} from "@/lib/documentationActions";
import { DocumentViewerModal } from "@/components/documentation/DocumentViewerModal";
import { DocumentHistoryModal } from "@/components/documentation/DocumentHistoryModal";
import { InstrumentSearchSelector } from "@/components/documentation/InstrumentSearchSelector";
import { Instrument } from "@/types/instrument";

export default function WorkInstructions() {
  useSEO({
    title: "Work Instructions — GaugeMaster",
    description: "Manage technical work instructions, operational guidance, and SOP documents",
  });

  const { user } = useAuth();
  const [instructions, setInstructions] = useState<WorkInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdCode, setSelectedIdCode] = useState("");
  const [selectedPartName, setSelectedPartName] = useState("");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createIdCode, setCreateIdCode] = useState("");
  const [createPartName, setCreatePartName] = useState("");
  const [createInstrumentId, setCreateInstrumentId] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Post-upload immediate view prompt
  const [lastUploadedItem, setLastUploadedItem] = useState<WorkInstruction | null>(null);
  const [isSuccessPromptOpen, setIsSuccessPromptOpen] = useState(false);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkInstruction | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editIdCode, setEditIdCode] = useState("");
  const [editPartName, setEditPartName] = useState("");
  const [editInstrumentId, setEditInstrumentId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editActionDetails, setEditActionDetails] = useState("");

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Viewer Modal State
  const [viewerDoc, setViewerDoc] = useState<{
    isOpen: boolean;
    title: string;
    documentName?: string;
    idCode?: string;
    partName?: string;
    filePath?: string;
    fileType?: string;
    version?: number;
  }>({ isOpen: false, title: "" });

  // History Modal State
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    itemName: string;
    itemId: string;
    list: WorkInstructionHistory[];
    isLoading: boolean;
  }>({
    isOpen: false,
    itemName: "",
    itemId: "",
    list: [],
    isLoading: false,
  });

  const fetchInstructions = async () => {
    setLoading(true);
    try {
      const data = await getWorkInstructions({
        companyId: user?.companyId,
      });
      setInstructions(data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load work instructions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructions();
  }, [user?.companyId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  // Derive unique ID Codes and Part Names with item counts
  const { uniqueIdCodes, idCodeCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    instructions.forEach((item) => {
      const code = item.id_code?.trim();
      if (code) {
        counts[code] = (counts[code] || 0) + 1;
      }
    });
    const unique = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return { uniqueIdCodes: unique, idCodeCounts: counts };
  }, [instructions]);

  const { uniquePartNames, partNameCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    instructions.forEach((item) => {
      const part = item.part_name?.trim();
      if (part) {
        counts[part] = (counts[part] || 0) + 1;
      }
    });
    const unique = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return { uniquePartNames: unique, partNameCounts: counts };
  }, [instructions]);

  // Combined client-side filtered data
  const filteredInstructions = useMemo(() => {
    let result = instructions;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.id_code?.toLowerCase().includes(q) ||
          item.part_name?.toLowerCase().includes(q) ||
          item.document_name?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q)
      );
    }

    if (selectedIdCode.trim()) {
      const targetCode = selectedIdCode.toLowerCase().trim();
      result = result.filter(
        (item) => item.id_code?.toLowerCase().trim() === targetCode
      );
    }

    if (selectedPartName.trim()) {
      const targetPart = selectedPartName.toLowerCase().trim();
      result = result.filter(
        (item) => item.part_name?.toLowerCase().trim() === targetPart
      );
    }

    return result;
  }, [instructions, searchQuery, selectedIdCode, selectedPartName]);

  const isFiltered = Boolean(selectedIdCode || selectedPartName || searchQuery.trim());

  const handleClearFilters = () => {
    setSelectedIdCode("");
    setSelectedPartName("");
    setSearchQuery("");
    setPageIndex(1);
  };

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      toast.error("Please select a gauge or enter a work instruction title");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", createTitle.trim());
      if (createIdCode.trim()) formData.append("id_code", createIdCode.trim());
      if (createPartName.trim()) formData.append("part_name", createPartName.trim());
      if (createInstrumentId) formData.append("instrument_id", createInstrumentId);
      if (createDescription.trim()) formData.append("description", createDescription.trim());
      if (user?.companyId) formData.append("companyId", user.companyId);
      if (createFile) formData.append("file", createFile);

      const created = await createWorkInstruction(formData);
      toast.success("Work instruction saved successfully");
      setIsCreateOpen(false);
      setCreateTitle("");
      setCreateIdCode("");
      setCreatePartName("");
      setCreateInstrumentId("");
      setCreateDescription("");
      setCreateFile(null);

      // Offer immediate view option
      if (created.file_path) {
        setLastUploadedItem(created);
        setIsSuccessPromptOpen(true);
      }
      fetchInstructions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save work instruction");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (item: WorkInstruction) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditIdCode(item.id_code || "");
    setEditPartName(item.part_name || "");
    setEditInstrumentId(item.instrument_id || "");
    setEditDescription(item.description || "");
    setEditFile(null);
    setEditActionDetails("");
    setIsEditOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editTitle.trim()) {
      toast.error("Work instruction title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", editTitle.trim());
      formData.append("id_code", editIdCode.trim());
      formData.append("part_name", editPartName.trim());
      if (editInstrumentId) formData.append("instrument_id", editInstrumentId);
      if (editDescription !== undefined) formData.append("description", editDescription.trim());
      if (editActionDetails.trim()) formData.append("actionDetails", editActionDetails.trim());
      if (editFile) formData.append("file", editFile);

      await updateWorkInstruction(editingItem.id, formData);
      toast.success("Work instruction updated successfully");
      setIsEditOpen(false);
      setEditingItem(null);
      fetchInstructions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update work instruction");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    try {
      await deleteWorkInstruction(deletingId);
      toast.success("Work instruction deleted successfully");
      setDeletingId(null);
      fetchInstructions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete work instruction");
    }
  };

  // View Document
  const handleView = (item: WorkInstruction) => {
    if (!item.file_path) {
      toast.error("No document uploaded for this instruction");
      return;
    }
    setViewerDoc({
      isOpen: true,
      title: item.title,
      documentName: item.document_name,
      idCode: item.id_code,
      partName: item.part_name,
      filePath: item.file_path,
      fileType: item.file_type,
      version: item.version,
    });
  };

  // Open History
  const handleOpenHistory = async (item: WorkInstruction) => {
    setHistoryModal({
      isOpen: true,
      itemName: item.title,
      itemId: item.id,
      list: [],
      isLoading: true,
    });

    try {
      const history = await getWorkInstructionHistory(item.id);
      setHistoryModal((prev) => ({
        ...prev,
        list: history,
        isLoading: false,
      }));
    } catch (err: any) {
      toast.error("Failed to load work instruction history");
      setHistoryModal((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const paginatedInstructions = useMemo(() => {
    const start = (pageIndex - 1) * pageSize;
    return filteredInstructions.slice(start, start + pageSize);
  }, [filteredInstructions, pageIndex, pageSize]);

  const workInstructionColumns = useMemo<ColumnDef<WorkInstruction>[]>(
    () => [
      {
        id: "sno",
        header: () => <div className="text-center font-semibold">S.No</div>,
        cell: ({ row }) => (
          <div className="text-center font-mono text-xs text-muted-foreground">
            {(pageIndex - 1) * pageSize + row.index + 1}
          </div>
        ),
        size: 60,
      },
      {
        accessorKey: "title",
        header: () => <span className="font-semibold min-w-[200px]">Work Instruction / Title</span>,
        cell: ({ row }) => {
          const inst = row.original;
          return (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {inst.title}
              </span>
              {inst.description && (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {inst.description}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "id_code",
        header: () => <span className="font-semibold whitespace-nowrap min-w-[140px]">ID Code / IMTE</span>,
        cell: ({ row }) => {
          const code = row.original.id_code;
          return code ? (
            <Badge
              variant="outline"
              className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md whitespace-nowrap inline-flex items-center gap-1.5 bg-muted/40 border-border/80 text-foreground shadow-2xs hover:bg-muted/60 max-w-[220px]"
              title={code}
            >
              <Hash className="h-3 w-3 text-primary/70 shrink-0" />
              <span className="truncate">{code}</span>
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground italic">-</span>
          );
        },
        size: 160,
      },
      {
        accessorKey: "part_name",
        header: () => <span className="font-semibold whitespace-nowrap min-w-[120px]">Part Name</span>,
        cell: ({ row }) => {
          const part = row.original.part_name;
          return part ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground whitespace-nowrap truncate max-w-[180px]" title={part}>
              <Cog className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{part}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">-</span>
          );
        },
        size: 140,
      },
      {
        accessorKey: "document_name",
        header: () => <span className="font-semibold">Document</span>,
        cell: ({ row }) => {
          const inst = row.original;
          const isPdf =
            inst.file_type?.toLowerCase().includes("pdf") ||
            inst.document_name?.toLowerCase().endsWith(".pdf");

          return inst.document_name ? (
            <div className="flex items-center gap-2">
              {isPdf ? (
                <FileText className="h-4 w-4 text-red-500 shrink-0" />
              ) : (
                <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
              )}
              <span className="text-xs font-medium truncate max-w-[180px]" title={inst.document_name}>
                {inst.document_name}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">No document</span>
          );
        },
      },
      {
        accessorKey: "version",
        header: () => <div className="text-center font-semibold">Version</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <Badge variant="secondary" className="font-mono text-[11px] font-bold">
              v{row.original.version}
            </Badge>
          </div>
        ),
        size: 80,
      },
      {
        accessorKey: "updated_at",
        header: () => <span className="font-semibold">Last Updated</span>,
        cell: ({ row }) => {
          const inst = row.original;
          return (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              <span className="text-foreground font-medium flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                {inst.updated_by_name || inst.created_by_name || "User"}
              </span>
              <span className="flex items-center gap-1 text-[11px]">
                <Clock className="h-2.5 w-2.5" />
                {inst.updated_at ? format(new Date(inst.updated_at), "dd MMM yyyy, hh:mm a") : "-"}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right font-semibold pr-4">Action</div>,
        cell: ({ row }) => {
          const inst = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1 hover:text-primary hover:border-primary/50"
                onClick={() => handleView(inst)}
                disabled={!inst.file_path}
                title="View Document"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">View</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1 hover:text-blue-600 hover:border-blue-300"
                onClick={() => handleOpenEdit(inst)}
                title="Edit Instruction"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs gap-1 hover:text-amber-600 hover:border-amber-300"
                onClick={() => handleOpenHistory(inst)}
                title="Revision History"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                onClick={() => setDeletingId(inst.id)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [pageIndex, pageSize]
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Work Instructions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Standard operating procedures (SOP), operational guidance, and instrument handling instructions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setCreateTitle("");
              setCreateIdCode("");
              setCreatePartName("");
              setCreateInstrumentId("");
              setCreateDescription("");
              setCreateFile(null);
              setIsCreateOpen(true);
            }}
            className="gap-2 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create Work Instruction</span>
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border shadow-xs">
        <CardHeader className="p-4 border-b bg-muted/20 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Left: Search Bar */}
            <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search title, document, description..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPageIndex(1);
                }}
                className="pl-9 pr-8 h-9 text-sm bg-background"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setPageIndex(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </form>

            {/* Right: Filters & Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter 1: ID Code / IMTE */}
              <DocumentationFilterCombobox
                label="ID Code / IMTE"
                placeholder="All ID Codes / IMTE"
                searchPlaceholder="Search ID Code / IMTE..."
                icon={Hash}
                options={uniqueIdCodes}
                value={selectedIdCode}
                onChange={(val) => {
                  setSelectedIdCode(val);
                  setPageIndex(1);
                }}
                countMap={idCodeCounts}
              />

              {/* Filter 2: Part Name */}
              <DocumentationFilterCombobox
                label="Part Name"
                placeholder="All Part Names"
                searchPlaceholder="Search Part Name..."
                icon={Cog}
                options={uniquePartNames}
                value={selectedPartName}
                onChange={(val) => {
                  setSelectedPartName(val);
                  setPageIndex(1);
                }}
                countMap={partNameCounts}
              />

              {/* Clear Filters / Reset Button */}
              {isFiltered && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                  title="Reset all filters"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </Button>
              )}

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchInstructions}
                className="gap-1.5 h-9 shrink-0"
                title="Refresh list"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          {/* Active Filter Badges Bar */}
          {isFiltered && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1 text-[11px]">
                <Filter className="h-3 w-3 text-primary" />
                Active Filters:
              </span>
              {selectedIdCode && (
                <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-0.5 font-mono text-[11px] bg-primary/10 text-primary border-primary/20 rounded-md whitespace-nowrap">
                  <Hash className="h-3 w-3 text-primary" />
                  <span>IMTE: {selectedIdCode}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIdCode("");
                      setPageIndex(1);
                    }}
                    className="hover:bg-primary/20 rounded p-0.5 text-primary"
                    title="Remove filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {selectedPartName && (
                <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-0.5 text-[11px] bg-primary/10 text-primary border-primary/20 rounded-md whitespace-nowrap">
                  <Cog className="h-3 w-3 text-primary" />
                  <span>Part: {selectedPartName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPartName("");
                      setPageIndex(1);
                    }}
                    className="hover:bg-primary/20 rounded p-0.5 text-primary"
                    title="Remove filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1.5 pl-2 pr-1 py-0.5 text-[11px] rounded-md whitespace-nowrap">
                  <Search className="h-3 w-3 text-muted-foreground" />
                  <span>Search: "{searchQuery}"</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setPageIndex(1);
                    }}
                    className="hover:bg-muted rounded p-0.5 text-muted-foreground hover:text-foreground"
                    title="Remove filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <span className="text-muted-foreground ml-auto text-[11px]">
                Showing {filteredInstructions.length} of {instructions.length}
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-4">
          <DataTable
            columns={workInstructionColumns}
            data={paginatedInstructions}
            loading={loading}
            pageIndex={pageIndex}
            pageSize={pageSize}
            pageCount={Math.max(1, Math.ceil(filteredInstructions.length / pageSize))}
            totalItems={filteredInstructions.length}
            onPageChange={setPageIndex}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPageIndex(1);
            }}
            hideSearch={true}
            hideColumnToggle={false}
            emptyTitle={isFiltered ? "No matching work instructions" : "No work instructions found"}
            emptyDescription={
              isFiltered
                ? "Try adjusting or clearing your ID code or part name filters."
                : 'Click "Create Work Instruction" to link instructions and SOPs to your gauges.'
            }
            emptyAction={
              isFiltered ? (
                <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-2 text-xs">
                  Reset All Filters
                </Button>
              ) : undefined
            }
            emptyIcon={<BookOpen className="h-8 w-8 text-muted-foreground/50" />}
          />
        </CardContent>
      </Card>

      {/* CREATE WORK INSTRUCTION DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Work Instruction</DialogTitle>
            <DialogDescription>
              Select a gauge/instrument from the master list (filtered by device type: gauge) to link instructions, and attach the SOP or guide.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {/* High performance 2,000+ Gauge Selector */}
            <InstrumentSearchSelector
              label="Select Target Gauge / Instrument"
              required
              companyId={user?.companyId}
              defaultDeviceType="gauge"
              selectedInstrumentId={createInstrumentId}
              selectedName={createTitle}
              selectedIdCode={createIdCode}
              selectedPartName={createPartName}
              onSelect={(selected: Instrument) => {
                const titleText = selected.name ? `WI: ${selected.name}` : "";
                setCreateTitle(titleText);
                setCreateIdCode(selected.id_code || "");
                setCreatePartName(selected.part_name || "");
                setCreateInstrumentId(selected.id || "");
              }}
              onClear={() => {
                setCreateTitle("");
                setCreateIdCode("");
                setCreatePartName("");
                setCreateInstrumentId("");
              }}
            />

            <div className="space-y-1.5">
              <Label htmlFor="wi-title" className="text-xs font-semibold">
                Instruction Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wi-title"
                placeholder="e.g. WI: Operating & Zero Check for Vernier Caliper"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-wi-desc" className="text-xs font-semibold">
                Description / Purpose (Optional)
              </Label>
              <Textarea
                id="create-wi-desc"
                placeholder="Brief summary of requirements, safety measures, or target operators..."
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Upload Document (PDF or Image)
              </Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/40 transition-colors">
                <input
                  type="file"
                  id="wi-file-upload"
                  className="hidden"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCreateFile(e.target.files[0]);
                    }
                  }}
                />
                <label
                  htmlFor="wi-file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  {createFile ? (
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-semibold text-primary">{createFile.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {(createFile.size / 1024 / 1024).toFixed(2)} MB &bull; Click to replace
                      </span>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-foreground">
                        Click to select or drop instruction PDF / image
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Supported: PDF, PNG, JPG, WebP, SVG (Max 25MB)
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !createTitle} className="gap-2">
                {isSubmitting ? "Saving..." : "Save Work Instruction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SUCCESS PROMPT WITH VIEW OPTION */}
      <Dialog open={isSuccessPromptOpen} onOpenChange={setIsSuccessPromptOpen}>
        <DialogContent className="max-w-md text-center">
          <div className="flex flex-col items-center justify-center gap-3 py-2">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-full">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <DialogTitle className="text-lg font-bold">Instruction Uploaded Successfully</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{lastUploadedItem?.title}</span> has
              been saved with version v{lastUploadedItem?.version}.
            </DialogDescription>
            <div className="flex items-center gap-2 pt-3 w-full justify-center">
              <Button
                variant="outline"
                className="w-1/2 text-xs"
                onClick={() => setIsSuccessPromptOpen(false)}
              >
                Close
              </Button>
              <Button
                className="w-1/2 text-xs gap-1.5 bg-primary text-primary-foreground"
                onClick={() => {
                  setIsSuccessPromptOpen(false);
                  if (lastUploadedItem) handleView(lastUploadedItem);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>View Document</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT INSTRUCTION DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Work Instruction</DialogTitle>
            <DialogDescription>
              Update instruction details, change linked instrument, or upload a new revision.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            {/* Re-select or change from master list */}
            <InstrumentSearchSelector
              label="Linked Gauge in Master List"
              required
              companyId={user?.companyId}
              defaultDeviceType="gauge"
              selectedInstrumentId={editInstrumentId}
              selectedName={editTitle}
              selectedIdCode={editIdCode}
              selectedPartName={editPartName}
              onSelect={(inst: Instrument) => {
                if (!editTitle) {
                  setEditTitle(inst.name ? `WI: ${inst.name}` : "");
                }
                setEditIdCode(inst.id_code || "");
                setEditPartName(inst.part_name || "");
                setEditInstrumentId(inst.id || "");
              }}
              onClear={() => {
                setEditInstrumentId("");
              }}
            />

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ID Code / IMTE</Label>
                <Input
                  value={editIdCode}
                  onChange={(e) => setEditIdCode(e.target.value)}
                  placeholder="e.g. PG-01"
                  className="h-9 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Part Name</Label>
                <Input
                  value={editPartName}
                  onChange={(e) => setEditPartName(e.target.value)}
                  placeholder="e.g. Flange Adapter"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Upload New Document Revision (Optional)
              </Label>
              <div className="border border-dashed rounded-lg p-3 text-center hover:bg-muted/40 transition-colors">
                <input
                  type="file"
                  id="edit-wi-file-upload"
                  className="hidden"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setEditFile(e.target.files[0]);
                    }
                  }}
                />
                <label htmlFor="edit-wi-file-upload" className="cursor-pointer flex flex-col items-center gap-1">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  {editFile ? (
                    <span className="text-xs font-semibold text-primary">{editFile.name} (Will increment to v{(editingItem?.version || 1) + 1})</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Current file: {editingItem?.document_name || "None"} &bull; Click to upload replacement
                    </span>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Revision Notes / Reason for Change</Label>
              <Input
                placeholder="e.g. Revised cleaning frequency step in section 3"
                value={editActionDetails}
                onChange={(e) => setEditActionDetails(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Instruction?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this work instruction and its revision history?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Instruction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DOCUMENT VIEWER MODAL */}
      <DocumentViewerModal
        isOpen={viewerDoc.isOpen}
        onClose={() => setViewerDoc((prev) => ({ ...prev, isOpen: false }))}
        title={viewerDoc.title}
        documentName={viewerDoc.documentName}
        idCode={viewerDoc.idCode}
        partName={viewerDoc.partName}
        filePath={viewerDoc.filePath}
        fileType={viewerDoc.fileType}
        version={viewerDoc.version}
      />

      {/* HISTORY MODAL */}
      <DocumentHistoryModal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal((prev) => ({ ...prev, isOpen: false }))}
        entityName="Work Instruction"
        itemName={historyModal.itemName}
        itemId={historyModal.itemId}
        historyList={historyModal.list}
        isLoading={historyModal.isLoading}
        onViewDocument={(histItem) => {
          setViewerDoc({
            isOpen: true,
            title: `${histItem.title || historyModal.itemName} (v${histItem.version})`,
            documentName: histItem.document_name,
            idCode: histItem.id_code,
            partName: histItem.part_name,
            filePath: histItem.file_path,
            fileType: histItem.file_type,
            version: histItem.version,
          });
        }}
      />
    </div>
  );
}
