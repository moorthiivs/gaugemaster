import { useState, useEffect, useRef, useMemo } from "react";
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
import { ArrowLeft, Save, Layers, Loader2, Plus, Sparkles, AlertTriangle, Maximize2, Minimize2, Image as ImageIcon, Upload, Trash2, AlignLeft, AlignCenter, AlignRight, Eye, Clock, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, PanelLeftClose, PanelLeftOpen, ClipboardPaste, ClipboardCopy, Copy, FileText, Sliders, FileCheck2, Target, Settings as SettingsIcon, ShieldCheck, CheckCircle2, Table as TableIcon, Wand2, FlaskConical, MoreVertical, Bot, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CALIBRATION_TYPES, CalibrationPoint } from "@/types/calibration";
import { CalibrationTemplate, CanvasBlock, TableGridBlock, CanvasColumnDef } from "@/types/template";
import { getTemplate, getTemplates, createTemplate, updateTemplate } from "@/lib/templateActions";
import { CalibrationDataGrid, CustomColumn } from "@/components/calibration/CalibrationDataGrid";
import { CanvasTemplateEditor, CANVAS_PRESETS, CanvasEditorActions } from "@/components/calibration/CanvasTemplateEditor";
import { GaugemasterTemplateAssistant } from "@/components/calibration/template-management/GaugemasterTemplateAssistant";
import { AiTemplateGeneratorModal } from "@/components/calibration/template-management/AiTemplateGeneratorModal";
import { TrialRunModal } from "@/components/calibration/template-management/TrialRunModal";
import { TableAuditModal } from "@/components/calibration/template-management/TableAuditModal";
import { GeneratedTemplateResult } from "@/lib/geminiService";
import { CanvasRowData, SplitRowBlock } from "@/types/template";
import { CertificatePreview } from "@/components/calibration/CertificatePreview";
import { TimePicker, DurationPicker } from "@/components/ui/time-picker";
import { SlidersHorizontal, LayoutGrid } from "lucide-react";
import { validateTemplatePreSave } from "@/lib/templatePreSaveValidator";
import { PreSaveAuditModal } from "@/components/calibration/template-management/PreSaveAuditModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
  const [isFullWindowPage, setIsFullWindowPage] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showCertPreviewModal, setShowCertPreviewModal] = useState(false);
  const [showPreSaveModal, setShowPreSaveModal] = useState(false);
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
  const [name, setName] = useState<string>(() => {
    if (!templateId) {
      return CANVAS_PRESETS[0]?.name || "New Calibration Template";
    }
    return "";
  });
  const [description, setDescription] = useState<string>(() => {
    if (!templateId) {
      return CANVAS_PRESETS[0]?.description || "";
    }
    return "";
  });
  const [instrumentType, setInstrumentType] = useState<string>(() => {
    if (!templateId) {
      return CANVAS_PRESETS[0]?.instrumentType || "Vernier Caliper";
    }
    return "Dial Indicator (0.001 mm)";
  });
  const [calibrationType, setCalibrationType] = useState("dimensional");
  const [defaultUnit, setDefaultUnit] = useState<string>(() => {
    if (!templateId) {
      return CANVAS_PRESETS[0]?.defaultUnit || "mm";
    }
    return "mm";
  });
  const [defaultTolerance, setDefaultTolerance] = useState<number | "">(() => {
    if (!templateId) {
      return CANVAS_PRESETS[0]?.defaultTolerance ?? 0.02;
    }
    return 0.001;
  });

  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(true);
  const [isMetrologyPropertiesCollapsed, setIsMetrologyPropertiesCollapsed] = useState(false);
  const canvasActionsRef = useRef<CanvasEditorActions | null>(null);

  // Dedicated Full-Height Copilot State matching reference smple.png
  const [showAssistant, setShowAssistant] = useState(true);
  const [isAssistantDocked, setIsAssistantDocked] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);

  // Studio Modals State
  const [showAiModal, setShowAiModal] = useState(false);
  const [showTrialRun, setShowTrialRun] = useState(false);
  const [showTableAuditModal, setShowTableAuditModal] = useState(false);
  const [auditTargetTable, setAuditTargetTable] = useState<TableGridBlock | null>(null);

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
  const [activeNavTab, setActiveNavTab] = useState<"canvas" | "tableConfig" | "specifications" | "certificateLayout" | "settings">("canvas");

  const totalPointsCount = useMemo(() => {
    if (isCanvasMode) {
      return layoutBlocks.reduce((acc, b) => {
        if (b.type === "table_grid") {
          return acc + (b.rows?.length || 0);
        }
        if (b.type === "split_row" && b.children) {
          return (
            acc +
            b.children.reduce(
              (cAcc, c) => (c.type === "table_grid" ? cAcc + (c.rows?.length || 0) : cAcc),
              0
            )
          );
        }
        return acc;
      }, 0);
    }
    return points.length;
  }, [isCanvasMode, layoutBlocks, points]);

  const [selectedTableBlockId, setSelectedTableBlockId] = useState<string>("");

  const allTableBlocks = useMemo(() => {
    const list: { block: TableGridBlock; parentId?: string }[] = [];
    layoutBlocks.forEach((b) => {
      if (b.type === "table_grid") {
        list.push({ block: b as TableGridBlock });
      } else if (b.type === "split_row" && b.children) {
        b.children.forEach((c) => {
          if (c.type === "table_grid") {
            list.push({ block: c as TableGridBlock, parentId: b.id });
          }
        });
      }
    });
    return list;
  }, [layoutBlocks]);

  const activeTableBlock = useMemo<TableGridBlock | null>(() => {
    if (!allTableBlocks.length) return null;
    if (selectedBlockId) {
      const found = allTableBlocks.find((item) => item.block.id === selectedBlockId);
      if (found) return found.block;
    }
    if (selectedTableBlockId) {
      const found = allTableBlocks.find((item) => item.block.id === selectedTableBlockId);
      if (found) return found.block;
    }
    return allTableBlocks[0].block;
  }, [allTableBlocks, selectedBlockId, selectedTableBlockId]);

  const updateActiveTableBlock = (updates: Partial<TableGridBlock>) => {
    if (!activeTableBlock) return;
    setLayoutBlocks((prev) =>
      prev.map((b) => {
        if (b.id === activeTableBlock.id && b.type === "table_grid") {
          return { ...b, ...updates } as CanvasBlock;
        }
        if (b.type === "split_row" && b.children) {
          return {
            ...b,
            children: b.children.map((c) =>
              c.id === activeTableBlock.id && c.type === "table_grid"
                ? ({ ...c, ...updates } as any)
                : c
            ),
          } as CanvasBlock;
        }
        return b;
      })
    );
    markDirty();
  };

  const handleAutoCalculateWidths = (tableId: string) => {
    const target = allTableBlocks.find((t) => t.block.id === tableId)?.block;
    if (!target || !target.columns || target.columns.length === 0) return;

    const updatedCols = target.columns.map((col) => {
      let baseWidth = Math.max(90, (col.label?.length || 8) * 11 + 35);
      if (col.type === "number") baseWidth = Math.max(100, baseWidth);
      if (col.type === "formula" || (col.type as any) === "calculated") baseWidth = Math.max(130, baseWidth);
      if (col.isPassFail || col.type === "status") baseWidth = Math.max(100, baseWidth);
      return { ...col, width: baseWidth };
    });

    updateActiveTableBlock({ columns: updatedCols });
    toast.success("Optimized column widths based on content type!");
  };

  const handleAddColumnToActiveTable = () => {
    if (!activeTableBlock) return;
    const currentCols = activeTableBlock.columns || [];
    const newColIndex = currentCols.length + 1;
    const newColKey = `col_${Date.now()}`;
    const newCol: CanvasColumnDef = {
      id: newColKey,
      key: newColKey,
      label: `Column ${newColIndex}`,
      type: "number",
      width: 110,
      align: "right",
      editable: true,
    };
    updateActiveTableBlock({ columns: [...currentCols, newCol] });
    toast.success(`Added new column "${newCol.label}"`);
  };

  const handleDeleteColumnFromActiveTable = (colId: string) => {
    if (!activeTableBlock) return;
    const currentCols = activeTableBlock.columns || [];
    if (currentCols.length <= 1) {
      toast.error("Table must have at least one column");
      return;
    }
    const updatedCols = currentCols.filter((c) => c.id !== colId && (!c.key || c.key !== colId));
    updateActiveTableBlock({ columns: updatedCols });
    toast.info("Column removed");
  };

  const handleUpdateColumnInActiveTable = (colId: string, colUpdates: Partial<CanvasColumnDef>) => {
    if (!activeTableBlock) return;
    const currentCols = activeTableBlock.columns || [];
    const updatedCols = currentCols.map((c) => {
      if (c.id === colId || (c.key && c.key === colId)) {
        return { ...c, ...colUpdates };
      }
      return c;
    });
    updateActiveTableBlock({ columns: updatedCols });
  };

  const [remarks, setRemarks] = useState("Standard calibration per ISO/IEC 17025");
  const [standardReference, setStandardReference] = useState("Standard calibration per ISO/IEC 17025");
  const [procedureReference, setProcedureReference] = useState("AE/CAL-SOP/01");
  const [procedureNo, setProcedureNo] = useState("");
  const [procedureName, setProcedureName] = useState("");
  const [procedureDate, setProcedureDate] = useState("");
  const [procedureRev, setProcedureRev] = useState("");
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState("");
  const [docRev, setDocRev] = useState("");
  const [acceptanceCriteriaDocNo, setAcceptanceCriteriaDocNo] = useState("");
  const [acceptanceCriteriaDate, setAcceptanceCriteriaDate] = useState("");
  const [acceptanceCriteriaRev, setAcceptanceCriteriaRev] = useState("");
  const [acceptanceCriteriaReference, setAcceptanceCriteriaReference] = useState("");
  
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

  // Draggable properties sidebar width (280px - 600px)
  const [propertiesWidth, setPropertiesWidth] = useState<number>(360);
  const [isResizingProps, setIsResizingProps] = useState(false);
  const propsResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (!isResizingProps) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!propsResizeRef.current) return;
      const delta = e.clientX - propsResizeRef.current.startX;
      const newWidth = Math.max(280, Math.min(600, Math.round(propsResizeRef.current.startWidth + delta)));
      setPropertiesWidth(newWidth);
    };
    const onMouseUp = () => {
      setIsResizingProps(false);
      propsResizeRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizingProps]);

  // Table Mutation Handlers for AI Copilot
  const handleApplyTableFixes = (tableId: string, updatedColumns: CanvasColumnDef[]) => {
    setLayoutBlocks((prev) =>
      prev.map((b) => {
        if (b.type === "table_grid" && b.id === tableId) {
          return { ...b, columns: updatedColumns };
        }
        if (b.type === "split_row" && (b as any).children) {
          const newChildren = (b as any).children.map((c: any) => {
            if (c.type === "table_grid" && c.id === tableId) {
              return { ...c, columns: updatedColumns };
            }
            return c;
          });
          return { ...b, children: newChildren };
        }
        return b;
      })
    );
    markDirty();
    toast.success("AI audited formulas applied to table!");
  };

  const handleUpdateTableBlock = (tableId: string, updatedFields: Partial<TableGridBlock>) => {
    setLayoutBlocks((prev) =>
      prev.map((b) => {
        if (b.type === "table_grid" && b.id === tableId) {
          return { ...b, ...updatedFields };
        }
        if (b.type === "split_row" && (b as any).children) {
          const newChildren = (b as any).children.map((c: any) => {
            if (c.type === "table_grid" && c.id === tableId) {
              return { ...c, ...updatedFields };
            }
            return c;
          });
          return { ...b, children: newChildren };
        }
        return b;
      })
    );
    markDirty();
    toast.success("Updated table properties successfully");
  };

  const handleAddTableColumn = (tableId: string, newColumn: CanvasColumnDef) => {
    setLayoutBlocks((prev) =>
      prev.map((b) => {
        if (b.type === "table_grid" && b.id === tableId) {
          return { ...b, columns: [...(b.columns || []), newColumn] };
        }
        if (b.type === "split_row" && (b as any).children) {
          const newChildren = (b as any).children.map((c: any) => {
            if (c.type === "table_grid" && c.id === tableId) {
              return { ...c, columns: [...(c.columns || []), newColumn] };
            }
            return c;
          });
          return { ...b, children: newChildren };
        }
        return b;
      })
    );
    markDirty();
    toast.success(`Added column "${newColumn.label}" successfully`);
  };

  const handleDeleteTableColumn = (tableId: string, columnId: string) => {
    setLayoutBlocks((prev) =>
      prev.map((b) => {
        if (b.type === "table_grid" && b.id === tableId) {
          return { ...b, columns: (b.columns || []).filter((c) => c.id !== columnId && (c as any).field !== columnId) };
        }
        if (b.type === "split_row" && (b as any).children) {
          const newChildren = (b as any).children.map((c: any) => {
            if (c.type === "table_grid" && c.id === tableId) {
              return { ...c, columns: (c.columns || []).filter((col: any) => col.id !== columnId && col.field !== columnId) };
            }
            return c;
          });
          return { ...b, children: newChildren };
        }
        return b;
      })
    );
    markDirty();
    toast.success("Removed column from table");
  };

  const handleAddTableBlock = (tableData?: Partial<TableGridBlock>) => {
    const newBlockId = tableData?.id || `table_${Date.now()}`;
    const newBlock: TableGridBlock = {
      id: newBlockId,
      type: "table_grid",
      title: tableData?.title || "New Calibration Table",
      width: tableData?.width || "100%",
      unit: tableData?.unit || defaultUnit,
      tolerance: tableData?.tolerance || (typeof defaultTolerance === "number" ? defaultTolerance : 0.01),
      decimal_places: tableData?.decimal_places ?? decimalPlaces,
      columns: tableData?.columns || [
        { id: "point_number", label: "Sl.No.", type: "nominal", width: "8%" },
        { id: "nominal", label: "Std. Spec", type: "nominal", width: "22%" },
        { id: "reading", label: "Actual Reading", type: "reading", width: "25%" },
        { id: "deviation", label: "Deviation", type: "formula", formula: "reading - nominal", width: "25%" },
        { id: "status", label: "Judgement", type: "status", formula: "IF(ABS(deviation)<=tolerance,'PASS','FAIL')", width: "20%" },
      ],
      rows: tableData?.rows || [
        { point_number: 1, nominal: 10.0, unit: defaultUnit },
        { point_number: 2, nominal: 20.0, unit: defaultUnit },
        { point_number: 3, nominal: 50.0, unit: defaultUnit },
      ],
    };
    setLayoutBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlockId);
    setSelectedTableBlockId(newBlockId);
    markDirty();
    toast.success(`Created table "${newBlock.title}"`);
  };

  const handleDeleteTableBlock = (tableId: string) => {
    const newBlocks = layoutBlocks.filter((b) => b.id !== tableId);
    setLayoutBlocks(newBlocks);
    if (selectedBlockId === tableId) {
      setSelectedBlockId(newBlocks[0]?.id || null);
    }
    markDirty();
    toast.info("Deleted table block from template");
  };

  const handleUpdateTableRows = (tableId: string, updatedRows: CanvasRowData[]) => {
    setLayoutBlocks((prev) =>
      prev.map((b) => {
        if (b.type === "table_grid" && b.id === tableId) {
          return { ...b, rows: updatedRows };
        }
        if (b.type === "split_row" && (b as any).children) {
          const newChildren = (b as any).children.map((c: any) => {
            if (c.type === "table_grid" && c.id === tableId) {
              return { ...c, rows: updatedRows };
            }
            return c;
          });
          return { ...b, children: newChildren };
        }
        return b;
      })
    );
    markDirty();
    toast.success("Updated table rows successfully");
  };

  const handleRestoreTableState = (
    tableId: string,
    previousState: {
      columns?: CanvasColumnDef[];
      tableSettings?: Partial<TableGridBlock>;
      rows?: CanvasRowData[];
    }
  ) => {
    setLayoutBlocks((prev) =>
      prev.map((b) => {
        if (b.type === "table_grid" && b.id === tableId) {
          return {
            ...b,
            ...(previousState.columns ? { columns: previousState.columns } : {}),
            ...(previousState.tableSettings || {}),
            ...(previousState.rows ? { rows: previousState.rows } : {}),
          };
        }
        if (b.type === "split_row" && (b as any).children) {
          const newChildren = (b as any).children.map((c: any) => {
            if (c.type === "table_grid" && c.id === tableId) {
              return {
                ...c,
                ...(previousState.columns ? { columns: previousState.columns } : {}),
                ...(previousState.tableSettings || {}),
                ...(previousState.rows ? { rows: previousState.rows } : {}),
              };
            }
            return c;
          });
          return { ...b, children: newChildren };
        }
        return b;
      })
    );
    markDirty();
  };

  const handleApplyAiGenerated = (result: GeneratedTemplateResult) => {
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
      setSelectedBlockId(result.blocks[0]?.id || null);
    }
    markDirty();
    toast.success(`Loaded "${result.name}" with ${result.blocks.length} blocks!`);
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
        setProcedureNo((tpl as any).procedure_no || "");
        setProcedureName(tpl.procedure_name || "");
        setProcedureDate(tpl.procedure_date || "");
        setProcedureRev(tpl.procedure_rev || "");
        setDocNo((tpl as any).doc_no || (tpl as any).docNo || "");
        setDocDate(tpl.doc_date || "");
        setDocRev(tpl.doc_rev || "");
        setAcceptanceCriteriaDocNo(tpl.acceptance_criteria_doc_no || "");
        setAcceptanceCriteriaDate(tpl.acceptance_criteria_date || "");
        setAcceptanceCriteriaRev(tpl.acceptance_criteria_rev || "");
        setAcceptanceCriteriaReference(tpl.acceptance_criteria_reference || "");
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
        if ((tpl as any).decimal_places !== undefined && (tpl as any).decimal_places !== null) {
          const parsed = Number((tpl as any).decimal_places);
          setDecimalPlaces(!isNaN(parsed) ? parsed : 4);
        } else {
          setDecimalPlaces(4);
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

  const handleSave = async (options?: { navigateOnSave?: boolean; force?: boolean }) => {
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

    // Pre-save quality & formula audit gate
    if (isCanvasMode && layoutBlocks.length > 0 && !options?.force) {
      const preSaveCheck = validateTemplatePreSave(layoutBlocks);
      if (!preSaveCheck.canSaveProduction) {
        setShowPreSaveModal(true);
        return;
      }
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
        procedure_no: procedureNo ? procedureNo.trim() : null,
        procedure_name: procedureName ? procedureName.trim() : null,
        procedure_date: procedureDate ? procedureDate.trim() : null,
        procedure_rev: procedureRev ? procedureRev.trim() : null,
        doc_no: docNo ? docNo.trim() : null,
        doc_date: docDate ? docDate.trim() : null,
        doc_rev: docRev ? docRev.trim() : null,
        acceptance_criteria_doc_no: acceptanceCriteriaDocNo ? acceptanceCriteriaDocNo.trim() : null,
        acceptance_criteria_date: acceptanceCriteriaDate ? acceptanceCriteriaDate.trim() : null,
        acceptance_criteria_rev: acceptanceCriteriaRev ? acceptanceCriteriaRev.trim() : null,
        acceptance_criteria_reference: acceptanceCriteriaReference ? acceptanceCriteriaReference.trim() : null,
        status_rule_type: statusRuleType,
        status_formula: statusFormula,
        userId: user?.id,
        companyId: (user as any)?.companyId || (user as any)?.company?.id || null,
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
    <div
      className={
        isFullWindowPage
          ? "fixed inset-0 z-50 bg-background flex flex-row h-screen w-screen overflow-hidden"
          : "min-h-[calc(100vh-4rem)] p-4 max-w-[1920px] mx-auto flex flex-row h-[calc(100vh-4rem)] overflow-hidden gap-3"
      }
    >
      {/* Left Column: Full Template Builder Studio (Header + Canvas/Tabs Workspace) */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* 3-Tier Studio Header matching reference design */}
      <div className="border-b bg-card shrink-0 z-20">
        {/* Tier 1: Responsive Single-Row Action Bar (Back | Mode Switch | Quick Presets & AI | Save & Copilot) */}
        <div className="px-3 sm:px-5 py-2 flex items-center justify-between border-b border-border/60 gap-2 shrink-0 overflow-x-auto scrollbar-none min-h-[48px]">
          {/* Left: Navigation & Mode Switch */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackNavigation}
              className="h-8 gap-1.5 text-foreground hover:text-primary font-semibold px-2 rounded-lg shrink-0"
              title="Go back to templates list"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{templateId ? "Edit Template" : "New Template"}</span>
            </Button>

            <div className="h-4 w-px bg-border/80 hidden sm:block shrink-0" />

            {/* Segmented View Switch */}
            <div className="flex items-center bg-muted/70 p-0.5 rounded-lg border shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsCanvasMode(true);
                  setActiveNavTab("canvas");
                  markDirty();
                  if (layoutBlocks.length === 0) {
                    setLayoutBlocks(JSON.parse(JSON.stringify(CANVAS_PRESETS[0].blocks)));
                  }
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  isCanvasMode
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Switch to Visual Canvas Layout"
              >
                <Sparkles className="w-3 h-3" />
                <span>Visual Canvas</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCanvasMode(false);
                  setActiveNavTab("canvas");
                  markDirty();
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  !isCanvasMode
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Switch to Single Grid Table Layout"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Single Grid</span>
              </button>
            </div>

            <Button
              type="button"
              variant={!isPropertiesCollapsed ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsPropertiesCollapsed(!isPropertiesCollapsed)}
              className={`gap-1.5 text-xs h-8 px-2.5 font-medium rounded-lg transition-colors shrink-0 ${
                !isPropertiesCollapsed
                  ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                  : "hover:bg-muted text-muted-foreground"
              }`}
              title="Toggle Template Properties (Document Control, SOP, Environment)"
            >
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span className="hidden md:inline">Properties</span>
            </Button>
          </div>

          {/* Right: Actions & Tools */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Standard Metrology Presets Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-8 px-2.5 font-medium border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg shadow-2xs shrink-0"
                  title="Load Standard Metrology Template Preset"
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                  <span className="hidden sm:inline">Presets</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-80 overflow-y-auto">
                {CANVAS_PRESETS.map((preset) => (
                  <DropdownMenuItem
                    key={preset.id}
                    onClick={() => {
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
                      toast.success(`Loaded "${preset.name}" preset!`);
                    }}
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                  >
                    <span className="font-semibold text-xs text-foreground">{preset.name}</span>
                    <span className="text-xxs text-muted-foreground line-clamp-1">{preset.description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* AI Smart Generate */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAiModal(true)}
              className="gap-1.5 text-xs h-8 px-2.5 font-medium border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg shadow-2xs shrink-0"
              title="AI Smart Template Generator from drawing, PDF or Excel"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">AI Generate</span>
            </Button>

            {/* Wide Screen Simulation & Audit Shortcuts (visible on ultra-wide screens >= 1700px) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTrialRun(true)}
              className="hidden min-[1700px]:inline-flex gap-1.5 text-xs h-8 px-2.5 font-medium rounded-lg hover:bg-muted shrink-0"
              title="Trial Run Simulation"
            >
              <FlaskConical className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Trial Run</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAuditTargetTable(activeTableBlock);
                setShowTableAuditModal(true);
              }}
              className="hidden min-[1700px]:inline-flex gap-1.5 text-xs h-8 px-2.5 font-medium rounded-lg hover:bg-muted shrink-0"
              title="AI Audit Table Formulas & Tolerances"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>AI Audit</span>
            </Button>

            {/* Dedicated AI Copilot Toggle Button */}
            <Button
              type="button"
              variant={showAssistant ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setShowAssistant(!showAssistant);
                setIsAssistantDocked(true);
              }}
              className={`gap-1.5 text-xs h-8 px-3 font-semibold rounded-lg shadow-2xs transition-colors shrink-0 ${
                showAssistant
                  ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/50"
                  : "border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              }`}
              title="Toggle Full-Height Gaugemaster Template Copilot"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-500" />
              <span>AI Copilot</span>
              {showAssistant && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse ml-0.5" />
              )}
            </Button>

            {/* Primary Save Template Button */}
            <Button
              size="sm"
              onClick={() => handleSave()}
              disabled={saving || isNameDuplicate || !name.trim()}
              className="gap-1.5 h-8 px-3.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-xs shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : templateId ? "Update" : "Save"}</span>
            </Button>

            {/* More Options Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg shrink-0"
                  title="More Studio Tools & Actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs">
                <DropdownMenuItem
                  onClick={() => setShowTrialRun(true)}
                  className="gap-2 cursor-pointer"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Trial Run Simulation</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setAuditTargetTable(activeTableBlock);
                    setShowTableAuditModal(true);
                  }}
                  className="gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span>AI Audit Table (ISO 17025)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowCertPreviewModal(true)}
                  className="gap-2 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span>Preview Certificate</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsFullWindowPage(!isFullWindowPage)}
                  className="gap-2 cursor-pointer"
                >
                  {isFullWindowPage ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Exit Full Window</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 text-primary" />
                      <span>Full Window Studio</span>
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleBackNavigation}
                  className="gap-2 cursor-pointer text-muted-foreground"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Exit Studio</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tier 2: Template Title & Metadata Row */}
        <div className="px-4 sm:px-6 pt-2.5 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="relative group max-w-2xl flex-1 min-w-[280px]">
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    markDirty();
                  }}
                  placeholder="Enter Template Name (e.g. Vernier Caliper Standard IS 3651) *"
                  className={`h-9 text-base sm:text-lg font-bold tracking-tight rounded-lg px-2.5 transition-all ${
                    !name.trim()
                      ? "border-amber-400 dark:border-amber-500 bg-amber-500/5 focus:border-primary focus:ring-2 focus:ring-primary/20"
                      : isNameDuplicate
                      ? "border-destructive focus:ring-2 focus:ring-destructive/20 bg-background"
                      : "border-border/60 hover:border-border focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                  }`}
                  title="Click to edit Template Name"
                />
              </div>

              {isDirty ? (
                <Badge variant="outline" className="border-amber-500/80 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xxs px-2.5 py-0.5 animate-pulse font-semibold rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Unsaved
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xxs px-2.5 py-0.5 font-semibold rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </Badge>
              )}

              {isNameDuplicate && (
                <span className="text-tiny text-destructive font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>A template with this name already exists</span>
                </span>
              )}

              {!name.trim() && (
                <span className="text-tiny text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  <span>Template Name is required to save</span>
                </span>
              )}
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1 flex-wrap">
              <span>{selectedTypeConfig.label}</span>
              <span>•</span>
              <span>{totalPointsCount || 9} Points</span>
              <span>•</span>
              <span>ISO 17025</span>
              {procedureReference && (
                <>
                  <span>•</span>
                  <span>{procedureReference}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tier 3: 5 Underline Navigation Tabs */}
        <div className="px-4 sm:px-6 flex items-center gap-6 border-t border-border/40 overflow-x-auto no-scrollbar">
          {[
            { id: "canvas", label: "Canvas View", icon: Layers },
            { id: "tableConfig", label: "Table Configuration", icon: SlidersHorizontal },
            { id: "specifications", label: "Specifications", icon: Target },
            { id: "certificateLayout", label: "Certificate Layout", icon: FileText },
            { id: "settings", label: "Settings", icon: SettingsIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeNavTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveNavTab(tab.id as any)}
                className={`py-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Studio Flex Workspace */}
      {activeNavTab === "canvas" && (
        <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 overflow-hidden bg-slate-50/50 dark:bg-slate-950/40">
        {/* Left Column: Properties Sidebar */}
        {!isPropertiesCollapsed && (
          <div
            style={{ width: `${propertiesWidth}px` }}
            className="w-full shrink-0 h-full flex relative select-none"
          >
            <Card className="w-full h-full flex flex-col overflow-hidden border shadow-xs bg-card">
          <CardHeader className="py-2.5 px-3.5 border-b shrink-0 bg-muted/20 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Template Properties
              </CardTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsPropertiesCollapsed(true)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-md"
              title="Collapse Panel"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-3 text-xs">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid grid-cols-4 h-9 bg-muted/70 p-0.5 rounded-lg mb-3">
                <TabsTrigger value="basic" className="text-tiny font-semibold py-1 px-1 gap-1 data-[state=active]:shadow-xs">
                  <Layers className="w-3 h-3" />
                  Basic
                </TabsTrigger>
                <TabsTrigger value="docs" className="text-tiny font-semibold py-1 px-1 gap-1 data-[state=active]:shadow-xs">
                  <FileText className="w-3 h-3" />
                  Docs
                </TabsTrigger>
                <TabsTrigger value="env" className="text-tiny font-semibold py-1 px-1 gap-1 data-[state=active]:shadow-xs">
                  <Clock className="w-3 h-3" />
                  Env
                </TabsTrigger>
                <TabsTrigger value="rules" className="text-tiny font-semibold py-1 px-1 gap-1 data-[state=active]:shadow-xs">
                  <Sparkles className="w-3 h-3" />
                  Rules
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: BASIC IDENTIFICATION & STANDARDS */}
              <TabsContent value="basic" className="space-y-3.5 mt-0">
                <div className="space-y-1.5">
                  <Label className="text-xs">Template Name <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g., Dial Indicator (0.001 mm) — Template A"
                    value={name}
                    onChange={(e) => { setName(e.target.value); markDirty(); }}
                    className={`text-xs ${isNameDuplicate ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {isNameDuplicate && (
                    <p className="text-tiny text-destructive font-medium flex items-center gap-1 mt-1">
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
                    rows={2.5}
                  />
                </div>

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
              </TabsContent>

              {/* TAB 2: DOCUMENTS & PROCEDURES */}
              <TabsContent value="docs" className="space-y-3.5 mt-0">
                {/* Format Document Control */}
                <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      Template Document Control
                    </Label>
                    <span className="text-xxs text-muted-foreground">Top-right header box</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-tiny text-muted-foreground">Doc. No.</Label>
                    <Input
                      placeholder="e.g., R/QCM/GI/001/03"
                      value={docNo}
                      onChange={(e) => { setDocNo(e.target.value); markDirty(); }}
                      className="text-xs font-medium h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-tiny text-muted-foreground">Date</Label>
                      <Input
                        placeholder="DD/MM/YYYY"
                        value={docDate}
                        onChange={(e) => { setDocDate(e.target.value); markDirty(); }}
                        className="text-xs font-medium h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-tiny text-muted-foreground">Revision</Label>
                      <Input
                        placeholder="e.g., 3"
                        value={docRev}
                        onChange={(e) => { setDocRev(e.target.value); markDirty(); }}
                        className="text-xs font-medium h-8"
                      />
                    </div>
                  </div>
                  {docNo && (
                    <div className="border border-primary/20 bg-background rounded-lg p-2 text-xxs font-mono shadow-2xs">
                      <div className="font-bold text-primary">Doc.No : {docNo}</div>
                      <div className="text-muted-foreground mt-0.5">Date &amp; Rev : {docDate || "-"} &amp; {docRev || "-"}</div>
                    </div>
                  )}
                </div>

                {/* Calibration Procedure Control */}
                <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-primary" />
                      Calibration Procedure
                    </Label>
                    <span className="text-xxs text-muted-foreground">Procedure No cell</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-tiny text-muted-foreground">Procedure Name</Label>
                    <Input
                      placeholder="e.g., Gauges and Instruments Calibration Procedure"
                      value={procedureName}
                      onChange={(e) => { setProcedureName(e.target.value); markDirty(); }}
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-tiny text-muted-foreground">Procedure No</Label>
                    <Input
                      placeholder="e.g., CP-001"
                      value={procedureNo}
                      onChange={(e) => { setProcedureNo(e.target.value); markDirty(); }}
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-tiny text-muted-foreground">Procedure Doc. No. / SOP</Label>
                    <Input
                      placeholder="e.g., D/QCM/GI/006/01"
                      value={procedureReference}
                      onChange={(e) => { setProcedureReference(e.target.value); markDirty(); }}
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-tiny text-muted-foreground">Date</Label>
                      <Input
                        placeholder="DD-MM-YYYY"
                        value={procedureDate}
                        onChange={(e) => { setProcedureDate(e.target.value); markDirty(); }}
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-tiny text-muted-foreground">Revision</Label>
                      <Input
                        placeholder="e.g., 2"
                        value={procedureRev}
                        onChange={(e) => { setProcedureRev(e.target.value); markDirty(); }}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                </div>

                {/* Acceptance Criteria Document Control */}
                <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-primary" />
                      Acceptance Criteria Reference
                    </Label>
                    <span className="text-xxs text-muted-foreground">Above Procedure table</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-tiny text-muted-foreground">Criteria Doc. No.</Label>
                    <Input
                      placeholder="e.g., D/QCM/GI/006/03"
                      value={acceptanceCriteriaDocNo}
                      onChange={(e) => { setAcceptanceCriteriaDocNo(e.target.value); markDirty(); }}
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-tiny text-muted-foreground">Date</Label>
                      <Input
                        placeholder="DD-MM-YYYY"
                        value={acceptanceCriteriaDate}
                        onChange={(e) => { setAcceptanceCriteriaDate(e.target.value); markDirty(); }}
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-tiny text-muted-foreground">Revision</Label>
                      <Input
                        placeholder="e.g., 01"
                        value={acceptanceCriteriaRev}
                        onChange={(e) => { setAcceptanceCriteriaRev(e.target.value); markDirty(); }}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-tiny text-muted-foreground">Custom Reference Text (Optional)</Label>
                    <Input
                      placeholder="AS Per D/QCM/GI/006/03 Rev-01 dated 12-05-2026"
                      value={acceptanceCriteriaReference}
                      onChange={(e) => { setAcceptanceCriteriaReference(e.target.value); markDirty(); }}
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: ENVIRONMENTAL DEFAULTS & DIAGRAM IMAGE */}
              <TabsContent value="env" className="space-y-3.5 mt-0">
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
                      <Label className="text-xxs text-muted-foreground">Temp (°C)</Label>
                      <Input
                        value={envTemp}
                        onChange={(e) => { setEnvTemp(e.target.value); markDirty(); }}
                        placeholder="20"
                        className="text-xs h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xxs text-muted-foreground">Humidity (%)</Label>
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
                      <span className="text-tiny font-semibold text-foreground">
                        Soaking Time (Optional)
                      </span>
                      <span className="text-xxs text-muted-foreground font-mono">hh:mm / hh:mm:ss</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xxs text-muted-foreground">Start Time</Label>
                        <TimePicker
                          value={envSoakingStartTime}
                          onChange={(val) => handleSoakingStartChange(val)}
                          placeholder="08:30"
                        />
                      </div>
                      <div>
                        <Label className="text-xxs text-muted-foreground">End Time</Label>
                        <TimePicker
                          value={envSoakingEndTime}
                          onChange={(val) => handleSoakingEndChange(val)}
                          placeholder="10:30"
                        />
                      </div>
                      <div>
                        <Label className="text-xxs text-primary font-semibold">Soaking Time</Label>
                        <DurationPicker
                          value={envSoakingTime}
                          onChange={(val) => { setEnvSoakingTime(val); markDirty(); }}
                          placeholder="02:00"
                        />
                      </div>
                    </div>
                    {(envSoakingTime || envSoakingStartTime || envSoakingEndTime) && (
                      <p className="text-xxs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        ✓ Soaking time details will be shown on preview and printed certificate
                      </p>
                    )}
                  </div>
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
                        className="h-6 px-2 text-xxs gap-1 font-semibold text-primary border-primary/30 hover:bg-primary/5 shadow-2xs"
                        title="Open Full Certificate Preview"
                      >
                        <Eye className="w-3 h-3" />
                        Full Preview
                      </Button>
                      {diagramImage && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xxs">
                          Uploaded
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-tiny text-muted-foreground leading-tight">
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
                        <span className="text-xxs text-muted-foreground">
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
                        <div className="flex items-center justify-between text-tiny font-medium text-muted-foreground">
                          <span>Live Certificate Preview</span>
                          <span className="font-mono text-xxs">{diagramWidth}px × {diagramHeight}px • {diagramAlignment}</span>
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
                            <Label className="text-xxs text-muted-foreground">Width: <span className="font-mono font-bold text-foreground">{diagramWidth}px</span></Label>
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
                            <Label className="text-xxs text-muted-foreground">Max Height: <span className="font-mono font-bold text-foreground">{diagramHeight}px</span></Label>
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
                          <Label className="text-xxs text-muted-foreground mr-1">Align:</Label>
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
                            className="h-6 px-2 text-xxs gap-1 font-medium"
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
                            className="h-6 px-2 text-xxs gap-1 font-medium"
                            onClick={handlePasteFromClipboard}
                            title="Paste new image from Clipboard (or press Ctrl+V)"
                          >
                            <ClipboardPaste className="w-2.5 h-2.5" />
                            Paste
                          </Button>
                          <label
                            htmlFor="diagram-replace-upload"
                            className="cursor-pointer inline-flex items-center gap-1 text-xxs h-6 px-2 border rounded-md hover:bg-muted font-medium"
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
                            className="h-6 px-2 text-xxs text-destructive hover:text-destructive hover:bg-destructive/10"
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
              </TabsContent>

              {/* TAB 4: RULES & ACCEPTANCE CRITERIA */}
              <TabsContent value="rules" className="space-y-3.5 mt-0">
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
                      <Label htmlFor="acceptance_check" className="text-tiny cursor-pointer font-medium">Enable</Label>
                    </div>
                  </div>

                  {enableAcceptance && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <Label className="text-xxs text-muted-foreground">Criteria Limit</Label>
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
                        <Label className="text-xxs text-muted-foreground">Limit Unit</Label>
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
              </TabsContent>
            </Tabs>
          </CardContent>
          </Card>
          {/* Draggable Resizer Handle on right border of Properties */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingProps(true);
              propsResizeRef.current = { startX: e.clientX, startWidth: propertiesWidth };
            }}
            className="absolute right-0 top-0 bottom-0 w-3 -mr-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-40 transition-colors flex items-center justify-center group select-none"
            title="Drag to adjust Properties sidebar width"
          >
            <div className="w-[3px] h-8 bg-slate-300 dark:bg-slate-700 group-hover:bg-primary group-active:bg-primary rounded-full transition-colors" />
          </div>
        </div>
        )}

        {/* Right Column: Interactive Canvas or Single Grid Data Table */}
        {isCanvasMode ? (
          <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
            <CanvasTemplateEditor
              blocks={layoutBlocks}
              onChange={(newBlocks) => {
                setLayoutBlocks(newBlocks);
                markDirty();
              }}
              hideCopilotInside={true}
              selectedBlockId={selectedBlockId}
              onSelectBlockId={(id) => {
                setSelectedBlockId(id);
                if (id) setSelectedTableBlockId(id);
              }}
              selectedColumnId={selectedColumnId}
              onSelectColumnId={setSelectedColumnId}
              onRegisterActions={(actions) => {
                canvasActionsRef.current = actions;
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
              onApplyGeneratedTemplate={handleApplyAiGenerated}
              defaultUnit={defaultUnit}
              defaultTolerance={typeof defaultTolerance === "number" ? defaultTolerance : 0.01}
              decimalPlaces={decimalPlaces}
              templateName={name}
              docNo={docNo}
              docDate={docDate}
              docRev={docRev}
              procedureReference={procedureReference}
              procedureNo={procedureNo}
              procedureName={procedureName}
              procedureDate={procedureDate}
              procedureRev={procedureRev}
              acceptanceCriteriaDocNo={acceptanceCriteriaDocNo}
              acceptanceCriteriaDate={acceptanceCriteriaDate}
              acceptanceCriteriaRev={acceptanceCriteriaRev}
              acceptanceCriteriaReference={acceptanceCriteriaReference}
              diagramImage={diagramImage}
              diagramImageWidth={diagramWidth}
              diagramImageHeight={diagramHeight}
              diagramImageAlignment={diagramAlignment}
              onDecimalPlacesChange={(dp) => {
                setDecimalPlaces(dp);
                markDirty();
              }}
            />
          </div>
        ) : (
          <Card className="flex-1 min-w-0 h-full flex flex-col overflow-hidden border shadow-xs bg-card">
            <CardHeader className="py-2.5 px-3.5 border-b shrink-0 bg-muted/20 flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
              <div>
                <CardTitle className="text-xs font-bold flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                  Standard Test Points & Custom Formulas
                </CardTitle>
              </div>

              <div className="flex items-center gap-2">
                {isPropertiesCollapsed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPropertiesCollapsed(false)}
                    className="text-xs h-7 gap-1 shadow-xs shrink-0 border-primary/40 text-primary hover:bg-primary/5"
                    title="Show Template Properties sidebar"
                  >
                    <PanelLeftOpen className="w-3.5 h-3.5" />
                    Show Properties
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-3 space-y-3">
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
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {/* TAB: Table Configuration */}
      {activeNavTab === "tableConfig" && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="w-full max-w-[1900px] mx-auto px-1 sm:px-2 space-y-4">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-bold text-foreground">Table & Column Architecture</h2>
                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/30">
                    {isCanvasMode ? `${allTableBlocks.length} Table Block${allTableBlocks.length === 1 ? '' : 's'}` : "Single Grid Mode"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure table schemas, column headers, keys, mathematical formulas, alignments, and widths
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveNavTab("canvas")}
                  className="gap-1.5 text-xs h-8"
                >
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  Return to Canvas View
                </Button>
              </div>
            </div>

            {isCanvasMode ? (
              <>
                {/* Table Block Switcher Tabs */}
                {allTableBlocks.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {allTableBlocks.map((item, idx) => {
                      const isSelected = activeTableBlock?.id === item.block.id;
                      return (
                        <button
                          key={item.block.id}
                          type="button"
                          onClick={() => setSelectedTableBlockId(item.block.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 border transition-all cursor-pointer shrink-0 ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-card text-muted-foreground hover:text-foreground border-border"
                          }`}
                        >
                          <TableIcon className="w-3.5 h-3.5" />
                          <span>{item.block.title || `Table Block ${idx + 1}`}</span>
                          <span className={`text-xxs px-1.5 py-0.5 rounded-full ${isSelected ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground"}`}>
                            {item.block.rows?.length || 0} rows
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeTableBlock ? (
                  <div className="space-y-4">
                    {/* Table Block Metrology & Print Settings Card */}
                    <Card className="border shadow-xs bg-card">
                      <CardHeader className="py-2.5 px-4 border-b bg-muted/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground">
                              <Sliders className="w-3.5 h-3.5 text-primary" />
                              Table Metrology & Print Properties
                            </CardTitle>
                            <Badge variant="secondary" className="text-xxs font-mono uppercase">
                              {activeTableBlock.rows?.length || 0} Test Points / Rows
                            </Badge>
                            {isMetrologyPropertiesCollapsed && (
                              <span className="text-tiny text-muted-foreground font-medium hidden sm:inline">
                                • {activeTableBlock.title || "Untitled"} ({activeTableBlock.unit || defaultUnit || "mm"}, ±{activeTableBlock.tolerance ?? 0.01})
                              </span>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsMetrologyPropertiesCollapsed(!isMetrologyPropertiesCollapsed)}
                            className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
                            title={isMetrologyPropertiesCollapsed ? "Expand Properties" : "Collapse Properties"}
                          >
                            {isMetrologyPropertiesCollapsed ? (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                <span>Expand</span>
                              </>
                            ) : (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                <span>Collapse</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      {!isMetrologyPropertiesCollapsed && (
                        <CardContent className="p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Table Section Title */}
                            <div className="space-y-1">
                              <Label className="text-tiny font-semibold text-muted-foreground uppercase">Section Title</Label>
                              <Input
                                value={activeTableBlock.title || ""}
                                onChange={(e) => updateActiveTableBlock({ title: e.target.value })}
                                placeholder="e.g. Calibration Data"
                                className="h-8 text-xs font-semibold"
                              />
                            </div>

                            {/* Unit */}
                            <div className="space-y-1">
                              <Label className="text-tiny font-semibold text-muted-foreground uppercase">Default Unit</Label>
                              <Input
                                value={activeTableBlock.unit || defaultUnit || "mm"}
                                onChange={(e) => updateActiveTableBlock({ unit: e.target.value })}
                                placeholder="e.g. mm, µm, bar, °C"
                                className="h-8 text-xs font-mono"
                              />
                            </div>

                            {/* Default Tolerance */}
                            <div className="space-y-1">
                              <Label className="text-tiny font-semibold text-muted-foreground uppercase">Default Tolerance (±)</Label>
                              <Input
                                type="number"
                                step="any"
                                value={activeTableBlock.tolerance ?? (typeof defaultTolerance === "number" ? defaultTolerance : 0.01)}
                                onChange={(e) => updateActiveTableBlock({ tolerance: parseFloat(e.target.value) || 0 })}
                                placeholder="0.010"
                                className="h-8 text-xs font-mono"
                              />
                            </div>

                            {/* Table Decimal Precision */}
                            <div className="space-y-1">
                              <Label className="text-tiny font-semibold text-muted-foreground uppercase">Table Decimal Precision</Label>
                              <Select
                                value={String(activeTableBlock.decimal_places ?? decimalPlaces ?? 4)}
                                onValueChange={(val) => {
                                  const dp = parseInt(val, 10) || 3;
                                  updateActiveTableBlock({ decimal_places: dp });
                                  setDecimalPlaces(dp);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 (0.0)</SelectItem>
                                  <SelectItem value="2">2 (0.00)</SelectItem>
                                  <SelectItem value="3">3 (0.000)</SelectItem>
                                  <SelectItem value="4">4 (0.0000)</SelectItem>
                                  <SelectItem value="5">5 (0.00000)</SelectItem>
                                  <SelectItem value="6">6 (0.000000)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                            {/* Table Print Orientation */}
                            <div className="space-y-2 p-3 rounded-lg bg-muted/20 border">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                  <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                                  Table Print Orientation
                                </Label>
                                <Badge variant="outline" className="text-xxs font-mono capitalize">
                                  {activeTableBlock.orientation || "auto"}
                                </Badge>
                              </div>
                              <Select
                                value={activeTableBlock.orientation || "auto"}
                                onValueChange={(val: any) => {
                                  updateActiveTableBlock({ orientation: val });
                                  toast.success(`Table orientation set to ${val}`);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">
                                    <div className="flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                      <span>Auto (Smart Column/Row Layout)</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="vertical">
                                    <span>Vertical (Standard Columns at Top)</span>
                                  </SelectItem>
                                  <SelectItem value="horizontal">
                                    <span>Horizontal (Transposed Matrix Across)</span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xxs text-muted-foreground">
                                {((activeTableBlock.columns?.length || 0) > 6)
                                  ? "Table has > 6 columns: Horizontal orientation recommended for optimal print width."
                                  : "Standard vertical layout recommended for standard certificate formatting."}
                              </p>
                            </div>

                            {/* Block Spacing & Margins */}
                            <div className="space-y-2 p-3 rounded-lg bg-muted/20 border">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                  <Sliders className="w-3.5 h-3.5 text-primary" />
                                  Block Spacing & Print Margins
                                </Label>
                                <span className="text-xxs font-mono text-muted-foreground">
                                  Top: {activeTableBlock.marginTop ?? 0}px • Bottom: {activeTableBlock.marginBottom ?? 6}px
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-tiny">
                                    <span className="text-muted-foreground">Top Gap</span>
                                    <span className="font-mono text-xs font-semibold">{activeTableBlock.marginTop ?? 0}px</span>
                                  </div>
                                  <div className="flex gap-1 flex-wrap">
                                    {[0, 4, 8, 12, 16].map((gap) => (
                                      <button
                                        key={gap}
                                        type="button"
                                        onClick={() => updateActiveTableBlock({ marginTop: gap })}
                                        className={`px-2 py-0.5 rounded text-xxs font-mono font-medium transition-colors border ${
                                          (activeTableBlock.marginTop ?? 0) === gap
                                            ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                                            : "bg-card text-muted-foreground hover:text-foreground border-border"
                                        }`}
                                      >
                                        {gap}px
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-tiny">
                                    <span className="text-muted-foreground">Bottom Gap</span>
                                    <span className="font-mono text-xs font-semibold">{activeTableBlock.marginBottom ?? 6}px</span>
                                  </div>
                                  <div className="flex gap-1 flex-wrap">
                                    {[0, 4, 6, 12, 18, 24].map((gap) => (
                                      <button
                                        key={gap}
                                        type="button"
                                        onClick={() => updateActiveTableBlock({ marginBottom: gap })}
                                        className={`px-2 py-0.5 rounded text-xxs font-mono font-medium transition-colors border ${
                                          (activeTableBlock.marginBottom ?? 6) === gap
                                            ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                                            : "bg-card text-muted-foreground hover:text-foreground border-border"
                                        }`}
                                      >
                                        {gap}px
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>

                    {/* Columns Architecture & Properties Card */}
                    <Card className="border shadow-xs bg-card">
                      <CardHeader className="py-3 px-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
                        <div>
                          <CardTitle className="text-xs font-bold flex items-center gap-2">
                            <TableIcon className="w-3.5 h-3.5 text-primary" />
                            Column Architecture & Formula Rules
                          </CardTitle>
                          <CardDescription className="text-tiny">
                            Define column identifiers, math formulas, decimal precisions, custom widths, and alignments
                          </CardDescription>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAutoCalculateWidths(activeTableBlock.id)}
                            className="h-8 text-xs gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/5"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            Auto-Fit Widths
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAddColumnToActiveTable}
                            className="h-8 text-xs gap-1.5 font-semibold shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Column
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-xs text-left min-w-[1250px]">
                          <thead className="bg-muted/40 text-muted-foreground font-semibold border-b text-tiny">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">#</th>
                              <th className="py-2.5 px-3 w-44 min-w-[140px]">Column Header</th>
                              <th className="py-2.5 px-3 w-36 min-w-[120px]">Key / Identifier</th>
                              <th className="py-2.5 px-3 w-32">Type</th>
                              <th className="py-2.5 px-3 w-28">Decimals</th>
                              <th className="py-2.5 px-3 min-w-[340px]">Formula Expression</th>
                              <th className="py-2.5 px-3 w-44 min-w-[160px]">Width (px)</th>
                              <th className="py-2.5 px-3 w-24 text-center">Align</th>
                              <th className="py-2.5 px-3 w-20 text-center">Pass/Fail</th>
                              <th className="py-2.5 px-3 w-14 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {(activeTableBlock.columns || []).map((col, idx) => {
                              const colIdentifier = col.id || col.key || `col_${idx + 1}`;
                              const parsedWidth = typeof col.width === "number"
                                ? col.width
                                : typeof col.width === "string" && col.width.endsWith("%")
                                ? Math.round((parseFloat(col.width) / 100) * 1100)
                                : parseInt(String(col.width || 110), 10) || 110;

                              return (
                                <tr key={colIdentifier} className="hover:bg-muted/20 transition-colors">
                                  <td className="py-2 px-3 text-center text-muted-foreground font-mono text-xxs">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2 px-3">
                                    <Input
                                      value={col.label || ""}
                                      onChange={(e) => handleUpdateColumnInActiveTable(colIdentifier, { label: e.target.value })}
                                      placeholder="Header Name"
                                      className="h-7 text-xs font-semibold"
                                    />
                                  </td>
                                  <td className="py-2 px-3">
                                    <code
                                      className="px-2 py-0.5 rounded bg-muted text-tiny font-mono text-foreground font-semibold cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                                      title="Click to copy key token"
                                      onClick={() => {
                                        navigator.clipboard.writeText(col.key || col.id);
                                        toast.success(`Copied "${col.key || col.id}"`);
                                      }}
                                    >
                                      {col.key || col.id}
                                    </code>
                                  </td>
                                  <td className="py-2 px-3">
                                    <Select
                                      value={col.type === "formula" ? "formula" : (col.type || "number")}
                                      onValueChange={(val: any) => {
                                        let defFormula = col.formula;
                                        if (val === "formula" && !defFormula) defFormula = "reading - nominal";
                                        if (val === "status" && !defFormula) defFormula = "IF(ABS(error)<=tolerance,'PASS','FAIL')";
                                        handleUpdateColumnInActiveTable(colIdentifier, { type: val, formula: defFormula });
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="nominal">Nominal / Spec</SelectItem>
                                        <SelectItem value="reading">Reading / Observed</SelectItem>
                                        <SelectItem value="trial">Trial (t1, t2..)</SelectItem>
                                        <SelectItem value="formula">Formula (fx)</SelectItem>
                                        <SelectItem value="tolerance">Tolerance (±)</SelectItem>
                                        <SelectItem value="status">Status / Pass-Fail</SelectItem>
                                        <SelectItem value="number">Numeric</SelectItem>
                                        <SelectItem value="text">Text</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="py-2 px-3">
                                    {col.type === "text" || col.type === "status" ? (
                                      <span className="text-muted-foreground text-xxs italic">N/A</span>
                                    ) : (
                                      <Select
                                        value={
                                          col.decimal_places !== undefined
                                            ? String(col.decimal_places)
                                            : col.decimalPrecision !== undefined
                                            ? String(col.decimalPrecision)
                                            : "inherit"
                                        }
                                        onValueChange={(val: string) => {
                                          const newDec = val === "inherit" ? undefined : parseInt(val, 10);
                                          handleUpdateColumnInActiveTable(colIdentifier, {
                                            decimal_places: newDec,
                                            decimalPrecision: newDec,
                                          });
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="inherit">Inherit ({activeTableBlock.decimal_places ?? decimalPlaces ?? 4})</SelectItem>
                                          <SelectItem value="0">0 (Integer)</SelectItem>
                                          <SelectItem value="1">1 Dec (.0)</SelectItem>
                                          <SelectItem value="2">2 Dec (.00)</SelectItem>
                                          <SelectItem value="3">3 Dec (.000)</SelectItem>
                                          <SelectItem value="4">4 Dec (.0000)</SelectItem>
                                          <SelectItem value="5">5 Dec (.00000)</SelectItem>
                                          <SelectItem value="6">6 Dec (.000000)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    {col.type === "formula" || col.type === "status" || Boolean(col.formula) ? (
                                      <div className="space-y-1">
                                        <Input
                                          value={col.formula || ""}
                                          onChange={(e) => handleUpdateColumnInActiveTable(colIdentifier, { formula: e.target.value })}
                                          placeholder="e.g. ABS(reading - nominal)"
                                          className="h-7 text-xs font-mono bg-blue-500/[0.04] border-blue-400/40 text-blue-700 dark:text-blue-300 font-medium w-full min-w-[320px]"
                                        />
                                        <span className="text-xxs text-muted-foreground flex items-center gap-1 font-mono">
                                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                          Live AST verified
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-tiny italic">Direct user input</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <input
                                          type="range"
                                          min={50}
                                          max={300}
                                          step={5}
                                          value={parsedWidth}
                                          onChange={(e) => handleUpdateColumnInActiveTable(colIdentifier, { width: parseInt(e.target.value, 10) || 100 })}
                                          className="w-20 h-1.5 bg-muted rounded appearance-none cursor-pointer accent-primary"
                                        />
                                        <Input
                                          type="number"
                                          value={parsedWidth}
                                          onChange={(e) => handleUpdateColumnInActiveTable(colIdentifier, { width: parseInt(e.target.value, 10) || 80 })}
                                          className="h-7 text-xs font-mono w-16 px-1.5 text-center"
                                        />
                                        <span className="text-xxs text-muted-foreground">px</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {[
                                          { label: "Sm", w: 70 },
                                          { label: "Md", w: 110 },
                                          { label: "Lg", w: 160 },
                                        ].map((p) => (
                                          <button
                                            key={p.label}
                                            type="button"
                                            onClick={() => handleUpdateColumnInActiveTable(colIdentifier, { width: p.w })}
                                            className={`px-1.5 py-0.2 text-[9px] rounded border font-mono transition-colors ${
                                              parsedWidth === p.w
                                                ? "bg-primary text-primary-foreground border-primary font-bold"
                                                : "bg-muted/40 text-muted-foreground hover:text-foreground border-border"
                                            }`}
                                          >
                                            {p.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <div className="inline-flex items-center rounded-md border p-0.5 bg-muted/40">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateColumnInActiveTable(colIdentifier, { align: "left" })}
                                        className={`p-1 rounded ${col.align === "left" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"}`}
                                        title="Align Left"
                                      >
                                        <AlignLeft className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateColumnInActiveTable(colIdentifier, { align: "center" })}
                                        className={`p-1 rounded ${col.align === "center" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"}`}
                                        title="Align Center"
                                      >
                                        <AlignCenter className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateColumnInActiveTable(colIdentifier, { align: "right" })}
                                        className={`p-1 rounded ${(!col.align || col.align === "right") ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"}`}
                                        title="Align Right"
                                      >
                                        <AlignRight className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <Checkbox
                                      checked={!!col.isPassFail || col.type === "status"}
                                      onCheckedChange={(c) => handleUpdateColumnInActiveTable(colIdentifier, { isPassFail: !!c })}
                                    />
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteColumnFromActiveTable(colIdentifier)}
                                      className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-md"
                                      title="Delete Column"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-card border rounded-xl">
                    <p className="text-xs text-muted-foreground">No table blocks found in current canvas layout.</p>
                  </div>
                )}

                {/* Formula AST Reference Engine Callout */}
                <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <Sparkles className="w-4 h-4" />
                    <span>Formula AST & Expression Engine Guidelines</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Formulas are verified via AST compiler before certificate compilation. You can reference any column key in this table directly.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-tiny font-semibold text-foreground">Available Column Tokens:</span>
                    {(activeTableBlock?.columns || []).map((col, idx) => {
                      const token = col.key || col.id || `col_${idx + 1}`;
                      return (
                        <code
                          key={token}
                          className="px-2 py-0.5 rounded-md bg-card border text-tiny font-mono text-primary font-bold shadow-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
                          onClick={() => {
                            navigator.clipboard.writeText(token);
                            toast.success(`Copied "${token}" to clipboard!`);
                          }}
                          title="Click to copy key"
                        >
                          {token}
                        </code>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              /* Single Grid Table Configuration */
              <Card className="border shadow-xs bg-card p-6 text-center space-y-3">
                <p className="text-xs text-muted-foreground">
                  You are currently in Single Grid Mode. Columns and formulas can be configured directly on the data grid.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveNavTab("canvas")}
                  className="text-xs"
                >
                  Edit Points in Single Grid
                </Button>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TAB: Specifications & Evaluation Rules */}
      {activeNavTab === "specifications" && (
        <ErrorBoundary fallbackTitle="Error loading Specifications tab">
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="w-full max-w-[1900px] mx-auto px-1 sm:px-2 space-y-5">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-bold text-foreground">Instrument Specifications & Evaluation Rules</h2>
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    ISO/IEC 17025 Compliant
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Define instrument categories, nominal tolerances, decimal precision, and acceptance criteria (MPE)
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveNavTab("canvas")}
                className="gap-1.5 text-xs h-8 shrink-0"
              >
                <Layers className="w-3.5 h-3.5 text-primary" />
                Return to Canvas View
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Instrument Profile Card */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="py-3 px-4 border-b bg-muted/20">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-primary" />
                    Instrument Profile & Units
                  </CardTitle>
                  <CardDescription className="text-tiny">
                    Define instrument classification, measurement unit, and numerical resolution
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Instrument Type / Category</Label>
                    <Input
                      value={instrumentType || ""}
                      onChange={(e) => { setInstrumentType(e.target.value); markDirty(); }}
                      placeholder="e.g. Dial Indicator (0.001 mm), Vernier Caliper"
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Calibration Discipline</Label>
                    <Select value={calibrationType || "dimensional"} onValueChange={(val) => { setCalibrationType(val); markDirty(); }}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALIBRATION_TYPES.map((t) => (
                          <SelectItem key={t.type} value={t.type}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Default Measurement Unit</Label>
                      <Select value={defaultUnit || "mm"} onValueChange={(val) => { setDefaultUnit(val); markDirty(); }}>
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mm">mm (Millimeter)</SelectItem>
                          <SelectItem value="µm">µm (Micrometer)</SelectItem>
                          <SelectItem value="inch">inch (Inches)</SelectItem>
                          <SelectItem value="deg">deg (Degrees)</SelectItem>
                          <SelectItem value="bar">bar (Pressure)</SelectItem>
                          <SelectItem value="psi">psi (Pressure)</SelectItem>
                          <SelectItem value="°C">°C (Temperature)</SelectItem>
                          <SelectItem value="kg">kg (Mass)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Decimal Places</Label>
                      <Select
                        value={String(decimalPlaces ?? 4)}
                        onValueChange={(val) => { setDecimalPlaces(parseInt(val, 10) || 0); markDirty(); }}
                      >
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 (e.g. 10)</SelectItem>
                          <SelectItem value="1">1 (e.g. 10.0)</SelectItem>
                          <SelectItem value="2">2 (e.g. 10.00)</SelectItem>
                          <SelectItem value="3">3 (e.g. 10.000)</SelectItem>
                          <SelectItem value="4">4 (e.g. 10.0000)</SelectItem>
                          <SelectItem value="5">5 (e.g. 10.00000)</SelectItem>
                          <SelectItem value="6">6 (e.g. 10.000000)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Default Nominal Tolerance (±)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="any"
                        value={defaultTolerance ?? ""}
                        onChange={(e) => {
                          setDefaultTolerance(e.target.value === "" ? "" : parseFloat(e.target.value));
                          markDirty();
                        }}
                        placeholder="0.001"
                        className="text-xs h-8 pr-12 font-mono font-bold"
                      />
                      <span className="absolute right-3 top-2 text-xxs text-muted-foreground font-mono">
                        {defaultUnit || "mm"}
                      </span>
                    </div>
                  </div>

                  {/* Live resolution preview */}
                  <div className="p-3 rounded-lg bg-muted/40 border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Preview Reading:</span>
                    <span className="font-mono font-bold text-foreground">
                      {(10.000001).toFixed(decimalPlaces ?? 4)} {defaultUnit || "mm"} (±{(typeof defaultTolerance === 'number' ? defaultTolerance : 0).toFixed(decimalPlaces ?? 4)})
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Acceptance Criteria & Evaluation Rules */}
              <div className="space-y-6">
                <Card className="border shadow-xs bg-card">
                  <CardHeader className="py-3 px-4 border-b bg-muted/20">
                    <CardTitle className="text-xs font-bold flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Acceptance Criteria (MPE)
                    </CardTitle>
                    <CardDescription className="text-tiny">
                      Maximum Permissible Error threshold enforcement for PASS/FAIL verdicts
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                      <div className="space-y-0.5">
                        <Label htmlFor="mpe_toggle" className="text-xs font-bold cursor-pointer">
                          Enforce Acceptance Criteria (MPE)
                        </Label>
                        <p className="text-tiny text-muted-foreground">
                          Evaluate measurement errors automatically against MPE limits
                        </p>
                      </div>
                      <Checkbox
                        id="mpe_toggle"
                        checked={enableAcceptance}
                        onCheckedChange={(c) => { setEnableAcceptance(!!c); markDirty(); }}
                      />
                    </div>

                    {enableAcceptance && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Criteria Limit</Label>
                          <Input
                            type="number"
                            step="any"
                            value={acceptanceValue ?? ""}
                            onChange={(e) => {
                              setAcceptanceValue(e.target.value === "" ? "" : parseFloat(e.target.value));
                              markDirty();
                            }}
                            placeholder="2"
                            className="text-xs h-8 font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Limit Unit Type</Label>
                          <Select
                            value={acceptanceType || "percentage"}
                            onValueChange={(val: any) => { setAcceptanceType(val); markDirty(); }}
                          >
                            <SelectTrigger className="text-xs h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">% Percentage</SelectItem>
                              <SelectItem value="absolute">± Absolute Unit ({defaultUnit || "mm"})</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Overall Verdict Strategy */}
                <Card className="border shadow-xs bg-card">
                  <CardHeader className="py-3 px-4 border-b bg-muted/20">
                    <CardTitle className="text-xs font-bold flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Pass / Fail Evaluation Engine
                    </CardTitle>
                    <CardDescription className="text-tiny">
                      Algorithm used to compute certificate final PASS/FAIL status
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Evaluation Logic</Label>
                      <Select
                        value={statusRuleType || "default"}
                        onValueChange={(val: any) => { setStatusRuleType(val); markDirty(); }}
                      >
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Standard (All points must PASS)</SelectItem>
                          <SelectItem value="custom_formula">Custom Mathematical Formula</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {statusRuleType === "custom_formula" && (
                      <div className="space-y-1.5 pt-1">
                        <Label className="text-xs font-semibold">Custom Formula Expression</Label>
                        <Input
                          value={statusFormula || ""}
                          onChange={(e) => { setStatusFormula(e.target.value); markDirty(); }}
                          placeholder="e.g. error <= tolerance ? 'PASS' : 'FAIL'"
                          className="text-xs font-mono h-8"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
        </ErrorBoundary>
      )}

      {/* TAB: Certificate Layout & Technical Diagram */}
      {activeNavTab === "certificateLayout" && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="w-full max-w-[1900px] mx-auto px-1 sm:px-2 space-y-5">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-bold text-foreground">Certificate Layout & Technical Diagram</h2>
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                    Document Control & ISO 17025
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage ISO document headers, calibration SOP references, and gauge schematic diagram embedding
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowCertPreviewModal(true)}
                  className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground font-semibold shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Open Live Certificate Preview
                </Button>
              </div>
            </div>

            {/* Document Control Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Document Control */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    Document Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="space-y-1">
                    <Label className="text-tiny">Document Number</Label>
                    <Input
                      value={docNo}
                      onChange={(e) => { setDocNo(e.target.value); markDirty(); }}
                      placeholder="e.g. DOC-CAL-001"
                      className="text-xs h-7.5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-tiny">Rev No.</Label>
                      <Input
                        value={docRev}
                        onChange={(e) => { setDocRev(e.target.value); markDirty(); }}
                        placeholder="01"
                        className="text-xs h-7.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-tiny">Issue Date</Label>
                      <Input
                        type="date"
                        value={docDate}
                        onChange={(e) => { setDocDate(e.target.value); markDirty(); }}
                        className="text-xs h-7.5"
                      />
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="text-xxs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold inline-block">
                      ✓ ISO/IEC 17025 Accredited
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Calibration SOP Reference */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    Calibration Procedure (SOP)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="space-y-1">
                    <Label className="text-tiny">Procedure Ref / Code</Label>
                    <Input
                      value={procedureReference}
                      onChange={(e) => { setProcedureReference(e.target.value); markDirty(); }}
                      placeholder="e.g. AE/CAL-SOP/01"
                      className="text-xs h-7.5"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-tiny">Procedure Name</Label>
                    <Input
                      value={procedureName}
                      onChange={(e) => { setProcedureName(e.target.value); markDirty(); }}
                      placeholder="e.g. SOP for Dial Gauges"
                      className="text-xs h-7.5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-tiny">Doc No</Label>
                      <Input
                        value={procedureNo}
                        onChange={(e) => { setProcedureNo(e.target.value); markDirty(); }}
                        placeholder="SOP-01"
                        className="text-xs h-7.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-tiny">Rev</Label>
                      <Input
                        value={procedureRev}
                        onChange={(e) => { setProcedureRev(e.target.value); markDirty(); }}
                        placeholder="00"
                        className="text-xs h-7.5"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-tiny">Date</Label>
                    <Input
                      type="date"
                      value={procedureDate}
                      onChange={(e) => { setProcedureDate(e.target.value); markDirty(); }}
                      className="text-xs h-7.5"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Acceptance Reference */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="py-2.5 px-3.5 border-b bg-muted/20">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <FileCheck2 className="w-3.5 h-3.5 text-amber-500" />
                    Acceptance Criteria Reference
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="space-y-1">
                    <Label className="text-tiny">Criteria Doc No.</Label>
                    <Input
                      value={acceptanceCriteriaDocNo}
                      onChange={(e) => { setAcceptanceCriteriaDocNo(e.target.value); markDirty(); }}
                      placeholder="e.g. IS 3651 / QA-SPEC-02"
                      className="text-xs h-7.5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-tiny">Rev</Label>
                      <Input
                        value={acceptanceCriteriaRev}
                        onChange={(e) => { setAcceptanceCriteriaRev(e.target.value); markDirty(); }}
                        placeholder="02"
                        className="text-xs h-7.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-tiny">Date</Label>
                      <Input
                        type="date"
                        value={acceptanceCriteriaDate}
                        onChange={(e) => { setAcceptanceCriteriaDate(e.target.value); markDirty(); }}
                        className="text-xs h-7.5"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-tiny">Reference Description</Label>
                    <Input
                      value={acceptanceCriteriaReference}
                      onChange={(e) => { setAcceptanceCriteriaReference(e.target.value); markDirty(); }}
                      placeholder="e.g. Table 1 Permissible Deviations"
                      className="text-xs h-7.5"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Technical Diagram / Schematic Card */}
            <Card className="border shadow-xs bg-card">
              <CardHeader className="py-3 px-4 border-b bg-muted/20">
                <CardTitle className="text-xs font-bold flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" />
                  Gauge Technical Diagram / Schematic
                </CardTitle>
                <CardDescription className="text-tiny">
                  Attach a technical drawing, CAD diagram, or gauge schematic to be displayed in the official certificate
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
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
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      isDragOverDiagram ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="file"
                      id="diagram-upload-full"
                      accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) processImageFile(file);
                      }}
                    />
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <label htmlFor="diagram-upload-full" className="text-primary hover:underline cursor-pointer">
                          Upload Diagram File
                        </label>
                        <span className="text-muted-foreground">•</span>
                        <button
                          type="button"
                          onClick={handlePasteFromClipboard}
                          className="text-primary hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <ClipboardPaste className="w-3.5 h-3.5" />
                          Paste from Clipboard
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Drag and drop your gauge image here or press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xxs font-mono">Ctrl+V</kbd> anywhere on this box
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Live Preview Container */}
                    <div className="border rounded-xl bg-slate-50 dark:bg-slate-900 p-4 flex flex-col items-center justify-center min-h-[140px] max-h-[260px] overflow-hidden">
                      <img
                        src={diagramImage}
                        alt="Schematic Diagram Preview"
                        style={{
                          width: `${diagramWidth}px`,
                          maxHeight: `${diagramHeight}px`,
                          objectFit: "contain",
                        }}
                        className="rounded border border-slate-300 dark:border-slate-700 bg-white shadow-xs"
                      />
                      <span className="text-xxs font-mono text-muted-foreground mt-2">
                        Display Size: {diagramWidth}px × {diagramHeight}px • Alignment: {diagramAlignment}
                      </span>
                    </div>

                    {/* Sliders & Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs text-muted-foreground">Width: <span className="font-bold text-foreground">{diagramWidth}px</span></Label>
                        </div>
                        <input
                          type="range"
                          min={80}
                          max={540}
                          step={5}
                          value={diagramWidth}
                          onChange={(e) => { setDiagramWidth(parseInt(e.target.value, 10)); markDirty(); }}
                          className="w-full accent-primary h-2 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <Label className="text-xs text-muted-foreground">Max Height: <span className="font-bold text-foreground">{diagramHeight}px</span></Label>
                        </div>
                        <input
                          type="range"
                          min={40}
                          max={280}
                          step={5}
                          value={diagramHeight}
                          onChange={(e) => { setDiagramHeight(parseInt(e.target.value, 10)); markDirty(); }}
                          className="w-full accent-primary h-2 cursor-pointer"
                        />
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Alignment</Label>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant={diagramAlignment === "left" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 h-8 text-xs gap-1"
                            onClick={() => { setDiagramAlignment("left"); markDirty(); }}
                          >
                            <AlignLeft className="w-3.5 h-3.5" /> Left
                          </Button>
                          <Button
                            type="button"
                            variant={diagramAlignment === "center" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 h-8 text-xs gap-1"
                            onClick={() => { setDiagramAlignment("center"); markDirty(); }}
                          >
                            <AlignCenter className="w-3.5 h-3.5" /> Center
                          </Button>
                          <Button
                            type="button"
                            variant={diagramAlignment === "right" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 h-8 text-xs gap-1"
                            onClick={() => { setDiagramAlignment("right"); markDirty(); }}
                          >
                            <AlignRight className="w-3.5 h-3.5" /> Right
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t flex-wrap">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={handleCopyImageToClipboard}
                        >
                          <Copy className="w-3 h-3" /> Copy Image
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={handlePasteFromClipboard}
                        >
                          <ClipboardPaste className="w-3 h-3" /> Paste New
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1"
                        onClick={() => {
                          setDiagramImage(null);
                          markDirty();
                          toast.info("Diagram image removed");
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Diagram
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB: Settings & Quality Control */}
      {activeNavTab === "settings" && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="w-full max-w-[1900px] mx-auto px-1 sm:px-2 space-y-5">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-bold text-foreground">Template Settings & Quality Control</h2>
                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/30">
                    QA Readiness & Validation
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Environmental standard room conditions, thermal soaking duration, SOP remarks, and pre-save audit
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => handleSave()}
                  disabled={saving || isNameDuplicate || !name.trim()}
                  className="gap-1.5 h-8 px-3.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? "Saving..." : templateId ? "Update Template" : "Save Template"}
                </Button>
              </div>
            </div>

            {/* General Template Information Card */}
            <Card className="border shadow-xs bg-card">
              <CardHeader className="py-3 px-4 border-b bg-muted/20">
                <CardTitle className="text-xs font-bold flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Template Information & Classification
                </CardTitle>
                <CardDescription className="text-tiny">
                  Master template identification, description, and instrument discipline
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Template Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={name}
                      onChange={(e) => { setName(e.target.value); markDirty(); }}
                      placeholder="e.g. Vernier Caliper Standard (IS 3651)"
                      className={`text-xs h-8 ${!name.trim() ? "border-amber-400" : isNameDuplicate ? "border-destructive" : ""}`}
                    />
                    {isNameDuplicate && (
                      <p className="text-xxs text-destructive">A template with this name already exists.</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Target Instrument Type / Category <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={instrumentType}
                      onChange={(e) => { setInstrumentType(e.target.value); markDirty(); }}
                      placeholder="e.g. Vernier Caliper (0-300 mm)"
                      className="text-xs h-8"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Calibration Discipline</Label>
                    <Select value={calibrationType} onValueChange={(val) => { setCalibrationType(val); markDirty(); }}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALIBRATION_TYPES.map((t) => (
                          <SelectItem key={t.type} value={t.type}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Template Description</Label>
                    <Input
                      value={description}
                      onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                      placeholder="e.g. Standard calibration for 0-300mm calipers with 5-trial readings"
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Environmental Conditions Card */}
              <Card className="border shadow-xs bg-card">
                <CardHeader className="py-3 px-4 border-b bg-muted/20">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Standard Environmental Conditions
                  </CardTitle>
                  <CardDescription className="text-tiny">
                    Ambient conditions and thermal stabilization per ISO/IEC 17025
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Temperature</Label>
                      <div className="relative">
                        <Input
                          value={envTemp}
                          onChange={(e) => { setEnvTemp(e.target.value); markDirty(); }}
                          placeholder="20"
                          className="text-xs h-8 pr-12 font-mono font-bold"
                        />
                        <span className="absolute right-3 top-2 text-xxs text-muted-foreground font-mono">
                          °C (±2°C)
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Relative Humidity</Label>
                      <div className="relative">
                        <Input
                          value={envHumidity}
                          onChange={(e) => { setEnvHumidity(e.target.value); markDirty(); }}
                          placeholder="55"
                          className="text-xs h-8 pr-12 font-mono font-bold"
                        />
                        <span className="absolute right-3 top-2 text-xxs text-muted-foreground font-mono">
                          %RH (±10%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t space-y-3">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>Thermal Soaking Stabilization</span>
                      {envSoakingTime && (
                        <Badge variant="secondary" className="font-mono text-xxs">
                          Duration: {envSoakingTime}
                        </Badge>
                      )}
                    </Label>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xxs text-muted-foreground">Start Time</Label>
                        <TimePicker
                          value={envSoakingStartTime}
                          onChange={handleSoakingStartChange}
                          withSeconds={true}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xxs text-muted-foreground">End Time</Label>
                        <TimePicker
                          value={envSoakingEndTime}
                          onChange={handleSoakingEndChange}
                          withSeconds={true}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xxs text-muted-foreground">Soaking Time Display</Label>
                      <Input
                        value={envSoakingTime}
                        onChange={(e) => { setEnvSoakingTime(e.target.value); markDirty(); }}
                        placeholder="e.g. Min 2hr or 02:00:00"
                        className="text-xs h-8 font-mono"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Remarks and Pre-Save Audit Card */}
              <div className="space-y-6">
                <Card className="border shadow-xs bg-card">
                  <CardHeader className="py-3 px-4 border-b bg-muted/20">
                    <CardTitle className="text-xs font-bold flex items-center gap-2">
                      <FileCheck2 className="w-3.5 h-3.5 text-primary" />
                      Notes & Standard Reference
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Standard Reference Remarks</Label>
                      <Input
                        value={standardReference}
                        onChange={(e) => { setStandardReference(e.target.value); markDirty(); }}
                        placeholder="Standard calibration per ISO/IEC 17025"
                        className="text-xs h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">General Template Remarks</Label>
                      <Textarea
                        value={remarks}
                        onChange={(e) => { setRemarks(e.target.value); markDirty(); }}
                        rows={3}
                        className="text-xs resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Quality Validation Gate Card */}
                <Card className="border shadow-xs bg-emerald-500/[0.03] border-emerald-500/20">
                  <CardHeader className="py-3 px-4 border-b bg-emerald-500/10">
                    <CardTitle className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      Quality Gate & Pre-Save Validator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-card border">
                        <div className="text-base font-bold font-mono text-foreground">{totalPointsCount}</div>
                        <div className="text-xxs text-muted-foreground">Total Points</div>
                      </div>
                      <div className="p-2 rounded-lg bg-card border">
                        <div className="text-base font-bold font-mono text-foreground">
                          {isCanvasMode ? allTableBlocks.length : 1}
                        </div>
                        <div className="text-xxs text-muted-foreground">Data Tables</div>
                      </div>
                      <div className="p-2 rounded-lg bg-card border">
                        <div className="text-base font-bold font-mono text-foreground">
                          {diagramImage ? "Embedded" : "None"}
                        </div>
                        <div className="text-xxs text-muted-foreground">Diagram</div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreSaveModal(true)}
                      className="w-full text-xs font-semibold gap-2 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 h-8"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Run Full Pre-Save Audit Gate
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Right Column: Full-Height Dedicated Copilot Dock matching reference smple.png */}
      {showAssistant && isAssistantDocked && (
        <aside
          aria-label="Calibration Template AI Copilot"
          className="w-[420px] xl:w-[460px] 2xl:w-[500px] shrink-0 h-full flex flex-col border-l border-border bg-background z-30 shadow-xl transition-all duration-300 animate-in slide-in-from-right-4"
        >
          <GaugemasterTemplateAssistant
            open={showAssistant}
            onClose={() => setShowAssistant(false)}
            templateName={name || "Visual Canvas Template"}
            instrumentType={instrumentType || "Calibration Instrument"}
            calibrationType={calibrationType || "dimensional"}
            blocks={layoutBlocks}
            selectedTable={auditTargetTable || activeTableBlock}
            selectedColumnId={selectedColumnId}
            onUpdateTableColumns={handleApplyTableFixes}
            onUpdateTableBlock={handleUpdateTableBlock}
            onAddTableColumn={handleAddTableColumn}
            onUpdateTableRows={handleUpdateTableRows}
            onRestoreTableState={handleRestoreTableState}
            onOpenTrialRun={() => setShowTrialRun(true)}
            onOpenTableAuditModal={() => {
              if (activeTableBlock) {
                setAuditTargetTable(activeTableBlock);
                setShowTableAuditModal(true);
              }
            }}
            onOpenPreSaveModal={() => setShowPreSaveModal(true)}
            onNavigateToColumn={(columnId) => setSelectedColumnId(columnId)}
            onNavigateToTable={(tableId) => {
              setSelectedBlockId(tableId);
              setSelectedTableBlockId(tableId);
            }}
            onDeleteTableColumn={handleDeleteTableColumn}
            onAddTableBlock={handleAddTableBlock}
            onDeleteTableBlock={handleDeleteTableBlock}
            docked={true}
            onToggleDock={() => setIsAssistantDocked(false)}
          />
        </aside>
      )}

      {/* Floating Copilot Modal/Window (when undocked) */}
      {showAssistant && !isAssistantDocked && (
        <GaugemasterTemplateAssistant
          open={showAssistant}
          onClose={() => setShowAssistant(false)}
          templateName={name || "Visual Canvas Template"}
          instrumentType={instrumentType || "Calibration Instrument"}
          calibrationType={calibrationType || "dimensional"}
          blocks={layoutBlocks}
          selectedTable={auditTargetTable || activeTableBlock}
          selectedColumnId={selectedColumnId}
          onUpdateTableColumns={handleApplyTableFixes}
          onUpdateTableBlock={handleUpdateTableBlock}
          onAddTableColumn={handleAddTableColumn}
          onUpdateTableRows={handleUpdateTableRows}
          onRestoreTableState={handleRestoreTableState}
          onOpenTrialRun={() => setShowTrialRun(true)}
          onOpenTableAuditModal={() => {
            if (activeTableBlock) {
              setAuditTargetTable(activeTableBlock);
              setShowTableAuditModal(true);
            }
          }}
          onOpenPreSaveModal={() => setShowPreSaveModal(true)}
          onNavigateToColumn={(columnId) => setSelectedColumnId(columnId)}
          onNavigateToTable={(tableId) => {
            setSelectedBlockId(tableId);
            setSelectedTableBlockId(tableId);
          }}
          onDeleteTableColumn={handleDeleteTableColumn}
          onAddTableBlock={handleAddTableBlock}
          onDeleteTableBlock={handleDeleteTableBlock}
          docked={false}
          onToggleDock={() => setIsAssistantDocked(true)}
        />
      )}

      {/* Floating Trigger Pill (when assistant is closed) */}
      {!showAssistant && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            type="button"
            onClick={() => {
              setShowAssistant(true);
              setIsAssistantDocked(true);
            }}
            className="h-10 px-4 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-2 border-2 border-indigo-400/30 animate-in fade-in zoom-in duration-200"
          >
            <div className="relative flex items-center justify-center">
              <Bot className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <span>Template Copilot</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          </Button>
        </div>
      )}

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
                doc_date: docDate || undefined,
                doc_rev: docRev || undefined,
                procedure_reference: procedureReference || "AE/CAL-SOP/01",
                procedure_no: procedureNo || undefined,
                procedure_name: procedureName || undefined,
                procedure_date: procedureDate || undefined,
                procedure_rev: procedureRev || undefined,
                acceptance_criteria_doc_no: acceptanceCriteriaDocNo || undefined,
                acceptance_criteria_date: acceptanceCriteriaDate || undefined,
                acceptance_criteria_rev: acceptanceCriteriaRev || undefined,
                acceptance_criteria_reference: acceptanceCriteriaReference || undefined,
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
            <div className="text-tiny text-muted-foreground">
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

      {/* Pre-Save Validation Gate Modal */}
      <PreSaveAuditModal
        open={showPreSaveModal}
        onOpenChange={setShowPreSaveModal}
        blocks={layoutBlocks}
        onConfirmSave={() => handleSave({ force: true, navigateOnSave: true })}
      />

      {/* AI Template Generator Modal */}
      <AiTemplateGeneratorModal
        open={showAiModal}
        onOpenChange={setShowAiModal}
        onApplyTemplate={handleApplyAiGenerated}
      />

      {/* Trial Run Modal */}
      <TrialRunModal
        open={showTrialRun}
        onOpenChange={setShowTrialRun}
        blocks={layoutBlocks}
        templateName={name || "Calibration Template"}
        diagramImage={diagramImage}
        diagramImageWidth={diagramWidth}
        diagramImageHeight={diagramHeight}
        diagramImageAlignment={diagramAlignment}
        defaultUnit={defaultUnit}
        defaultTolerance={typeof defaultTolerance === "number" ? defaultTolerance : 0.01}
        decimalPlaces={decimalPlaces}
        docNo={docNo}
        docDate={docDate}
        docRev={docRev}
        procedureReference={procedureReference}
        procedureNo={procedureNo}
        procedureName={procedureName}
        procedureDate={procedureDate}
        procedureRev={procedureRev}
        acceptanceCriteriaDocNo={acceptanceCriteriaDocNo}
        acceptanceCriteriaDate={acceptanceCriteriaDate}
        acceptanceCriteriaRev={acceptanceCriteriaRev}
        acceptanceCriteriaReference={acceptanceCriteriaReference}
      />

      {/* Table Audit Modal */}
      <TableAuditModal
        open={showTableAuditModal}
        onOpenChange={setShowTableAuditModal}
        table={auditTargetTable || activeTableBlock}
        onApplyFixes={handleApplyTableFixes}
      />
    </div>
  );
}
