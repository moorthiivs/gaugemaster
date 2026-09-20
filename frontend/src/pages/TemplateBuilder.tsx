import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/DataTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FileSpreadsheet,
  Search,
  Edit,
  Trash2,
  Copy,
  Layers,
  Ruler,
  Gauge,
  Thermometer,
  RotateCw,
  Zap,
  Scale,
  Droplets,
  Download,
  Upload,
  X,
  Sparkles,
  LayoutGrid,
  List,
} from "lucide-react";
import { CALIBRATION_TYPES } from "@/types/calibration";
import { CalibrationTemplate } from "@/types/template";
import { getTemplates, createTemplate, deleteTemplate } from "@/lib/templateActions";
import { TemplateExportModal } from "@/components/calibration/template-management/TemplateExportModal";
import { TemplateImportModal } from "@/components/calibration/template-management/TemplateImportModal";
import { TemplateBulkDeleteModal } from "@/components/calibration/template-management/TemplateBulkDeleteModal";

const TYPE_ICONS: Record<string, any> = {
  dimensional: Ruler,
  pressure: Gauge,
  temperature: Thermometer,
  torque: RotateCw,
  electrical: Zap,
  weight: Scale,
  flow: Droplets,
};

const DISCIPLINE_THEMES: Record<
  string,
  { badge: string; border: string; accent: string; lightBg: string }
> = {
  dimensional: {
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
    border: "hover:border-sky-500/40",
    accent: "from-sky-500 to-sky-400",
    lightBg: "hover:bg-sky-500/[0.015]",
  },
  pressure: {
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
    border: "hover:border-blue-500/40",
    accent: "from-blue-500 to-blue-400",
    lightBg: "hover:bg-blue-500/[0.015]",
  },
  temperature: {
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
    border: "hover:border-amber-500/40",
    accent: "from-amber-500 to-amber-400",
    lightBg: "hover:bg-amber-500/[0.015]",
  },
  torque: {
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25",
    border: "hover:border-purple-500/40",
    accent: "from-purple-500 to-purple-400",
    lightBg: "hover:bg-purple-500/[0.015]",
  },
  electrical: {
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    border: "hover:border-emerald-500/40",
    accent: "from-emerald-500 to-emerald-400",
    lightBg: "hover:bg-emerald-500/[0.015]",
  },
  weight: {
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
    border: "hover:border-rose-500/40",
    accent: "from-rose-500 to-rose-400",
    lightBg: "hover:bg-rose-500/[0.015]",
  },
  flow: {
    badge: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25",
    border: "hover:border-teal-500/40",
    accent: "from-teal-500 to-teal-400",
    lightBg: "hover:bg-teal-500/[0.015]",
  },
};

const DEFAULT_THEME = {
  badge: "bg-primary/10 text-primary border-primary/25",
  border: "hover:border-primary/40",
  accent: "from-primary to-primary/60",
  lightBg: "hover:bg-primary/[0.015]",
};

