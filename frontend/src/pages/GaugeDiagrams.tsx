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
  Compass,
  Hash,
  Cog,
} from "lucide-react";
import {
  GaugeDiagram,
  GaugeDiagramHistory,
} from "@/types/documentation";
import {
  getGaugeDiagrams,
  createGaugeDiagram,
  updateGaugeDiagram,
  deleteGaugeDiagram,
  getGaugeDiagramHistory,
} from "@/lib/documentationActions";
import { DocumentViewerModal } from "@/components/documentation/DocumentViewerModal";
import { DocumentHistoryModal } from "@/components/documentation/DocumentHistoryModal";
import { InstrumentSearchSelector } from "@/components/documentation/InstrumentSearchSelector";
import { Instrument } from "@/types/instrument";

export default function GaugeDiagrams() {
  useSEO({
    title: "Gauge Diagrams — GaugeMaster",
    description: "Manage technical drawings, diagrams, and dimensional schematics of gauges",
  });

  const { user } = useAuth();
  const [diagrams, setDiagrams] = useState<GaugeDiagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createGaugeName, setCreateGaugeName] = useState("");
  const [createIdCode, setCreateIdCode] = useState("");
  const [createPartName, setCreatePartName] = useState("");
  const [createInstrumentId, setCreateInstrumentId] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Post-upload immediate view prompt
  const [lastUploadedItem, setLastUploadedItem] = useState<GaugeDiagram | null>(null);
  const [isSuccessPromptOpen, setIsSuccessPromptOpen] = useState(false);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GaugeDiagram | null>(null);
  const [editGaugeName, setEditGaugeName] = useState("");
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
    list: GaugeDiagramHistory[];
    isLoading: boolean;
  }>({
    isOpen: false,
    itemName: "",
    itemId: "",
    list: [],
    isLoading: false,
  });

  const fetchDiagrams = async () => {
    setLoading(true);
    try {
      const data = await getGaugeDiagrams({
        companyId: user?.companyId,
        search: searchQuery,
      });
      setDiagrams(data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load gauge diagrams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagrams();
  }, [user?.companyId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDiagrams();
  };

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createGaugeName.trim()) {
      toast.error("Please select a gauge from the Instruments Master list");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("gauge_name", createGaugeName.trim());
      if (createIdCode.trim()) formData.append("id_code", createIdCode.trim());
      if (createPartName.trim()) formData.append("part_name", createPartName.trim());
      if (createInstrumentId) formData.append("instrument_id", createInstrumentId);
      if (createDescription.trim()) formData.append("description", createDescription.trim());
      if (user?.companyId) formData.append("companyId", user.companyId);
      if (createFile) formData.append("file", createFile);

      const created = await createGaugeDiagram(formData);
      toast.success("Gauge diagram saved successfully");
      setIsCreateOpen(false);
      setCreateGaugeName("");
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
      fetchDiagrams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save gauge diagram");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (item: GaugeDiagram) => {
    setEditingItem(item);
    setEditGaugeName(item.gauge_name);
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
    if (!editGaugeName.trim()) {
      toast.error("Gauge Name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("gauge_name", editGaugeName.trim());
      formData.append("id_code", editIdCode.trim());
      formData.append("part_name", editPartName.trim());
      if (editInstrumentId) formData.append("instrument_id", editInstrumentId);
      if (editDescription !== undefined) formData.append("description", editDescription.trim());
      if (editActionDetails.trim()) formData.append("actionDetails", editActionDetails.trim());
      if (editFile) formData.append("file", editFile);

      await updateGaugeDiagram(editingItem.id, formData);
      toast.success("Gauge diagram updated successfully");
      setIsEditOpen(false);
      setEditingItem(null);
      fetchDiagrams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update gauge diagram");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    try {
      await deleteGaugeDiagram(deletingId);
      toast.success("Gauge diagram deleted successfully");
      setDeletingId(null);
      fetchDiagrams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete gauge diagram");
    }
  };

  // View Document
  const handleView = (item: GaugeDiagram) => {
    if (!item.file_path) {
      toast.error("No diagram document uploaded for this gauge");
      return;
    }
    setViewerDoc({
      isOpen: true,
      title: item.gauge_name,
      documentName: item.document_name,
      idCode: item.id_code,
      partName: item.part_name,
      filePath: item.file_path,
      fileType: item.file_type,
      version: item.version,
    });
  };

  // Open History
  const handleOpenHistory = async (item: GaugeDiagram) => {
    setHistoryModal({
      isOpen: true,
      itemName: item.gauge_name,
      itemId: item.id,
      list: [],
      isLoading: true,
    });

    try {
      const history = await getGaugeDiagramHistory(item.id);
      setHistoryModal((prev) => ({
        ...prev,
        list: history,
        isLoading: false,
      }));
    } catch (err: any) {
      toast.error("Failed to load gauge diagram history");
      setHistoryModal((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const paginatedDiagrams = useMemo(() => {
    const start = (pageIndex - 1) * pageSize;
    return diagrams.slice(start, start + pageSize);
  }, [diagrams, pageIndex, pageSize]);

  const gaugeDiagramColumns = useMemo<ColumnDef<GaugeDiagram>[]>(
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
        accessorKey: "gauge_name",
        header: () => <span className="font-semibold min-w-[200px]">Gauge Name</span>,
        cell: ({ row }) => {
          const diag = row.original;
          return (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {diag.gauge_name}
              </span>
              {diag.description && (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {diag.description}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "id_code",
        header: () => <span className="font-semibold">ID Code / IMTE</span>,
        cell: ({ row }) => {
          const diag = row.original;
          return diag.id_code ? (
            <Badge variant="outline" className="font-mono text-[11px] font-semibold bg-muted/40 gap-1">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <span>{diag.id_code}</span>
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground italic">-</span>
          );
        },
      },
      {
        accessorKey: "part_name",
        header: () => <span className="font-semibold">Part Name</span>,
        cell: ({ row }) => {
          const diag = row.original;
          return diag.part_name ? (
            <div className="flex items-center gap-1 text-xs font-medium text-foreground">
              <Cog className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{diag.part_name}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">-</span>
          );
        },
      },
      {
        accessorKey: "document_name",
        header: () => <span className="font-semibold">Diagram File</span>,
        cell: ({ row }) => {
          const diag = row.original;
          const isPdf =
            diag.file_type?.toLowerCase().includes("pdf") ||
            diag.document_name?.toLowerCase().endsWith(".pdf");

          return diag.document_name ? (
            <div className="flex items-center gap-2">
              {isPdf ? (
                <FileText className="h-4 w-4 text-red-500 shrink-0" />
              ) : (
                <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
              )}
              <span className="text-xs font-medium truncate max-w-[180px]" title={diag.document_name}>
                {diag.document_name}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">No file</span>
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
          const diag = row.original;
          return (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              <span className="text-foreground font-medium flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                {diag.updated_by_name || diag.created_by_name || "User"}
              </span>
              <span className="flex items-center gap-1 text-[11px]">
                <Clock className="h-2.5 w-2.5" />
                {diag.updated_at ? format(new Date(diag.updated_at), "dd MMM yyyy, hh:mm a") : "-"}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right font-semibold pr-4">Action</div>,
        cell: ({ row }) => {
          const diag = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1 hover:text-primary hover:border-primary/50"
                onClick={() => handleView(diag)}
                disabled={!diag.file_path}
                title="View Diagram"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">View</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1 hover:text-blue-600 hover:border-blue-300"
                onClick={() => handleOpenEdit(diag)}
                title="Edit Diagram"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs gap-1 hover:text-amber-600 hover:border-amber-300"
                onClick={() => handleOpenHistory(diag)}
                title="Revision History"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                onClick={() => setDeletingId(diag.id)}
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
          <h1 className="text-2xl font-bold tracking-tight">Gauge Diagrams</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Engineering drawings, technical diagrams, and dimensional schematics of gauges
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setCreateGaugeName("");
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
            <span>Create Gauge Diagram</span>
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border shadow-xs">
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search gauge name, ID code / IMTE, or part..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-background"
              />
            </form>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDiagrams}
              className="gap-1.5 h-9 shrink-0"
              title="Refresh list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <DataTable
            columns={gaugeDiagramColumns}
            data={paginatedDiagrams}
            loading={loading}
            pageIndex={pageIndex}
            pageSize={pageSize}
            pageCount={Math.max(1, Math.ceil(diagrams.length / pageSize))}
            totalItems={diagrams.length}
            onPageChange={setPageIndex}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPageIndex(1);
            }}
            hideSearch={true}
            hideColumnToggle={false}
            emptyTitle="No gauge diagrams found"
            emptyDescription='Click "Create Gauge Diagram" to select gauges from the master list and link engineering schematics.'
            emptyIcon={<Compass className="h-8 w-8 text-muted-foreground/50" />}
          />
        </CardContent>
      </Card>

      {/* CREATE GAUGE DIAGRAM DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Gauge Diagram</DialogTitle>
            <DialogDescription>
              Select a gauge from the Instruments Master (filtered by device type: gauge) and attach the diagram schematic.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {/* High performance 2,000+ Gauge Selector with on-screen filter */}
            <InstrumentSearchSelector
              label="Select Gauge from Master"
              required
              companyId={user?.companyId}
              defaultDeviceType="gauge"
              selectedInstrumentId={createInstrumentId}
              selectedName={createGaugeName}
              selectedIdCode={createIdCode}
              selectedPartName={createPartName}
              onSelect={(inst: Instrument) => {
                setCreateGaugeName(inst.name || "");
                setCreateIdCode(inst.id_code || "");
                setCreatePartName(inst.part_name || "");
                setCreateInstrumentId(inst.id || "");
              }}
              onClear={() => {
                setCreateGaugeName("");
                setCreateIdCode("");
                setCreatePartName("");
                setCreateInstrumentId("");
              }}
            />

            <div className="space-y-1.5">
              <Label htmlFor="create-diag-desc" className="text-xs font-semibold">
                Description / Drawing Spec (Optional)
              </Label>
              <Textarea
                id="create-diag-desc"
                placeholder="Notes on zero check points, drawing number, or tolerance dimensions..."
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Upload Diagram / Drawing (Image or PDF)
              </Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/40 transition-colors">
                <input
                  type="file"
                  id="diag-file-upload"
                  className="hidden"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCreateFile(e.target.files[0]);
                    }
                  }}
                />
                <label
                  htmlFor="diag-file-upload"
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
                        Click to select or drop diagram image / PDF
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Supported: PNG, JPG, WebP, SVG, PDF (Max 25MB)
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
              <Button type="submit" disabled={isSubmitting || !createGaugeName} className="gap-2">
                {isSubmitting ? "Saving..." : "Save Gauge Diagram"}
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
            <DialogTitle className="text-lg font-bold">Diagram Uploaded Successfully</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{lastUploadedItem?.gauge_name}</span> has
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
                <span>View Diagram</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT DIAGRAM DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Gauge Diagram</DialogTitle>
            <DialogDescription>
              Update gauge details, change linked instrument, or upload a new revision.
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
              selectedName={editGaugeName}
              selectedIdCode={editIdCode}
              selectedPartName={editPartName}
              onSelect={(inst: Instrument) => {
                setEditGaugeName(inst.name || "");
                setEditIdCode(inst.id_code || "");
                setEditPartName(inst.part_name || "");
                setEditInstrumentId(inst.id || "");
              }}
              onClear={() => {
                setEditInstrumentId("");
              }}
            />

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
                Upload New Diagram Revision (Optional)
              </Label>
              <div className="border border-dashed rounded-lg p-3 text-center hover:bg-muted/40 transition-colors">
                <input
                  type="file"
                  id="edit-diag-file-upload"
                  className="hidden"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setEditFile(e.target.files[0]);
                    }
                  }}
                />
                <label htmlFor="edit-diag-file-upload" className="cursor-pointer flex flex-col items-center gap-1">
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
                placeholder="e.g. Added detail view of vernier scale markings"
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
            <AlertDialogTitle>Delete Gauge Diagram?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this gauge diagram and its revision history?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Diagram
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
        entityName="Gauge Diagram"
        itemName={historyModal.itemName}
        itemId={historyModal.itemId}
        historyList={historyModal.list}
        isLoading={historyModal.isLoading}
        onViewDocument={(histItem) => {
          setViewerDoc({
            isOpen: true,
            title: `${histItem.gauge_name || historyModal.itemName} (v${histItem.version})`,
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
