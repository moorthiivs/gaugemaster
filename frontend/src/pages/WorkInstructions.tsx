import { useState, useEffect, useId } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useSEO } from "@/hooks/useSEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
} from "lucide-react";
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

const COMMON_INSTRUCTIONS = [
  "WI-01: Instrument Handling & Cleaning Guidelines",
  "WI-02: Zero Error Setting & Parallax Minimization",
  "WI-03: Temperature Soaking & Environmental Preconditioning",
  "WI-04: Gauge Block Wringing & Contact Technique",
  "WI-05: Calibration Certificate Generation & Archival",
  "WI-06: Out of Calibration Quarantine Protocol",
];

export default function WorkInstructions() {
  useSEO({
    title: "Work Instructions — GaugeMaster",
    description: "Manage technical work instructions, operational guidance, and SOP documents",
  });

  const { user } = useAuth();
  const [instructions, setInstructions] = useState<WorkInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
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

  const wiDataListId = useId();

  const fetchInstructions = async () => {
    setLoading(true);
    try {
      const data = await getWorkInstructions({
        companyId: user?.companyId,
        search: searchQuery,
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
    fetchInstructions();
  };

  // Handle Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      toast.error("Please enter or select a Work Instruction Title");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", createTitle.trim());
      if (createDescription.trim()) {
        formData.append("description", createDescription.trim());
      }
      if (user?.companyId) {
        formData.append("companyId", user.companyId);
      }
      if (createFile) {
        formData.append("file", createFile);
      }

      const created = await createWorkInstruction(formData);
      toast.success("Work instruction saved successfully");
      setIsCreateOpen(false);
      setCreateTitle("");
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
      toast.error("Title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", editTitle.trim());
      if (editDescription !== undefined) {
        formData.append("description", editDescription.trim());
      }
      if (editActionDetails.trim()) {
        formData.append("actionDetails", editActionDetails.trim());
      }
      if (editFile) {
        formData.append("file", editFile);
      }

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
      toast.error("No document uploaded for this work instruction");
      return;
    }
    setViewerDoc({
      isOpen: true,
      title: item.title,
      documentName: item.document_name,
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

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Work Instructions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Step-by-step operating guidelines, calibration protocols, and technical job instructions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="gap-2 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create Work Instruction</span>
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
                placeholder="Search work instruction title or process..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-background"
              />
            </form>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInstructions}
              className="gap-1.5 h-9 shrink-0"
              title="Refresh list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-16 text-center font-semibold">S.No</TableHead>
                <TableHead className="font-semibold min-w-[220px]">Work Instruction / Title</TableHead>
                <TableHead className="font-semibold">Document</TableHead>
                <TableHead className="font-semibold w-24 text-center">Version</TableHead>
                <TableHead className="font-semibold">Last Updated</TableHead>
                <TableHead className="text-right font-semibold pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-muted-foreground text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      <span>Loading work instructions...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : instructions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-muted-foreground text-sm">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                      <p className="font-medium text-foreground">No work instructions found</p>
                      <p className="text-xs text-muted-foreground">
                        Click "Create Work Instruction" to upload instructions and standard guides.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                instructions.map((inst, index) => {
                  const isPdf =
                    inst.file_type?.toLowerCase().includes("pdf") ||
                    inst.document_name?.toLowerCase().endsWith(".pdf");

                  return (
                    <TableRow key={inst.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        {inst.document_name ? (
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
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono text-[11px] font-bold">
                          v{inst.version}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-foreground font-medium flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {inst.updated_by_name || inst.created_by_name || "User"}
                          </span>
                          <span className="flex items-center gap-1 text-[11px]">
                            <Clock className="h-2.5 w-2.5" />
                            {inst.updated_at ? format(new Date(inst.updated_at), "dd MMM yyyy, hh:mm a") : "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-4">
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
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CREATE WORK INSTRUCTION DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Work Instruction</DialogTitle>
            <DialogDescription>
              Select or enter the Work Instruction title / process and upload the guideline PDF or image.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wi-name" className="text-xs font-semibold">
                Title / Process <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wi-name"
                list={wiDataListId}
                placeholder="e.g. WI-01: Instrument Handling & Cleaning Guidelines"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                required
                className="h-9 text-sm"
              />
              <datalist id={wiDataListId}>
                {COMMON_INSTRUCTIONS.map((inst) => (
                  <option key={inst} value={inst} />
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground">
                Type a custom title or select from common standard suggestions.
              </p>
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
              <Button type="submit" disabled={isSubmitting} className="gap-2">
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

      {/* EDIT WORK INSTRUCTION DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Work Instruction</DialogTitle>
            <DialogDescription>
              Update instruction details or upload a new revision document (increments version).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
                className="h-9 text-sm"
              />
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
                placeholder="e.g. Added section 4 on digital vernier battery replacement"
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
            filePath: histItem.file_path,
            fileType: histItem.file_type,
            version: histItem.version,
          });
        }}
      />
    </div>
  );
}
