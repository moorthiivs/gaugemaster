import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { CALIBRATION_TYPES } from "@/types/calibration";
import { CalibrationTemplate } from "@/types/template";
import { getTemplates, createTemplate, deleteTemplate } from "@/lib/templateActions";

const TYPE_ICONS: Record<string, any> = {
  dimensional: Ruler,
  pressure: Gauge,
  temperature: Thermometer,
  torque: RotateCw,
  electrical: Zap,
  weight: Scale,
  flow: Droplets,
};

export default function TemplateBuilder() {
  useSEO({
    title: "Calibration Template Builder — GaugeMaster",
    description: "Create and manage reusable calibration templates categorized by calibration type",
  });

  const navigate = useNavigate();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CalibrationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");

  // Delete Dialog State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getTemplates({
        userId: user.id,
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
        name: `${tpl.name} (Copy)`,
        description: tpl.description,
        instrument_type: tpl.instrument_type,
        calibration_type: tpl.calibration_type,
        default_unit: tpl.default_unit,
        default_tolerance: tpl.default_tolerance,
        environmental_defaults: tpl.environmental_defaults,
        calibration_points: tpl.calibration_points,
        custom_columns: (tpl as any).custom_columns,
        column_order: (tpl as any).column_order,
        remarks: tpl.remarks,
        userId: user?.id,
      };
      await createTemplate(duplicateData);
      toast.success("Template duplicated successfully!");
      fetchTemplates();
    } catch {
      toast.error("Failed to duplicate template");
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteId) return;
    try {
      await deleteTemplate(deleteId);
      toast.success("Template deleted");
      setTemplates((prev) => prev.filter((t) => t.id !== deleteId));
    } catch {
      toast.error("Failed to delete template");
    } finally {
      setDeleteId(null);
    }
  };

  const filteredTemplates = templates.filter((tpl) => {
    const query = searchQuery.toLowerCase();
    return (
      tpl.name.toLowerCase().includes(query) ||
      tpl.instrument_type.toLowerCase().includes(query) ||
      tpl.calibration_type.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 py-6 px-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            Calibration Template Builder
          </h1>
          <p className="text-sm text-muted-foreground">
            Create, manage, and reuse standardized calibration formats grouped by Calibration Type
          </p>
        </div>
        <Button onClick={handleOpenNewModal} className="gap-2 shadow-lg">
          <PlusCircle className="w-4 h-4" />
          Create New Template
        </Button>
      </div>

      {/* Category Tabs / Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <Button
          variant={selectedType === "All" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("All")}
          className="rounded-full text-xs shrink-0"
        >
          All Categories ({templates.length})
        </Button>
        {CALIBRATION_TYPES.map((ct) => {
          const IconComp = TYPE_ICONS[ct.type] || Layers;
          const count = templates.filter((t) => t.calibration_type === ct.type).length;
          return (
            <Button
              key={ct.type}
              variant={selectedType === ct.type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(ct.type)}
              className="rounded-full text-xs shrink-0 gap-1.5"
            >
              <IconComp className="w-3.5 h-3.5" />
              {ct.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* Search & Actions bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search templates by name, instrument type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Showing {filteredTemplates.length} of {templates.length} templates
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-44 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((tpl) => {
                const IconComp = TYPE_ICONS[tpl.calibration_type] || Layers;
                const calTypeConfig = CALIBRATION_TYPES.find(
                  (c) => c.type === tpl.calibration_type
                );

                return (
                  <Card
                    key={tpl.id}
                    className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/50"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <Badge variant="outline" className="text-[10px] gap-1 font-normal capitalize">
                            <IconComp className="w-3 h-3 text-primary" />
                            {calTypeConfig?.label || tpl.calibration_type}
                          </Badge>
                          <CardTitle className="text-base font-semibold line-clamp-1">
                            {tpl.name}
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-1">
                            Instrument: <span className="font-medium text-foreground">{tpl.instrument_type}</span>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0 text-xs">
                      {tpl.description && (
                        <p className="text-muted-foreground line-clamp-2 text-[11px]">
                          {tpl.description}
                        </p>
                      )}

                      <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2.5 rounded-lg text-[11px]">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Unit</span>
                          <span className="font-semibold">{tpl.default_unit || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Tolerance</span>
                          <span className="font-semibold">±{tpl.default_tolerance ?? "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Points</span>
                          <span className="font-semibold">{tpl.calibration_points?.length || 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t text-[10px] text-muted-foreground">
                        <span>
                          Temp: {tpl.environmental_defaults?.temperature || "20"}°C | Hum: {tpl.environmental_defaults?.humidity || "55"}%
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Duplicate"
                            onClick={() => handleDuplicate(tpl)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Edit"
                            onClick={() => handleOpenEditModal(tpl)}
                          >
                            <Edit className="w-3.5 h-3.5 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete"
                            onClick={() => setDeleteId(tpl.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">No templates found</p>
              <p className="text-xs text-muted-foreground mb-4">
                Create reusable calibration formats to accelerate calibration entry.
              </p>
              <Button onClick={handleOpenNewModal} className="gap-2">
                <PlusCircle className="w-4 h-4" />
                Create Template
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calibration Template?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete this template? Existing calibrations created using this template will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white text-xs"
              onClick={handleDeleteTemplate}
            >
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