export default function TemplateBuilder() {
  useSEO({
    title: "Calibration Template Builder — GaugeMaster",
    description: "Create and manage reusable calibration formats categorized by calibration type",
  });

  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAccess } = usePermissions();
  const [templates, setTemplates] = useState<CalibrationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");

  // Selection & Management State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  // Delete Dialog State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // View Mode: "card" | "table"
  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    try {
      return (localStorage.getItem("gm_template_view_mode") as "card" | "table") || "card";
    } catch {
      return "card";
    }
  });

  const handleSetViewMode = (mode: "card" | "table") => {
    setViewMode(mode);
    try {
      localStorage.setItem("gm_template_view_mode", mode);
    } catch {
      // ignore
    }
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("gm_template_page_size");
      return stored ? parseInt(stored, 10) : 10;
    } catch {
      return 10;
    }
  });

  const handleSetPageSize = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    try {
      localStorage.setItem("gm_template_page_size", String(size));
    } catch {
      // ignore
    }
  };

  // Reset to page 1 when search or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedType]);

  const fetchTemplates = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getTemplates({
        userId: user.id,
        companyId: user.companyId,
        calibrationType: selectedType !== "All" ? selectedType : undefined,
      });
      setTemplates(data || []);
    } catch {
      toast.error("Failed to load calibration templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [user?.id, selectedType]);

  const handleOpenNewModal = () => {
    navigate("/calibration/templates/builder");
  };

  const handleOpenEditModal = (tpl: CalibrationTemplate) => {
    navigate(`/calibration/templates/builder?id=${tpl.id}`);
  };

  const handleDuplicate = async (tpl: CalibrationTemplate) => {
    try {
      const duplicateData: Partial<CalibrationTemplate> = {
        ...tpl,
        id: undefined,
        name: `${tpl.name} (Copy)`,
        createdAt: undefined,
        updatedAt: undefined,
        user: undefined,
        userId: user?.id,
        companyId: (user as any)?.companyId || (user as any)?.company?.id || tpl.companyId,
      };
      await createTemplate(duplicateData);
      toast.success("Template duplicated successfully!");
      fetchTemplates();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to duplicate template";
      toast.error(msg);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteId) return;
    try {
      await deleteTemplate(deleteId);
      toast.success("Template deleted successfully");
      setTemplates((prev) => prev.filter((t) => t.id !== deleteId));
      setSelectedIds((prev) => prev.filter((id) => id !== deleteId));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to delete template";
      toast.error(msg);
    } finally {
      setDeleteId(null);
    }
  };

  const filteredTemplates = templates.filter((tpl) => {
    const query = searchQuery.toLowerCase();
    return (
      tpl.name.toLowerCase().includes(query) ||
      tpl.instrument_type.toLowerCase().includes(query) ||
      tpl.calibration_type.toLowerCase().includes(query) ||
      (tpl.description && tpl.description.toLowerCase().includes(query))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredTemplates.length);
  const paginatedTemplates = filteredTemplates.slice(startIndex, endIndex);

  const selectedTemplatesList = templates.filter((t) => selectedIds.includes(t.id));

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTemplates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTemplates.map((t) => t.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const tableColumns = useMemo<ColumnDef<CalibrationTemplate>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <div className="flex justify-center">
            <Checkbox
              checked={selectedIds.length > 0 && selectedIds.length === filteredTemplates.length}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all templates"
            />
          </div>
        ),
        cell: ({ row }) => {
          const tpl = row.original;
          const isSelected = selectedIds.includes(tpl.id);
          return (
            <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelectOne(tpl.id)}
                aria-label={`Select ${tpl.name}`}
              />
            </div>
          );
        },
      },
      {
        accessorKey: "calibration_type",
        header: "Discipline",
        cell: ({ row }) => {
          const tpl = row.original;
          const IconComp = TYPE_ICONS[tpl.calibration_type] || Layers;
          const calTypeConfig = CALIBRATION_TYPES.find((c) => c.type === tpl.calibration_type);
          const theme = DISCIPLINE_THEMES[tpl.calibration_type] || DEFAULT_THEME;
          return (
            <Badge
              variant="outline"
              className={`text-[10px] gap-1 font-semibold capitalize tracking-wide px-2 py-0.5 rounded-full border ${theme.badge}`}
            >
              <IconComp className="w-3 h-3 shrink-0" />
              <span>{calTypeConfig?.label || tpl.calibration_type}</span>
            </Badge>
          );
        },
      },
      {
        accessorKey: "name",
        header: "Template Name",
        cell: ({ row }) => {
          const tpl = row.original;
          return (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-foreground group-hover:text-primary transition-colors text-[13px]">
                  {tpl.name}
                </span>
                {tpl.calibration_points && (
                  <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded">
                    {tpl.calibration_points.length} pts
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/80 line-clamp-1 max-w-[380px]">
                {tpl.description || "Standard calibration procedure template."}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "instrument_type",
        header: "Instrument",
        cell: ({ row }) => (
          <span className="font-medium text-foreground/90 bg-muted/50 dark:bg-muted/30 px-2 py-0.5 rounded text-[11px] inline-block truncate max-w-[160px]">
            {row.original.instrument_type}
          </span>
        ),
      },
      {
        id: "unit_tol",
        header: "Unit / Tol",
        cell: ({ row }) => {
          const tpl = row.original;
          return (
            <div className="flex items-center gap-1.5 font-mono text-[11.5px]">
              <span className="font-semibold text-foreground">{tpl.default_unit || "—"}</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-muted-foreground">
                {tpl.default_tolerance !== undefined && tpl.default_tolerance !== null
                  ? `±${tpl.default_tolerance}`
                  : "—"}
              </span>
            </div>
          );
        },
      },
      {
        id: "environment",
        header: "Environment",
        cell: ({ row }) => {
          const tpl = row.original;
          return (
            <div className="flex items-center gap-2 font-medium text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1 text-muted-foreground/90">
                <Thermometer className="w-3 h-3 text-amber-500 shrink-0" />
                {tpl.environmental_defaults?.temperature || "20"}°C
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="flex items-center gap-1 text-muted-foreground/90">
                <Droplets className="w-3 h-3 text-sky-500 shrink-0" />
                {tpl.environmental_defaults?.humidity || "55"}% RH
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        meta: { align: "right" },
        cell: ({ row }) => {
          const tpl = row.original;
          return (
            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors"
                title="Duplicate Template"
                onClick={() => handleDuplicate(tpl)}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              {canAccess("templates", "edit") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                  title="Edit Template"
                  onClick={() => handleOpenEditModal(tpl)}
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              )}
              {canAccess("templates", "delete") && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  title="Delete Template"
                  onClick={() => setDeleteId(tpl.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [selectedIds, filteredTemplates, canAccess]
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
              <Layers className="w-6 h-6" />
            </div>
            <span>Calibration Template Builder</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Create, manage, export, and import reusable calibration formats across organizations with automated metrology calculation rules.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportModalOpen(true)}
            className="gap-1.5 text-xs h-9 px-3.5 border-border/80 hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-all"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            Import Templates
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportModalOpen(true)}
            className="gap-1.5 text-xs h-9 px-3.5 border-border/80 hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-all"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            Export Packages
            {selectedIds.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-primary/15 text-primary text-[10px] font-bold rounded-full">
                {selectedIds.length}
              </span>
            )}
          </Button>

          {canAccess("templates", "delete") && selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteModalOpen(true)}
              className="gap-1.5 text-xs h-9 px-3.5 shadow-sm animate-in fade-in zoom-in-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedIds.length})
            </Button>
          )}

          {canAccess("templates", "create") && (
            <Button
              onClick={handleOpenNewModal}
              size="sm"
              className="gap-2 shadow-sm text-xs h-9 px-4 font-semibold hover:shadow-md transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Create New Template
            </Button>
          )}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
        <button
          onClick={() => setSelectedType("All")}
          className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border ${
            selectedType === "All"
              ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
              : "bg-card/80 hover:bg-accent/80 text-muted-foreground hover:text-foreground border-border/70"
          }`}
        >
          <span>All Categories</span>
          <span
            className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold transition-colors ${
              selectedType === "All"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-muted text-muted-foreground group-hover:text-foreground"
            }`}
          >
            {templates.length}
          </span>
        </button>

        {CALIBRATION_TYPES.map((ct) => {
          const IconComp = TYPE_ICONS[ct.type] || Layers;
          const count = templates.filter((t) => t.calibration_type === ct.type).length;
          const isSelected = selectedType === ct.type;
          return (
            <button
              key={ct.type}
              onClick={() => setSelectedType(ct.type)}
              className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                  : "bg-card/80 hover:bg-accent/80 text-muted-foreground hover:text-foreground border-border/70"
              }`}
            >
              <IconComp
                className={`w-3.5 h-3.5 ${
                  isSelected ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
                }`}
              />
              <span>{ct.label}</span>
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold transition-colors ${
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground group-hover:text-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar & Search Bar */}
      <div className="bg-card/80 dark:bg-card/40 backdrop-blur-md border border-border/80 rounded-xl p-3 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[260px] max-w-2xl">
          <div
            role="button"
            tabIndex={0}
            onClick={toggleSelectAll}
            className="inline-flex items-center justify-center rounded-lg text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2 shrink-0 cursor-pointer select-none border border-border/60 bg-background/50"
          >
            <Checkbox
              checked={selectedIds.length > 0 && selectedIds.length === filteredTemplates.length}
              onCheckedChange={toggleSelectAll}
            />
            <span>Select All</span>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold bg-muted text-muted-foreground"
            >
              {selectedIds.length}/{filteredTemplates.length}
            </Badge>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg text-xs shrink-0 animate-in fade-in zoom-in-95">
              <span className="font-semibold text-primary">{selectedIds.length} selected</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
                className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
              {canAccess("templates", "delete") && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteModalOpen(true)}
                  className="h-6 px-2 text-[11px] gap-1 shadow-none"
                >
                  <Trash2 className="w-3 h-3" />
                  Bulk Delete
                </Button>
              )}
            </div>
          )}

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              placeholder="Search templates by name, instrument type, standard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 text-xs h-9 bg-background/80 border-border/80 focus:border-primary/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Showing <span className="font-semibold text-foreground">{filteredTemplates.length}</span> of{" "}
              <span className="font-semibold text-foreground">{templates.length}</span> templates
            </span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted/60 dark:bg-muted/40 p-0.5 rounded-lg border border-border/70 shadow-2xs">
            <button
              type="button"
              onClick={() => handleSetViewMode("card")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === "card"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Card Grid View"
              aria-label="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode("table")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Data Table View"
              aria-label="Data Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Templates Grid / Content */}
      {loading ? (
        viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-60 rounded-xl border border-border/60 bg-card p-5 space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-muted rounded" />
                  <div className="w-24 h-5 bg-muted rounded-full" />
                </div>
                <div className="space-y-2">
                  <div className="w-3/4 h-5 bg-muted rounded" />
                  <div className="w-1/2 h-3.5 bg-muted rounded" />
                </div>
                <div className="w-full h-10 bg-muted/60 rounded-lg" />
                <div className="h-10 bg-muted/40 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs animate-pulse">
            <div className="h-11 bg-muted/50 border-b border-border/80" />
            <div className="divide-y divide-border/50">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 bg-card flex items-center px-4 gap-4">
                  <div className="w-4 h-4 bg-muted rounded shrink-0" />
                  <div className="w-28 h-5 bg-muted rounded-full shrink-0" />
                  <div className="w-48 h-5 bg-muted rounded" />
                  <div className="w-28 h-5 bg-muted rounded ml-auto" />
                  <div className="w-24 h-5 bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        )
      ) : filteredTemplates.length > 0 ? (
        <div className="space-y-4">
          {viewMode === "card" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedTemplates.map((tpl) => {
                const IconComp = TYPE_ICONS[tpl.calibration_type] || Layers;
                const calTypeConfig = CALIBRATION_TYPES.find(
                  (c) => c.type === tpl.calibration_type
                );
                const theme = DISCIPLINE_THEMES[tpl.calibration_type] || DEFAULT_THEME;
                const isSelected = selectedIds.includes(tpl.id);

                return (
                  <Card
                    key={tpl.id}
                    className={`group relative overflow-hidden rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                      theme.lightBg
                    } ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02] shadow-sm"
                        : `border-border/80 ${theme.border} hover:shadow-md hover:-translate-y-0.5`
                    }`}
                  >
                    {/* Top Accent Stripe */}
                    <div
                      className={`h-1 w-full bg-gradient-to-r ${theme.accent} opacity-70 group-hover:opacity-100 transition-opacity`}
                    />

                    <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      {/* Top Row: Checkbox + Discipline Badge */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectOne(tpl.id)}
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                            <Badge
                              variant="outline"
                              className={`text-[10px] gap-1 font-semibold capitalize tracking-wide px-2 py-0.5 rounded-full border ${theme.badge}`}
                            >
                              <IconComp className="w-3 h-3 shrink-0" />
                              <span>{calTypeConfig?.label || tpl.calibration_type}</span>
                            </Badge>
                          </div>

                          {tpl.calibration_points && (
                            <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                              {tpl.calibration_points.length} pts
                            </span>
                          )}
                        </div>

                        {/* Template Title & Instrument Subtitle */}
                        <div className="space-y-1">
                          <h3
                            onClick={() => handleOpenEditModal(tpl)}
                            className="text-[15px] font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 cursor-pointer tracking-tight"
                            title={tpl.name}
                          >
                            {tpl.name}
                          </h3>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground/80">Instrument:</span>
                            <span className="font-semibold text-foreground/90 bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-[11px] truncate max-w-[200px]">
                              {tpl.instrument_type}
                            </span>
                          </div>
                        </div>

                        {/* Description (Uniform height) */}
                        <div className="min-h-[2.25rem]">
                          {tpl.description ? (
                            <p
                              className="text-muted-foreground/85 line-clamp-2 text-xs leading-relaxed"
                              title={tpl.description}
                            >
                              {tpl.description}
                            </p>
                          ) : (
                            <p className="text-muted-foreground/40 italic text-xs leading-relaxed">
                              Standard calibration procedure template.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Specification Metrics Micro-Dashboard */}
                      <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-3 gap-2 bg-muted/40 dark:bg-muted/20 border border-border/60 rounded-lg p-2.5 text-center">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider block">
                              Unit
                            </span>
                            <span className="text-xs font-semibold text-foreground font-mono block truncate">
                              {tpl.default_unit || "—"}
                            </span>
                          </div>
                          <div className="space-y-0.5 border-x border-border/50 px-1">
                            <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider block">
                              Tolerance
                            </span>
                            <span className="text-xs font-semibold text-foreground font-mono block truncate">
                              {tpl.default_tolerance !== undefined && tpl.default_tolerance !== null
                                ? `±${tpl.default_tolerance}`
                                : "—"}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider block">
                              Test Points
                            </span>
                            <span className="text-xs font-semibold text-foreground font-mono block">
                              {tpl.calibration_points?.length || 0}
                            </span>
                          </div>
                        </div>

                        {/* Card Footer: Environmental Conditions & Action Buttons */}
                        <div className="flex items-center justify-between pt-2.5 border-t border-border/60 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-2 font-medium">
                            <span className="flex items-center gap-1 text-muted-foreground/90">
                              <Thermometer className="w-3 h-3 text-amber-500 shrink-0" />
                              {tpl.environmental_defaults?.temperature || "20"}°C
                            </span>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="flex items-center gap-1 text-muted-foreground/90">
                              <Droplets className="w-3 h-3 text-sky-500 shrink-0" />
                              {tpl.environmental_defaults?.humidity || "55"}% RH
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-md transition-colors"
                              title="Duplicate Template"
                              onClick={() => handleDuplicate(tpl)}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            {canAccess("templates", "edit") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                                title="Edit Template"
                                onClick={() => handleOpenEditModal(tpl)}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {canAccess("templates", "delete") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                title="Delete Template"
                                onClick={() => setDeleteId(tpl.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <DataTable
              columns={tableColumns}
              data={paginatedTemplates}
              loading={loading}
              pageCount={totalPages}
              pageIndex={currentPage}
              pageSize={pageSize}
              totalItems={filteredTemplates.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
              onRowClick={(tpl) => handleOpenEditModal(tpl)}
              hideSearch={true}
              hideColumnToggle={false}
              emptyTitle="No templates found"
              emptyDescription="Try adjusting your search query or discipline filter."
              emptyIcon={Layers}
            />
          )}

          {/* Enhanced Pagination Bar for Cards View */}
          {viewMode === "card" && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-muted-foreground bg-card/60 dark:bg-card/40 backdrop-blur-xs p-3 rounded-xl border border-border/70 shadow-2xs">
              <div className="flex items-center gap-3 flex-wrap">
                <span>
                  Showing <strong className="font-semibold text-foreground font-mono">{filteredTemplates.length === 0 ? 0 : startIndex + 1}</strong> to{" "}
                  <strong className="font-semibold text-foreground font-mono">{endIndex}</strong> of{" "}
                  <strong className="font-semibold text-foreground font-mono">{filteredTemplates.length}</strong> templates
                </span>
                <div className="flex items-center gap-1.5 ml-1">
                  <span>Per page:</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => handleSetPageSize(Number(val))}
                  >
                    <SelectTrigger className="w-[72px] h-8 text-xs font-mono font-semibold rounded-lg bg-background/80 border-border/80">
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
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5 text-xs rounded-lg border-border/80"
                >
                  Previous
                </Button>

                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  if (pNum === 1 || pNum === totalPages || Math.abs(pNum - currentPage) <= 1) {
                    return (
                      <Button
                        key={pNum}
                        variant={currentPage === pNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pNum)}
                        className={`h-8 w-8 text-xs p-0 font-mono font-bold rounded-lg ${
                          currentPage === pNum
                            ? "bg-primary text-primary-foreground shadow-2xs"
                            : "border-border/80 hover:bg-muted/60"
                        }`}
                      >
                        {pNum}
                      </Button>
                    );
                  }
                  if (pNum === 2 && currentPage > 3) {
                    return <span key="dots-left" className="px-1 text-muted-foreground">...</span>;
                  }
                  if (pNum === totalPages - 1 && currentPage < totalPages - 2) {
                    return <span key="dots-right" className="px-1 text-muted-foreground">...</span>;
                  }
                  return null;
                })}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-2.5 text-xs rounded-lg border-border/80"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 px-4 rounded-xl border border-dashed border-border/80 bg-card/40">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 border border-border/80 flex items-center justify-center mx-auto mb-4 text-muted-foreground shadow-xs">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">No templates found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mb-5 leading-relaxed">
            {searchQuery
              ? `No templates matched your query "${searchQuery}". Try clearing filters or refining your search.`
              : "Standardize your measurement workflows by creating reusable calibration templates or importing existing packages."}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="gap-2 text-xs"
              >
                <X className="w-3.5 h-3.5" />
                Clear Search
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(true)}
              className="gap-2 text-xs"
            >
              <Upload className="w-3.5 h-3.5 text-primary" />
              Import Package
            </Button>
            {canAccess("templates", "create") && (
              <Button
                onClick={handleOpenNewModal}
                size="sm"
                className="gap-2 text-xs font-semibold shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Create Template
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calibration Template?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Are you sure you want to delete this template? Existing calibrations created using this template will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs"
              onClick={handleDeleteTemplate}
            >
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Modal */}
      <TemplateExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        selectedTemplates={selectedTemplatesList}
        allTemplates={filteredTemplates}
        companyId={user?.companyId}
        userId={user?.id}
        userName={user?.name}
      />

      {/* Import Modal */}
      <TemplateImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        companyId={user?.companyId}
        userId={user?.id}
        userName={user?.name}
        onSuccess={fetchTemplates}
      />

      {/* Bulk Delete Modal */}
      <TemplateBulkDeleteModal
        open={bulkDeleteModalOpen}
        onOpenChange={setBulkDeleteModalOpen}
        selectedTemplates={selectedTemplatesList}
        isSuperAdmin={user?.isSuperAdmin}
        onSuccess={() => {
          setSelectedIds([]);
          fetchTemplates();
        }}
      />
    </div>
  );
}
