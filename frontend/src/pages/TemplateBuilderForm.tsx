import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Layers, Loader2, Plus, Sparkles, AlertTriangle, Maximize2, Minimize2, Image as ImageIcon, Upload, Trash2, AlignLeft, AlignCenter, AlignRight, Eye, Clock, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, ClipboardPaste, ClipboardCopy, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CALIBRATION_TYPES, CalibrationPoint } from "@/types/calibration";
import { CalibrationTemplate, CanvasBlock } from "@/types/template";
import { getTemplate, getTemplates, createTemplate, updateTemplate } from "@/lib/templateActions";
import { CalibrationDataGrid, CustomColumn } from "@/components/calibration/CalibrationDataGrid";
import { CanvasTemplateEditor, CANVAS_PRESETS } from "@/components/calibration/CanvasTemplateEditor";
import { CertificatePreview } from "@/components/calibration/CertificatePreview";
import { TimePicker, DurationPicker } from "@/components/ui/time-picker";
import { SlidersHorizontal, LayoutGrid } from "lucide-react";

export default function TemplateBuilderForm() {
  useSEO({
    title: "Template Builder Editor — GaugeMaster",
    description: "Design custom calibration templates with visual canvas, formula engine and multi-table layouts",
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("id");
  const { user } = useAuth();

  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [isFullWindowPage, setIsFullWindowPage] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showCertPreviewModal, setShowCertPreviewModal] = useState(false);
  const [existingTemplates, setExistingTemplates] = useState<CalibrationTemplate[]>([]);

  // Canvas Mode State
  const [isCanvasMode, setIsCanvasMode] = useState<boolean>(!templateId);
  const [layoutBlocks, setLayoutBlocks] = useState<CanvasBlock[]>(() => {
    if (!templateId) {
      return JSON.parse(JSON.stringify(CANVAS_PRESETS[0].blocks));
    }
    return [];
  });

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instrumentType, setInstrumentType] = useState("Dial Indicator (0.001 mm)");
  const [calibrationType, setCalibrationType] = useState("dimensional");
  const [defaultUnit, setDefaultUnit] = useState("mm");
  const [defaultTolerance, setDefaultTolerance] = useState<number | "">(0.001);

  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(true);

  // Environmental Defaults
  const [envTemp, setEnvTemp] = useState("20");
  const [envHumidity, setEnvHumidity] = useState("55");
  const [envSoakingTime, setEnvSoakingTime] = useState("");
  const [envSoakingStartTime, setEnvSoakingStartTime] = useState("");
  const [envSoakingEndTime, setEnvSoakingEndTime] = useState("");

  // Helper to calculate soaking duration from Start and End times
  const calculateSoakingDuration = (startTimeStr: string, endTimeStr: string): string => {
    if (!startTimeStr || !endTimeStr) return "";
    const parseParts = (t: string) => {
      const parts = t.trim().split(":").map((p) => parseInt(p, 10));
      const h = isNaN(parts[0]) ? 0 : parts[0];
      const m = isNaN(parts[1]) ? 0 : parts[1];
      const s = isNaN(parts[2]) ? 0 : parts[2];
      return h * 3600 + m * 60 + s;
    };
    const startSec = parseParts(startTimeStr);
    const endSec = parseParts(endTimeStr);
    let diffSec = endSec - startSec;
    if (diffSec < 0) diffSec += 24 * 3600;
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    if (s > 0 || startTimeStr.split(":").length === 3 || endTimeStr.split(":").length === 3) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const handleSoakingStartChange = (val: string) => {
    setEnvSoakingStartTime(val);
    markDirty();
    if (val && envSoakingEndTime) {
      const dur = calculateSoakingDuration(val, envSoakingEndTime);
      if (dur) setEnvSoakingTime(dur);
    }
  };

  const handleSoakingEndChange = (val: string) => {
    setEnvSoakingEndTime(val);
    markDirty();
    if (envSoakingStartTime && val) {
      const dur = calculateSoakingDuration(envSoakingStartTime, val);
      if (dur) setEnvSoakingTime(dur);
    }
  };

  // Acceptance Criteria State
  const [enableAcceptance, setEnableAcceptance] = useState(true);
  const [acceptanceValue, setAcceptanceValue] = useState<number | "">(2);
  const [acceptanceType, setAcceptanceType] = useState<"percentage" | "absolute">("percentage");

  // Grid Data
  const [points, setPoints] = useState<CalibrationPoint[]>([
    { point_number: 1, description: "1/10 Revolution", nominal: 0.001, ascending_reading: 0.0001, error: 0.0009, unit: "mm", tolerance: 0.001, status: "PASS", customFields: {} },
    { point_number: 2, description: "1 Revolution", nominal: 0.004, ascending_reading: 0.0001, error: 0.0039, unit: "mm", tolerance: 0.001, status: "PASS", customFields: {} },
    { point_number: 3, description: "Max Revolution", nominal: 0.018, ascending_reading: 0.0001, error: 0.0179, unit: "mm", tolerance: 0.001, status: "PASS", customFields: {} },
  ]);

  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [standardColumnConfigs, setStandardColumnConfigs] = useState<Record<string, CustomColumn>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [decimalPlaces, setDecimalPlaces] = useState<number>(4);
  const [remarks, setRemarks] = useState("Standard calibration per ISO/IEC 17025");
  const [standardReference, setStandardReference] = useState("Standard calibration per ISO/IEC 17025");
  const [procedureReference, setProcedureReference] = useState("AE/CAL-SOP/01");
  const [docNo, setDocNo] = useState("");
  
  // Status Formula
  const [statusRuleType, setStatusRuleType] = useState<"default" | "custom_formula">("default");
  const [statusFormula, setStatusFormula] = useState<string>("");

  // Diagram / Schematic Image State (Optional)
  const [diagramImage, setDiagramImage] = useState<string | null>(null);
  const [diagramWidth, setDiagramWidth] = useState<number>(350);
  const [diagramHeight, setDiagramHeight] = useState<number>(160);
  const [diagramAlignment, setDiagramAlignment] = useState<"center" | "left" | "right">("center");
  const [isDragOverDiagram, setIsDragOverDiagram] = useState(false);

  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please provide a valid image file (PNG, JPG, SVG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDiagramImage(reader.result as string);
      markDirty();
      toast.success("Diagram image loaded!");
    };
    reader.readAsDataURL(file);
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard) {
        toast.error("Clipboard API is not available in your browser. Focus the box and press Ctrl+V directly.");
        return;
      }
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], "pasted-diagram.png", { type: imageType });
            processImageFile(file);
            return;
          }
        }
      }
      toast.error("No image found in clipboard. Copy an image or screenshot first (e.g. Win+Shift+S or Right Click -> Copy Image).");
    } catch (err: any) {
      console.error("Paste error", err);
      toast.info("Please focus the upload area and press Ctrl+V directly to paste.");
    }
  };

  const handleCopyImageToClipboard = async () => {
    if (!diagramImage) return;
    try {
      const res = await fetch(diagramImage);
      const blob = await res.blob();
      let pngBlob = blob;
      if (blob.type !== "image/png") {
        const img = new Image();
        img.src = diagramImage;
        await new Promise((resolve) => { img.onload = resolve; });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || diagramWidth;
        canvas.height = img.naturalHeight || diagramHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        pngBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
      }
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": pngBlob,
        }),
      ]);
      toast.success("Diagram image copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy image", err);
      toast.error("Could not copy image to clipboard.");
    }
  };

  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            e.stopPropagation();
            processImageFile(file);
            return;
          }
        }
      }
    }
  };

  // Global window paste listener when not typing in text fields
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") {
        return;
      }
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              processImageFile(file);
              return;
            }
          }
        }
      }
    };
    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, []);

  // Helper to mark form as modified
  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  // Browser refresh / tab close protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Keyboard shortcut: Escape key exits Full Window Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullWindowPage) {
        setIsFullWindowPage(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullWindowPage]);

  // Fetch existing templates for current company to validate unique template names
  useEffect(() => {
    if (!user?.id) return;
    getTemplates({ userId: user.id, companyId: user.companyId })
      .then((tpls) => setExistingTemplates(tpls))
      .catch(() => {});
  }, [user?.id, user?.companyId]);

  // Fetch existing template if editing
  useEffect(() => {
    if (!templateId || !user?.id) return;
    setLoading(true);
    getTemplate(templateId)
      .then((tpl) => {
        setName(tpl.name || "");
        setDescription(tpl.description || "");
        setInstrumentType(tpl.instrument_type || "");
        setCalibrationType(tpl.calibration_type || "dimensional");
        setDefaultUnit(tpl.default_unit || "mm");
        setDefaultTolerance(tpl.default_tolerance ?? 0.01);
        setEnvTemp(tpl.environmental_defaults?.temperature || "20");
        setEnvHumidity(tpl.environmental_defaults?.humidity || "55");
        setEnvSoakingTime(tpl.environmental_defaults?.soaking_time || "");
        setEnvSoakingStartTime(tpl.environmental_defaults?.soaking_start_time || "");
        setEnvSoakingEndTime(tpl.environmental_defaults?.soaking_end_time || "");
        setRemarks(tpl.remarks || "");
        setStandardReference((tpl as any).standard_reference || tpl.remarks || "Standard calibration per ISO/IEC 17025");
        setProcedureReference(tpl.procedure_reference || "AE/CAL-SOP/01");
        setDocNo((tpl as any).doc_no || (tpl as any).docNo || "");
        setStatusRuleType((tpl.status_rule_type as "default" | "custom_formula") || "default");
        setStatusFormula(tpl.status_formula || "");

        setDiagramImage(tpl.diagram_image || null);
        if (tpl.diagram_image_width) setDiagramWidth(tpl.diagram_image_width);
        if (tpl.diagram_image_height) setDiagramHeight(tpl.diagram_image_height);
        if (tpl.diagram_image_alignment) setDiagramAlignment(tpl.diagram_image_alignment as "center" | "left" | "right");

        if ((tpl as any).acceptance_criteria) {
          setEnableAcceptance(!!(tpl as any).acceptance_criteria.enabled);
          setAcceptanceValue((tpl as any).acceptance_criteria.value ?? 2);
          setAcceptanceType((tpl as any).acceptance_criteria.type || "percentage");
        }

        if (tpl.is_canvas_template || (tpl.layout_blocks && tpl.layout_blocks.length > 0)) {
          setIsCanvasMode(true);
          setLayoutBlocks(tpl.layout_blocks || []);
        } else {
          setIsCanvasMode(false);
        }

        if (tpl.calibration_points && tpl.calibration_points.length > 0) {
          const formatted: CalibrationPoint[] = tpl.calibration_points.map((pt: any, idx: number) => ({
            point_number: pt.point_number || idx + 1,
            description: pt.description || "",
            nominal: pt.nominal || 0,
            ascending_reading: pt.ascending_reading || 0,
            descending_reading: pt.descending_reading,
            error: pt.error || 0,
            unit: tpl.default_unit || "mm",
            tolerance: pt.tolerance !== undefined ? pt.tolerance : tpl.default_tolerance,
            status: pt.status || "PASS",
            customFields: pt.customFields || {},
          }));
          setPoints(formatted);
        }

        if ((tpl as any).custom_columns) {
          setCustomColumns((tpl as any).custom_columns);
        }
        if ((tpl as any).standard_columns_config) {
          setStandardColumnConfigs((tpl as any).standard_columns_config);
        }
        if ((tpl as any).column_order) {
          setColumnOrder((tpl as any).column_order);
        }
        if ((tpl as any).hidden_columns) {
          setHiddenColumns((tpl as any).hidden_columns);
        }
        if ((tpl as any).decimal_places !== undefined) {
          setDecimalPlaces((tpl as any).decimal_places);
        }
        setIsDirty(false);
      })
      .catch(() => toast.error("Failed to load template"))
      .finally(() => setLoading(false));
  }, [templateId, user?.id]);

  const selectedTypeConfig =
    CALIBRATION_TYPES.find((c) => c.type === calibrationType) || CALIBRATION_TYPES[0];

  const isNameDuplicate = existingTemplates.some(
    (t) => t.id !== templateId && t.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

  const handleSave = async (options?: { navigateOnSave?: boolean }) => {
    if (!name.trim()) {
      toast.error("Please enter a Template Name");
      return;
    }
    if (isNameDuplicate) {
      toast.error(`A template with the name "${name}" already exists. Please choose a unique name.`);
      return;
    }
    if (!instrumentType.trim()) {
      toast.error("Please enter a Target Instrument Type");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<CalibrationTemplate> & { custom_columns?: any[]; column_order?: string[]; hidden_columns?: string[]; acceptance_criteria?: any } = {
        name,
        description,
        instrument_type: instrumentType,
        calibration_type: calibrationType,
        default_unit: defaultUnit,
        default_tolerance: defaultTolerance === "" ? undefined : Number(defaultTolerance),
        environmental_defaults: {
          temperature: envTemp,
          humidity: envHumidity,
          soaking_time: envSoakingTime || undefined,
          soaking_start_time: envSoakingStartTime || undefined,
          soaking_end_time: envSoakingEndTime || undefined,
        },
        acceptance_criteria: {
          enabled: enableAcceptance,
          value: acceptanceValue === "" ? 0 : Number(acceptanceValue),
          type: acceptanceType,
        },
        is_canvas_template: isCanvasMode,
        layout_blocks: isCanvasMode ? layoutBlocks : undefined,
        calibration_points: points,
        custom_columns: customColumns,
        standard_columns_config: standardColumnConfigs,
        column_order: columnOrder,
        hidden_columns: hiddenColumns,
        decimal_places: decimalPlaces,
        diagram_image: diagramImage ? diagramImage : "",
        diagram_image_width: diagramWidth,
        diagram_image_height: diagramHeight,
        diagram_image_alignment: diagramAlignment,
        remarks,
        standard_reference: standardReference,
        procedure_reference: procedureReference,
        doc_no: docNo ? docNo.trim() : null,
        status_rule_type: statusRuleType,
        status_formula: statusFormula,
        userId: user?.id,
      };

      if (templateId) {
        await updateTemplate(templateId, payload);
        toast.success("Template updated successfully!");
      } else {
        const created = await createTemplate(payload);
        toast.success("Calibration template created successfully!");
        if (created?.id && !options?.navigateOnSave) {
          navigate(`/calibration/templates/builder?id=${created.id}`, { replace: true });
        }
      }

      setIsDirty(false);

      if (options?.navigateOnSave) {
        navigate("/calibration/templates");
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || "Failed to save template";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleBackNavigation = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      navigate("/calibration/templates");
    }
  };

  const handleConfirmLeaveWithoutSave = () => {
    setIsDirty(false);
    setShowUnsavedModal(false);
    navigate("/calibration/templates");
  };

  const handleConfirmSaveAndLeave = async () => {
    setShowUnsavedModal(false);
    await handleSave({ navigateOnSave: true });
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={isFullWindowPage ? "fixed inset-0 z-50 bg-background overflow-auto p-6 space-y-6 max-w-none" : "min-h-[calc(100vh-4rem)] py-6 px-4 max-w-[1700px] mx-auto space-y-6"}>
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handleBackNavigation}
            className="shrink-0"
            title="Go back to templates list"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">
                {templateId ? `Edit Template: ${name || "Untitled"}` : "Create New Calibration Template"}
              </h1>
              <Badge variant="secondary" className="capitalize text-xs">
                {selectedTypeConfig.label}
              </Badge>
              {isDirty && (
                <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 text-[10px] animate-pulse">
                  Unsaved Changes
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Design standardized test points, tolerances, environmental defaults & custom formula columns
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isPropertiesCollapsed ? "outline" : "ghost"}
            size="sm"
            onClick={() => setIsPropertiesCollapsed(!isPropertiesCollapsed)}
            className="gap-1.5 text-xs font-semibold shadow-xs"
            title={isPropertiesCollapsed ? "Expand Template Properties panel" : "Collapse Template Properties panel"}
          >
            {isPropertiesCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5 text-primary" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
            {isPropertiesCollapsed ? "Show Properties" : "Hide Properties"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCertPreviewModal(true)}
            className="gap-1.5 text-xs font-semibold shadow-xs hover:bg-primary/5 hover:text-primary border-primary/30"
            title="Preview Full Calibration Certificate layout with current template settings"
          >
            <Eye className="w-3.5 h-3.5 text-primary" />
            Preview Certificate
          </Button>
          <Button
            variant={isFullWindowPage ? "default" : "outline"}
            size="sm"
            onClick={() => setIsFullWindowPage(!isFullWindowPage)}
            className="gap-1.5 text-xs font-semibold shadow-xs"
            title={isFullWindowPage ? "Exit Full Window Mode (Esc)" : "Expand Workspace to 100% Full Screen Window"}
          >
            {isFullWindowPage ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-primary" />}
            {isFullWindowPage ? "Exit Full Window" : "Full Window Mode"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleBackNavigation}>
            Cancel
          </Button>
          <Button size="sm" onClick={()=>handleSave()} disabled={saving || isNameDuplicate || !name.trim()} className="gap-2 shadow-md">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : templateId ? "Update Template" : "Save Template"}
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Column: General Settings (Hidden when Collapsed) */}
        <Card className={`${isPropertiesCollapsed ? "hidden" : "lg:col-span-1"} space-y-4`}>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Template Properties
                </CardTitle>
                <CardDescription className="text-xs">
                  Basic identification & environmental defaults
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsPropertiesCollapsed(true)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-md"
                title="Collapse Template Properties Panel"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Template Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g., Dial Indicator (0.001 mm) — Template A"
                value={name}
                onChange={(e) => { setName(e.target.value); markDirty(); }}
                className={`text-xs ${isNameDuplicate ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {isNameDuplicate && (
                <p className="text-[11px] text-destructive font-medium flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  A template with this name already exists. Please choose a unique name.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Calibration Category <span className="text-red-500">*</span></Label>
              <Select value={calibrationType} onValueChange={(val) => { setCalibrationType(val); markDirty(); }}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALIBRATION_TYPES.map((ct) => (
                    <SelectItem key={ct.type} value={ct.type}>
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Target Instrument Type <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g., Dial Indicator (0.001 mm), Snap Gauge, Tachometer"
                value={instrumentType}
                onChange={(e) => { setInstrumentType(e.target.value); markDirty(); }}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Default Unit</Label>
                <Input
                  placeholder="e.g. mm, bar, °C, rpm"
                  value={defaultUnit}
                  onChange={(e) => { setDefaultUnit(e.target.value); markDirty(); }}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Default Tolerance (±)</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.001"
                  value={defaultTolerance}
                  onChange={(e) => {
                    setDefaultTolerance(e.target.value === "" ? "" : parseFloat(e.target.value));
                    markDirty();
                  }}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description / Scope</Label>
              <Textarea
                placeholder="Optional description of template specifications or procedure..."
                value={description}
                onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                className="text-xs resize-none"
                rows={3}
              />
            </div>

            {/* Environmental Conditions */}
            <div className="p-3 bg-muted/40 rounded-xl space-y-2.5 border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Default Environmental Conditions
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Temp (°C)</Label>
                  <Input
                    value={envTemp}
                    onChange={(e) => { setEnvTemp(e.target.value); markDirty(); }}
                    placeholder="20"
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Humidity (%)</Label>
                  <Input
                    value={envHumidity}
                    onChange={(e) => { setEnvHumidity(e.target.value); markDirty(); }}
                    placeholder="55"
                    className="text-xs h-8"
                  />
                </div>
              </div>

              {/* Soaking Time Settings */}
              <div className="pt-2 border-t border-border/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground">
                    Soaking Time (Optional)
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">hh:mm / hh:mm:ss</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Start Time</Label>
                    <TimePicker
                      value={envSoakingStartTime}
                      onChange={(val) => handleSoakingStartChange(val)}
                      placeholder="08:30"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">End Time</Label>
                    <TimePicker
                      value={envSoakingEndTime}
                      onChange={(val) => handleSoakingEndChange(val)}
                      placeholder="10:30"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-primary font-semibold">Soaking Time</Label>
                    <DurationPicker
                      value={envSoakingTime}
                      onChange={(val) => { setEnvSoakingTime(val); markDirty(); }}
                      placeholder="02:00"
                    />
                  </div>
                </div>
                {(envSoakingTime || envSoakingStartTime || envSoakingEndTime) && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    ✓ Soaking time details will be shown on preview and printed certificate
                  </p>
                )}
              </div>
            </div>

            {/* Acceptance Criteria Card Section */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  Acceptance Criteria (MPE)
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="acceptance_check"
                    checked={enableAcceptance}
                    onCheckedChange={(c) => setEnableAcceptance(!!c)}
                  />
                  <Label htmlFor="acceptance_check" className="text-[11px] cursor-pointer font-medium">Enable</Label>
                </div>
              </div>

              {enableAcceptance && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Criteria Limit</Label>
                    <Input
                      type="number"
                      step="any"
                      value={acceptanceValue}
                      onChange={(e) => setAcceptanceValue(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      placeholder="2"
                      className="text-xs h-8 bg-background font-mono font-bold"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Limit Unit</Label>
                    <Select value={acceptanceType} onValueChange={(val: any) => setAcceptanceType(val)}>
                      <SelectTrigger className="text-xs h-8 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">% Percentage</SelectItem>
                        <SelectItem value="absolute">± Absolute Unit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Diagram / Schematic Image */}
            <div className="p-3 bg-muted/30 rounded-xl space-y-3 border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" />
                  Diagram / Schematic Image (Optional)
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCertPreviewModal(true)}
                    className="h-6 px-2 text-[10px] gap-1 font-semibold text-primary border-primary/30 hover:bg-primary/5 shadow-2xs"
                    title="Open Full Certificate Preview"
                  >
                    <Eye className="w-3 h-3" />
                    Full Preview
                  </Button>
                  {diagramImage && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                      Uploaded
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Upload an instrument schematic or measurement diagram to print on the certificate directly above the calibration results table.
              </p>

              {!diagramImage ? (
                <div
                  tabIndex={0}
                  onPaste={handleContainerPaste}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOverDiagram(true); }}
                  onDragLeave={() => setIsDragOverDiagram(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOverDiagram(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processImageFile(file);
                  }}
                  className={`border-2 border-dashed ${
                    isDragOverDiagram ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:border-primary/50 bg-background/50"
                  } rounded-lg p-3 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40`}
                >
                  <input
                    type="file"
                    id="diagram-upload"
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processImageFile(file);
                    }}
                  />
                  <div className="flex flex-col items-center gap-1.5 py-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-center mt-0.5">
                      <label
                        htmlFor="diagram-upload"
                        className="cursor-pointer text-xs font-semibold text-primary hover:underline"
                      >
                        Browse File
                      </label>
                      <span className="text-xs text-muted-foreground">•</span>
                      <button
                        type="button"
                        onClick={handlePasteFromClipboard}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <ClipboardPaste className="w-3 h-3" />
                        Paste from Clipboard
                      </button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      PNG, JPG, SVG, WebP (Max 5MB) • Press <kbd className="px-1 py-0.5 text-[9px] font-mono bg-muted rounded border">Ctrl+V</kbd> anywhere to paste
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  tabIndex={0}
                  onPaste={handleContainerPaste}
                  className="space-y-3 bg-background p-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {/* Live Preview Box */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                      <span>Live Certificate Preview</span>
                      <span className="font-mono text-[10px]">{diagramWidth}px × {diagramHeight}px • {diagramAlignment}</span>
                    </div>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragOverDiagram(true); }}
                      onDragLeave={() => setIsDragOverDiagram(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOverDiagram(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) processImageFile(file);
                      }}
                      className={`border rounded-md bg-slate-50 dark:bg-slate-900 p-2 flex ${
                        diagramAlignment === 'left' ? 'justify-start' : diagramAlignment === 'right' ? 'justify-end' : 'justify-center'
                      } overflow-hidden min-h-[90px] max-h-[200px] items-center relative ${isDragOverDiagram ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                    >
                      <img
                        src={diagramImage}
                        alt="Diagram Preview"
                        style={{
                          width: `${diagramWidth}px`,
                          maxHeight: `${diagramHeight}px`,
                          objectFit: "contain",
                        }}
                        className="rounded border border-slate-300 dark:border-slate-700 bg-white shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Size & Alignment Customization Controls */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-[10px] text-muted-foreground">Width: <span className="font-mono font-bold text-foreground">{diagramWidth}px</span></Label>
                      </div>
                      <input
                        type="range"
                        min={80}
                        max={540}
                        step={5}
                        value={diagramWidth}
                        onChange={(e) => {
                          setDiagramWidth(parseInt(e.target.value, 10));
                          markDirty();
                        }}
                        className="w-full accent-primary h-1.5 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-[10px] text-muted-foreground">Max Height: <span className="font-mono font-bold text-foreground">{diagramHeight}px</span></Label>
                      </div>
                      <input
                        type="range"
                        min={40}
                        max={280}
                        step={5}
                        value={diagramHeight}
                        onChange={(e) => {
                          setDiagramHeight(parseInt(e.target.value, 10));
                          markDirty();
                        }}
                        className="w-full accent-primary h-1.5 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Alignment & Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t flex-wrap">
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px] text-muted-foreground mr-1">Align:</Label>
                      <Button
                        type="button"
                        variant={diagramAlignment === "left" ? "default" : "outline"}
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => { setDiagramAlignment("left"); markDirty(); }}
                        title="Align Left"
                      >
                        <AlignLeft className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant={diagramAlignment === "center" ? "default" : "outline"}
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => { setDiagramAlignment("center"); markDirty(); }}
                        title="Align Center"
                      >
                        <AlignCenter className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant={diagramAlignment === "right" ? "default" : "outline"}
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => { setDiagramAlignment("right"); markDirty(); }}
                        title="Align Right"
                      >
                        <AlignRight className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1 font-medium"
                        onClick={handleCopyImageToClipboard}
                        title="Copy Diagram Image to Clipboard"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        Copy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1 font-medium"
                        onClick={handlePasteFromClipboard}
                        title="Paste new image from Clipboard (or press Ctrl+V)"
                      >
                        <ClipboardPaste className="w-2.5 h-2.5" />
                        Paste
                      </Button>
                      <label
                        htmlFor="diagram-replace-upload"
                        className="cursor-pointer inline-flex items-center gap-1 text-[10px] h-6 px-2 border rounded-md hover:bg-muted font-medium"
                      >
                        <Upload className="w-2.5 h-2.5" />
                        Replace
                      </label>
                      <input
                        type="file"
                        id="diagram-replace-upload"
                        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) processImageFile(file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setDiagramImage(null);
                          markDirty();
                          toast.info("Diagram image removed");
                        }}
                      >
                        <Trash2 className="w-2.5 h-2.5 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>

                  {/* Full Certificate Preview Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCertPreviewModal(true)}
                    className="w-full text-xs font-semibold gap-1.5 h-7.5 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View in Full Certificate Preview
                  </Button>
                </div>
              )}
            </div>

            {/* Document Number */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Doc. No.</Label>
                <span className="text-[10px] text-muted-foreground">Printed on top right of certificate</span>
              </div>
              <Input
                placeholder="e.g., DOC/CAL/01"
                value={docNo}
                onChange={(e) => { setDocNo(e.target.value); markDirty(); }}
                className="text-xs font-medium"
              />
            </div>

            {/* Procedure Reference Template */}
            <div className="space-y-1.5">
              <Label className="text-xs">Procedure Reference (SOP)</Label>
              <Input
                placeholder="e.g., AE/CAL-SOP/01"
                value={procedureReference}
                onChange={(e) => { setProcedureReference(e.target.value); markDirty(); }}
                className="text-xs"
              />
            </div>

            {/* Standard Reference Template */}
            <div className="space-y-1.5">
              <Label className="text-xs">Standard Reference / Guideline</Label>
              <Input
                placeholder="Standard calibration per ISO/IEC 17025"
                value={standardReference}
                onChange={(e) => {
                  setStandardReference(e.target.value);
                  setRemarks(e.target.value);
                  markDirty();
                }}
                className="text-xs font-medium"
              />
            </div>

            {/* Remarks Template */}
            <div className="space-y-1.5">
              <Label className="text-xs">Certificate Remarks Template</Label>
              <Textarea
                placeholder="Default certificate notes or compliance remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="text-xs resize-none"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Right Columns: Interactive Data Grid (Expands to 100% full width when Properties Collapsed) */}
        <Card className={`${isPropertiesCollapsed ? "lg:col-span-3" : "lg:col-span-2"} space-y-4`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  {isCanvasMode ? "Visual Canvas Designer (IS 3651 & Multi-Table)" : "Standard Test Points & Custom Formulas"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isCanvasMode
                    ? "Design modular multi-table layouts, side-by-side split rows, reference matrix tables, and notes"
                    : "Pre-configure test rows, add custom columns, edit formulas with clickable variable chips"}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border">
                  <Button
                    type="button"
                    variant={isCanvasMode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setIsCanvasMode(true);
                      markDirty();
                      if (layoutBlocks.length === 0) {
                        setLayoutBlocks(JSON.parse(JSON.stringify(CANVAS_PRESETS[0].blocks)));
                      }
                    }}
                    className="text-xs h-7 gap-1.5 font-bold shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Visual Canvas Designer
                  </Button>
                  <Button
                    type="button"
                    variant={!isCanvasMode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setIsCanvasMode(false);
                      markDirty();
                    }}
                    className="text-xs h-7 gap-1.5 font-medium shadow-xs"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Single Table Grid
                  </Button>
                </div>

                {isPropertiesCollapsed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPropertiesCollapsed(false)}
                    className="text-xs gap-1.5 shadow-xs shrink-0 border-primary/40 text-primary hover:bg-primary/5"
                    title="Show Template Properties sidebar"
                  >
                    <PanelLeftOpen className="w-3.5 h-3.5" />
                    Show Properties
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCanvasMode ? (
              <CanvasTemplateEditor
                blocks={layoutBlocks}
                onChange={(newBlocks) => {
                  setLayoutBlocks(newBlocks);
                  markDirty();
                }}
                onSelectPreset={(preset) => {
                  setLayoutBlocks(JSON.parse(JSON.stringify(preset.blocks)));
                  if (!templateId || name === "New Template" || !name.trim()) {
                    setName(preset.name);
                  }
                  if (preset.instrumentType) {
                    setInstrumentType(preset.instrumentType);
                  }
                  if (preset.defaultTolerance !== undefined) {
                    setDefaultTolerance(preset.defaultTolerance);
                  }
                  if (preset.defaultUnit) {
                    setDefaultUnit(preset.defaultUnit);
                  }
                  markDirty();
                  toast.success(`Loaded "${preset.name}" preset layout and properties!`);
                }}
                onApplyGeneratedTemplate={(result) => {
                  if (result.name && (!templateId || name === "New Template" || !name.trim())) {
                    setName(result.name);
                  }
                  if (result.description) {
                    setDescription(result.description);
                  }
                  if (result.instrumentType) {
                    setInstrumentType(result.instrumentType);
                  }
                  if (result.defaultTolerance !== undefined) {
                    setDefaultTolerance(result.defaultTolerance);
                  }
                  if (result.defaultUnit) {
                    setDefaultUnit(result.defaultUnit);
                  }
                  if (result.decimalPlaces !== undefined) {
                    setDecimalPlaces(result.decimalPlaces);
                  }
                  if (result.acceptanceCriteria) {
                    setEnableAcceptance(result.acceptanceCriteria.enabled);
                    setAcceptanceType(result.acceptanceCriteria.type);
                    setAcceptanceValue(result.acceptanceCriteria.value);
                  }
                  if (result.blocks && result.blocks.length > 0) {
                    setLayoutBlocks(result.blocks);
                  }
                  markDirty();
                }}
                defaultUnit={defaultUnit}
                defaultTolerance={typeof defaultTolerance === "number" ? defaultTolerance : 0.01}
                decimalPlaces={decimalPlaces}
                templateName={name}
                diagramImage={diagramImage}
                diagramImageWidth={diagramWidth}
                diagramImageHeight={diagramHeight}
                diagramImageAlignment={diagramAlignment}
                onDecimalPlacesChange={(dp) => {
                  setDecimalPlaces(dp);
                  markDirty();
                }}
              />
            ) : (
              <CalibrationDataGrid
                typeConfig={selectedTypeConfig}
                points={points}
                onPointsChange={(pts) => { setPoints(pts); markDirty(); }}
                unit={defaultUnit}
                onUnitChange={(u) => { setDefaultUnit(u); markDirty(); }}
                tolerance={typeof defaultTolerance === "number" ? defaultTolerance : 0}
                onToleranceChange={(tol) => { setDefaultTolerance(tol); markDirty(); }}
                initialCustomColumns={customColumns}
                initialStandardColumnConfigs={standardColumnConfigs}
                initialColumnOrder={columnOrder}
                initialHiddenColumns={hiddenColumns}
                onCustomColumnsChange={(cols) => { setCustomColumns(cols); markDirty(); }}
                onStandardColumnConfigsChange={(configs) => { setStandardColumnConfigs(configs); markDirty(); }}
                onColumnOrderChange={(order) => { setColumnOrder(order); markDirty(); }}
                onHiddenColumnsChange={(hidden) => { setHiddenColumns(hidden); markDirty(); }}
                initialDecimalPlaces={decimalPlaces}
                onDecimalPlacesChange={(dp) => { setDecimalPlaces(dp); markDirty(); }}
                acceptanceCriteria={{
                  enabled: enableAcceptance,
                  value: typeof acceptanceValue === "number" ? acceptanceValue : 0,
                  type: acceptanceType,
                }}
                onAcceptanceCriteriaChange={(config) => {
                  setEnableAcceptance(!!config.enabled);
                  setAcceptanceValue(config.value ?? 2);
                  if (config.type) setAcceptanceType(config.type);
                  markDirty();
                }}
                initialStatusRuleType={statusRuleType}
                initialStatusFormula={statusFormula}
                onStatusRuleChange={(type, formula) => {
                  setStatusRuleType(type);
                  setStatusFormula(formula);
                  markDirty();
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      <Dialog open={showUnsavedModal} onOpenChange={setShowUnsavedModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              Unsaved Changes Detected
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              You have unsaved changes in this calibration template. If you leave now without saving, your modifications will be permanently lost.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUnsavedModal(false)}
              className="sm:w-auto text-xs"
            >
              Keep Editing
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmLeaveWithoutSave}
              className="sm:w-auto text-xs"
            >
              Leave Without Saving
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSaveAndLeave}
              disabled={saving || isNameDuplicate || !name.trim()}
              className="sm:w-auto text-xs gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              Save & Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Certificate Preview Modal */}
      <Dialog open={showCertPreviewModal} onOpenChange={setShowCertPreviewModal}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="pb-3 border-b shrink-0 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Live Calibration Certificate Preview
              </DialogTitle>
              <DialogDescription className="text-xs">
                Simulated real-time layout of the calibration certificate with your template points, custom formula columns, and diagram schematic.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 px-1 flex justify-center bg-slate-100 dark:bg-slate-900/60 rounded-lg">
            <CertificatePreview
              calibration={{
                certificate_number: "PREVIEW-DEMO-001",
                ulr_number: "ULR-DEMO-2026-0001",
                calibration_date: new Date().toISOString().split("T")[0],
                certificate_issue_date: new Date().toISOString().split("T")[0],
                next_calibration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                instrument: {
                  name: name || "Sample Instrument",
                  make: "Standard Make",
                  range: "0 - 100",
                  least_count: "0.001",
                  unit: defaultUnit || "mm",
                  serial_no: "SN-SAMPLE-01",
                  id_no: "ID-SAMPLE-01",
                  location: "Quality Lab / Shop Floor",
                  department: "Quality Assurance",
                } as any,
                reference_standards: [
                  {
                    name: "Gauge Block Set Grade K",
                    make: "Mitutoyo",
                    id: "REF-STD-01",
                    traceable_to: "NPL / NABL Accredited Lab",
                    validity: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                  },
                ],
                environmental_conditions: {
                  temperature: envTemp,
                  humidity: envHumidity,
                  soaking_time: envSoakingTime || undefined,
                  soaking_start_time: envSoakingStartTime || undefined,
                  soaking_end_time: envSoakingEndTime || undefined,
                },
                doc_no: docNo || undefined,
                procedure_reference: procedureReference || "AE/CAL-SOP/01",
                standard_reference: standardReference || remarks || "Standard calibration per ISO/IEC 17025",
                is_canvas_template: isCanvasMode,
                layout_blocks: isCanvasMode ? layoutBlocks : undefined,
                calibration_points: points,
                custom_columns: customColumns,
                standard_columns_config: standardColumnConfigs,
                column_order: columnOrder,
                hidden_columns: hiddenColumns,
                decimal_places: decimalPlaces,
                acceptance_criteria: {
                  enabled: enableAcceptance,
                  value: acceptanceValue === "" ? 0 : Number(acceptanceValue),
                  type: acceptanceType,
                },
                diagram_image: diagramImage || undefined,
                diagram_image_width: diagramWidth,
                diagram_image_height: diagramHeight,
                diagram_image_alignment: diagramAlignment,
                uncertainty: "± 0.0015 mm",
                verdict: "PASS",
                remarks: remarks || "Standard calibration per ISO/IEC 17025",
                calibrated_by: user?.name || "Calibrator",
                calibrated_by_designation: "Calibration Engineer",
                reviewed_by: "Quality Manager",
                reviewed_by_designation: "Quality Head",
                approved_by: "Authorised Signatory",
                approved_by_designation: "Technical Director",
              }}
            />
          </div>

          <DialogFooter className="pt-3 border-t shrink-0 flex flex-row items-center justify-between sm:justify-between">
            <div className="text-[11px] text-muted-foreground">
              {diagramImage ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ Diagram Schematic embedded: {diagramWidth}px × {diagramHeight}px ({diagramAlignment})
                </span>
              ) : (
                <span>No diagram attached (Standard layout)</span>
              )}
            </div>
            <Button variant="default" size="sm" onClick={() => setShowCertPreviewModal(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
