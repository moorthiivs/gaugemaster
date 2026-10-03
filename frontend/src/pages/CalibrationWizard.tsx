import { useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, XCircle, Search, Loader2, Plus, PlusCircle, Trash2, CalendarIcon, ChevronsUpDown, X, Layers, FileCheck, ChevronDown, AlertTriangle, AlertCircle, Sparkles, Table, Save, Copy, Upload, ImageIcon, AlignLeft, AlignCenter, AlignRight, Eye, ClipboardPaste, Merge, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import httpClient from "@/lib/httpClient";
import { Instrument } from "@/types/instrument";
import { CalibrationPoint, CALIBRATION_TYPES, CalibrationTypeConfig } from "@/types/calibration";
import { createCalibration, getNextNumbers, generateCertificate, getDraft, saveDraft, deleteDraft, getCalibration, updateCalibration } from "@/lib/calibrationActions";
import { getTemplates, getTemplate } from "@/lib/templateActions";
import { Skeleton } from "@/components/ui/skeleton";
import { CalibrationTemplate } from "@/types/template";
import { getCoveredCells } from "@/lib/tableSpanUtils";
import { getEffectiveTableOrientation } from "@/lib/tableLayoutOptimizer";
import { evaluateCanvasRowFormulas } from "@/lib/formulaEngine";
import { parseSpecification } from "@/lib/specificationParser";
import { CANVAS_PRESETS, CanvasTemplatePreset } from "@/data/canvasPresets";
import { getInstrument } from "@/lib/instrumentActions";
import { InstrumentTypeSelector } from "@/components/calibration/InstrumentTypeSelector";
import { CalibrationDataGrid, CustomColumn } from "@/components/calibration/CalibrationDataGrid";
import { CertificatePreview } from "@/components/calibration/CertificatePreview";
import { UlrGate } from "@/components/calibration/UlrGate";
import { VerdictBadge } from "@/components/calibration/VerdictBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarPicker } from "@/components/ui/calendar";
import { YearMonthDatePicker } from "@/components/ui/year-month-date-picker";
import { TimePicker, DurationPicker } from "@/components/ui/time-picker";
import { format, addMonths, parseISO } from "date-fns";
import { cn, getRoleName } from "@/lib/utils";
import { computeNextDueDate, parseFrequencyMonths } from "@/lib/dateUtils";

const STEPS = [
  "Select Instrument",
  "Reference Standard",
  "Calibration Data",
  "Results & Verdict",
  "Certificate",
];

const toLocalYyyyMmDd = (d?: string | Date | null): string => {
  if (!d) return "";
  try {
    const dateObj = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return "";
    return format(dateObj, "yyyy-MM-dd");
  } catch {
    return "";
  }
};

const formatDisplayDate = (d?: string | Date | null, pattern: string = "dd-MMM-yyyy"): string => {
  if (!d) return "-";
  try {
    const dateObj = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dateObj.getTime())) return "-";
    return format(dateObj, pattern);
  } catch {
    return "-";
  }
};

export default function CalibrationWizard() {
  useSEO({ title: "New Calibration — GaugeMaster", description: "Perform instrument calibration" });
  const navigate = useNavigate();
  const { instrumentId } = useParams();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [certLoading, setCertLoading] = useState(false);

  // Step 1 — Instrument
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Instrument[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [selectedType, setSelectedType] = useState<CalibrationTypeConfig | null>(null);
  const [searching, setSearching] = useState(false);

  // Step 2 — Reference Standard
  const [referenceStandards, setReferenceStandards] = useState<any[]>([
    { name: "", id: "", traceable_to: "", validity: "", range: "", least_count: "" }
  ]);
  const [masterStandards, setMasterStandards] = useState<Instrument[]>([]);

  // Step 3 — Environmental + Data
  const [envTemp, setEnvTemp] = useState("");
  const [envHumidity, setEnvHumidity] = useState("");
  const [envSoakingTime, setEnvSoakingTime] = useState("");
  const [envSoakingStartTime, setEnvSoakingStartTime] = useState("");
  const [envSoakingEndTime, setEnvSoakingEndTime] = useState("");
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState("");
  const [docRev, setDocRev] = useState("");

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
    if (val && envSoakingEndTime) {
      const dur = calculateSoakingDuration(val, envSoakingEndTime);
      if (dur) setEnvSoakingTime(dur);
    }
  };

  const handleSoakingEndChange = (val: string) => {
    setEnvSoakingEndTime(val);
    if (envSoakingStartTime && val) {
      const dur = calculateSoakingDuration(envSoakingStartTime, val);
      if (dur) setEnvSoakingTime(dur);
    }
  };
  const [procedureReference, setProcedureReference] = useState("");
  const [procedureNo, setProcedureNo] = useState("");
  const [procedureName, setProcedureName] = useState("");
  const [procedureDate, setProcedureDate] = useState("");
  const [procedureRev, setProcedureRev] = useState("");
  const [acceptanceCriteriaDocNo, setAcceptanceCriteriaDocNo] = useState("");
  const [acceptanceCriteriaDate, setAcceptanceCriteriaDate] = useState("");
  const [acceptanceCriteriaRev, setAcceptanceCriteriaRev] = useState("");
  const [acceptanceCriteriaReference, setAcceptanceCriteriaReference] = useState("");
  const [standardReference, setStandardReference] = useState("Standard calibration per ISO/IEC 17025");
  const [receiptCondition, setReceiptCondition] = useState<string>("NO DENT & DAMAGE (OK)");
  const [customReceiptCondition, setCustomReceiptCondition] = useState<string>("");
  const effectiveReceiptCondition = receiptCondition === "CUSTOM" ? customReceiptCondition.trim() : receiptCondition;

  // Helper: check if a text string is a receipt condition / visual damage note rather than a calibration measurement specification
  const isReceiptRow = (text: string, row?: any) => {
    if (row && (row.is_merged || row.isMerged)) return false;
    const t = (text || "").trim().toLowerCase();
    if (!t) return false;
    // Only match legacy exact receipt condition values or explicit receipt condition headers
    if (
      t === "no dent & damage (ok)" ||
      t === "no dent & damage" ||
      t === "no dent and damage" ||
      t === "dent & damage observed" ||
      t === "satisfactory"
    ) {
      return true;
    }
    if (
      t.startsWith("receipt condition") ||
      t.startsWith("receipt inspection") ||
      t.startsWith("instrument receipt condition") ||
      t.includes("receipt condition:") ||
      t.includes("receipt condition :")
    ) {
      return true;
    }
    return false;
  };

  // Helper: flatten all table_grid blocks, including nested child tables within split_row blocks
  const getAllCanvasTables = (blocks: any[]): any[] => {
    const tables: any[] = [];
    if (!Array.isArray(blocks)) return tables;
    blocks.forEach((b: any) => {
      if (!b) return;
      if (b.type === "table_grid") {
        tables.push(b);
      } else if (b.type === "split_row" && Array.isArray(b.children)) {
        b.children.forEach((c: any) => {
          if (c && c.type === "table_grid") {
            tables.push(c);
          }
        });
      }
    });
    return tables;
  };

  // Helper: bind specifications to canvas tables respecting multi-table boundaries
  const bindSpecificationsToCanvasTables = (
    tables: any[],
    specs: any[],
    defaultTolerance: number,
    defaultDecimalPlaces: number,
    defaultUnit: string = "mm"
  ) => {
    if (!tables || tables.length === 0 || !specs || specs.length === 0) return;
    const validTables = tables.filter((b: any) => !((b.title || "").toLowerCase().includes("receipt condition")));
    if (validTables.length === 0) return;

        const mergeSpecIntoRow = (existingRow: any, s: any, columns: any[], tol: number, dec: number, tableUnit: string, tableNominal?: number | string) => {
      if (!s) return evaluateCanvasRowFormulas(existingRow, columns, tol, dec, tableNominal);

      const specText = s.specification || s.required_dimension || s.description || existingRow.specification || existingRow.required_dimension || existingRow.description || "";
      const parsed = specText ? parseSpecification(specText, s.unit || tableUnit || defaultUnit, tol, dec) : null;

      const mergedRow: any = {
        ...existingRow,
        ...s,
        cellSpans: existingRow.cellSpans || s.cellSpans,
        point_number: existingRow.point_number ?? s.point_number,
        required_dimension: specText,
        description: specText,
        specification: specText,
        nominal: (s.nominal !== undefined && s.nominal !== 0 && s.nominal !== "0" && s.nominal !== "")
          ? s.nominal
          : (existingRow.nominal !== undefined ? existingRow.nominal : (parsed?.isValid ? parsed.nominal : 0)),
        lower_tolerance: s.lower_tolerance !== undefined ? s.lower_tolerance : (existingRow.lower_tolerance ?? parsed?.lowerTolerance),
        upper_tolerance: s.upper_tolerance !== undefined ? s.upper_tolerance : (existingRow.upper_tolerance ?? parsed?.upperTolerance),
        lower_limit: s.lower_limit !== undefined ? s.lower_limit : (existingRow.lower_limit ?? parsed?.lowerLimit),
        upper_limit: s.upper_limit !== undefined ? s.upper_limit : (existingRow.upper_limit ?? parsed?.upperLimit),
        tolerance: s.tolerance !== undefined ? s.tolerance : (existingRow.tolerance ?? tol),
        unit: s.unit || existingRow.unit || tableUnit || defaultUnit,
        actual: (s.actual !== undefined && s.actual !== "") ? s.actual : (existingRow.actual ?? ""),
      };

      // Ensure all custom column values from existingRow are preserved if not provided in s
      if (Array.isArray(columns)) {
        columns.forEach((col: any) => {
          if (existingRow[col.id] !== undefined && (mergedRow[col.id] === undefined || mergedRow[col.id] === "")) {
            mergedRow[col.id] = existingRow[col.id];
          }
        });
      }

            return evaluateCanvasRowFormulas(mergedRow, columns, tol, dec, tableNominal);
    };

        const createNewRowFromSpec = (s: any, idx: number, columns: any[], tol: number, dec: number, tableUnit: string, tableNominal?: number | string) => {
      const specText = s.specification || s.required_dimension || s.description || "";
      const parsed = specText ? parseSpecification(specText, s.unit || tableUnit || defaultUnit, tol, dec) : null;
      const rowObj: any = {
        ...s,
        point_number: s.point_number || idx + 1,
        required_dimension: specText,
        description: specText,
        specification: specText,
        cellSpans: s.cellSpans,
        nominal: s.nominal !== undefined ? s.nominal : (parsed?.isValid ? parsed.nominal : 0),
        lower_tolerance: s.lower_tolerance !== undefined ? s.lower_tolerance : parsed?.lowerTolerance,
        upper_tolerance: s.upper_tolerance !== undefined ? s.upper_tolerance : parsed?.upperTolerance,
        lower_limit: s.lower_limit !== undefined ? s.lower_limit : parsed?.lowerLimit,
        upper_limit: s.upper_limit !== undefined ? s.upper_limit : parsed?.upperLimit,
        tolerance: s.tolerance !== undefined ? s.tolerance : tol,
        unit: s.unit || tableUnit || defaultUnit,
        actual: s.actual ?? "",
      };
            return evaluateCanvasRowFormulas(rowObj, columns, tol, dec, tableNominal);
    };

    if (validTables.length === 1) {
      // Single table template: bind specs directly to primary table preserving template authoring & cellSpans
      const primaryTable = validTables[0];
      const dec = primaryTable.decimal_places ?? defaultDecimalPlaces ?? 3;
      const tol = primaryTable.tolerance ?? defaultTolerance ?? 0.02;
      const existingRows = Array.isArray(primaryTable.rows) ? primaryTable.rows : [];

      if (existingRows.length > 0) {
        primaryTable.rows = existingRows.map((existingRow: any, idx: number) => {
          const s = specs.find((sp: any) => sp.point_number === existingRow.point_number || sp.point_number === (idx + 1)) || specs[idx];
                    return mergeSpecIntoRow(existingRow, s, primaryTable.columns, tol, dec, primaryTable.unit, primaryTable.nominal);
        });
      } else {
        primaryTable.rows = specs.map((s: any, idx: number) =>
          createNewRowFromSpec(s, idx, primaryTable.columns, tol, dec, primaryTable.unit, primaryTable.nominal)
        );
      }
    } else {
      // Multi-table template: check if specifications carry table identifiers
      const specsHaveTableMarkers = specs.some((s: any) =>
        s.table_index !== undefined || s.table_id !== undefined || (s.table_title && String(s.table_title).trim().length > 0)
      );

      if (specsHaveTableMarkers) {
        validTables.forEach((tbl: any, tblIdx: number) => {
          const matchingSpecs = specs.filter((s: any) => {
            if (s.table_index !== undefined) return Number(s.table_index) === tblIdx;
            if (s.table_id && tbl.id) return s.table_id === tbl.id;
            if (s.table_title && tbl.title) return String(s.table_title).trim().toLowerCase() === String(tbl.title).trim().toLowerCase();
            return false;
          });

          if (matchingSpecs.length > 0) {
            const dec = tbl.decimal_places ?? defaultDecimalPlaces ?? 3;
            const tol = tbl.tolerance ?? defaultTolerance ?? 0.02;
            const existingRows = Array.isArray(tbl.rows) ? tbl.rows : [];

            if (existingRows.length > 0) {
              tbl.rows = existingRows.map((existingRow: any, idx: number) => {
                const s = matchingSpecs.find((sp: any) => sp.point_number === existingRow.point_number || sp.point_number === (idx + 1)) || matchingSpecs[idx];
                                return mergeSpecIntoRow(existingRow, s, tbl.columns, tol, dec, tbl.unit, tbl.nominal);
              });
            } else {
              tbl.rows = matchingSpecs.map((s: any, idx: number) =>
                createNewRowFromSpec(s, idx, tbl.columns, tol, dec, tbl.unit, tbl.nominal)
              );
            }
          }
        });
      } else {
        // Legacy flat specs without table markers:
        const templateHasRows = validTables.some((t: any) => Array.isArray(t.rows) && t.rows.length > 0);
        if (!templateHasRows) {
          const primaryTable = validTables[0];
          const dec = primaryTable.decimal_places ?? defaultDecimalPlaces ?? 3;
          const tol = primaryTable.tolerance ?? defaultTolerance ?? 0.02;
          primaryTable.rows = specs.map((s: any, idx: number) =>
            createNewRowFromSpec(s, idx, primaryTable.columns, tol, dec, primaryTable.unit)
          );
        }
      }
    }
  };

  const [calPoints, setCalPoints] = useState<CalibrationPoint[]>([]);
  const [calUnit, setCalUnit] = useState("");
  const [calTolerance, setCalTolerance] = useState(0);
  const [statusRuleType, setStatusRuleType] = useState<"default" | "custom_formula">("default");
  const [statusFormula, setStatusFormula] = useState<string>("");

  // Step 4 — Results
  const [uncertainty, setUncertainty] = useState("");
  const [verdict, setVerdict] = useState<"PASS" | "FAIL" | "CONDITIONAL">("PASS");
  const [isVerdictManuallyOverridden, setIsVerdictManuallyOverridden] = useState<boolean>(false);
  const [autoVerdict, setAutoVerdict] = useState<"PASS" | "FAIL" | "CONDITIONAL">("PASS");
  const [verdictStats, setVerdictStats] = useState<{ total: number; pass: number; fail: number; conditional: number }>({ total: 0, pass: 0, fail: 0, conditional: 0 });
  const [remarks, setRemarks] = useState("");
  const [calibratedBy, setCalibratedBy] = useState("");
  const [calibratedByDesignation, setCalibratedByDesignation] = useState("");
  const [calibratedBySignature, setCalibratedBySignature] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [reviewedByDesignation, setReviewedByDesignation] = useState("");
  const [reviewedBySignature, setReviewedBySignature] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [approvedByDesignation, setApprovedByDesignation] = useState("");
  const [approvedBySignature, setApprovedBySignature] = useState("");
  const [calDate, setCalDate] = useState(toLocalYyyyMmDd(new Date()));
  const [certIssueDate, setCertIssueDate] = useState(toLocalYyyyMmDd(new Date()));
  const [nextCalDate, setNextCalDate] = useState("");
  const [systemUsers, setSystemUsers] = useState<any[]>([]);

  // Template Variant & Instrument Master Custom Parameters State
  const [savingInstrumentCustom, setSavingInstrumentCustom] = useState(false);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [showCertPreviewModal, setShowCertPreviewModal] = useState(false);
  const [isDragOverDiagram, setIsDragOverDiagram] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [savingTemplateVariant, setSavingTemplateVariant] = useState(false);

  // Normalizes pasted or uploaded images using an offscreen canvas:
  // 1. Decodes any interlaced PNG formats (Adam7) into standard scanlines
  // 2. Fills transparent alpha with solid white background to guarantee pristine PDF rendering
  // 3. Produces standard non-interlaced 32-bit RGBA PNG DataURL
  const cleanImageToDataUrl = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(dataUrl);

          // Fill solid white background so transparent PNGs print crisp without black artifacts
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Copy diagram image base64 to system clipboard
  const handleCopyImageToClipboard = async () => {
    if (!wizardDiagramImage) return;
    try {
      const res = await fetch(wizardDiagramImage);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      toast.success("Diagram image copied to clipboard");
    } catch (err) {
      console.error("Failed to copy image to clipboard", err);
      toast.error("Could not copy image to clipboard");
    }
  };

  // Paste image from system clipboard via Navigator Clipboard API
  const handlePasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64 = e.target?.result as string;
            if (base64) {
              const clean = await cleanImageToDataUrl(base64);
              setWizardDiagramImage(clean);
              toast.success("Gauge Diagram pasted from clipboard");
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      toast.info("No image found in clipboard. Press Ctrl+V anywhere to paste.");
    } catch (err) {
      toast.info("Press Ctrl+V anywhere on the page to paste image");
    }
  };

  // Process uploaded or dropped image file
  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, JPG, WEBP, SVG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      if (base64) {
        const clean = await cleanImageToDataUrl(base64);
        setWizardDiagramImage(clean);
        toast.success("Diagram image attached");
      }
    };
    reader.readAsDataURL(file);
  };

  // Merge Instrument Custom Parameters (gauge drawing, specific specifications, doc properties, env defaults)
  const applyInstrumentCustomParameters = (instr: Instrument) => {
    if (!instr || !instr.custom_parameters) return;
    const cp = instr.custom_parameters;

    // 1. Diagram Image
    if (cp.diagram_image !== undefined) {
      setWizardDiagramImage(cp.diagram_image || null);
      if (cp.diagram_image_width) setWizardDiagramWidth(cp.diagram_image_width);
      if (cp.diagram_image_height) setWizardDiagramHeight(cp.diagram_image_height);
      if (cp.diagram_image_alignment) setWizardDiagramAlignment(cp.diagram_image_alignment);
    }

    // 2. Doc Properties
    if (cp.doc_properties) {
      if (cp.doc_properties.doc_no) setDocNo(cp.doc_properties.doc_no);
      if (cp.doc_properties.doc_date) setDocDate(cp.doc_properties.doc_date);
      if (cp.doc_properties.doc_rev) setDocRev(cp.doc_properties.doc_rev);
      const loadedProcNo = cp.doc_properties.procedure_no || cp.doc_properties.procedure_reference || "";
      if (loadedProcNo) {
        setProcedureNo(loadedProcNo);
        setProcedureReference(loadedProcNo);
      }
      if (cp.doc_properties.procedure_name) setProcedureName(cp.doc_properties.procedure_name);
      if (cp.doc_properties.procedure_date) setProcedureDate(cp.doc_properties.procedure_date);
      if (cp.doc_properties.procedure_rev) setProcedureRev(cp.doc_properties.procedure_rev);
      if (cp.doc_properties.acceptance_criteria_doc_no) setAcceptanceCriteriaDocNo(cp.doc_properties.acceptance_criteria_doc_no);
      if (cp.doc_properties.acceptance_criteria_date) setAcceptanceCriteriaDate(cp.doc_properties.acceptance_criteria_date);
      if (cp.doc_properties.acceptance_criteria_rev) setAcceptanceCriteriaRev(cp.doc_properties.acceptance_criteria_rev);
      if (cp.doc_properties.acceptance_criteria_reference) setAcceptanceCriteriaReference(cp.doc_properties.acceptance_criteria_reference);
    }

    // 3. Environmental Defaults & Receipt Condition
    if (cp.environmental_defaults) {
      if (cp.environmental_defaults.temperature) setEnvTemp(cp.environmental_defaults.temperature);
      if (cp.environmental_defaults.humidity) setEnvHumidity(cp.environmental_defaults.humidity);
      if (cp.environmental_defaults.soaking_time) setEnvSoakingTime(cp.environmental_defaults.soaking_time);
      if (cp.environmental_defaults.soaking_start_time) setEnvSoakingStartTime(cp.environmental_defaults.soaking_start_time);
      if (cp.environmental_defaults.soaking_end_time) setEnvSoakingEndTime(cp.environmental_defaults.soaking_end_time);
    }
    const savedReceipt = cp.receipt_condition || cp.environmental_defaults?.receipt_condition;
    if (savedReceipt) {
      if (["NO DENT & DAMAGE (OK)", "SATISFACTORY", "DENT & DAMAGE OBSERVED"].includes(savedReceipt)) {
        setReceiptCondition(savedReceipt);
      } else {
        setReceiptCondition("CUSTOM");
        setCustomReceiptCondition(savedReceipt);
      }
    }

    // 4. Specifications auto-merge into calPoints and wizardLayoutBlocks (strictly exclude receipt condition notes)
    if (cp.specifications && Array.isArray(cp.specifications)) {
      const validSpecs = cp.specifications.filter((s: any) => (s.is_merged || s.isMerged) ? true : !isReceiptRow(s.required_dimension || s.description || s.parameter_name || "", s));
      if (validSpecs.length > 0) {
        const mergedPoints: CalibrationPoint[] = validSpecs.map((spec: any, idx: number) => ({
          point_number: spec.point_number || idx + 1,
          description: spec.description || spec.required_dimension || `Point ${idx + 1}`,
          nominal: spec.nominal !== undefined ? Number(spec.nominal) : 0,
          ascending_reading: spec.ascending_reading !== undefined ? Number(spec.ascending_reading) : (spec.nominal !== undefined ? Number(spec.nominal) : 0),
          descending_reading: spec.descending_reading !== undefined ? Number(spec.descending_reading) : undefined,
          error: spec.error !== undefined ? Number(spec.error) : 0,
          unit: spec.unit || calUnit || "mm",
          tolerance: spec.tolerance !== undefined ? Number(spec.tolerance) : calTolerance,
          status: spec.status || "PASS",
          customFields: spec.customFields || {},
        }));
        setCalPoints(mergedPoints);

        // Also merge into active canvas blocks if in canvas mode
        setWizardLayoutBlocks((prevBlocks: any[]) => {
          if (!prevBlocks || prevBlocks.length === 0) return prevBlocks;
          const newBlocks = JSON.parse(JSON.stringify(prevBlocks));
          const allTables = getAllCanvasTables(newBlocks);
          bindSpecificationsToCanvasTables(
            allTables,
            validSpecs,
            calTolerance || 0.02,
            wizardDecimalPlaces ?? 3,
            calUnit || "mm"
          );
          return newBlocks;
        });
      }
    }
  };

  // Clipboard Paste Listener for Diagram Image (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (step !== 2 && step !== 3) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = async (event) => {
              const base64 = event.target?.result as string;
              if (base64) {
                const clean = await cleanImageToDataUrl(base64);
                setWizardDiagramImage(clean);
                toast.success("Gauge Diagram pasted from clipboard (Ctrl+V)");
              }
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [step]);

  // Diagram Image File Upload
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, JPG, WEBP)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      if (base64) {
        const clean = await cleanImageToDataUrl(base64);
        setWizardDiagramImage(clean);
        toast.success("Diagram image uploaded");
      }
    };
    reader.readAsDataURL(file);
  };

  // Extract all current specifications, diagram image, and document properties for Item-level Instrument Master persistence
  const getCustomParametersPayload = () => {
    if (!selectedInstrument) return null;
    let gaugeSpecs: any[] = [];
    if (wizardIsCanvas && wizardLayoutBlocks.length > 0) {
      const allTables = getAllCanvasTables(wizardLayoutBlocks);
      const validTables = allTables.filter((b: any) => !((b.title || "").toLowerCase().includes("receipt condition")));
      validTables.forEach((tbl: any, tblIdx: number) => {
        if (Array.isArray(tbl.rows)) {
          tbl.rows
            .filter((r: any) => (r.is_merged || r.isMerged) ? true : !isReceiptRow(r.required_dimension || r.description || "", r))
            .forEach((r: any) => {
              gaugeSpecs.push({
                ...r,
                table_index: tblIdx,
                table_id: tbl.id || `table_${tblIdx}`,
                table_title: tbl.title || "",
                point_number: r.point_number ?? (gaugeSpecs.length + 1),
                required_dimension: r.required_dimension || r.specification || r.description || "",
                description: r.description || r.specification || r.required_dimension || "",
                specification: r.specification || r.required_dimension || r.description || "",
                cellSpans: r.cellSpans,
                nominal: r.nominal,
                tolerance: r.tolerance ?? tbl.tolerance,
                lower_tolerance: r.lower_tolerance,
                upper_tolerance: r.upper_tolerance,
                lower_limit: r.lower_limit,
                upper_limit: r.upper_limit,
                unit: r.unit || tbl.unit || calUnit || "mm",
                actual: r.actual,
              });
            });
        }
      });
    } else {
      gaugeSpecs = calPoints
        .filter(p => ((p as any).is_merged || (p as any).isMerged) ? true : !isReceiptRow(p.description || "", p))
        .map(p => ({
          point_number: p.point_number,
          description: p.description,
          nominal: p.nominal,
          unit: p.unit,
          tolerance: p.tolerance,
          customFields: p.customFields,
        }));
    }

    return {
      ...(selectedInstrument.custom_parameters || {}),
      diagram_image: wizardDiagramImage ? wizardDiagramImage : null,
      diagram_image_width: wizardDiagramWidth,
      diagram_image_height: wizardDiagramHeight,
      diagram_image_alignment: wizardDiagramAlignment,
      doc_properties: {
        doc_no: docNo || undefined,
        doc_date: docDate || undefined,
        doc_rev: docRev || undefined,
        procedure_no: procedureNo || undefined,
        procedure_name: procedureName || undefined,
        procedure_date: procedureDate || undefined,
        procedure_rev: procedureRev || undefined,
        procedure_reference: procedureNo || procedureReference || undefined,
        acceptance_criteria_doc_no: acceptanceCriteriaDocNo || undefined,
        acceptance_criteria_date: acceptanceCriteriaDate || undefined,
        acceptance_criteria_rev: acceptanceCriteriaRev || undefined,
        acceptance_criteria_reference: acceptanceCriteriaReference || undefined,
      },
      environmental_defaults: {
        temperature: envTemp || undefined,
        humidity: envHumidity || undefined,
        soaking_time: envSoakingTime || undefined,
        soaking_start_time: envSoakingStartTime || undefined,
        soaking_end_time: envSoakingEndTime || undefined,
      },
      receipt_condition: effectiveReceiptCondition,
      specifications: gaugeSpecs.length > 0 ? gaugeSpecs : (selectedInstrument.custom_parameters?.specifications || []),
    };
  };

  // Save current diagram, specifications, doc info to Instrument Master
  const handleSaveToInstrumentMaster = async () => {
    if (!selectedInstrument) {
      toast.error("No instrument selected");
      return;
    }
    const updatedCustomParams = getCustomParametersPayload();
    if (!updatedCustomParams) return;
    setSavingInstrumentCustom(true);
    try {
      await httpClient.patch(`/instruments/${selectedInstrument.id}`, {
        custom_parameters: updatedCustomParams,
      });

      setSelectedInstrument({
        ...selectedInstrument,
        custom_parameters: updatedCustomParams,
      });

      toast.success(`Saved specifications & diagram to Instrument Master (${selectedInstrument.id_code})`);
    } catch (err: any) {
      console.error("Failed to save to Instrument Master", err);
      toast.error(err.response?.data?.message || "Failed to update Instrument Master");
    } finally {
      setSavingInstrumentCustom(false);
    }
  };

  // Save current configuration as a new standalone Calibration Template Variant
  const handleSaveAsNewTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a Template Variant Name");
      return;
    }
    setSavingTemplateVariant(true);
    try {
      const payload = {
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || undefined,
        category: selectedInstrument?.category || "General",
        instrument_type: selectedInstrument?.item_type || selectedInstrument?.name || selectedType?.type || "General",
        calibration_type: selectedType?.type || (selectedInstrument as any)?.calibration_type || "dimensional",
        default_unit: calUnit || "mm",
        default_tolerance: calTolerance || 0,
        is_active: true,
        doc_no: docNo || undefined,
        doc_date: docDate || undefined,
        doc_rev: docRev || undefined,
        procedure_no: procedureNo || undefined,
        procedure_name: procedureName || undefined,
        procedure_date: procedureDate || undefined,
        procedure_rev: procedureRev || undefined,
        procedure_reference: procedureNo || procedureReference || undefined,
        acceptance_criteria_doc_no: acceptanceCriteriaDocNo || undefined,
        acceptance_criteria_date: acceptanceCriteriaDate || undefined,
        acceptance_criteria_rev: acceptanceCriteriaRev || undefined,
        acceptance_criteria_reference: acceptanceCriteriaReference || undefined,
        standard_reference: standardReference || undefined,
        environmental_defaults: {
          temperature: envTemp || undefined,
          humidity: envHumidity || undefined,
          soaking_time: envSoakingTime || undefined,
          soaking_start_time: envSoakingStartTime || undefined,
          soaking_end_time: envSoakingEndTime || undefined,
        },
        is_canvas_template: wizardIsCanvas,
        layout_blocks: wizardIsCanvas ? wizardLayoutBlocks : undefined,
        custom_columns: wizardCustomColumns,
        standard_columns_config: wizardStandardColumnConfigs,
        column_order: wizardColumnOrder,
        hidden_columns: wizardHiddenColumns,
        decimal_places: wizardDecimalPlaces,
        acceptance_criteria: wizardAcceptanceCriteria,
        diagram_image: wizardDiagramImage || undefined,
        diagram_image_width: wizardDiagramWidth,
        diagram_image_height: wizardDiagramHeight,
        diagram_image_alignment: wizardDiagramAlignment,
        calibration_points: calPoints.map((p, idx) => ({
          point_number: p.point_number || idx + 1,
          description: p.description || `Point ${idx + 1}`,
          nominal: p.nominal,
          unit: p.unit || calUnit || "mm",
          tolerance: p.tolerance,
          customFields: p.customFields,
        })),
      };

      const res = await httpClient.post("/calibration-templates", payload);
      const createdTpl = res.data;
      setAvailableTemplates(prev => [createdTpl, ...prev]);
      setSelectedTemplateId(createdTpl.id);
      setSaveTemplateModalOpen(false);
      setNewTemplateName("");
      setNewTemplateDescription("");
      toast.success(`Saved new template variant "${createdTpl.name}"`);
      if (proceedAfterTemplateVariantRef.current) {
        proceedAfterTemplateVariantRef.current = false;
        executeSaveAndContinue();
      }
    } catch (err: any) {
      console.error("Failed to save template variant", err);
      toast.error(err.response?.data?.message || "Failed to create template variant");
    } finally {
      setSavingTemplateVariant(false);
    }
  };

  useEffect(() => {
    const fetchSystemUsers = async () => {
      try {
        const res = await httpClient.get(`/users?companyId=${user?.companyId || ""}`);
        const list = Array.isArray(res.data) ? res.data : [];
        if (user?.name && !list.some((u: any) => u.name === user.name || u.id === user.id)) {
          list.unshift({ id: user.id, name: user.name, designation: getRoleName(user.role) || "Calibration Engineer", signature: (user as any).signature || user.name });
        }
        setSystemUsers(list);
      } catch (err) {
        console.error("Failed to load users for signatories", err);
        if (user?.name) {
          setSystemUsers([{ id: user.id, name: user.name, designation: getRoleName(user.role) || "Calibration Engineer", signature: (user as any).signature || user.name }]);
        }
      }
    };
    fetchSystemUsers();
  }, [user]);

  // Draft & Edit state params
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get("draftId");
  const editIdParam = searchParams.get("editId");
  const typeParam = searchParams.get("type");

  // Sync certIssueDate to calDate by default (for new calibrations)
  useEffect(() => {
    if (calDate && !editIdParam && !draftIdParam) {
      setCertIssueDate(calDate);
    }
  }, [calDate, editIdParam, draftIdParam]);

  // Auto-calculate Next Calibration Due Date based on Instrument Frequency
  useEffect(() => {
    if (calDate && selectedInstrument) {
      const computed = computeNextDueDate(calDate, selectedInstrument.frequency);
      setNextCalDate(computed);
    }
  }, [calDate, selectedInstrument]);

  // Step 5 — ULR & Certificate
  const [ulrEnabled, setUlrEnabled] = useState(false);
  const [nextCertNumber, setNextCertNumber] = useState("—");
  const [nextUlrNumber, setNextUlrNumber] = useState("—");
  const [savedCalibrationId, setSavedCalibrationId] = useState<string | null>(null);
  const [certificateGenerated, setCertificateGenerated] = useState(false);

  const [isEditMode, setIsEditMode] = useState(!!editIdParam);
  const [availableTemplates, setAvailableTemplates] = useState<CalibrationTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);

  const draftIdRef = useRef<string | null>(draftIdParam || null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(draftIdParam || null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [editLoading, setEditLoading] = useState(!!editIdParam);

  const { canAccess } = usePermissions();

  // Enforce module RBAC permissions for edit vs create mode
  useEffect(() => {
    if (!user) return;
    if (isEditMode && !canAccess("calibrations", "edit")) {
      toast.error("You do not have permission to edit calibrations");
      navigate("/calibration", { replace: true });
    } else if (!isEditMode && !canAccess("calibrations", "create")) {
      toast.error("You do not have permission to create calibrations");
      navigate("/calibration", { replace: true });
    }
  }, [user, isEditMode, canAccess, navigate]);

  // Auto-select logged-in user as default Calibrated By
  useEffect(() => {
    if (user?.name && !isEditMode && !draftIdParam && !calibratedBy) {
      setCalibratedBy(user.name);
      setCalibratedByDesignation(getRoleName(user.role) || "Calibration Engineer");
      if ((user as any).signature) {
        setCalibratedBySignature((user as any).signature);
      }
    }
  }, [user, isEditMode, draftIdParam, calibratedBy]);

  // Auto-resolve signatures from systemUsers if missing
  useEffect(() => {
    if (systemUsers.length > 0) {
      if (calibratedBy && !calibratedBySignature) {
        const u = systemUsers.find((userItem) => userItem.name === calibratedBy || userItem.id === calibratedBy);
        if (u?.signature) setCalibratedBySignature(u.signature);
      }
      if (reviewedBy && !reviewedBySignature) {
        const u = systemUsers.find((userItem) => userItem.name === reviewedBy || userItem.id === reviewedBy);
        if (u?.signature) setReviewedBySignature(u.signature);
      }
      if (approvedBy && !approvedBySignature) {
        const u = systemUsers.find((userItem) => userItem.name === approvedBy || userItem.id === approvedBy);
        if (u?.signature) setApprovedBySignature(u.signature);
      }
    }
  }, [systemUsers, calibratedBy, reviewedBy, approvedBy, calibratedBySignature, reviewedBySignature, approvedBySignature]);

  // Pre-select calibration type if type URL parameter is present
  useEffect(() => {
    if (typeParam && !editIdParam && !draftIdParam) {
      const match = CALIBRATION_TYPES.find(
        (t) =>
          t.type.toLowerCase() === typeParam.toLowerCase() ||
          t.label.toLowerCase() === typeParam.toLowerCase()
      );
      if (match) {
        setSelectedType(match);
        if (match.defaultUnit) {
          setCalUnit(match.defaultUnit);
        }
      }
    }
  }, [typeParam, editIdParam, draftIdParam]);

  // Fetch templates for selected Calibration Type (with fallback to all company templates)
  useEffect(() => {
    if (!user) return;
    const typeStr = selectedType?.type || "";
    getTemplates({ userId: user.id, companyId: user.companyId, calibrationType: typeStr })
      .then(async (tpls) => {
        if (tpls && tpls.length > 0) {
          setAvailableTemplates(tpls);
        } else {
          // Fallback to fetch all company templates
          const allTpls = await getTemplates({ userId: user.id, companyId: user.companyId });
          setAvailableTemplates(allTpls || []);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch templates", err);
        getTemplates({ userId: user.id, companyId: user.companyId }).then((allTpls) => setAvailableTemplates(allTpls || [])).catch(() => {});
      });
  }, [user, selectedType]);

  const [wizardIsCanvas, setWizardIsCanvas] = useState<boolean>(false);
  const [wizardLayoutBlocks, setWizardLayoutBlocks] = useState<any[]>([]);
  const [wizardCustomColumns, setWizardCustomColumns] = useState<CustomColumn[]>([]);
  const [wizardStandardColumnConfigs, setWizardStandardColumnConfigs] = useState<Record<string, CustomColumn>>({});
  const [wizardColumnOrder, setWizardColumnOrder] = useState<string[]>([]);
  const [wizardHiddenColumns, setWizardHiddenColumns] = useState<string[]>([]);
  const [wizardDecimalPlaces, setWizardDecimalPlaces] = useState<number>(4);
  const [wizardAcceptanceCriteria, setWizardAcceptanceCriteria] = useState<{
    enabled?: boolean;
    value?: number;
    type?: "percentage" | "absolute";
  }>({});
  const [wizardDiagramImage, setWizardDiagramImage] = useState<string | null>(null);
  const [wizardDiagramWidth, setWizardDiagramWidth] = useState<number>(240);
  const [wizardDiagramHeight, setWizardDiagramHeight] = useState<number>(140);
  const [wizardDiagramAlignment, setWizardDiagramAlignment] = useState<"center" | "left" | "right">("center");
  const [step1Collapsed, setStep1Collapsed] = useState(true);
  const [step2Collapsed, setStep2Collapsed] = useState(true);
  const [step3Collapsed, setStep3Collapsed] = useState(true);
  const [metadataCollapsed, setMetadataCollapsed] = useState(true);
  const [diagramCollapsed, setDiagramCollapsed] = useState(true);

  // Template modification detection & dialog state
  const originalTemplateSnapshotRef = useRef<{
    templateId: string;
    templateName: string;
    diagramImage: string | null;
    blocks: any[];
    points: any[];
  } | null>(null);
  const [templateModifiedModalOpen, setTemplateModifiedModalOpen] = useState(false);
  const proceedAfterTemplateVariantRef = useRef<boolean>(false);

  // Helper to determine if a column is purely for readings or calculated results (NOT a template specification)
  const isReadingOrCalculatedColumn = (col: any): boolean => {
    if (!col) return false;
    const id = String(col.id || "").toLowerCase();
    const type = String(col.type || "").toLowerCase();
    const role = String(col.role || "").toUpperCase();

    if (type === "reading" || type === "trial" || type === "formula" || type === "calc" || type === "status" || type === "judgement") {
      return true;
    }
    if (role === "READING" || role === "CALCULATED" || role === "JUDGEMENT") {
      return true;
    }
    if (Boolean(col.formula && String(col.formula).trim())) {
      return true;
    }
    if (id === "remarks" || id === "remark" || id === "observation" || id === "observations" || id === "notes") {
      return true;
    }
    // Pattern matches trial/reading/result columns: trial_1, t1, reading, actual, error, deviation, avg, status, etc.
    if (/^(?:trial|t|reading|r|actual|observed|measuring_value|error|deviation|status|judgement|result|avg|average)(?:_\d+|\d+)?$/i.test(id)) {
      return true;
    }
    return false;
  };

  // Helper to normalize values for structural equality comparison
  const normalizeStructuralVal = (val: any): string | number => {
    if (val === undefined || val === null) return "";
    if (typeof val === "number") return val;
    const trimmed = String(val).trim();
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== "") return num;
    return trimmed;
  };

  // Helper to extract table_grid blocks from canvas layout
  const extractCanvasTables = (blocks: any[]): any[] => {
    const tables: any[] = [];
    if (!Array.isArray(blocks)) return tables;
    for (const b of blocks) {
      if (!b) continue;
      if (b.type === "table_grid") {
        tables.push(b);
      } else if (b.type === "split_row" && Array.isArray(b.children)) {
        for (const c of b.children) {
          if (c && c.type === "table_grid") {
            tables.push(c);
          }
        }
      }
    }
    return tables;
  };

  // Checks whether the user modified specifications, added/deleted rows, or altered diagram from the baseline
  const checkIsTemplateModified = (): boolean => {
    if (!originalTemplateSnapshotRef.current) return false;
    if (!selectedTemplateId || selectedTemplateId === "none") return false;

    const snapshot = originalTemplateSnapshotRef.current;
    if (snapshot.templateId !== selectedTemplateId) return false;

    // 1. Diagram Drawing / Image check
    const currentDiagram = wizardDiagramImage || null;
    const snapDiagram = snapshot.diagramImage || null;
    if (snapDiagram !== currentDiagram) {
      return true;
    }

    // 2. Specifications & Rows check (Canvas Mode)
    if (wizardIsCanvas) {
      const currentTables = extractCanvasTables(wizardLayoutBlocks || []);
      const snapTables = extractCanvasTables(snapshot.blocks || []);

      // If table count changed (e.g. table added or removed)
      if (currentTables.length !== snapTables.length) {
        return true;
      }

      for (let t = 0; t < currentTables.length; t++) {
        const curTbl = currentTables[t];
        const snpTbl = snapTables[t];
        const curRows = Array.isArray(curTbl.rows) ? curTbl.rows : [];
        const snpRows = Array.isArray(snpTbl.rows) ? snpTbl.rows : [];

        // Additional row added or row deleted!
        if (curRows.length !== snpRows.length) {
          return true;
        }

        // Columns structure modified (column added, removed, or ID changed)
        const curCols = Array.isArray(curTbl.columns) ? curTbl.columns : [];
        const snpCols = Array.isArray(snpTbl.columns) ? snpTbl.columns : [];
        if (curCols.length !== snpCols.length) {
          return true;
        }
        for (let c = 0; c < curCols.length; c++) {
          if (curCols[c]?.id !== snpCols[c]?.id || curCols[c]?.type !== snpCols[c]?.type) {
            return true;
          }
        }

        // Identify specification / metadata columns (excluding reading, trial, formula, and status columns)
        const specCols = curCols.filter((col) => !isReadingOrCalculatedColumn(col));

        // Check each row for structural modifications
        for (let r = 0; r < curRows.length; r++) {
          const cr = curRows[r];
          const sr = snpRows[r];
          if (!cr || !sr) return true;

          // Check if statement / merged row status changed
          const curMerged = Boolean(cr.is_merged || cr.isMerged || cr.is_statement || cr.isStatement);
          const snpMerged = Boolean(sr.is_merged || sr.isMerged || sr.is_statement || sr.isStatement);
          if (curMerged !== snpMerged) return true;
          if (curMerged) {
            const curText = normalizeStructuralVal(cr.text || cr.merged_text || cr.statement_text || "");
            const snpText = normalizeStructuralVal(sr.text || sr.merged_text || sr.statement_text || "");
            if (curText !== snpText) return true;
            continue;
          }

          // Check specification columns (nominal, vernier_reading, tolerance, max_permissible_error, etc.)
          for (const col of specCols) {
            if (normalizeStructuralVal(cr[col.id]) !== normalizeStructuralVal(sr[col.id])) {
              return true;
            }
          }

          // Check standard specification properties: nominal, tolerance, limits, required_dimension, unit
          const curNom = cr.nominal !== undefined ? cr.nominal : cr.nom;
          const snpNom = sr.nominal !== undefined ? sr.nominal : sr.nom;
          if (normalizeStructuralVal(curNom) !== normalizeStructuralVal(snpNom)) {
            return true;
          }

          if (normalizeStructuralVal(cr.tolerance) !== normalizeStructuralVal(sr.tolerance)) {
            return true;
          }

          const curLTol = cr.lower_tolerance !== undefined ? cr.lower_tolerance : cr.lowerTolerance;
          const snpLTol = sr.lower_tolerance !== undefined ? sr.lower_tolerance : sr.lowerTolerance;
          if (normalizeStructuralVal(curLTol) !== normalizeStructuralVal(snpLTol)) {
            return true;
          }

          const curUTol = cr.upper_tolerance !== undefined ? cr.upper_tolerance : cr.upperTolerance;
          const snpUTol = sr.upper_tolerance !== undefined ? sr.upper_tolerance : sr.upperTolerance;
          if (normalizeStructuralVal(curUTol) !== normalizeStructuralVal(snpUTol)) {
            return true;
          }

          const curReq = cr.required_dimension || cr.description || cr.specification;
          const snpReq = sr.required_dimension || sr.description || sr.specification;
          if (normalizeStructuralVal(curReq) !== normalizeStructuralVal(snpReq)) {
            return true;
          }

          if (normalizeStructuralVal(cr.unit) !== normalizeStructuralVal(sr.unit)) {
            return true;
          }
        }
      }
    } else {
      // 3. Specifications & Rows check (Standard Points Mode)
      const currentPoints = calPoints || [];
      const snapPoints = snapshot.points || [];

      // Additional row added or row deleted!
      if (currentPoints.length !== snapPoints.length) {
        return true;
      }

      for (let i = 0; i < currentPoints.length; i++) {
        const cp = currentPoints[i];
        const sp = snapPoints[i];
        if (!cp || !sp) return true;

        const curReq = cp.description || (cp as any).required_dimension;
        const snpReq = sp.description || (sp as any).required_dimension;
        if (normalizeStructuralVal(curReq) !== normalizeStructuralVal(snpReq)) {
          return true;
        }

        if (normalizeStructuralVal(cp.nominal) !== normalizeStructuralVal(sp.nominal)) {
          return true;
        }

        if (normalizeStructuralVal(cp.tolerance) !== normalizeStructuralVal(sp.tolerance)) {
          return true;
        }

        if (normalizeStructuralVal(cp.unit) !== normalizeStructuralVal(sp.unit)) {
          return true;
        }
      }
    }

    return false;
  };

  const isPreloadedFromPreviousRef = useRef<boolean>(false);

  // Helper to apply previous calibration data completely
  const applyPreviousCalibrationData = (cal: any, typeMatch?: CalibrationTypeConfig) => {
    if (!cal) return;
    isPreloadedFromPreviousRef.current = true;

    // Set Date of Calibration to previous calibration due date if present
    if (cal.next_calibration_date) {
      const prevDueDate = toLocalYyyyMmDd(cal.next_calibration_date);
      if (prevDueDate) {
        setCalDate(prevDueDate);
        setCertIssueDate(prevDueDate);
      }
    }

    // 1. Reference standards
    if (cal.reference_standards && Array.isArray(cal.reference_standards) && cal.reference_standards.length > 0) {
      setReferenceStandards(cal.reference_standards);
    } else if (cal.reference_standard_name) {
      setReferenceStandards([
        {
          name: cal.reference_standard_name,
          id: cal.reference_standard_id || "",
          traceable_to: cal.reference_standard_traceable_to || "",
          validity: cal.reference_standard_validity ? toLocalYyyyMmDd(cal.reference_standard_validity) : "",
          range: cal.reference_standard_range || "",
          least_count: cal.reference_standard_least_count || "",
        },
      ]);
    }

    // 2. Environmental conditions
    if (cal.environmental_conditions) {
      if (cal.environmental_conditions.temperature) setEnvTemp(cal.environmental_conditions.temperature);
      if (cal.environmental_conditions.humidity) setEnvHumidity(cal.environmental_conditions.humidity);
      if (cal.environmental_conditions.soaking_time) setEnvSoakingTime(cal.environmental_conditions.soaking_time);
      if (cal.environmental_conditions.soaking_start_time) setEnvSoakingStartTime(cal.environmental_conditions.soaking_start_time);
      if (cal.environmental_conditions.soaking_end_time) setEnvSoakingEndTime(cal.environmental_conditions.soaking_end_time);
    }
    if (cal.doc_no) setDocNo(cal.doc_no);
    if (cal.doc_date) setDocDate(cal.doc_date);
    if (cal.doc_rev) setDocRev(cal.doc_rev);

    // 3. SOP & Standard Reference
    const loadedProcNo = (cal as any).procedure_no || cal.procedure_reference || "";
    if (loadedProcNo) {
      setProcedureNo(loadedProcNo);
      setProcedureReference(loadedProcNo);
    }
    if (cal.procedure_name) setProcedureName(cal.procedure_name);
    if (cal.procedure_date) setProcedureDate(cal.procedure_date);
    if (cal.procedure_rev) setProcedureRev(cal.procedure_rev);
    if (cal.acceptance_criteria_doc_no) setAcceptanceCriteriaDocNo(cal.acceptance_criteria_doc_no);
    if (cal.acceptance_criteria_date) setAcceptanceCriteriaDate(cal.acceptance_criteria_date);
    if (cal.acceptance_criteria_rev) setAcceptanceCriteriaRev(cal.acceptance_criteria_rev);
    if (cal.acceptance_criteria_reference) setAcceptanceCriteriaReference(cal.acceptance_criteria_reference);
    if (cal.standard_reference) setStandardReference(cal.standard_reference);
    else if (cal.remarks) setStandardReference(cal.remarks);

    // 4. Custom Formula & Rule Type
    if (cal.status_rule_type) setStatusRuleType(cal.status_rule_type as "default" | "custom_formula");
    if (cal.status_formula) setStatusFormula(cal.status_formula);

    // 5. Custom grid schema & columns & canvas layout
    if (cal.is_canvas_template || (cal.layout_blocks && cal.layout_blocks.length > 0)) {
      setWizardIsCanvas(true);
      setWizardLayoutBlocks(cal.layout_blocks || []);
    } else {
      setWizardIsCanvas(false);
      setWizardLayoutBlocks([]);
    }
    if (cal.custom_columns && cal.custom_columns.length > 0) setWizardCustomColumns(cal.custom_columns);
    if (cal.standard_columns_config) setWizardStandardColumnConfigs(cal.standard_columns_config);
    if (cal.column_order && cal.column_order.length > 0) setWizardColumnOrder(cal.column_order);
    if (cal.hidden_columns && cal.hidden_columns.length > 0) setWizardHiddenColumns(cal.hidden_columns);
    if (cal.decimal_places !== undefined) setWizardDecimalPlaces(cal.decimal_places);
    if (cal.acceptance_criteria) setWizardAcceptanceCriteria(cal.acceptance_criteria);
    if (cal.diagram_image) setWizardDiagramImage(cal.diagram_image);
    if (cal.diagram_image_width) setWizardDiagramWidth(cal.diagram_image_width);
    if (cal.diagram_image_height) setWizardDiagramHeight(cal.diagram_image_height);
    if (cal.diagram_image_alignment) setWizardDiagramAlignment(cal.diagram_image_alignment);

    // 6. Calibration Points & Tolerance / Unit
    if (cal.calibration_points && cal.calibration_points.length > 0) {
      const loadedTol = cal.calibration_points[0].tolerance !== undefined ? cal.calibration_points[0].tolerance : calTolerance;
      if (loadedTol !== undefined) setCalTolerance(loadedTol);
      if (cal.calibration_points[0].unit) setCalUnit(cal.calibration_points[0].unit);

      const hasDescending = typeMatch?.columns?.some((c: any) => c.key === "descending_reading") || false;

      const fixedPoints = cal.calibration_points.map((pt: any, idx: number) => {
        const rowTol = pt.tolerance !== undefined && pt.tolerance > 0 ? pt.tolerance : loadedTol;
        let error = pt.error !== undefined ? Number(pt.error) : 0;
        if (pt.ascending_reading !== undefined && pt.nominal !== undefined) {
          if (hasDescending && pt.descending_reading !== undefined) {
            const avg = ((Number(pt.ascending_reading) || 0) + (Number(pt.descending_reading) || 0)) / 2;
            error = parseFloat((avg - (Number(pt.nominal) || 0)).toFixed(4));
          } else {
            error = parseFloat(((Number(pt.ascending_reading) || 0) - (Number(pt.nominal) || 0)).toFixed(4));
          }
        }
        return {
          ...pt,
          point_number: pt.point_number || idx + 1,
          description: pt.description || `Point ${idx + 1}`,
          error,
          tolerance: rowTol,
          status: pt.status || (rowTol > 0 ? (Math.abs(error) <= rowTol ? "PASS" : "FAIL") : "PASS")
        };
      });
      setCalPoints(fixedPoints);
    }

    // 7. Template ID & Name resolution
    if (cal.template_id) {
      setSelectedTemplateId(cal.template_id);
    } else if (cal.template_name && availableTemplates.length > 0) {
      const matchByName = availableTemplates.find(
        (t) => t.name.toLowerCase() === cal.template_name.toLowerCase()
      );
      if (matchByName) {
        setSelectedTemplateId(matchByName.id);
      }
    }

    // 8. Uncertainty & Remarks
    if (cal.uncertainty) setUncertainty(cal.uncertainty);
    if (cal.remarks) setRemarks(cal.remarks);
  };

  const handleClearTemplate = () => {
    originalTemplateSnapshotRef.current = null;
    setSelectedTemplateId("none");
    setWizardIsCanvas(false);
    setWizardLayoutBlocks([]);
    setWizardCustomColumns([]);
    setWizardStandardColumnConfigs({});
    setWizardColumnOrder([]);
    setWizardHiddenColumns([]);
    setWizardDecimalPlaces(4);
    setWizardAcceptanceCriteria({});
    setWizardDiagramImage(null);
    setDocNo("");
    setDocDate("");
    setDocRev("");
    setProcedureNo("");
    setProcedureReference("");
    setProcedureName("");
    setProcedureDate("");
    setProcedureRev("");
    setAcceptanceCriteriaDocNo("");
    setAcceptanceCriteriaDate("");
    setAcceptanceCriteriaRev("");
    setAcceptanceCriteriaReference("");
    toast.info("Cleared template selection (Custom Grid)");
  };

  // Apply Calibration Template Object helper
  const applyTemplateObject = (tpl: CalibrationTemplate, isEdit: boolean = false, existingPoints?: any[]) => {
    if (!tpl) return;

    setSelectedTemplateId(tpl.id);
    if (tpl.default_unit) setCalUnit(tpl.default_unit);
    if (tpl.default_tolerance !== undefined) setCalTolerance(tpl.default_tolerance);
    const instEnv = selectedInstrument?.custom_parameters?.environmental_defaults;
    if (tpl.environmental_defaults) {
      if (tpl.environmental_defaults.temperature) setEnvTemp(tpl.environmental_defaults.temperature);
      if (tpl.environmental_defaults.humidity) setEnvHumidity(tpl.environmental_defaults.humidity);
      if (tpl.environmental_defaults.soaking_time) setEnvSoakingTime(tpl.environmental_defaults.soaking_time);
      if (tpl.environmental_defaults.soaking_start_time) setEnvSoakingStartTime(tpl.environmental_defaults.soaking_start_time);
      if (tpl.environmental_defaults.soaking_end_time) setEnvSoakingEndTime(tpl.environmental_defaults.soaking_end_time);
    } else if (instEnv && !isEdit) {
      if (instEnv.temperature) setEnvTemp(instEnv.temperature);
      if (instEnv.humidity) setEnvHumidity(instEnv.humidity);
      if (instEnv.soaking_time) setEnvSoakingTime(instEnv.soaking_time);
      if (instEnv.soaking_start_time) setEnvSoakingStartTime(instEnv.soaking_start_time);
      if (instEnv.soaking_end_time) setEnvSoakingEndTime(instEnv.soaking_end_time);
    }

    const instDocProps = selectedInstrument?.custom_parameters?.doc_properties;

    const tplDocNo = (tpl as any).doc_no || (tpl as any).docNo;
    if (tplDocNo) {
      setDocNo(tplDocNo);
    } else if (instDocProps?.doc_no) {
      setDocNo(instDocProps.doc_no);
    } else if (!isEdit) {
      setDocNo("");
    }

    const tplDocDate = tpl.doc_date;
    if (tplDocDate) {
      setDocDate(tplDocDate);
    } else if (instDocProps?.doc_date) {
      setDocDate(instDocProps.doc_date);
    } else if (!isEdit) {
      setDocDate("");
    }

    const tplDocRev = tpl.doc_rev;
    if (tplDocRev) {
      setDocRev(tplDocRev);
    } else if (instDocProps?.doc_rev) {
      setDocRev(instDocProps.doc_rev);
    } else if (!isEdit) {
      setDocRev("");
    }

    if (tpl.remarks) setRemarks(tpl.remarks);
    if ((tpl as any).standard_reference || tpl.remarks) setStandardReference((tpl as any).standard_reference || tpl.remarks);

    const loadedTplProcNo = (tpl as any).procedure_no || tpl.procedure_reference;
    if (loadedTplProcNo) {
      setProcedureNo(loadedTplProcNo);
      setProcedureReference(loadedTplProcNo);
    } else if (instDocProps?.procedure_no || instDocProps?.procedure_reference) {
      const p = instDocProps.procedure_no || instDocProps.procedure_reference;
      setProcedureNo(p);
      setProcedureReference(p);
    } else if (!isEdit) {
      setProcedureNo("");
      setProcedureReference("");
    }

    const tplProcName = tpl.procedure_name;
    if (tplProcName) {
      setProcedureName(tplProcName);
    } else if (instDocProps?.procedure_name) {
      setProcedureName(instDocProps.procedure_name);
    } else if (!isEdit) {
      setProcedureName("");
    }

    const tplProcDate = tpl.procedure_date;
    if (tplProcDate) {
      setProcedureDate(tplProcDate);
    } else if (instDocProps?.procedure_date) {
      setProcedureDate(instDocProps.procedure_date);
    } else if (!isEdit) {
      setProcedureDate("");
    }

    const tplProcRev = tpl.procedure_rev;
    if (tplProcRev) {
      setProcedureRev(tplProcRev);
    } else if (instDocProps?.procedure_rev) {
      setProcedureRev(instDocProps.procedure_rev);
    } else if (!isEdit) {
      setProcedureRev("");
    }

    const tplCritDocNo = tpl.acceptance_criteria_doc_no;
    if (tplCritDocNo) {
      setAcceptanceCriteriaDocNo(tplCritDocNo);
    } else if (instDocProps?.acceptance_criteria_doc_no) {
      setAcceptanceCriteriaDocNo(instDocProps.acceptance_criteria_doc_no);
    } else if (!isEdit) {
      setAcceptanceCriteriaDocNo("");
    }

    const tplCritDate = tpl.acceptance_criteria_date;
    if (tplCritDate) {
      setAcceptanceCriteriaDate(tplCritDate);
    } else if (instDocProps?.acceptance_criteria_date) {
      setAcceptanceCriteriaDate(instDocProps.acceptance_criteria_date);
    } else if (!isEdit) {
      setAcceptanceCriteriaDate("");
    }

    const tplCritRev = tpl.acceptance_criteria_rev;
    if (tplCritRev) {
      setAcceptanceCriteriaRev(tplCritRev);
    } else if (instDocProps?.acceptance_criteria_rev) {
      setAcceptanceCriteriaRev(instDocProps.acceptance_criteria_rev);
    } else if (!isEdit) {
      setAcceptanceCriteriaRev("");
    }

    const tplCritRef = tpl.acceptance_criteria_reference;
    if (tplCritRef) {
      setAcceptanceCriteriaReference(tplCritRef);
    } else if (instDocProps?.acceptance_criteria_reference) {
      setAcceptanceCriteriaReference(instDocProps.acceptance_criteria_reference);
    } else if (!isEdit) {
      setAcceptanceCriteriaReference("");
    }

    if (tpl.status_rule_type) setStatusRuleType(tpl.status_rule_type as "default" | "custom_formula");
    if (tpl.status_formula) setStatusFormula(tpl.status_formula);

    // SMART BINDING: Check if the selected instrument has its own saved specifications
    const rawInstSpecs = selectedInstrument?.custom_parameters?.specifications;
    const validInstSpecs = Array.isArray(rawInstSpecs)
      ? rawInstSpecs.filter((s: any) => (s.is_merged || s.isMerged) ? true : !isReceiptRow(s.required_dimension || s.description || s.parameter_name || "", s))
      : [];

    let initialSanitizedBlocks: any[] = [];
    // Check if canvas template
    if (tpl.is_canvas_template || (tpl.layout_blocks && tpl.layout_blocks.length > 0)) {
      setWizardIsCanvas(true);
      const clonedBlocks = JSON.parse(JSON.stringify(tpl.layout_blocks || []));

      // Only ignore the table of INSTRUMENT RECEIPT CONDITION from canvas layout blocks (not all tables)
      const sanitizedBlocks = clonedBlocks.filter((b: any) => {
        const title = (b.title || b.content || "").toLowerCase();
        return !title.includes("receipt condition");
      });

      if (!isEdit && validInstSpecs.length > 0) {
        const allTables = getAllCanvasTables(sanitizedBlocks);
        bindSpecificationsToCanvasTables(
          allTables,
          validInstSpecs,
          tpl.default_tolerance ?? 0.02,
          tpl.decimal_places ?? 3,
          tpl.default_unit || "mm"
        );
      }

      // Ensure no obsolete receipt condition rows remain inside sanitizedBlocks, and evaluate formulas across all tables
      sanitizedBlocks.forEach((b: any) => {
        if (b.type === "table_grid" && Array.isArray(b.rows)) {
          const dec = b.decimal_places ?? tpl.decimal_places ?? 3;
          const tol = b.tolerance ?? tpl.default_tolerance ?? 0.02;
          b.rows = b.rows
            .filter((r: any) => (r.is_merged || r.isMerged) ? true : !isReceiptRow(r.required_dimension || r.description || "", r))
                        .map((r: any) => evaluateCanvasRowFormulas(r, b.columns, tol, dec, b.nominal));
        } else if (b.type === "split_row" && Array.isArray(b.children)) {
          b.children.forEach((c: any) => {
            if (c && c.type === "table_grid" && Array.isArray(c.rows)) {
              const dec = c.decimal_places ?? tpl.decimal_places ?? 3;
              const tol = c.tolerance ?? tpl.default_tolerance ?? 0.02;
              c.rows = c.rows
                .filter((r: any) => (r.is_merged || r.isMerged) ? true : !isReceiptRow(r.required_dimension || r.description || "", r))
                                .map((r: any) => evaluateCanvasRowFormulas(r, c.columns, tol, dec, c.nominal));
            }
          });
        }
      });

      initialSanitizedBlocks = sanitizedBlocks;
      setWizardLayoutBlocks(sanitizedBlocks);
    } else {
      setWizardIsCanvas(false);
      setWizardLayoutBlocks([]);
    }

    // Always set custom columns, column order, hidden columns, decimal places, acceptance criteria
    setWizardCustomColumns((tpl as any).custom_columns || []);
    setWizardStandardColumnConfigs((tpl as any).standard_columns_config || {});
    setWizardColumnOrder((tpl as any).column_order || []);
    setWizardHiddenColumns((tpl as any).hidden_columns || []);
    setWizardDecimalPlaces(tpl.decimal_places ?? 4);
    setWizardAcceptanceCriteria((tpl as any).acceptance_criteria || {});

    // Diagram Image resolution: preserve instrument item-level diagram if saved!
    const instCustomDiagram = selectedInstrument?.custom_parameters?.diagram_image;
    let initialDiagram: string | null = null;
    if (instCustomDiagram !== undefined && !isEdit) {
      initialDiagram = instCustomDiagram || null;
      setWizardDiagramImage(initialDiagram);
      if (selectedInstrument?.custom_parameters?.diagram_image_width) setWizardDiagramWidth(selectedInstrument.custom_parameters.diagram_image_width);
      if (selectedInstrument?.custom_parameters?.diagram_image_height) setWizardDiagramHeight(selectedInstrument.custom_parameters.diagram_image_height);
      if (selectedInstrument?.custom_parameters?.diagram_image_alignment) setWizardDiagramAlignment(selectedInstrument.custom_parameters.diagram_image_alignment);
    } else if (!isEdit) {
      initialDiagram = tpl.diagram_image || null;
      setWizardDiagramImage(initialDiagram);
      if (tpl.diagram_image_width) setWizardDiagramWidth(tpl.diagram_image_width);
      if (tpl.diagram_image_height) setWizardDiagramHeight(tpl.diagram_image_height);
      if (tpl.diagram_image_alignment) setWizardDiagramAlignment(tpl.diagram_image_alignment);
    } else {
      initialDiagram = tpl.diagram_image || null;
    }

    let initialPoints: CalibrationPoint[] = [];
    if (isEdit && existingPoints && existingPoints.length > 0) {
      initialPoints = existingPoints;
      setCalPoints(existingPoints);
    } else if (!isEdit && validInstSpecs.length > 0) {
      initialPoints = validInstSpecs.map((s: any, idx) => ({
        point_number: s.point_number || idx + 1,
        description: s.description || s.required_dimension || `Point ${idx + 1}`,
        nominal: s.nominal !== undefined ? Number(s.nominal) : 0,
        ascending_reading: s.ascending_reading !== undefined ? Number(s.ascending_reading) : (s.nominal !== undefined ? Number(s.nominal) : 0),
        descending_reading: s.descending_reading !== undefined ? Number(s.descending_reading) : undefined,
        error: s.error !== undefined ? Number(s.error) : 0,
        unit: s.unit || tpl.default_unit || calUnit || "mm",
        tolerance: s.tolerance !== undefined ? Number(s.tolerance) : (tpl.default_tolerance !== undefined ? Number(tpl.default_tolerance) : calTolerance),
        status: s.status || "PASS",
        customFields: s.customFields || {},
      }));
      setCalPoints(initialPoints);
    } else if (tpl.calibration_points && tpl.calibration_points.length > 0) {
      initialPoints = tpl.calibration_points.map((pt: any, idx) => ({
        point_number: pt.point_number || idx + 1,
        description: pt.description || `Point ${idx + 1}`,
        nominal: pt.nominal !== undefined ? Number(pt.nominal) : 0,
        ascending_reading: pt.ascending_reading !== undefined ? Number(pt.ascending_reading) : (pt.nominal !== undefined ? Number(pt.nominal) : 0),
        descending_reading: pt.descending_reading !== undefined ? Number(pt.descending_reading) : undefined,
        error: pt.error !== undefined ? Number(pt.error) : 0,
        unit: pt.unit || tpl.default_unit || calUnit || "mm",
        tolerance: pt.tolerance !== undefined ? Number(pt.tolerance) : (tpl.default_tolerance !== undefined ? Number(tpl.default_tolerance) : calTolerance),
        status: pt.status || "PASS",
        customFields: pt.customFields || {},
      }));
      setCalPoints(initialPoints);
    }

    // Record baseline snapshot of initialized template definition for modification detection
    originalTemplateSnapshotRef.current = {
      templateId: tpl.id,
      templateName: tpl.name,
      diagramImage: initialDiagram,
      blocks: JSON.parse(JSON.stringify(initialSanitizedBlocks || [])),
      points: JSON.parse(JSON.stringify(initialPoints || [])),
    };
  };

  // Apply Standard Preset helper
  const applyPresetAsTemplate = (preset: CanvasTemplatePreset) => {
    const fakeTpl: any = {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      instrument_type: preset.instrumentType,
      default_unit: preset.defaultUnit,
      default_tolerance: preset.defaultTolerance,
      is_canvas_template: true,
      layout_blocks: preset.blocks,
    };
    applyTemplateObject(fakeTpl, false);
  };

  // Apply Calibration Template helper
  const handleApplyTemplate = (tplId: string) => {
    if (tplId === "none") {
      handleClearTemplate();
      return;
    }
    const presetMatch = CANVAS_PRESETS.find((p) => p.id === tplId);
    if (presetMatch) {
      applyPresetAsTemplate(presetMatch);
      toast.success(`Applied standard preset "${presetMatch.name}"`);
      return;
    }
    const tpl = availableTemplates.find((t) => t.id === tplId);
    if (!tpl) return;
    applyTemplateObject(tpl, false);
    toast.success(`Applied template "${tpl.name}"`);
  };

  // Auto-apply matching template when templates load or instrument changes (for new calibrations)
  useEffect(() => {
    if (!availableTemplates || availableTemplates.length === 0) return;
    if ((selectedTemplateId && selectedTemplateId !== "none") || isEditMode || draftIdParam) return;

    let match: CalibrationTemplate | undefined;
    if (selectedInstrument) {
      const instName = (selectedInstrument.name || "").toLowerCase();
      const instType = (selectedInstrument.item_type || "").toLowerCase();
      match = availableTemplates.find(
        (t) =>
          t.instrument_type.toLowerCase() === instName ||
          t.instrument_type.toLowerCase() === instType ||
          (instName && instName.includes(t.name.toLowerCase())) ||
          t.name.toLowerCase().includes(instName)
      );
    }

    if (!match && availableTemplates.length > 0) {
      match = availableTemplates[0];
    }

    if (match) {
      if (isPreloadedFromPreviousRef.current) {
        // Set matching template ID for display without overwriting preloaded points or formulas!
        setSelectedTemplateId(match.id);
        if ((match as any).doc_no || (match as any).docNo) {
          setDocNo((match as any).doc_no || (match as any).docNo);
        }
        originalTemplateSnapshotRef.current = {
          templateId: match.id,
          templateName: match.name,
          diagramImage: wizardDiagramImage || null,
          blocks: JSON.parse(JSON.stringify(wizardLayoutBlocks || [])),
          points: JSON.parse(JSON.stringify(calPoints || [])),
        };
      } else {
        handleApplyTemplate(match.id);
      }
    }
  }, [availableTemplates, selectedInstrument, selectedTemplateId, isEditMode, draftIdParam]);

  // Load existing calibration if in Edit mode
  useEffect(() => {
    if (!user || !editIdParam) return;
    setIsEditMode(true);
    setEditLoading(true);

    getCalibration(editIdParam)
      .then(async (cal) => {
        setSavedCalibrationId(cal.id);
        setSelectedInstrument(cal.instrument);
        const typeMatch =
          CALIBRATION_TYPES.find((t) => t.type === cal.calibration_type) ||
          CALIBRATION_TYPES[0];
        setSelectedType(typeMatch);

        // Fetch available templates for this type
        let tpls: CalibrationTemplate[] = [];
        try {
          tpls = await getTemplates({ userId: user.id, companyId: user.companyId, calibrationType: typeMatch.type });
          setAvailableTemplates(tpls || []);
        } catch (e) {
          console.error("Failed to fetch templates on edit", e);
        }

        // Determine target template
        let targetTplId = (cal as any).template_id;
        let targetTpl: CalibrationTemplate | undefined;

        if (targetTplId && tpls.length > 0) {
          targetTpl = tpls.find((t) => t.id === targetTplId);
        }
        if (!targetTpl && targetTplId) {
          try {
            targetTpl = await getTemplate(targetTplId);
          } catch (e) {}
        }
        if (!targetTpl && cal.instrument && tpls.length > 0) {
          const instName = (cal.instrument.name || "").toLowerCase();
          const instType = (cal.instrument.item_type || "").toLowerCase();
          targetTpl = tpls.find(
            (t) =>
              t.instrument_type.toLowerCase() === instName ||
              t.instrument_type.toLowerCase() === instType ||
              (instName && instName.includes(t.name.toLowerCase())) ||
              t.name.toLowerCase().includes(instName)
          );
          if (!targetTpl) targetTpl = tpls[0];
        }

        if (targetTpl) {
          applyTemplateObject(targetTpl, true, cal.calibration_points);
        }

        // Overlay specific calibration values saved on cal record
        if (cal.reference_standards && cal.reference_standards.length > 0) {
          setReferenceStandards(cal.reference_standards);
        } else if (cal.reference_standard_name) {
          setReferenceStandards([
            {
              name: cal.reference_standard_name,
              id: cal.reference_standard_id || "",
              traceable_to: cal.reference_standard_traceable_to || "",
              validity: cal.reference_standard_validity
                ? toLocalYyyyMmDd(cal.reference_standard_validity)
                : "",
              range: cal.reference_standard_range || "",
              least_count: cal.reference_standard_least_count || "",
            },
          ]);
        }

        if (cal.environmental_conditions) {
          if (cal.environmental_conditions.temperature) setEnvTemp(cal.environmental_conditions.temperature);
          if (cal.environmental_conditions.humidity) setEnvHumidity(cal.environmental_conditions.humidity);
          if (cal.environmental_conditions.soaking_time) setEnvSoakingTime(cal.environmental_conditions.soaking_time);
          if (cal.environmental_conditions.soaking_start_time) setEnvSoakingStartTime(cal.environmental_conditions.soaking_start_time);
          if (cal.environmental_conditions.soaking_end_time) setEnvSoakingEndTime(cal.environmental_conditions.soaking_end_time);
        }
        const instEnv = cal.instrument?.custom_parameters?.environmental_defaults;
        if (instEnv) {
          if (!cal.environmental_conditions?.temperature && instEnv.temperature) setEnvTemp(instEnv.temperature);
          if (!cal.environmental_conditions?.humidity && instEnv.humidity) setEnvHumidity(instEnv.humidity);
          if (!cal.environmental_conditions?.soaking_time && instEnv.soaking_time) setEnvSoakingTime(instEnv.soaking_time);
          if (!cal.environmental_conditions?.soaking_start_time && instEnv.soaking_start_time) setEnvSoakingStartTime(instEnv.soaking_start_time);
          if (!cal.environmental_conditions?.soaking_end_time && instEnv.soaking_end_time) setEnvSoakingEndTime(instEnv.soaking_end_time);
        }

        const savedReceipt = (cal.environmental_conditions as any)?.receipt_condition || (cal as any).receipt_condition || cal.instrument?.custom_parameters?.receipt_condition || cal.instrument?.custom_parameters?.environmental_defaults?.receipt_condition;
        if (savedReceipt) {
          if (["NO DENT & DAMAGE (OK)", "SATISFACTORY", "DENT & DAMAGE OBSERVED"].includes(savedReceipt)) {
            setReceiptCondition(savedReceipt);
          } else {
            setReceiptCondition("CUSTOM");
            setCustomReceiptCondition(savedReceipt);
          }
        } else {
          setReceiptCondition("NO DENT & DAMAGE (OK)");
        }

        const instDocProps = cal.instrument?.custom_parameters?.doc_properties;

        // 1. Doc Number
        const loadedDocNo = cal.doc_no || instDocProps?.doc_no;
        if (loadedDocNo) setDocNo(loadedDocNo);

        // 2. Doc Date
        const loadedDocDate = cal.doc_date || instDocProps?.doc_date;
        if (loadedDocDate) setDocDate(loadedDocDate);

        // 3. Doc Rev
        const loadedDocRev = cal.doc_rev || instDocProps?.doc_rev;
        if (loadedDocRev) setDocRev(loadedDocRev);

        // 4. Procedure No & Reference
        const calProcNo = (cal as any).procedure_no || (cal as any).procedure_reference || instDocProps?.procedure_no || instDocProps?.procedure_reference;
        if (calProcNo) {
          setProcedureNo(calProcNo);
          setProcedureReference(calProcNo);
        }

        // 5. Procedure Name
        const calProcName = (cal as any).procedure_name || instDocProps?.procedure_name;
        if (calProcName) setProcedureName(calProcName);

        // 6. Procedure Date
        const calProcDate = (cal as any).procedure_date || instDocProps?.procedure_date;
        if (calProcDate) setProcedureDate(calProcDate);

        // 7. Procedure Rev
        const calProcRev = (cal as any).procedure_rev || instDocProps?.procedure_rev;
        if (calProcRev) setProcedureRev(calProcRev);

        // 8. Acceptance Criteria Doc No
        const calCritDocNo = (cal as any).acceptance_criteria_doc_no || instDocProps?.acceptance_criteria_doc_no;
        if (calCritDocNo) setAcceptanceCriteriaDocNo(calCritDocNo);

        // 9. Acceptance Criteria Date
        const calCritDate = (cal as any).acceptance_criteria_date || instDocProps?.acceptance_criteria_date;
        if (calCritDate) setAcceptanceCriteriaDate(calCritDate);

        // 10. Acceptance Criteria Rev
        const calCritRev = (cal as any).acceptance_criteria_rev || instDocProps?.acceptance_criteria_rev;
        if (calCritRev) setAcceptanceCriteriaRev(calCritRev);

        // 11. Acceptance Criteria Reference
        const calCritRef = (cal as any).acceptance_criteria_reference || instDocProps?.acceptance_criteria_reference;
        if (calCritRef) setAcceptanceCriteriaReference(calCritRef);

        // 12. Standard Reference
        if ((cal as any).standard_reference) {
          setStandardReference((cal as any).standard_reference);
        } else if (cal.remarks) {
          setStandardReference(cal.remarks);
        }

        if (cal.calibration_points && cal.calibration_points.length > 0) {
          setCalPoints(cal.calibration_points);
          if (cal.calibration_points[0].unit) {
            setCalUnit(cal.calibration_points[0].unit);
          }
          if (cal.calibration_points[0].tolerance !== undefined) {
            setCalTolerance(cal.calibration_points[0].tolerance);
          }
          if ((cal as any).status_rule_type) setStatusRuleType((cal as any).status_rule_type);
          if ((cal as any).status_formula) setStatusFormula((cal as any).status_formula);
        }

        if (cal.custom_columns && cal.custom_columns.length > 0) setWizardCustomColumns(cal.custom_columns as unknown as CustomColumn[]);
        if ((cal as any).standard_columns_config) setWizardStandardColumnConfigs((cal as any).standard_columns_config);
        if (cal.column_order && cal.column_order.length > 0) setWizardColumnOrder(cal.column_order);
        if (cal.hidden_columns && cal.hidden_columns.length > 0) setWizardHiddenColumns(cal.hidden_columns);
        if ((cal as any).decimal_places !== undefined) setWizardDecimalPlaces((cal as any).decimal_places);
        if ((cal as any).acceptance_criteria) setWizardAcceptanceCriteria((cal as any).acceptance_criteria);

        if ((cal as any).is_canvas_template || ((cal as any).layout_blocks && (cal as any).layout_blocks.length > 0)) {
          setWizardIsCanvas(true);
          const rawBlocks = (cal as any).layout_blocks || [];
          const sanitizedBlocks = rawBlocks
            .filter((b: any) => {
              const title = (b.title || b.content || "").toLowerCase();
              return !title.includes("receipt condition");
            })
            .map((b: any) => {
              if (b.type === "table_grid" && Array.isArray(b.rows)) {
                return {
                  ...b,
                  rows: b.rows.filter((r: any) => (r.is_merged || r.isMerged) ? true : !isReceiptRow(r.required_dimension || r.description || "", r)),
                };
              }
              if (b.type === "split_row" && Array.isArray(b.children)) {
                return {
                  ...b,
                  children: b.children.map((c: any) => {
                    if (c && c.type === "table_grid" && Array.isArray(c.rows)) {
                      return {
                        ...c,
                        rows: c.rows.filter((r: any) => (r.is_merged || r.isMerged) ? true : !isReceiptRow(r.required_dimension || r.description || "", r)),
                      };
                    }
                    return c;
                  }),
                };
              }
              return b;
            });
          setWizardLayoutBlocks(sanitizedBlocks);
        }

        if ((cal as any).diagram_image !== undefined) setWizardDiagramImage((cal as any).diagram_image || null);
        if ((cal as any).diagram_image_width) setWizardDiagramWidth((cal as any).diagram_image_width);
        if ((cal as any).diagram_image_height) setWizardDiagramHeight((cal as any).diagram_image_height);
        if ((cal as any).diagram_image_alignment) setWizardDiagramAlignment((cal as any).diagram_image_alignment);

                setUncertainty(cal.uncertainty || "");
        setVerdict((cal.verdict as any) || "PASS");
        setIsVerdictManuallyOverridden(false);
        if (cal.remarks) setRemarks(cal.remarks);
        setCalibratedBy(cal.calibrated_by || "");
        setCalibratedByDesignation(cal.calibrated_by_designation || "");
        setCalibratedBySignature((cal as any).calibrated_by_signature || "");
        setReviewedBy(cal.reviewed_by || "");
        setReviewedByDesignation(cal.reviewed_by_designation || "");
        setReviewedBySignature((cal as any).reviewed_by_signature || "");
        setApprovedBy(cal.approved_by || "");
        setApprovedByDesignation(cal.approved_by_designation || "");
        setApprovedBySignature((cal as any).approved_by_signature || "");
        setCalDate(
          toLocalYyyyMmDd(cal.calibration_date) || toLocalYyyyMmDd(new Date())
        );
        setCertIssueDate(
          toLocalYyyyMmDd((cal as any).certificate_issue_date) ||
            toLocalYyyyMmDd(cal.calibration_date) ||
            toLocalYyyyMmDd(new Date())
        );
        setNextCalDate(
          toLocalYyyyMmDd(cal.next_calibration_date)
        );
        setNextCertNumber(cal.certificate_number || "");
        if (cal.ulr_number) {
          setUlrEnabled(true);
          setNextUlrNumber(cal.ulr_number);
        } else if ((cal as any).ulr_enabled) {
          setUlrEnabled(true);
        }

        // Reopen workflow starting from Step 2 (Calibration Entry)
        setStep(2);
        toast.info(`Editing calibration ${cal.certificate_number}`);
      })
      .catch((err) => {
        toast.error("Failed to load calibration for editing");
      })
      .finally(() => {
        setIsInitializing(false);
        setEditLoading(false);
      });
  }, [user, editIdParam]);

  // Auto-save Draft
  useEffect(() => {
    if (isInitializing || !user || savedCalibrationId) return;
    const timeout = setTimeout(() => {
      const draftData = {
        step,
        selectedInstrument,
        selectedType,
        referenceStandards,
        envTemp,
        envHumidity,
        envSoakingTime,
        envSoakingStartTime,
        envSoakingEndTime,
        docNo,
        procedureNo,
        procedureName,
        procedureDate,
        procedureRev,
        procedureReference,
        receiptCondition,
        customReceiptCondition,
        calPoints,
        wizardIsCanvas,
        wizardLayoutBlocks,
        selectedTemplateId,
        wizardDiagramImage,
        wizardDiagramWidth,
        wizardDiagramHeight,
        wizardDiagramAlignment,
        wizardCustomColumns,
        wizardStandardColumnConfigs,
        wizardColumnOrder,
        wizardHiddenColumns,
        wizardDecimalPlaces,
        wizardAcceptanceCriteria,
        calUnit,
        calTolerance,
                uncertainty,
        verdict,
        isVerdictManuallyOverridden,
        remarks,
        calibratedBy,
        calibratedByDesignation,
        reviewedBy,
        reviewedByDesignation,
        approvedBy,
        approvedByDesignation,
        calDate,
        certIssueDate,
        nextCalDate,
      };
      saveDraft(user.id, draftData, draftIdRef.current || undefined).then((saved) => {
        if (saved && saved.id && !draftIdRef.current) {
          draftIdRef.current = saved.id;
          setActiveDraftId(saved.id);
        }
      }).catch(console.error);
    }, 1500); // 1.5s debounce
    return () => clearTimeout(timeout);
  }, [
    step, selectedInstrument, selectedType, referenceStandards, envTemp, envHumidity, envSoakingTime, envSoakingStartTime, envSoakingEndTime, docNo, procedureReference,
    receiptCondition, customReceiptCondition,
    calPoints, wizardIsCanvas, wizardLayoutBlocks, selectedTemplateId, wizardDiagramImage, wizardDiagramWidth, wizardDiagramHeight, wizardDiagramAlignment,
    wizardCustomColumns, wizardColumnOrder, wizardHiddenColumns, calUnit, calTolerance, uncertainty, verdict, isVerdictManuallyOverridden, remarks, calibratedBy, calibratedByDesignation,
    reviewedBy, reviewedByDesignation, approvedBy, approvedByDesignation, calDate, certIssueDate, nextCalDate, user, savedCalibrationId, isInitializing
  ]);

  // Load specific draft on mount
  useEffect(() => {
    if (!user) return;
    if (draftIdParam) {
      getDraft(draftIdParam).then((draft) => {
        if (draft && draft.data) {
          let d = draft.data;
          if (typeof d === "string") {
            try { d = JSON.parse(d); } catch (e) { console.error("Failed to parse draft", e); }
          }
          setStep(d.step || 0);
          setSelectedInstrument(d.selectedInstrument || null);
          setSelectedType(d.selectedType || null);
          setReferenceStandards(d.referenceStandards || [{ name: "", id: "", traceable_to: "", validity: "", range: "", least_count: "" }]);
          setEnvTemp(d.envTemp || "");
          setEnvHumidity(d.envHumidity || "");
          setEnvSoakingTime(d.envSoakingTime || "");
          setEnvSoakingStartTime(d.envSoakingStartTime || "");
          setEnvSoakingEndTime(d.envSoakingEndTime || "");
          setDocNo(d.docNo || "");
          const draftProcNo = d.procedureNo || d.procedureReference || "";
          setProcedureNo(draftProcNo);
          setProcedureReference(draftProcNo);
          if (d.procedureName) setProcedureName(d.procedureName);
          if (d.procedureDate) setProcedureDate(d.procedureDate);
          if (d.procedureRev) setProcedureRev(d.procedureRev);
          if (d.receiptCondition) setReceiptCondition(d.receiptCondition);
          if (d.customReceiptCondition) setCustomReceiptCondition(d.customReceiptCondition);
          setCalPoints(d.calPoints || []);
          if (d.wizardDiagramImage !== undefined) setWizardDiagramImage(d.wizardDiagramImage);
          if (d.wizardDiagramWidth) setWizardDiagramWidth(d.wizardDiagramWidth);
          if (d.wizardDiagramHeight) setWizardDiagramHeight(d.wizardDiagramHeight);
          if (d.wizardDiagramAlignment) setWizardDiagramAlignment(d.wizardDiagramAlignment);
          if (d.wizardIsCanvas !== undefined) setWizardIsCanvas(d.wizardIsCanvas);
          if (d.wizardLayoutBlocks) setWizardLayoutBlocks(d.wizardLayoutBlocks);
          if (d.selectedTemplateId) setSelectedTemplateId(d.selectedTemplateId);
          setWizardCustomColumns(d.wizardCustomColumns || []);
          setWizardStandardColumnConfigs(d.wizardStandardColumnConfigs || {});
          setWizardColumnOrder(d.wizardColumnOrder || []);
          setWizardHiddenColumns(d.wizardHiddenColumns || []);
          setWizardDecimalPlaces(d.wizardDecimalPlaces ?? 4);
          setWizardAcceptanceCriteria(d.wizardAcceptanceCriteria || {});
          setCalUnit(d.calUnit || "");
          setCalTolerance(d.calTolerance || 0);
          setUncertainty(d.uncertainty || "");
                    setVerdict(d.verdict || "PASS");
          setIsVerdictManuallyOverridden(Boolean(d.isVerdictManuallyOverridden));
          setRemarks(d.remarks || "");
          setCalibratedBy(d.calibratedBy || "");
          setCalibratedByDesignation(d.calibratedByDesignation || "");
          setReviewedBy(d.reviewedBy || "");
          setReviewedByDesignation(d.reviewedByDesignation || "");
          setApprovedBy(d.approvedBy || "");
          setApprovedByDesignation(d.approvedByDesignation || "");
          setCalDate(d.calDate || new Date().toISOString().split("T")[0]);
          setCertIssueDate(d.certIssueDate || d.calDate || new Date().toISOString().split("T")[0]);
          setNextCalDate(d.nextCalDate || "");
        }
        setIsInitializing(false);
      }).catch(() => setIsInitializing(false));
    } else {
      setIsInitializing(false);
    }
  }, [user, draftIdParam]);

  // Load instrument if coming from instruments page
  useEffect(() => {
    if (instrumentId) {
      getInstrument(instrumentId).then((inst) => {
        setSelectedInstrument(inst);
        applyInstrumentCustomParameters(inst);
        if (inst.due_date) {
          const prevDueDate = toLocalYyyyMmDd(inst.due_date);
          if (prevDueDate) {
            setCalDate(prevDueDate);
            setCertIssueDate(prevDueDate);
          }
        }
        // Try to auto-detect type from item_type
        const typeMatch = CALIBRATION_TYPES.find(
          (t) => inst.item_type?.toLowerCase().includes(t.type) || inst.name?.toLowerCase().includes(t.type)
        );
        if (typeMatch) {
          setSelectedType(typeMatch);
          setCalUnit(typeMatch.defaultUnit);
        }
        
        // Auto-fill from latest calibration
        httpClient.get(`/calibrations/latest/${instrumentId}`).then((res) => {
          if (res.data) {
            applyPreviousCalibrationData(res.data, typeMatch);
            toast.success("Auto-filled data from previous calibration");
          }
        }).catch(() => {});
      }).catch(() => {
        toast.error("Failed to load instrument");
      });
    }
  }, [instrumentId]);

  // Fetch Master Standards for Step 2
  useEffect(() => {
    if (user?.id) {
      httpClient.get("/instruments", {
        params: { is_reference_standard: "true", pageSize: 100, createdBy: user.id }
      }).then(res => setMasterStandards(res.data?.data || [])).catch(() => {});
    }
  }, [user]);

  // Removed next numbers fetch on step 4 because it overwrites the actual saved numbers

  // Search instruments (debounced)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        setSearching(true);
        httpClient.get("/instruments", {
          params: { search: searchQuery, pageSize: 20, createdBy: user?.id },
        })
        .then(res => setSearchResults(res.data?.data || []))
        .catch(() => toast.error("Search failed"))
        .finally(() => setSearching(false));
      } else {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, user]);

  // Recently Calibrated Alert modal state
  const [recentCalModalOpen, setRecentCalModalOpen] = useState(false);
  const [recentCalDetails, setRecentCalDetails] = useState<{ lastCalDate?: string; dueDate?: string } | null>(null);
  const [pendingSelectedInstrument, setPendingSelectedInstrument] = useState<Instrument | null>(null);

  const proceedWithInstrumentSelect = (inst: Instrument) => {
    setSelectedInstrument(inst);
    applyInstrumentCustomParameters(inst);
    if (inst.due_date) {
      const prevDueDate = toLocalYyyyMmDd(inst.due_date);
      if (prevDueDate) {
        setCalDate(prevDueDate);
        setCertIssueDate(prevDueDate);
      }
    }
    const typeMatch = CALIBRATION_TYPES.find(
      (t) => inst.item_type?.toLowerCase().includes(t.type) || inst.name?.toLowerCase().includes(t.type)
    );
    if (typeMatch) {
      setSelectedType(typeMatch);
      setCalUnit(typeMatch.defaultUnit);
    }
    
    // Auto-fill from latest calibration
    httpClient.get(`/calibrations/latest/${inst.id}`).then((res) => {
      if (res.data) {
        applyPreviousCalibrationData(res.data, typeMatch);
        toast.success(`Auto-filled template from previous calibration for ${inst.name}`);
      }
    }).catch(() => {});
  };

  const handleInstrumentSelect = (inst: Instrument) => {
    if (inst.last_calibration_date) {
      const lastCal = new Date(inst.last_calibration_date);
      const now = new Date();
      const diffDays = Math.abs((now.getTime() - lastCal.getTime()) / (1000 * 3600 * 24));
      if (diffDays <= 10) {
        setRecentCalDetails({ lastCalDate: inst.last_calibration_date, dueDate: inst.due_date });
        setPendingSelectedInstrument(inst);
        setRecentCalModalOpen(true);
        return;
      }
    }
    proceedWithInstrumentSelect(inst);
  };

  // Auto-determine verdict from points or canvas blocks with full telemetry
  useEffect(() => {
    let computed: "PASS" | "FAIL" | "CONDITIONAL" = "PASS";
    let totalPts = 0;
    let passPts = 0;
    let failPts = 0;
    let condPts = 0;

    if (wizardIsCanvas && wizardLayoutBlocks.length > 0) {
      const allTables = getAllCanvasTables(wizardLayoutBlocks);
      const nonMergedRows: any[] = [];
      allTables.forEach((tbl) => {
        if (Array.isArray(tbl.rows)) {
          tbl.rows.forEach((r: any) => {
            if (!r.is_merged && !r.isMerged) {
              nonMergedRows.push(r);
            }
          });
        }
      });

      if (nonMergedRows.length > 0) {
        nonMergedRows.forEach((r) => {
          const rawStatus = String(
            r.status || r.judgement || r.result || r.verdict || r.decision || r.acceptance || ""
          ).trim().toUpperCase();

          if (rawStatus === "FAIL" || rawStatus === "REJECT" || rawStatus === "NG" || rawStatus === "NOT OK") {
            failPts++;
            totalPts++;
          } else if (rawStatus === "PASS" || rawStatus === "OK" || rawStatus === "ACCEPT" || rawStatus === "ACCEPTED") {
            passPts++;
            totalPts++;
          } else if (rawStatus === "CONDITIONAL" || rawStatus === "HOLD" || rawStatus === "DERATED") {
            condPts++;
            totalPts++;
          } else if (typeof r.reading === "number" && typeof r.nominal === "number") {
            // Fallback numeric tolerance check if no explicit status text column
            const tol = typeof r.tolerance === "number" ? r.tolerance : 0;
            const dev = Math.abs(r.reading - r.nominal);
            totalPts++;
            if (tol > 0 && dev > tol) {
              failPts++;
            } else {
              passPts++;
            }
          }
        });

        if (failPts > 0) {
          computed = "FAIL";
        } else if (condPts > 0) {
          computed = "CONDITIONAL";
        } else if (passPts > 0) {
          computed = "PASS";
        }
      }
    } else if (calPoints.length > 0) {
      totalPts = calPoints.length;
      calPoints.forEach((p) => {
        const st = String(p.status || "").trim().toUpperCase();
        if (st === "FAIL" || st === "REJECT") failPts++;
        else if (st === "CONDITIONAL") condPts++;
        else passPts++;
      });

      if (failPts > 0) computed = "FAIL";
      else if (condPts > 0) computed = "CONDITIONAL";
      else computed = "PASS";
    }

    setAutoVerdict(computed);
    setVerdictStats({ total: totalPts, pass: passPts, fail: failPts, conditional: condPts });

    // Only auto-update verdict if user has not manually overridden it
    if (!isVerdictManuallyOverridden) {
      setVerdict(computed);
    }
  }, [wizardIsCanvas, wizardLayoutBlocks, calPoints, calTolerance, isVerdictManuallyOverridden]);

  // Auto-calculate next calibration due date based on frequency
  useEffect(() => {
    if (calDate && selectedInstrument?.frequency) {
      const match = selectedInstrument.frequency.match(/(\d+)\s*(MONTH|YEAR|DAY)S?/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const unit = match[2].toUpperCase();
        
        try {
          let newDate = parseISO(calDate);
          if (unit === "MONTH") {
            newDate = addMonths(newDate, num);
          } else if (unit === "YEAR") {
            newDate = addMonths(newDate, num * 12);
          }
          // Note: DAYS could be added if date-fns addDays is imported, but typically it's MONTH/YEAR
          
          setNextCalDate(format(newDate, "yyyy-MM-dd"));
        } catch (e) {
          console.error("Error parsing date", e);
        }
      }
    }
  }, [calDate, selectedInstrument?.frequency]);

  // Save calibration and move to certificate step
  const handleSaveAndContinue = async () => {
    if (!selectedInstrument || !selectedType) {
      toast.error("Please select an instrument and type");
      return;
    }

    if (!effectiveReceiptCondition) {
      toast.error("Gauge Receipt Condition is mandatory. Please select or enter a condition.");
      return;
    }

    // Prompt user to save as a new template variant ONLY IF original template was modified
    if (checkIsTemplateModified()) {
      setTemplateModifiedModalOpen(true);
      return;
    }

    // Otherwise proceed directly without asking ("default save instrument master don't ask")
    await executeSaveAndContinue();
  };

  async function executeSaveAndContinue() {
    if (!selectedInstrument || !selectedType) return;
    if (isEditMode && !canAccess("calibrations", "edit")) {
      toast.error("You do not have permission to edit calibrations");
      return;
    }
    if (!isEditMode && !canAccess("calibrations", "create")) {
      toast.error("You do not have permission to create calibrations");
      return;
    }
    setSaving(true);
    try {
      const data = {
        instrument_id: selectedInstrument.id,
        calibration_date: calDate,
        certificate_issue_date: certIssueDate || calDate,
        calibration_type: selectedType.type,
        reference_standards: referenceStandards.filter(r => r.name || r.id),
        environmental_conditions: {
          temperature: envTemp,
          humidity: envHumidity,
          soaking_time: envSoakingTime || undefined,
          soaking_start_time: envSoakingStartTime || undefined,
          soaking_end_time: envSoakingEndTime || undefined,
          receipt_condition: effectiveReceiptCondition,
        },
        receipt_condition: effectiveReceiptCondition,
        doc_no: docNo || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_no : undefined) || undefined,
        doc_date: docDate || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_date : undefined) || undefined,
        doc_rev: docRev || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_rev : undefined) || undefined,
        procedure_reference: procedureNo || procedureReference || undefined,
        procedure_no: procedureNo || (selectedTemplateId && selectedTemplateId !== "none" ? (availableTemplates.find(t => t.id === selectedTemplateId) as any)?.procedure_no : undefined) || undefined,
        procedure_name: procedureName || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.procedure_name : undefined) || undefined,
        procedure_date: procedureDate || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.procedure_date : undefined) || undefined,
        procedure_rev: procedureRev || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.procedure_rev : undefined) || undefined,
        acceptance_criteria_doc_no: acceptanceCriteriaDocNo || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_doc_no : undefined) || undefined,
        acceptance_criteria_date: acceptanceCriteriaDate || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_date : undefined) || undefined,
        acceptance_criteria_rev: acceptanceCriteriaRev || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_rev : undefined) || undefined,
        acceptance_criteria_reference: acceptanceCriteriaReference || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_reference : undefined) || undefined,
        standard_reference: standardReference || remarks || undefined,
        is_canvas_template: wizardIsCanvas,
        layout_blocks: wizardIsCanvas ? wizardLayoutBlocks : undefined,
        calibration_points: calPoints,
        custom_columns: wizardCustomColumns,
        standard_columns_config: wizardStandardColumnConfigs,
        column_order: wizardColumnOrder,
        hidden_columns: wizardHiddenColumns,
        template_id: selectedTemplateId && selectedTemplateId !== "none" ? selectedTemplateId : undefined,
        template_name: selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.name : undefined,
        decimal_places: wizardDecimalPlaces,
        acceptance_criteria: wizardAcceptanceCriteria,
        diagram_image: wizardDiagramImage ? wizardDiagramImage : "",
        diagram_image_width: wizardDiagramWidth,
        diagram_image_height: wizardDiagramHeight,
        diagram_image_alignment: wizardDiagramAlignment,
        uncertainty,
        verdict,
        remarks,
        status_rule_type: statusRuleType,
        status_formula: statusFormula,
        calibrated_by: calibratedBy,
        calibrated_by_designation: calibratedByDesignation,
        calibrated_by_signature: calibratedBySignature,
        reviewed_by: reviewedBy,
        reviewed_by_designation: reviewedByDesignation,
        reviewed_by_signature: reviewedBySignature,
        approved_by: approvedBy,
        approved_by_designation: approvedByDesignation,
        approved_by_signature: approvedBySignature,
        ulr_enabled: ulrEnabled,
        next_calibration_date: nextCalDate || undefined,
        companyId: user?.companyId,
        created_by: user?.id,
      };

      let savedId = savedCalibrationId;
      if (isEditMode && savedCalibrationId) {
        await updateCalibration(
          savedCalibrationId,
          data as any,
          user?.id,
          user?.name || user?.email || "User",
        );
        toast.success("Calibration updated & certificate regenerated!");
      } else {
        const saved = await createCalibration(data as any);
        savedId = saved.id;
        setSavedCalibrationId(saved.id);
        setNextCertNumber(saved.certificate_number || nextCertNumber);
        if (saved.ulr_number) setNextUlrNumber(saved.ulr_number);

        if (activeDraftId) {
          await deleteDraft(activeDraftId).catch(console.error);
          setActiveDraftId(null);
          draftIdRef.current = null;
        }

        toast.success("Calibration saved successfully!");
      }

      // Default: silently auto-persist specifications, diagram, doc info & env to Instrument Master ("default save instrument master don't ask")
      const updatedCustomParams = getCustomParametersPayload();
      if (selectedInstrument && updatedCustomParams) {
        await httpClient.patch(`/instruments/${selectedInstrument.id}`, {
          custom_parameters: updatedCustomParams,
        }).catch(console.error);

        setSelectedInstrument(prev => prev ? {
          ...prev,
          custom_parameters: updatedCustomParams,
        } : prev);
      }

      setCertificateGenerated(false);
      
      // Delete draft after successful save
      if (activeDraftId) {
        deleteDraft(activeDraftId).catch(console.error);
      }
      
      setStep(4); // Move to certificate step
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save calibration");
    } finally {
      setSaving(false);
    }
  }

  // Generate certificate
  const handleGenerateCertificate = async () => {
    if (!savedCalibrationId) {
      toast.error("Please save the calibration first");
      return;
    }
    setCertLoading(true);
    try {
      const blob = await generateCertificate(savedCalibrationId);
      // Download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Certificate-${nextCertNumber.replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setCertificateGenerated(true);
      toast.success("Certificate generated and downloaded!");
    } catch (err: any) {
      toast.error("Failed to generate certificate");
    } finally {
      setCertLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Certificate-${nextCertNumber.replace(/\//g, "-")}`,
    pageStyle: "@page { size: A4 portrait; margin: 0; } body { margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }",
  });

  const handleWizardCanvasCellChange = (
    blockIndex: number,
    isSplit: boolean,
    childIndex: number,
    rowIndex: number,
    colId: string,
    val: any
  ) => {
    const updatedBlocks = JSON.parse(JSON.stringify(wizardLayoutBlocks));
    let targetTbl: any;
    if (isSplit) {
      targetTbl = updatedBlocks[blockIndex].children[childIndex];
    } else {
      targetTbl = updatedBlocks[blockIndex];
    }

    if (!targetTbl || !targetTbl.rows) return;

    const row = { ...targetTbl.rows[rowIndex], [colId]: val };

    const tol = parseFloat(String(row.tolerance ?? targetTbl.tolerance ?? 0.02)) || 0.02;
    const dec = targetTbl.decimal_places !== undefined ? targetTbl.decimal_places : (wizardDecimalPlaces || 3);

    // If editing a specification / required_dimension, dynamically parse nominal & tolerance limits
    const isSpecCol =
      colId === "required_dimension" ||
      colId === "specification" ||
      colId === "spec" ||
      colId === "description" ||
      colId === "nominal" ||
      /spec|dimension/i.test(colId) ||
      Boolean(targetTbl.columns?.some((c: any) => c && c.id === colId && /spec|dimension/i.test(c.label || c.id || "")));

    if (isSpecCol) {
      const specText = String(val ?? "").trim();
      const parsed = parseSpecification(specText, targetTbl.unit || "mm", tol, dec);
      if (parsed.isValid) {
        row.nominal = parsed.nominal;
        row.lower_tolerance = parsed.lowerTolerance;
        row.upper_tolerance = parsed.upperTolerance;
        row.lower_limit = parsed.lowerLimit;
        row.upper_limit = parsed.upperLimit;
        row.lowerLimit = parsed.lowerLimit;
        row.upperLimit = parsed.upperLimit;
      }
    }

    // Clean stale sibling aliases if editing a trial/reading column
    const trialMatch = String(colId).match(/^(?:t|trial_|trial|reading_|reading|actual_|actual|observed_|observed|r|col_)?([1-9]|1[0-9]|20)$/i);
    if (trialMatch) {
      const idx = trialMatch[1];
      const aliases = [
        `t${idx}`, `trial_${idx}`, `trial${idx}`, `reading_${idx}`, `reading${idx}`,
        `actual_${idx}`, `actual${idx}`, `observed_${idx}`, `observed${idx}`, `r${idx}`, `col_${idx}`, idx
      ];
      aliases.forEach((a) => {
        row[a] = val;
      });
    }

    // Clean phantom reading fields if not in table columns
    if (!targetTbl.columns.some((c: any) => c.id === "actual")) delete row.actual;
    if (!targetTbl.columns.some((c: any) => c.id === "actual_dimension")) delete row.actual_dimension;
    if (!targetTbl.columns.some((c: any) => c.id === "reading")) delete row.reading;

    // Deterministic formula evaluation (topological order, formula string parsing, blank propagation)
        const evaluatedRow = evaluateCanvasRowFormulas(row, targetTbl.columns, tol, dec, targetTbl.nominal);

    targetTbl.rows[rowIndex] = evaluatedRow;
    setWizardLayoutBlocks(updatedBlocks);
  };

  const handleWizardCanvasAddRow = (
    blockIndex: number,
    isSplit: boolean = false,
    childIndex: number = 0
  ) => {
    const updatedBlocks = JSON.parse(JSON.stringify(wizardLayoutBlocks));
    let targetTbl: any;
    if (isSplit) {
      targetTbl = updatedBlocks[blockIndex]?.children?.[childIndex];
    } else {
      targetTbl = updatedBlocks[blockIndex];
    }
    if (!targetTbl || !targetTbl.rows) return;

    const newPointNum = targetTbl.rows.length + 1;
    const newRow: any = {
      point_number: newPointNum,
      required_dimension: "",
      description: `Point ${newPointNum}`,
      nominal: 0,
      unit: targetTbl.unit || calUnit || "mm",
      tolerance: targetTbl.tolerance ?? calTolerance ?? 0.02,
      actual: "",
      reading: "",
      deviation: "-",
      error: undefined,
      status: "-",
      judgement: "-",
    };

    const tol = parseFloat(String(newRow.tolerance ?? targetTbl.tolerance ?? 0.02)) || 0.02;
    const dec = targetTbl.decimal_places !== undefined ? targetTbl.decimal_places : (wizardDecimalPlaces || 3);
        const evaluatedRow = evaluateCanvasRowFormulas(newRow, targetTbl.columns || [], tol, dec, targetTbl.nominal);

    targetTbl.rows.push(evaluatedRow);
    setWizardLayoutBlocks(updatedBlocks);
    toast.success(`Added parameter row ${newPointNum}`);
  };

  const handleWizardCanvasAddStatementRow = (
    blockIndex: number,
    isSplit: boolean = false,
    childIndex: number = 0
  ) => {
    setWizardLayoutBlocks((prevBlocks: any[]) => {
      if (!prevBlocks || prevBlocks.length === 0) return prevBlocks;
      const updatedBlocks = JSON.parse(JSON.stringify(prevBlocks));
      const targetTbl = isSplit
        ? updatedBlocks[blockIndex]?.children?.[childIndex]
        : updatedBlocks[blockIndex];
      if (!targetTbl) return prevBlocks;
      if (!targetTbl.rows) targetTbl.rows = [];

      const newPointNum = targetTbl.rows.length + 1;
      const newRow: any = {
        point_number: newPointNum,
        is_merged: true,
        isMerged: true,
        statement: "All the jaws are free from dent and damages",
        merged_text: "All the jaws are free from dent and damages",
        description: "All the jaws are free from dent and damages",
      };
      targetTbl.rows.push(newRow);
      return updatedBlocks;
    });
    toast.success("Added statement row");
  };

  const handleWizardCanvasStatementChange = (
    blockIndex: number,
    isSplit: boolean,
    childIndex: number,
    rowIndex: number,
    text: string
  ) => {
    setWizardLayoutBlocks((prevBlocks: any[]) => {
      if (!prevBlocks || prevBlocks.length === 0) return prevBlocks;
      const updatedBlocks = JSON.parse(JSON.stringify(prevBlocks));
      const targetTbl = isSplit
        ? updatedBlocks[blockIndex]?.children?.[childIndex]
        : updatedBlocks[blockIndex];
      if (!targetTbl || !targetTbl.rows || !targetTbl.rows[rowIndex]) return prevBlocks;

      const row = targetTbl.rows[rowIndex];
      row.statement = text;
      row.merged_text = text;
      row.description = text;
      row.required_dimension = text;
      return updatedBlocks;
    });
  };

  const handleWizardCanvasDeleteRow = (
    blockIndex: number,
    isSplit: boolean = false,
    childIndex: number = 0,
    rowIndex: number = 0
  ) => {
    const updatedBlocks = JSON.parse(JSON.stringify(wizardLayoutBlocks));
    let targetTbl: any;
    if (isSplit) {
      targetTbl = updatedBlocks[blockIndex]?.children?.[childIndex];
    } else {
      targetTbl = updatedBlocks[blockIndex];
    }
    if (!targetTbl || !targetTbl.rows || targetTbl.rows.length <= 1) {
      toast.error("Table must have at least 1 specification row");
      return;
    }

    targetTbl.rows.splice(rowIndex, 1);
    targetTbl.rows.forEach((r: any, idx: number) => {
      r.point_number = idx + 1;
    });

    setWizardLayoutBlocks(updatedBlocks);
    toast.info(`Deleted row ${rowIndex + 1}`);
  };

  const renderWizardTableGrid = (tbl: any, bIdx: number, isSplit: boolean = false, cIdx: number = 0) => {
    const effOrientation = getEffectiveTableOrientation(tbl);
    if (effOrientation === "horizontal") {
      const displayCols = tbl.columns.filter((c: any) => c.id !== "point_number" && c.id !== "sl_no" && c.id !== "sino");
      const dec = tbl.decimal_places !== undefined ? tbl.decimal_places : 3;

      return (
        <div key={tbl.id || `${bIdx}_${cIdx}`} className="border rounded-lg overflow-hidden bg-card shadow-xs">
          <div className="bg-muted/70 px-3 py-1.5 border-b flex items-center justify-between">
            <span className="font-bold text-xs flex items-center gap-1.5">
              <Table className="w-3.5 h-3.5 text-primary" />
              {tbl.title}
            </span>
                        <div className="flex items-center gap-2">
              {tbl.nominal !== undefined && tbl.nominal !== "" && (
                <Badge variant="outline" className="text-2xs font-semibold px-2 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800">
                  Nominal: {tbl.nominal} {tbl.unit || "mm"}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground font-mono">
                Unit: {tbl.unit || "mm"} • Tol: ±{tbl.tolerance ?? "0.005"}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead className="bg-muted/95 z-10">
                <tr className="bg-muted/40 font-bold border-b divide-x text-[10.5px]">
                  <th className="py-1 px-2 text-left w-48 min-w-[150px] bg-muted/60 sticky left-0 z-20">
                    Parameter / Sl no
                  </th>
                  {tbl.rows.map((r: any, rIdx: number) => (
                    <th key={rIdx} className="py-1 px-1.5 min-w-[50px] font-bold text-foreground">
                      {r.point_number ?? (rIdx + 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y font-mono text-xs">
                {displayCols.map((col: any) => (
                  <tr key={col.id} className="divide-x hover:bg-muted/20">
                    <td className="py-1 px-2 text-left font-bold text-foreground bg-muted/30 sticky left-0 z-10 whitespace-nowrap text-[11px]">
                      {col.label}
                    </td>
                    {tbl.rows.map((row: any, rIdx: number) => {
                      const colDec = col.decimal_places ?? col.decimalPrecision ?? tbl.decimal_places ?? 3;
                      if (col.type === "nominal" || col.type === "number") {
                        const rawCell = row[col.id] !== undefined && row[col.id] !== null && row[col.id] !== ""
                          ? row[col.id]
                          : (col.id === "nominal" || col.id === "nom" ? row.nominal : "");
                        const val = rawCell !== undefined && rawCell !== null && rawCell !== ""
                          ? (!isNaN(Number(rawCell)) ? Number(rawCell).toFixed(colDec) : String(rawCell))
                          : "-";
                        return (
                          <td key={rIdx} className="py-0.5 px-1 font-bold text-foreground text-[11px]">
                            {val}
                          </td>
                        );
                      }
                      if (col.type === "text") {
                        return (
                          <td key={rIdx} className="py-0.5 px-1 font-medium text-[11px]">
                            {row.description || row[col.id] || "-"}
                          </td>
                        );
                      }
                      if (
                        col.type === "trial" ||
                        col.type === "reading" ||
                        col.role === "READING" ||
                        col.dataType === "MEASUREMENT" ||
                        (col.role as string) === "MEASUREMENT" ||
                        col.semanticRole === "READING" ||
                        col.semanticRole === "TRIAL" ||
                        /actual|reading|trial|observed/i.test(col.id) ||
                        /actual|reading|trial|observed/i.test(col.label || "")
                      ) {
                        return (
                          <td key={rIdx} className="p-0.5 min-w-[52px]">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={row[col.id] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                  handleWizardCanvasCellChange(
                                    bIdx,
                                    isSplit,
                                    cIdx,
                                    rIdx,
                                    col.id,
                                    v
                                  );
                                }
                              }}
                              onBlur={(e) => {
                                const raw = e.target.value.trim();
                                if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                const parsed = parseFloat(raw);
                                if (!isNaN(parsed)) {
                                  const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                  handleWizardCanvasCellChange(bIdx, isSplit, cIdx, rIdx, col.id, formatted);
                                }
                              }}
                              className="h-6 text-[11px] text-center font-mono font-semibold py-0 px-1 w-full min-w-[48px]"
                              placeholder={colDec === 0 ? "0" : (0).toFixed(colDec)}
                            />
                          </td>
                        );
                      }
                      const cellRaw = row[col.id] ?? row.status ?? "-";
                      const cellStr = String(cellRaw).trim().toUpperCase();
                      const isJudgementCol =
                        col.type === "status" ||
                        col.role === "JUDGEMENT" ||
                        /judg|verdict|status/i.test(col.label || col.id) ||
                        cellStr === "PASS" ||
                        cellStr === "FAIL" ||
                        cellStr === "OK" ||
                        cellStr === "REJECT";

                      if (isJudgementCol) {
                        const st = cellRaw !== undefined && cellRaw !== null && cellRaw !== "" ? cellRaw : "-";
                        const isPass = cellStr === "PASS" || cellStr === "OK";
                        const isFail = cellStr === "FAIL" || cellStr === "REJECT";
                        return (
                          <td key={rIdx} className="py-0.5 px-1">
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-bold py-0 px-1 ${
                                isPass
                                  ? "border-emerald-500 text-emerald-600 bg-emerald-500/10"
                                  : isFail
                                    ? "border-red-500 text-red-600 bg-red-500/10"
                                    : "border-border text-muted-foreground bg-muted"
                              }`}
                            >
                              {st}
                            </Badge>
                          </td>
                        );
                      }
                      if (col.type === "formula") {
                        const val = row[col.id] ?? "-";
                        return (
                          <td key={rIdx} className="py-0.5 px-1 font-bold text-foreground text-[11px]">
                            {val}
                          </td>
                        );
                      }
                      return (
                        <td key={rIdx} className="py-0.5 px-1 text-[11px]">
                          {row[col.id] !== undefined && row[col.id] !== null ? String(row[col.id]) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tbl.footerNote && (
            <div className="p-1.5 text-[10px] italic bg-muted/20 border-t text-center text-muted-foreground">
              {tbl.footerNote}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={tbl.id || `${bIdx}_${cIdx}`} className="border rounded-lg overflow-hidden bg-card shadow-xs">
        <div className="bg-muted/70 px-3 py-1.5 border-b flex items-center justify-between">
          <span className="font-bold text-xs flex items-center gap-1.5">
            <Table className="w-3.5 h-3.5 text-primary" />
            {tbl.title}
          </span>
                    <div className="flex items-center gap-2">
            {tbl.nominal !== undefined && tbl.nominal !== "" && (
              <Badge variant="outline" className="text-2xs font-semibold px-2 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800">
                Nominal: {tbl.nominal} {tbl.unit || "mm"}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground font-mono">
              Unit: {tbl.unit || "mm"} • Tol: ±{tbl.tolerance ?? "0.02"}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead className="sticky top-0 bg-muted/95 z-10 backdrop-blur-xs">
              <tr className="bg-muted/30 font-semibold border-b divide-x text-[10px]">
                {tbl.columns.map((col: any) => (
                  <th key={col.id} style={{ width: col.width }} className="py-1 px-1.5">
                    {col.label}
                  </th>
                ))}
                <th className="w-9 py-1 px-1 text-center font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y font-mono text-xs">
              {(() => {
                const coveredCells = getCoveredCells(tbl.rows, tbl.columns);
                return tbl.rows.map((row: any, rIdx: number) => {
                if (row.is_merged || row.isMerged) {
                  const statementVal =
                    row.statement ??
                    row.merged_text ??
                    row.description ??
                    row.required_dimension ??
                    "All the jaws are free from dent and damages";
                  return (
                    <tr
                      key={rIdx}
                      className="divide-x bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/30"
                    >
                      <td className="py-1 px-1 font-semibold text-muted-foreground text-[11px] bg-amber-100/40 dark:bg-amber-950/40 text-center">
                        {row.point_number ?? rIdx + 1}
                      </td>
                      <td
                        colSpan={Math.max(1, tbl.columns.length - 1)}
                        className="py-1 px-2 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[9px] py-0 px-1 font-bold bg-amber-100 text-amber-900 border-amber-300 shrink-0"
                          >
                            Statement
                          </Badge>
                          <Input
                            type="text"
                            value={statementVal}
                            onChange={(e) =>
                              handleWizardCanvasStatementChange(
                                bIdx,
                                isSplit,
                                cIdx,
                                rIdx,
                                e.target.value,
                              )
                            }
                            className="h-6 text-[11px] font-medium bg-background px-2 w-full"
                          />
                        </div>
                      </td>
                      <td className="p-0.5 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            handleWizardCanvasDeleteRow(
                              bIdx,
                              isSplit,
                              cIdx,
                              rIdx,
                            )
                          }
                          title="Delete row"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={rIdx} className="divide-x hover:bg-muted/20">
                  {tbl.columns.map((col: any, colIdx: number) => {
                    if (coveredCells.has(`${rIdx}_${col.id}`)) {
                      return null;
                    }
                    const spanInfo = row.cellSpans?.[col.id];
                    const span = spanInfo?.colSpan || 1;
                    const rSpan = spanInfo?.rowSpan || 1;
                    const isMerged = span > 1 || rSpan > 1;

                    const isPointNo = col.id === "point_number" || col.id === "sl_no" || col.id === "sino";
                    if (isPointNo) {
                      return (
                        <td
                          key={col.id}
                          colSpan={span > 1 ? span : undefined}
                          rowSpan={rSpan > 1 ? rSpan : undefined}
                          className="py-0.5 px-1 font-semibold text-muted-foreground text-[11px]"
                        >
                          {row.point_number ?? row[col.id] ?? (rIdx + 1)}
                        </td>
                      );
                    }
                    // MERGED CELL (span > 1 || rSpan > 1) across parameter columns
                    if (isMerged) {
                      const cellVal = row[col.id] !== undefined && row[col.id] !== null && row[col.id] !== ""
                        ? row[col.id]
                        : (col.id === "nominal" ? row.nominal : "") ?? "";
                      const isReadingOrTrial =
                        col.type === "trial" ||
                        col.type === "reading" ||
                        col.role === "READING" ||
                        col.dataType === "MEASUREMENT" ||
                        /actual|reading|trial|observed/i.test(col.id) ||
                        /actual|reading|trial|observed/i.test(col.label || "");

                      return (
                        <td
                          key={col.id}
                          colSpan={span > 1 ? span : undefined}
                          rowSpan={rSpan > 1 ? rSpan : undefined}
                          className="py-1 px-1.5 font-bold text-center bg-amber-50/40 dark:bg-amber-950/20 text-foreground text-xs align-middle"
                        >
                          {isReadingOrTrial ? (
                            rSpan > 1 ? (
                              <div className="flex flex-col items-center justify-center gap-1 w-full h-full min-h-[44px] py-1">
                                <div className="flex items-center gap-1 flex-wrap justify-center">
                                  {span > 1 && (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 text-[9px] py-0 px-1 font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border-amber-300"
                                    >
                                      {span} Cols
                                    </Badge>
                                  )}
                                  {rSpan > 1 && (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 text-[9px] py-0 px-1 font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 border-indigo-300"
                                    >
                                      {rSpan} Rows
                                    </Badge>
                                  )}
                                </div>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={row[col.id] ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                      handleWizardCanvasCellChange(
                                        bIdx,
                                        isSplit,
                                        cIdx,
                                        rIdx,
                                        col.id,
                                        v
                                      );
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const raw = e.target.value.trim();
                                    if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                    const parsed = parseFloat(raw);
                                    if (!isNaN(parsed)) {
                                      const colDec = col.decimal_places ?? col.decimalPrecision ?? (tbl.decimal_places !== undefined ? tbl.decimal_places : 3);
                                      const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                      handleWizardCanvasCellChange(bIdx, isSplit, cIdx, rIdx, col.id, formatted);
                                    }
                                  }}
                                  className="h-6 text-[11px] text-center font-mono font-semibold py-0 px-1.5 w-full"
                                  placeholder="0.000"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 w-full justify-center">
                                {span > 1 && (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-[9px] py-0 px-1 font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border-amber-300"
                                  >
                                    {span} Cols
                                  </Badge>
                                )}
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={row[col.id] ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                      handleWizardCanvasCellChange(
                                        bIdx,
                                        isSplit,
                                        cIdx,
                                        rIdx,
                                        col.id,
                                        v
                                      );
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const raw = e.target.value.trim();
                                    if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                                    const parsed = parseFloat(raw);
                                    if (!isNaN(parsed)) {
                                      const colDec = col.decimal_places ?? col.decimalPrecision ?? (tbl.decimal_places !== undefined ? tbl.decimal_places : 3);
                                      const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                      handleWizardCanvasCellChange(bIdx, isSplit, cIdx, rIdx, col.id, formatted);
                                    }
                                  }}
                                  className="h-6 text-[11px] text-center font-mono font-semibold py-0 px-2 flex-1 min-w-[50px]"
                                  placeholder="0.000"
                                />
                              </div>
                            )
                          ) : (
                            rSpan > 1 ? (
                              <div className="flex flex-col items-center justify-center gap-1 w-full h-full min-h-[44px] py-1">
                                <div className="flex items-center gap-1 flex-wrap justify-center">
                                  {span > 1 && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] py-0 px-1 font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border-amber-300 shrink-0"
                                    >
                                      {span} Cols
                                    </Badge>
                                  )}
                                  {rSpan > 1 && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] py-0 px-1 font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 border-indigo-300 shrink-0"
                                    >
                                      {rSpan} Rows
                                    </Badge>
                                  )}
                                </div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs">
                                  {cellVal || "-"}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5">
                                {span > 1 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] py-0 px-1 font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border-amber-300 shrink-0"
                                  >
                                    {span} Cols
                                  </Badge>
                                )}
                                <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs">
                                  {cellVal || "-"}
                                </span>
                              </div>
                            )
                          )}
                        </td>
                      );
                    }
                    const colDec = col.decimal_places ?? col.decimalPrecision ?? (tbl.decimal_places !== undefined ? tbl.decimal_places : 3);
                    if (col.type === "nominal" || col.type === "number") {
                      const rawCell = row[col.id] !== undefined && row[col.id] !== null && row[col.id] !== ""
                        ? row[col.id]
                        : (col.id === "nominal" || col.id === "nom" ? row.nominal : "");
                      const val = rawCell !== undefined && rawCell !== null && rawCell !== ""
                        ? (!isNaN(Number(rawCell)) ? Number(rawCell).toFixed(colDec) : String(rawCell))
                        : "-";
                      return (
                        <td key={col.id} className="py-0.5 px-1.5 font-bold text-foreground text-[11px]">
                          {val}
                        </td>
                      );
                    }
                    if (col.type === "text") {
                      const isSpecCol = col.id === "required_dimension" || col.id === "description" || col.id === "specification" || col.id === "spec" || /spec|dimension/i.test(col.label || "");
                      if (isSpecCol) {
                        return (
                          <td key={col.id} className="p-0.5 min-w-[130px]">
                            <Textarea
                              value={row[col.id] || row.required_dimension || row.description || ""}
                              onChange={(e) => {
                                handleWizardCanvasCellChange(
                                  bIdx,
                                  isSplit,
                                  cIdx,
                                  rIdx,
                                  col.id,
                                  e.target.value
                                );
                              }}
                              rows={String(row[col.id] || row.required_dimension || "").includes("\n") ? 2 : 1}
                              className="min-h-[26px] py-1 px-1.5 text-[11px] font-mono leading-tight resize-y bg-background/50 hover:bg-background focus:bg-background transition-colors text-left w-full"
                              placeholder="e.g. 55.10-0.025"
                            />
                          </td>
                        );
                      }
                      return (
                        <td key={col.id} className="py-0.5 px-1.5 font-medium text-left pl-2 text-[11px]">
                          {row.description || row[col.id] || (row.point_number ?? (rIdx + 1))}
                        </td>
                      );
                    }
                    if (
                      col.type === "trial" ||
                      col.type === "reading" ||
                      col.role === "READING" ||
                      col.dataType === "MEASUREMENT" ||
                      (col.role as string) === "MEASUREMENT" ||
                      col.semanticRole === "READING" ||
                      col.semanticRole === "TRIAL" ||
                      /actual|reading|trial|observed/i.test(col.id) ||
                      /actual|reading|trial|observed/i.test(col.label || "")
                    ) {
                      return (
                        <td key={col.id} className="p-0.5">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={row[col.id] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "" || /^[+-]?\d*\.?\d*$/.test(v)) {
                                handleWizardCanvasCellChange(
                                  bIdx,
                                  isSplit,
                                  cIdx,
                                  rIdx,
                                  col.id,
                                  v
                                );
                              }
                            }}
                            onBlur={(e) => {
                              const raw = e.target.value.trim();
                              if (raw === "" || raw === "-" || raw === "+" || raw === ".") return;
                              const parsed = parseFloat(raw);
                              if (!isNaN(parsed)) {
                                const formatted = colDec === 0 ? String(Math.round(parsed)) : parsed.toFixed(colDec);
                                handleWizardCanvasCellChange(bIdx, isSplit, cIdx, rIdx, col.id, formatted);
                              }
                            }}
                            className="h-6 text-[11px] text-center font-mono font-semibold py-0 px-1"
                            placeholder={colDec === 0 ? "0" : (0).toFixed(colDec)}
                          />
                        </td>
                      );
                    }
                    const cellRaw = row[col.id] ?? row.status ?? "-";
                    const cellStr = String(cellRaw).trim().toUpperCase();
                    const isJudgementCol =
                      col.type === "status" ||
                      col.role === "JUDGEMENT" ||
                      /judg|verdict|status/i.test(col.label || col.id) ||
                      cellStr === "PASS" ||
                      cellStr === "FAIL" ||
                      cellStr === "OK" ||
                      cellStr === "REJECT";

                    if (isJudgementCol) {
                      const st = cellRaw !== undefined && cellRaw !== null && cellRaw !== "" ? cellRaw : "-";
                      const isPass = cellStr === "PASS" || cellStr === "OK";
                      const isFail = cellStr === "FAIL" || cellStr === "REJECT";
                      return (
                        <td key={col.id} className="py-0.5 px-1">
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-bold py-0 px-1.5 ${
                              isPass
                                ? "border-emerald-500 text-emerald-600 bg-emerald-500/10"
                                : isFail
                                  ? "border-red-500 text-red-600 bg-red-500/10"
                                  : "border-border text-muted-foreground bg-muted"
                            }`}
                          >
                            {st}
                          </Badge>
                        </td>
                      );
                    }
                    if (col.type === "formula") {
                      const val = row[col.id] ?? "-";
                      return (
                        <td key={col.id} className="py-0.5 px-1 font-bold text-foreground text-[11px]">
                          {val}
                        </td>
                      );
                    }
                    return <td key={col.id} className="py-0.5 px-1 text-[11px]">{row[col.id] !== undefined && row[col.id] !== null ? String(row[col.id]) : "-"}</td>;
                  })}
                  <td className="p-0.5 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleWizardCanvasDeleteRow(bIdx, isSplit, cIdx, rIdx)}
                      title="Delete parameter row"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              );
            });
            })()}
            </tbody>
          </table>
        </div>
        <div className="bg-muted/30 px-3 py-1.5 border-t flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 font-medium border-dashed border-primary/40 hover:bg-primary/5 text-primary"
              onClick={() => handleWizardCanvasAddRow(bIdx, isSplit, cIdx)}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Parameter Row ({tbl.rows.length + 1})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 font-medium border-dashed border-amber-500/40 hover:bg-amber-500/5 text-amber-700 dark:text-amber-400"
              onClick={() => handleWizardCanvasAddStatementRow(bIdx, isSplit, cIdx)}
            >
              <Merge className="w-3.5 h-3.5" />
              Add Statement Row
            </Button>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            {tbl.rows.length} {tbl.rows.length === 1 ? "row" : "rows"} configured
          </span>
        </div>
        {tbl.footerNote && (
          <div className="p-1.5 text-[10px] italic bg-muted/20 border-t text-center text-muted-foreground">
            {tbl.footerNote}
          </div>
        )}
      </div>
    );
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedInstrument && !!selectedType;
      case 1: return true; // Reference standard is optional
      case 2: {
        const hasPoints = wizardIsCanvas ? wizardLayoutBlocks.length > 0 : calPoints.length > 0;
        const hasReceipt = receiptCondition === "CUSTOM" ? !!customReceiptCondition.trim() : !!receiptCondition;
        return hasPoints && hasReceipt;
      }
      case 3: return true;
      default: return true;
    }
  };

  if (isInitializing || editLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Progress Steps Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border">
              <Skeleton className="h-5 w-5 rounded-full shrink-0" />
              <Skeleton className="h-3 w-20 hidden sm:block" />
            </div>
          ))}
        </div>

        {/* Step Content Card Skeleton */}
        <Card className="border rounded-xl shadow-xs overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Step Summaries Skeleton */}
            <div className="space-y-3">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>

            {/* Template Selector Bar Skeleton */}
            <div className="p-4 border rounded-xl bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>

            {/* Inputs Row Skeleton */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[260px] space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="w-48 sm:w-56 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="w-24 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="w-24 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="w-28 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>

            {/* Table Grid Skeleton */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b pb-3">
                <Skeleton className="h-8 w-44" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                    <Skeleton className="h-5 w-6" />
                    <Skeleton className="h-6 flex-1" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/calibration")} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">New Calibration</h1>
          <p className="text-sm text-muted-foreground">Complete the calibration process step by step</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="w-full bg-card/80 backdrop-blur-md border border-border/80 p-2 rounded-2xl shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isCompleted = i < step;
            return (
              <button
                key={i}
                type="button"
                disabled={!isCompleted && i > step}
                onClick={() => {
                  if (isCompleted || i <= step) {
                    setStep(i);
                  }
                }}
                className={cn(
                  "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 text-left border shadow-2xs",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/20 scale-[1.01]"
                    : isCompleted
                    ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15 cursor-pointer"
                    : "bg-muted/30 border-border/60 text-muted-foreground opacity-75 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-transform duration-200 shadow-2xs",
                    isCompleted
                      ? "bg-emerald-500 text-white"
                      : isActive
                      ? "bg-white text-primary font-black"
                      : "bg-background border border-border text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono tracking-wider uppercase block opacity-70">Step {i + 1}</span>
                  <span className="font-bold truncate text-xs block leading-snug">{s}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ── Collapsible Step 1 & Step 2 Summaries for Step 3 (step 2) & Step 4 (step 3) ── */}
          {(step === 2 || step === 3) && (
            <div className="space-y-3 mb-6">
              {/* Step 1 Summary Card */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-xs border-muted-foreground/20">
                <button
                  type="button"
                  onClick={() => setStep1Collapsed(!step1Collapsed)}
                  className="w-full flex items-center justify-between p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Step 1: Instrument</span>
                        {selectedType && (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold">
                            {selectedType.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {selectedInstrument ? `${selectedInstrument.name} (${selectedInstrument.id_code})` : "No instrument selected"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span>{step1Collapsed ? "View Details" : "Hide Details"}</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", !step1Collapsed && "rotate-180")} />
                  </div>
                </button>

                {!step1Collapsed && selectedInstrument && (
                  <div className="p-4 border-t bg-card text-xs grid grid-cols-2 sm:grid-cols-5 gap-3 animate-in fade-in-50 duration-200">
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Instrument Name</span><span className="font-semibold text-sm">{selectedInstrument.name}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">ID Code</span><span className="font-medium">{selectedInstrument.id_code}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Make</span><span className="font-medium">{selectedInstrument.make || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Range</span><span className="font-medium">{selectedInstrument.range || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Least Count</span><span className="font-medium">{selectedInstrument.least_count || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Serial No</span><span className="font-medium">{selectedInstrument.serial_no || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Location</span><span className="font-medium">{selectedInstrument.location || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Calibration Type</span><span className="font-medium text-primary">{selectedType?.label || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">DOC (Last Cal)</span><span className="font-medium">{formatDisplayDate(selectedInstrument.last_calibration_date)}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Due Date</span><span className="text-amber-600 dark:text-amber-400 font-semibold">{formatDisplayDate(selectedInstrument.due_date || selectedInstrument.next_due_date)}</span></div>
                  </div>
                )}
              </div>

              {/* Step 2 Summary Card */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-xs border-muted-foreground/20">
                <button
                  type="button"
                  onClick={() => setStep2Collapsed(!step2Collapsed)}
                  className="w-full flex items-center justify-between p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Step 2: Reference Standard</span>
                      <p className="text-sm font-semibold text-foreground">
                        {referenceStandards.filter(r => r.name || r.id).length > 0
                          ? referenceStandards.filter(r => r.name || r.id).map(r => r.name || r.id).join(", ")
                          : "Standard / In-house Reference"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span>{step2Collapsed ? "View Details" : "Hide Details"}</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", !step2Collapsed && "rotate-180")} />
                  </div>
                </button>

                {!step2Collapsed && (
                  <div className="p-4 border-t bg-card text-xs space-y-3 animate-in fade-in-50 duration-200">
                    {referenceStandards.map((ref, idx) => (
                      <div key={idx} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                        <div className="font-semibold text-xs text-primary flex items-center justify-between">
                          <span>Reference Standard {idx + 1}: {ref.name || "Default Standard"}</span>
                          {ref.id && <Badge variant="secondary" className="text-[10px]">{ref.id}</Badge>}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div><span className="text-muted-foreground block text-[10px]">Traceable To</span><span className="font-medium">{ref.traceable_to || "NABL Accredited Lab"}</span></div>
                          <div><span className="text-muted-foreground block text-[10px]">Validity</span><span className="font-medium">{ref.validity ? formatDisplayDate(ref.validity) : "-"}</span></div>
                          <div><span className="text-muted-foreground block text-[10px]">Range</span><span className="font-medium">{ref.range || "-"}</span></div>
                          <div><span className="text-muted-foreground block text-[10px]">Least Count</span><span className="font-medium">{ref.least_count || "-"}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 3 Summary Card (Shown in Step 4) */}
              {step === 3 && (
                <div className="border rounded-xl bg-card overflow-hidden shadow-xs border-muted-foreground/20">
                  <button
                    type="button"
                    onClick={() => setStep3Collapsed(!step3Collapsed)}
                    className="w-full flex items-center justify-between p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Step 3: Calibration Data</span>
                        <p className="text-sm font-semibold text-foreground">
                          {calPoints.length} Test Points • Unit: {calUnit || "mm"} {procedureNo || procedureReference ? `• Proc: ${procedureNo || procedureReference}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span>{step3Collapsed ? "View Details" : "Hide Details"}</span>
                      <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", !step3Collapsed && "rotate-180")} />
                    </div>
                  </button>

                  {!step3Collapsed && (
                    <div className="p-4 border-t bg-card text-xs space-y-3 animate-in fade-in-50 duration-200">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs bg-muted/20 p-2.5 rounded-lg border">
                        <div><span className="text-muted-foreground block text-[10px]">Procedure No</span><span className="font-medium">{procedureNo || procedureReference || "-"}</span></div>
                        <div><span className="text-muted-foreground block text-[10px]">Doc. No.</span><span className="font-medium">{docNo || "-"}</span></div>
                        <div><span className="text-muted-foreground block text-[10px]">Temperature</span><span className="font-medium">{envTemp ? `${envTemp}°C` : "-"}</span></div>
                        <div><span className="text-muted-foreground block text-[10px]">Humidity</span><span className="font-medium">{envHumidity ? `${envHumidity}%` : "-"}</span></div>
                        <div><span className="text-muted-foreground block text-[10px]">Soaking Time</span><span className="font-medium text-primary">{envSoakingTime || (envSoakingStartTime && envSoakingEndTime ? `${envSoakingStartTime} - ${envSoakingEndTime}` : "-")}</span></div>
                      </div>

                      {calPoints.length > 0 && (
                        <div className="border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-muted text-muted-foreground font-semibold sticky top-0 text-[10px] uppercase">
                              <tr>
                                <th className="p-2 border-b border-r">Pt</th>
                                <th className="p-2 border-b border-r">Description</th>
                                <th className="p-2 border-b border-r">Nominal ({calUnit})</th>
                                <th className="p-2 border-b border-r">Actual ({calUnit})</th>
                                <th className="p-2 border-b border-r">Error ({calUnit})</th>
                                <th className="p-2 border-b">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {calPoints.map((pt, i) => (
                                <tr key={i} className="hover:bg-muted/30">
                                  <td className="p-2 border-r font-medium text-center">{pt.point_number || i + 1}</td>
                                  <td className="p-2 border-r">{pt.description || `Point ${i + 1}`}</td>
                                  <td className="p-2 border-r font-mono">{pt.nominal ?? (pt as any).nominal_value ?? "-"}</td>
                                  <td className="p-2 border-r font-mono">{pt.ascending_reading ?? (pt as any).actual_reading ?? "-"}</td>
                                  <td className="p-2 border-r font-mono">{pt.error ?? "-"}</td>
                                  <td className="p-2">
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                                      pt.status?.toUpperCase() === "PASS" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                                    )}>
                                      {pt.status || "PASS"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* ═══ Step 1: Select Instrument ═══ */}
          {step === 0 && (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID code, serial number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10"
                />
                {searching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {searchResults.map((inst) => (
                    <div
                      key={inst.id}
                      onClick={() => handleInstrumentSelect(inst)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedInstrument?.id === inst.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium text-sm">{inst.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">({inst.id_code})</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{inst.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {inst.make && <span>Make: {inst.make}</span>}
                        {inst.range && <span>Range: {inst.range}</span>}
                        {inst.location && <span>Location: {inst.location}</span>}
                        {inst.last_calibration_date && <span>DOC: {formatDisplayDate(inst.last_calibration_date)}</span>}
                        {inst.due_date && <span className="text-amber-600 dark:text-amber-400 font-medium">Due Date: {formatDisplayDate(inst.due_date)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Instrument Details */}
              {selectedInstrument && (
                <div className="border rounded-lg p-4 bg-primary/5">
                  <h4 className="font-semibold text-sm mb-2">Selected Instrument</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Name</span><span className="font-semibold">{selectedInstrument.name}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">ID Code</span><span className="font-medium">{selectedInstrument.id_code}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Make</span><span className="font-medium">{selectedInstrument.make || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Range</span><span className="font-medium">{selectedInstrument.range || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Least Count</span><span className="font-medium">{selectedInstrument.least_count || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Serial No</span><span className="font-medium">{selectedInstrument.serial_no || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Location</span><span className="font-medium">{selectedInstrument.location || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Calibration Type</span><span className="font-medium text-primary">{selectedType?.label || selectedInstrument.item_type || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">DOC (Last Cal Date)</span><span className="font-medium">{formatDisplayDate(selectedInstrument.last_calibration_date)}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Due Date</span><span className="text-amber-600 dark:text-amber-400 font-semibold">{formatDisplayDate(selectedInstrument.due_date || selectedInstrument.next_due_date)}</span></div>
                  </div>
                </div>
              )}

              {/* Instrument Type */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Select Calibration Type</Label>
                <InstrumentTypeSelector
                  selectedType={selectedType?.type || ""}
                  onSelect={(type) => {
                    setSelectedType(type);
                    setCalUnit(type.defaultUnit);
                  }}
                />
              </div>
            </>
          )}

          {/* ═══ Step 2: Reference Standard ═══ */}
          {step === 1 && (
            <div className="space-y-6">
              {referenceStandards.map((ref, index) => (
                <div key={index} className="relative p-4 border rounded-xl bg-card">
                  {referenceStandards.length > 1 && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-2 top-2 h-6 w-6 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        const newRefs = [...referenceStandards];
                        newRefs.splice(index, 1);
                        setReferenceStandards(newRefs);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <h4 className="font-semibold text-sm mb-4">Reference Standard {index + 1}</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Choose from Master Instrument */}
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs text-primary font-semibold">Select from Master Inventory (Optional)</Label>
                      <Select 
                        value={masterStandards.find(m => m.id === ref.id || m.id_code === ref.id || (ref.name && m.name.toLowerCase() === ref.name.toLowerCase()))?.id || ""}
                        onValueChange={(val) => {
                          const master = masterStandards.find(m => m.id === val);
                          if (master) {
                            const initialCertNo = master.cert_no || master.traceable || (master as any).certificate_no || (master as any).cert_number || (master as any).calibration_agency || master.id_code || master.id || "";
                            const newRefs = [...referenceStandards];
                            newRefs[index] = {
                              ...newRefs[index],
                              name: master.name,
                              make: master.make || (master as any).manufacturer || (master as any).brand || "",
                              id: master.id_code || master.id || "",
                              range: master.range || "",
                              least_count: master.least_count || "",
                              validity: master.due_date ? toLocalYyyyMmDd(master.due_date) : "",
                              traceable_to: initialCertNo,
                              cert_no: initialCertNo,
                            };
                            setReferenceStandards(newRefs);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full bg-primary/5">
                          <SelectValue placeholder="-- Select a Master Instrument to auto-fill --" />
                        </SelectTrigger>
                        <SelectContent>
                          {masterStandards.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name} ({m.id_code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Reference Standard Name</Label>
                      <Input 
                        value={ref.name} 
                        onChange={(e) => {
                          const newRefs = [...referenceStandards];
                          newRefs[index].name = e.target.value;
                          setReferenceStandards(newRefs);
                        }} 
                        placeholder="e.g., Dead Weight Tester" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">ID / Serial Number</Label>
                      <Input 
                        value={ref.id} 
                        onChange={(e) => {
                          const newRefs = [...referenceStandards];
                          newRefs[index].id = e.target.value;
                          setReferenceStandards(newRefs);
                        }} 
                        placeholder="e.g., DWT-001" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Traceable To (NABL Lab / Cert No)</Label>
                      <Input 
                        value={ref.traceable_to || ref.cert_no || ""} 
                        onChange={(e) => {
                          const newRefs = [...referenceStandards];
                          newRefs[index].traceable_to = e.target.value;
                          newRefs[index].cert_no = e.target.value;
                          setReferenceStandards(newRefs);
                        }} 
                        placeholder="e.g., NABL Cert 12345" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Validity / Due Date</Label>
                      <YearMonthDatePicker
                        value={ref.validity ? toLocalYyyyMmDd(ref.validity) : ""}
                        onChange={(newDate) => {
                          const newRefs = [...referenceStandards];
                          newRefs[index].validity = newDate;
                          setReferenceStandards(newRefs);
                        }}
                        placeholder="Select validity date"
                        className="h-9 text-xs"
                        formatPattern="dd-MMM-yyyy"
                        clearable
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setReferenceStandards([...referenceStandards, { name: "", id: "", traceable_to: "", cert_no: "", validity: "" }])}
                className="w-full text-xs font-semibold border-dashed"
              >
                + Add Another Reference Standard
              </Button>
            </div>
          )}

          {/* ═══ Step 3: Calibration Data ═══ */}
          {step === 2 && selectedType && (
            <>
              {/* Calibration Template Selector */}
              <div className="space-y-2 bg-primary/5 p-3.5 rounded-xl border border-primary/20 mb-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Calibration Template
                  </Label>
                  {selectedType && (
                    <span className="text-[10px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border">
                      {selectedType.label}
                    </span>
                  )}
                </div>

                <Popover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={templatePopoverOpen}
                      className="w-full justify-between h-9 text-xs bg-background hover:bg-muted/50 border-border/70 shadow-2xs font-medium"
                    >
                      {selectedTemplateId && selectedTemplateId !== "none" ? (
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-foreground truncate">
                            {availableTemplates.find((t) => t.id === selectedTemplateId)?.name}
                          </span>
                          {availableTemplates.find((t) => t.id === selectedTemplateId)?.instrument_type && (
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                              ({availableTemplates.find((t) => t.id === selectedTemplateId)?.instrument_type})
                            </span>
                          )}
                          <Badge variant="secondary" className="text-[9px] font-mono shrink-0">
                            {availableTemplates.find((t) => t.id === selectedTemplateId)?.calibration_points?.length || 0} points
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-medium">
                          {availableTemplates.length > 0
                            ? "-- None / Custom (No Template Selected) --"
                            : "-- No Templates Found (Using Custom Grid) --"}
                        </span>
                      )}
                      <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl border-border/80 rounded-xl overflow-hidden">
                    <div className="p-2 border-b bg-muted/40 flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        placeholder="Filter templates..."
                        value={templateSearchQuery}
                        onChange={(e) => setTemplateSearchQuery(e.target.value)}
                        className="w-full bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y">
                      <div
                        onClick={() => {
                          handleApplyTemplate("none");
                          setTemplatePopoverOpen(false);
                          setTemplateSearchQuery("");
                        }}
                        className={cn(
                          "p-2.5 text-xs cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between",
                          (!selectedTemplateId || selectedTemplateId === "none") && "bg-primary/10 font-bold text-primary"
                        )}
                      >
                        <div>
                          <p className="font-medium text-foreground">Custom / Manual Data Entry</p>
                          <p className="text-[10px] text-muted-foreground">Do not use a saved template structure</p>
                        </div>
                        {(!selectedTemplateId || selectedTemplateId === "none") && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </div>

                      {availableTemplates
                        .filter(t => !templateSearchQuery || t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) || t.instrument_type?.toLowerCase().includes(templateSearchQuery.toLowerCase()))
                        .map((tpl) => {
                          const isSelected = selectedTemplateId === tpl.id;
                          return (
                            <div
                              key={tpl.id}
                              onClick={() => {
                                handleApplyTemplate(tpl.id);
                                setTemplatePopoverOpen(false);
                                setTemplateSearchQuery("");
                              }}
                              className={cn(
                                "p-2.5 text-xs cursor-pointer hover:bg-primary/5 transition-colors flex items-center justify-between",
                                isSelected && "bg-primary/10 font-bold text-primary"
                              )}
                            >
                              <div>
                                <p className="font-semibold text-foreground">{tpl.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  {tpl.instrument_type} • {tpl.calibration_points?.length || 0} test points
                                </p>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </div>
                          );
                        })}

                      {/* Standard System Presets (LF Gauge Standard, Micrometer, Caliper, etc.) */}
                      <div className="bg-muted/60 px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t">
                        Standard System Presets
                      </div>
                      {CANVAS_PRESETS
                        .filter(p => !templateSearchQuery || p.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) || p.instrumentType.toLowerCase().includes(templateSearchQuery.toLowerCase()))
                        .map((preset) => {
                          const isSelected = selectedTemplateId === preset.id;
                          return (
                            <div
                              key={preset.id}
                              onClick={() => {
                                handleApplyTemplate(preset.id);
                                setTemplatePopoverOpen(false);
                                setTemplateSearchQuery("");
                              }}
                              className={cn(
                                "p-2.5 text-xs cursor-pointer hover:bg-primary/5 transition-colors flex items-center justify-between",
                                isSelected && "bg-primary/10 font-bold text-primary"
                              )}
                            >
                              <div>
                                <p className="font-semibold text-foreground flex items-center gap-1.5">
                                  <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                                  <span>{preset.name}</span>
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  {preset.instrumentType} • {preset.blocks.length} sections
                                </p>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </div>
                          );
                        })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* ═══ Collapsible Document, Procedure & Environmental Metadata ═══ */}
              {(() => {
                const metadataFields = [
                  { label: "Receipt Condition", value: receiptCondition === "CUSTOM" ? customReceiptCondition : receiptCondition, required: true },
                  { label: "Standard Reference", value: standardReference },
                  { label: "Template Doc No", value: docNo },
                  { label: "Doc Date", value: docDate },
                  { label: "Doc Rev", value: docRev },
                  { label: "Temp (°C)", value: envTemp },
                  { label: "Humidity (%)", value: envHumidity },
                  { label: "Procedure No", value: procedureNo },
                  { label: "Procedure Name", value: procedureName },
                  { label: "Rev", value: procedureRev },
                  { label: "Date", value: procedureDate },
                  { label: "Acceptance Criteria Doc No", value: acceptanceCriteriaDocNo },
                  { label: "Criteria Rev", value: acceptanceCriteriaRev },
                  { label: "Criteria Date", value: acceptanceCriteriaDate },
                  { label: "Criteria Ref", value: acceptanceCriteriaReference },
                  { label: "Soaking Time", value: envSoakingTime },
                ];
                const emptyMetadataFields = metadataFields.filter((f) => !f.value || !String(f.value).trim());
                const emptyMetadataCount = emptyMetadataFields.length;
                const isReceiptConditionEmpty = !receiptCondition || (receiptCondition === "CUSTOM" && !customReceiptCondition?.trim());

                return (
                  <div className="border rounded-xl bg-card overflow-hidden shadow-xs border-muted-foreground/20 mb-4">
                    <button
                      type="button"
                      onClick={() => setMetadataCollapsed(!metadataCollapsed)}
                      className="w-full flex items-center justify-between p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                      aria-expanded={!metadataCollapsed}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                            isReceiptConditionEmpty
                              ? "bg-rose-500 text-white"
                              : emptyMetadataCount > 0
                              ? "bg-amber-500 text-white"
                              : "bg-emerald-500 text-white"
                          )}
                        >
                          {isReceiptConditionEmpty ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : emptyMetadataCount > 0 ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                              SOP, Environmental &amp; Document Properties
                            </span>
                            {isReceiptConditionEmpty && (
                              <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-rose-500" />
                                Receipt Condition Required *
                              </Badge>
                            )}
                            {emptyMetadataCount > 0 ? (
                              <Badge
                                variant="outline"
                                title={`Empty fields: ${emptyMetadataFields.map(f => f.label).join(", ")}`}
                                className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold flex items-center gap-1 cursor-help"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                {emptyMetadataCount} Empty {emptyMetadataCount === 1 ? "Field" : "Fields"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                All Parameters Filled
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-medium text-foreground mt-0.5">
                            {effectiveReceiptCondition ? `${effectiveReceiptCondition}` : "No Receipt Condition"}
                            {(envTemp || envHumidity) && ` • ${envTemp || "--"}°C / ${envHumidity || "--"}%`}
                            {procedureNo && ` • SOP: ${procedureNo}`}
                            {docNo && ` • Doc: ${docNo}`}
                          </p>
                          {emptyMetadataCount > 0 && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-normal mt-0.5">
                              <span className="font-semibold">Empty:</span>{" "}
                              {emptyMetadataFields.map((f) => f.label).slice(0, 4).join(", ")}
                              {emptyMetadataCount > 4 && ` +${emptyMetadataCount - 4} more`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0">
                        <span>{metadataCollapsed ? "View Details" : "Hide Details"}</span>
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", !metadataCollapsed && "rotate-180")} />
                      </div>
                    </button>

                    {!metadataCollapsed && (
                      <div className="p-3.5 border-t bg-card space-y-3 animate-in fade-in-50 duration-200">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="space-y-1.5 flex-1 min-w-[220px]">
                            <Label className="text-xs font-semibold">Standard Reference</Label>
                            <Input value={standardReference} onChange={(e) => setStandardReference(e.target.value)} placeholder="Standard calibration per ISO/IEC 17025" className="text-xs font-medium" />
                          </div>
                          <div className="space-y-1.5 min-w-[210px]">
                            <Label className="text-xs font-semibold flex items-center gap-1">
                              Gauge Receipt Condition <span className="text-rose-500">*</span>
                            </Label>
                            <Select value={receiptCondition} onValueChange={(val) => setReceiptCondition(val)}>
                              <SelectTrigger className="text-xs font-medium bg-background h-9">
                                <SelectValue placeholder="Select Condition" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NO DENT & DAMAGE (OK)">NO DENT & DAMAGE (OK)</SelectItem>
                                <SelectItem value="SATISFACTORY">SATISFACTORY</SelectItem>
                                <SelectItem value="DENT & DAMAGE OBSERVED">DENT & DAMAGE OBSERVED</SelectItem>
                                <SelectItem value="CUSTOM">CUSTOM (Enter Condition...)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {receiptCondition === "CUSTOM" && (
                            <div className="space-y-1.5 min-w-[220px] flex-1">
                              <Label className="text-xs font-semibold text-foreground">Custom Receipt Condition <span className="text-rose-500">*</span></Label>
                              <Input
                                value={customReceiptCondition}
                                onChange={(e) => setCustomReceiptCondition(e.target.value)}
                                placeholder="e.g., No dent, measuring face OK"
                                className="text-xs font-medium h-9"
                              />
                            </div>
                          )}
                          <div className="space-y-1.5 w-36">
                            <Label className="text-xs font-semibold">Template Doc No</Label>
                            <Input value={docNo} onChange={(e) => setDocNo(e.target.value)} placeholder="e.g., DOC/CAL/01" className="text-xs font-medium" />
                          </div>
                          <div className="space-y-1.5 min-w-[130px] w-36">
                            <Label className="text-xs font-medium text-muted-foreground">Doc Date</Label>
                            <YearMonthDatePicker
                              value={docDate}
                              onChange={(newDate) => setDocDate(newDate)}
                              placeholder="DD-MM-YYYY"
                              className="text-xs font-medium h-9"
                              formatPattern="dd-MMM-yyyy"
                              clearable
                            />
                          </div>
                          <div className="space-y-1.5 w-20">
                            <Label className="text-xs font-medium text-muted-foreground">Doc Rev</Label>
                            <Input value={docRev} onChange={(e) => setDocRev(e.target.value)} placeholder="e.g. 3" className="text-xs font-medium text-center" />
                          </div>
                          <div className="space-y-1.5 w-24">
                            <Label className="text-xs font-medium">Temp (°C)</Label>
                            <Input value={envTemp} onChange={(e) => setEnvTemp(e.target.value)} placeholder="20" className="text-xs text-center font-medium" />
                          </div>
                          <div className="space-y-1.5 w-24">
                            <Label className="text-xs font-medium">Humidity (%)</Label>
                            <Input value={envHumidity} onChange={(e) => setEnvHumidity(e.target.value)} placeholder="55" className="text-xs text-center font-medium" />
                          </div>
                        </div>

                        {/* Procedure & Acceptance Criteria Details */}
                        <div className="pt-3 border-t border-border/70 grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="space-y-1 col-span-12 md:col-span-3">
                            <Label className="text-[11px] font-semibold text-foreground">Procedure No</Label>
                            <Input
                              value={procedureNo}
                              onChange={(e) => {
                                setProcedureNo(e.target.value);
                                setProcedureReference(e.target.value);
                              }}
                              placeholder="e.g. PC-01"
                              className="text-xs h-8 font-medium"
                            />
                          </div>
                          <div className="space-y-1 col-span-12 md:col-span-5">
                            <Label className="text-[11px] font-semibold text-foreground">Procedure Name</Label>
                            <Input
                              value={procedureName}
                              onChange={(e) => setProcedureName(e.target.value)}
                              placeholder="e.g. Master procedure"
                              className="text-xs h-8 font-medium"
                            />
                          </div>
                          <div className="space-y-1 col-span-6 md:col-span-2">
                            <Label className="text-[11px] font-semibold text-foreground">Rev</Label>
                            <Input
                              value={procedureRev}
                              onChange={(e) => setProcedureRev(e.target.value)}
                              placeholder="Rev"
                              className="text-xs h-8 font-medium text-center"
                            />
                          </div>
                          <div className="space-y-1 col-span-6 md:col-span-2">
                            <Label className="text-[11px] font-semibold text-foreground">Date</Label>
                            <YearMonthDatePicker
                              value={procedureDate}
                              onChange={(newDate) => setProcedureDate(newDate)}
                              placeholder="DD-MM-YYYY"
                              className="text-xs h-8 font-medium"
                              formatPattern="dd-MMM-yyyy"
                              clearable
                            />
                          </div>

                          <div className="space-y-1 col-span-12 md:col-span-4">
                            <Label className="text-[11px] font-semibold text-foreground">Acceptance Criteria Doc No</Label>
                            <Input value={acceptanceCriteriaDocNo} onChange={(e) => setAcceptanceCriteriaDocNo(e.target.value)} placeholder="e.g. D/QCM/GI/001/03" className="text-xs h-8 font-medium" />
                          </div>
                          <div className="space-y-1 col-span-12 md:col-span-8">
                            <Label className="text-[11px] font-semibold text-foreground">Criteria Rev &amp; Date / Ref</Label>
                            <div className="flex gap-1.5 items-center">
                              <Input value={acceptanceCriteriaRev} onChange={(e) => setAcceptanceCriteriaRev(e.target.value)} placeholder="Rev" className="text-xs h-8 w-14 shrink-0 font-medium text-center" />
                              <YearMonthDatePicker
                                value={acceptanceCriteriaDate}
                                onChange={(newDate) => setAcceptanceCriteriaDate(newDate)}
                                placeholder="Date"
                                className="text-xs h-8 w-40 min-w-[150px] shrink-0 font-medium"
                                formatPattern="dd-MMM-yyyy"
                                clearable
                              />
                              <Input value={acceptanceCriteriaReference} onChange={(e) => setAcceptanceCriteriaReference(e.target.value)} placeholder="Custom Ref Text" className="text-xs h-8 min-w-[120px] flex-1 font-medium" />
                            </div>
                          </div>
                        </div>

                        {/* Soaking Time Row */}
                        <div className="pt-2.5 border-t border-border/70 flex flex-wrap items-end gap-3">
                          <div className="space-y-1 w-32 sm:w-36">
                            <Label className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                              Soaking Start Time
                            </Label>
                            <TimePicker
                              value={envSoakingStartTime}
                              onChange={(val) => handleSoakingStartChange(val)}
                              placeholder="08:30"
                            />
                          </div>
                          <div className="space-y-1 w-32 sm:w-36">
                            <Label className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                              Soaking End Time
                            </Label>
                            <TimePicker
                              value={envSoakingEndTime}
                              onChange={(val) => handleSoakingEndChange(val)}
                              placeholder="10:30"
                            />
                          </div>
                          <div className="space-y-1 w-32 sm:w-36">
                            <Label className="text-[11px] text-primary font-bold flex items-center gap-1">
                              Soaking Time (hh:mm)
                            </Label>
                            <DurationPicker
                              value={envSoakingTime}
                              onChange={(val) => setEnvSoakingTime(val)}
                              placeholder="02:00"
                            />
                          </div>
                          {(envSoakingTime || envSoakingStartTime || envSoakingEndTime) && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium self-center mt-3">
                              ✓ Soaking details active
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ═══ Diagram / Schematic Image (Optional) Card ═══ */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-xs border-muted-foreground/20 mb-4">
                <button
                  type="button"
                  onClick={() => setDiagramCollapsed(!diagramCollapsed)}
                  className="w-full flex items-center justify-between p-3.5 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                  aria-expanded={!diagramCollapsed}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                        wizardDiagramImage ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                      )}
                    >
                      {wizardDiagramImage ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 text-primary" />
                          Diagram / Schematic Image (Optional)
                        </span>
                        {wizardDiagramImage ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Diagram Attached
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            No Diagram Uploaded
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-medium text-foreground mt-0.5">
                        {wizardDiagramImage
                          ? `${wizardDiagramWidth || 350}px × ${wizardDiagramHeight || 160}px • Align ${wizardDiagramAlignment || "center"}`
                          : "No schematic image uploaded yet for this calibration"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {wizardDiagramImage && (
                      <div className="hidden sm:flex items-center gap-1.5 mr-2" onClick={(e) => e.stopPropagation()}>
                        <img
                          src={wizardDiagramImage}
                          alt="Thumbnail"
                          className="w-7 h-7 object-contain rounded border border-muted bg-white shrink-0"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCertPreviewModal(true);
                          }}
                          className="h-6 px-2 text-[10px] gap-1 font-semibold text-primary border-primary/30 hover:bg-primary/5 shadow-2xs"
                          title="Open Full Certificate Preview"
                        >
                          <Eye className="w-3 h-3" />
                          Preview
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0">
                      <span>{diagramCollapsed ? "View Details" : "Hide Details"}</span>
                      <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", !diagramCollapsed && "rotate-180")} />
                    </div>
                  </div>
                </button>

                {!diagramCollapsed && (
                  <div className="p-4 border-t bg-card space-y-3 animate-in fade-in-50 duration-200">
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Upload an instrument schematic or measurement diagram to print on the certificate directly above the calibration results table.
                    </p>

                    {!wizardDiagramImage ? (
                      <div
                        tabIndex={0}
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
                          id="wizard-diagram-upload"
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
                              htmlFor="wizard-diagram-upload"
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
                      <div className="space-y-3 bg-muted/20 p-3 rounded-xl border">
                        {/* Live Preview Box */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                            <span className="font-semibold text-foreground">Live Certificate Preview</span>
                            <span className="font-mono text-[10px]">{wizardDiagramWidth || 350}px × {wizardDiagramHeight || 160}px • {wizardDiagramAlignment || "center"}</span>
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
                            className={`border rounded-lg bg-slate-50 dark:bg-slate-900 p-3 flex ${
                              wizardDiagramAlignment === 'left' ? 'justify-start' : wizardDiagramAlignment === 'right' ? 'justify-end' : 'justify-center'
                            } overflow-hidden min-h-[100px] max-h-[220px] items-center relative ${isDragOverDiagram ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                          >
                            <img
                              src={wizardDiagramImage}
                              alt="Diagram Preview"
                              style={{
                                width: `${wizardDiagramWidth || 350}px`,
                                maxHeight: `${wizardDiagramHeight || 160}px`,
                                objectFit: "contain",
                              }}
                              className="rounded border border-slate-300 dark:border-slate-700 bg-white shadow-xs"
                            />
                          </div>
                        </div>

                        {/* Size Sliders */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <Label className="text-[10px] text-muted-foreground">Width: <span className="font-mono font-bold text-foreground">{wizardDiagramWidth || 350}px</span></Label>
                            </div>
                            <input
                              type="range"
                              min={80}
                              max={540}
                              step={5}
                              value={wizardDiagramWidth || 350}
                              onChange={(e) => setWizardDiagramWidth(parseInt(e.target.value, 10))}
                              className="w-full accent-primary h-1.5 cursor-pointer"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <Label className="text-[10px] text-muted-foreground">Max Height: <span className="font-mono font-bold text-foreground">{wizardDiagramHeight || 160}px</span></Label>
                            </div>
                            <input
                              type="range"
                              min={40}
                              max={280}
                              step={5}
                              value={wizardDiagramHeight || 160}
                              onChange={(e) => setWizardDiagramHeight(parseInt(e.target.value, 10))}
                              className="w-full accent-primary h-1.5 cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Alignment & Actions Row */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t flex-wrap">
                          <div className="flex items-center gap-1">
                            <Label className="text-[10px] text-muted-foreground mr-1">Align:</Label>
                            <Button
                              type="button"
                              variant={wizardDiagramAlignment === "left" ? "default" : "outline"}
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setWizardDiagramAlignment("left")}
                              title="Align Left"
                            >
                              <AlignLeft className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant={wizardDiagramAlignment === "center" ? "default" : "outline"}
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setWizardDiagramAlignment("center")}
                              title="Align Center"
                            >
                              <AlignCenter className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant={wizardDiagramAlignment === "right" ? "default" : "outline"}
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setWizardDiagramAlignment("right")}
                              title="Align Right"
                            >
                              <AlignRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs gap-1 font-medium"
                              onClick={handleCopyImageToClipboard}
                              title="Copy Diagram Image to Clipboard"
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs gap-1 font-medium"
                              onClick={handlePasteFromClipboard}
                              title="Paste new image from Clipboard (or press Ctrl+V)"
                            >
                              <ClipboardPaste className="w-3 h-3" />
                              Paste
                            </Button>
                            <label
                              htmlFor="wizard-diagram-replace-upload"
                              className="cursor-pointer inline-flex items-center gap-1 text-xs h-7 px-2.5 border rounded-md hover:bg-muted font-medium"
                            >
                              <Upload className="w-3 h-3" />
                              Replace
                            </label>
                            <input
                              type="file"
                              id="wizard-diagram-replace-upload"
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
                              className="h-7 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                              onClick={() => {
                                setWizardDiagramImage(null);
                                toast.info("Diagram image removed");
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove
                            </Button>
                          </div>
                        </div>

                        {/* View in Full Certificate Preview Button */}
                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCertPreviewModal(true)}
                            className="w-full h-8 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/5 bg-primary/5 gap-2"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View in Full Certificate Preview
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ═══ Template Variant & Instrument Master Action Bar ═══ */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gradient-to-r from-muted/50 via-card to-muted/50 border rounded-xl shadow-xs mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold px-2 py-0.5 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Auto-saved to Instrument Master
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {selectedInstrument ? `Custom diagram & specifications save directly to ${selectedInstrument.id_code} on calibration completion` : "Specifications & drawing save automatically to instrument master"}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {selectedInstrument && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSaveToInstrumentMaster}
                      disabled={savingInstrumentCustom}
                      className="text-xs h-8 gap-1.5 border-primary/30 hover:bg-primary/5 text-primary font-medium"
                    >
                      {savingInstrumentCustom ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Save to Instrument Master
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => {
                      if (selectedInstrument) {
                        setNewTemplateName(`${selectedInstrument.name} - ${selectedInstrument.id_code} Variant`);
                      }
                      setSaveTemplateModalOpen(true);
                    }}
                    className="text-xs h-8 gap-1.5 shadow-xs font-semibold"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Save as New Template Variant
                  </Button>
                </div>
              </div>

              {wizardIsCanvas && wizardLayoutBlocks.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/20 p-2.5 rounded-lg text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="font-bold text-foreground">Canvas Template Data Entry ({wizardLayoutBlocks.length} Sections)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {selectedTemplateId && selectedTemplateId !== "none" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApplyTemplate(selectedTemplateId)}
                          className="h-6 text-[11px] px-2 gap-1 text-primary hover:bg-primary/20"
                          title="Reload layout blocks, values and merges directly from the saved template"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reload from Template
                        </Button>
                      )}
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        Readings calculate automatically based on template formulas
                      </span>
                    </div>
                  </div>

                  {wizardLayoutBlocks.map((block: any, bIdx: number) => {
                    if (block.type === "table_grid") {
                      return renderWizardTableGrid(block, bIdx, false, 0);
                    }
                    if (block.type === "split_row") {
                      return (
                        <div key={block.id || bIdx} className={`grid grid-cols-1 md:grid-cols-${block.children?.length || 2} gap-3`}>
                          {block.children?.map((child: any, cIdx: number) => {
                            const isBlank = !child || child.type === "blank" || child.type === "empty" || (child.type === "text_block" && !child.content?.trim());
                            return (
                              <div key={child?.id || cIdx}>
                                {child?.type === "table_grid" && renderWizardTableGrid(child, bIdx, true, cIdx)}
                                {child?.type === "text_block" && child.content?.trim() && (
                                  <div className="p-3 border rounded-lg bg-card text-xs font-medium text-center">
                                    {child.content}
                                  </div>
                                )}
                                {isBlank && <div className="hidden md:block" />}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    if (block.type === "matrix_table") {
                      return (
                        <div key={block.id || bIdx} className="border rounded-lg overflow-hidden bg-card shadow-xs">
                          <div className="bg-muted px-3 py-1.5 font-bold text-xs border-b">
                            {block.title} (Reference Matrix)
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-center border-collapse">
                              <thead>
                                {block.headers?.map((hRow: any[], hIdx: number) => (
                                  <tr key={hIdx} className="bg-muted/40 font-bold border-b divide-x text-[11px]">
                                    {hRow.map((cell: any, cIdx: number) => (
                                      <th key={cIdx} colSpan={cell.colSpan} rowSpan={cell.rowSpan} className="p-1.5">
                                        {cell.text}
                                      </th>
                                    ))}
                                  </tr>
                                ))}
                              </thead>
                              <tbody className="divide-y font-mono text-[11px]">
                                {block.rows?.map((row: any[], rIdx: number) => (
                                  <tr key={rIdx} className="divide-x hover:bg-muted/20">
                                    {row.map((cellVal: any, cIdx: number) => (
                                      <td key={cIdx} className="p-1.5">
                                        {cellVal}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    }
                    if (block.type === "text_block") {
                      return (
                        <div key={block.id || bIdx} className="p-3 border rounded-lg bg-card text-xs font-medium text-center">
                          {block.content}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ) : (
                <CalibrationDataGrid
                  typeConfig={selectedType}
                  points={calPoints}
                  onPointsChange={setCalPoints}
                  unit={calUnit}
                  onUnitChange={setCalUnit}
                  tolerance={calTolerance}
                  onToleranceChange={setCalTolerance}
                  initialCustomColumns={wizardCustomColumns}
                  initialStandardColumnConfigs={wizardStandardColumnConfigs}
                  initialColumnOrder={wizardColumnOrder}
                  initialHiddenColumns={wizardHiddenColumns}
                  initialDecimalPlaces={wizardDecimalPlaces}
                  acceptanceCriteria={wizardAcceptanceCriteria}
                  onCustomColumnsChange={setWizardCustomColumns}
                  onStandardColumnConfigsChange={setWizardStandardColumnConfigs}
                  onColumnOrderChange={setWizardColumnOrder}
                  onHiddenColumnsChange={setWizardHiddenColumns}
                  onDecimalPlacesChange={setWizardDecimalPlaces}
                  onAcceptanceCriteriaChange={setWizardAcceptanceCriteria}
                  initialStatusRuleType={statusRuleType}
                  initialStatusFormula={statusFormula}
                  onStatusRuleChange={(type, formula) => {
                    setStatusRuleType(type);
                    setStatusFormula(formula);
                  }}
                />
              )}
            </>
          )}

          {/* ═══ Step 4: Results & Verdict ═══ */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 flex flex-col">
                  <Label className="text-xs font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" /> Date of Calibration
                    </span>
                    {selectedInstrument?.due_date && (
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full" title="Previous Calibration Due Date Reference">
                        Prev Due: {formatDisplayDate(selectedInstrument.due_date)}
                      </span>
                    )}
                  </Label>
                  <YearMonthDatePicker
                    value={calDate}
                    onChange={(newDate) => {
                      setCalDate(newDate);
                      setCertIssueDate(newDate);
                    }}
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <Label className="text-xs font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" /> Next Calibration Due
                    </span>
                    {selectedInstrument?.frequency && (
                      <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {selectedInstrument.frequency}
                      </span>
                    )}
                  </Label>
                  <YearMonthDatePicker
                    value={nextCalDate}
                    onChange={(newDate) => setNextCalDate(newDate)}
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" /> Certificate Issue Date
                  </Label>
                  <YearMonthDatePicker
                    value={certIssueDate}
                    onChange={(newDate) => setCertIssueDate(newDate)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Measurement Uncertainty</Label>
                  <Input value={uncertainty} onChange={(e) => setUncertainty(e.target.value)} placeholder="e.g., ±0.03 Bar" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      Calibration Verdict
                      {isVerdictManuallyOverridden ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium text-amber-700 bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400">
                          Manual Override
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium text-primary bg-primary/5 border-primary/20 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-primary" /> Auto-evaluated
                        </Badge>
                      )}
                    </Label>
                    {isVerdictManuallyOverridden && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerdict(autoVerdict);
                          setIsVerdictManuallyOverridden(false);
                          toast.info(`Verdict reset to auto-evaluated (${autoVerdict})`);
                        }}
                        className="text-[11px] text-primary hover:text-primary/80 hover:underline flex items-center gap-1 font-semibold cursor-pointer transition-colors"
                        title="Reset to automatically calculated verdict based on calibration test points"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset to Auto ({autoVerdict})
                      </button>
                    )}
                  </div>
                  <Select
                    value={verdict}
                    onValueChange={(v) => {
                      const selectedVal = v as "PASS" | "FAIL" | "CONDITIONAL";
                      setVerdict(selectedVal);
                      if (selectedVal !== autoVerdict) {
                        setIsVerdictManuallyOverridden(true);
                      } else {
                        setIsVerdictManuallyOverridden(false);
                      }
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-10 text-xs font-semibold rounded-lg transition-all border shadow-2xs",
                        verdict === "PASS" &&
                          "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 focus:ring-emerald-500",
                        verdict === "FAIL" &&
                          "bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 focus:ring-rose-500",
                        verdict === "CONDITIONAL" &&
                          "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 focus:ring-amber-500"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {verdict === "PASS" && (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-bold tracking-wide">PASS</span>
                            <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-normal ml-1 hidden sm:inline">
                              &mdash; Conforms to Specifications
                            </span>
                          </>
                        )}
                        {verdict === "FAIL" && (
                          <>
                            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span className="font-bold tracking-wide">FAIL</span>
                            <span className="text-[11px] text-rose-700/80 dark:text-rose-400/80 font-normal ml-1 hidden sm:inline">
                              &mdash; Non-Conforming / Out of Tolerance
                            </span>
                          </>
                        )}
                        {verdict === "CONDITIONAL" && (
                          <>
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="font-bold tracking-wide">CONDITIONAL</span>
                            <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-normal ml-1 hidden sm:inline">
                              &mdash; Conditional Acceptance / Derated
                            </span>
                          </>
                        )}
                      </div>
                    </SelectTrigger>
                    <SelectContent className="p-1">
                      <SelectItem
                        value="PASS"
                        className="cursor-pointer py-2 focus:bg-emerald-50 dark:focus:bg-emerald-950/40 rounded-md my-0.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300">PASS</span>
                            <span className="text-[10px] text-muted-foreground">All measurement points conform to tolerance limits</span>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem
                        value="FAIL"
                        className="cursor-pointer py-2 focus:bg-rose-50 dark:focus:bg-rose-950/40 rounded-md my-0.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0">
                            <XCircle className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-xs text-rose-800 dark:text-rose-300">FAIL</span>
                            <span className="text-[10px] text-muted-foreground">One or more points exceed tolerance or instrument rejected</span>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem
                        value="CONDITIONAL"
                        className="cursor-pointer py-2 focus:bg-amber-50 dark:focus:bg-amber-950/40 rounded-md my-0.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-xs text-amber-800 dark:text-amber-300">CONDITIONAL</span>
                            <span className="text-[10px] text-muted-foreground">Derated accuracy, limited range, or conditional approval</span>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {verdictStats.total > 0 && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5 font-medium">
                      <span>Data telemetry:</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{verdictStats.pass} passed</span>
                      {verdictStats.fail > 0 && (
                        <>
                          <span>&bull;</span>
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">{verdictStats.fail} failed</span>
                        </>
                      )}
                      {verdictStats.conditional > 0 && (
                        <>
                          <span>&bull;</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">{verdictStats.conditional} conditional</span>
                        </>
                      )}
                      <span>out of {verdictStats.total} test points</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Remarks</Label>
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Any observations or notes..." rows={3} />
              </div>

              {/* Signatories */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Signatories</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Calibrated By (Engineer / Admin Selection) */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Calibrated By</Label>
                    {(() => {
                      const userRoleStr = getRoleName(user?.role);
                      const isAdmin = userRoleStr.toLowerCase().includes("admin") || userRoleStr === "Admin" || userRoleStr === "Administrator";
                      return isAdmin ? (
                        <Select
                          value={systemUsers.find((u) => u.name === calibratedBy || u.id === calibratedBy)?.id || calibratedBy}
                          onValueChange={(val) => {
                            const selectedUser = systemUsers.find((u) => u.id === val || u.name === val);
                            if (selectedUser) {
                              setCalibratedBy(selectedUser.name);
                              setCalibratedByDesignation(selectedUser.designation || getRoleName(selectedUser.role) || "Calibration Engineer");
                              if (selectedUser.signature) {
                                setCalibratedBySignature(selectedUser.signature);
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs font-semibold bg-background">
                            <SelectValue placeholder="Select Calibration Engineer" />
                          </SelectTrigger>
                          <SelectContent>
                            {systemUsers.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name} ({getRoleName(u.designation) || getRoleName(u.role) || "Engineer"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={calibratedBy || user?.name || "Calibration Engineer"}
                          readOnly
                          className="bg-muted/40 font-semibold cursor-not-allowed text-xs h-9"
                        />
                      );
                    })()}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-950/50 rounded-md border border-sky-200 dark:border-sky-800 text-xs shadow-sm">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Designation:</span>
                      <span className="font-bold text-sky-950 dark:text-sky-100 uppercase tracking-wide text-[11px]">
                        {getRoleName(calibratedByDesignation) || getRoleName(user?.role) || "CALIBRATION ENGINEER"}
                      </span>
                    </div>
                  </div>

                  {/* Reviewed By (Pending Manager Review) */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Reviewed By</Label>
                    <Input
                      value={reviewedBy || "Pending Review"}
                      readOnly
                      className="bg-muted/20 text-muted-foreground italic cursor-not-allowed text-xs h-9"
                    />
                    <span className="text-[10px] text-muted-foreground block">Will be assigned upon Quality Review</span>
                  </div>

                  {/* Approved By (Captured automatically on Approval) */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Approved By</Label>
                    <Input
                      value={approvedBy || "Pending Approval"}
                      readOnly
                      className="bg-muted/20 text-muted-foreground italic cursor-not-allowed text-xs h-9"
                    />
                    <span className="text-[10px] text-muted-foreground block">Captured automatically when Manager Approves</span>
                  </div>
                </div>
              </div>

              {/* ULR Toggle - moved here so it's part of the save */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="ulr-pre-toggle"
                    checked={ulrEnabled}
                    onChange={(e) => setUlrEnabled(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <Label htmlFor="ulr-pre-toggle" className="text-sm cursor-pointer">
                    Enable ULR Number <span className="text-muted-foreground">(optional)</span>
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Step 5: Certificate ═══ */}
          {step === 4 && (
            <div className="space-y-6">
              <UlrGate
                ulrEnabled={ulrEnabled}
                onUlrEnabledChange={setUlrEnabled}
                nextCertNumber={nextCertNumber}
                nextUlrNumber={nextUlrNumber}
                certificateGenerated={certificateGenerated}
                onGenerateCertificate={handleGenerateCertificate}
                onPrint={handlePrint}
                loading={certLoading}
              />

              {/* Certificate Preview */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Certificate Preview</h4>
                <div className="flex justify-center" ref={printRef}>
                  <CertificatePreview
                    calibration={{
                      instrument: selectedInstrument as any,
                      certificate_number: nextCertNumber,
                      ulr_number: ulrEnabled ? nextUlrNumber : undefined,
                      calibration_date: calDate,
                      certificate_issue_date: certIssueDate || calDate,
                      next_calibration_date: nextCalDate,
                      reference_standards: referenceStandards,
                      reference_standard_name: referenceStandards[0]?.name,
                      reference_standard_id: referenceStandards[0]?.id,
                      reference_standard_traceable_to: referenceStandards[0]?.traceable_to,
                      reference_standard_validity: referenceStandards[0]?.validity,
                      environmental_conditions: {
                        temperature: envTemp,
                        humidity: envHumidity,
                        soaking_time: envSoakingTime || undefined,
                        soaking_start_time: envSoakingStartTime || undefined,
                        soaking_end_time: envSoakingEndTime || undefined,
                      },
                      doc_no: docNo || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_no : undefined) || undefined,
                      doc_date: docDate || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_date : undefined) || undefined,
                      doc_rev: docRev || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_rev : undefined) || undefined,
                      procedure_reference: procedureNo || procedureReference || undefined,
                      procedure_no: procedureNo || (selectedTemplateId && selectedTemplateId !== "none" ? (availableTemplates.find(t => t.id === selectedTemplateId) as any)?.procedure_no : undefined) || undefined,
                      procedure_name: procedureName || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.procedure_name : undefined) || undefined,
                      procedure_date: procedureDate || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.procedure_date : undefined) || undefined,
                      procedure_rev: procedureRev || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.procedure_rev : undefined) || undefined,
                      acceptance_criteria_doc_no: acceptanceCriteriaDocNo || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_doc_no : undefined) || undefined,
                      acceptance_criteria_date: acceptanceCriteriaDate || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_date : undefined) || undefined,
                      acceptance_criteria_rev: acceptanceCriteriaRev || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_rev : undefined) || undefined,
                      acceptance_criteria_reference: acceptanceCriteriaReference || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_reference : undefined) || undefined,
                      standard_reference: standardReference || remarks,
                      is_canvas_template: wizardIsCanvas,
                      layout_blocks: wizardIsCanvas ? wizardLayoutBlocks : undefined,
                      calibration_points: calPoints,
                      uncertainty,
                      verdict,
                      remarks,
                      calibrated_by: calibratedBy,
                      calibrated_by_designation: calibratedByDesignation,
                      calibrated_by_signature: calibratedBySignature,
                      reviewed_by: reviewedBy,
                      reviewed_by_designation: reviewedByDesignation,
                      reviewed_by_signature: reviewedBySignature,
                      approved_by: approvedBy,
                      approved_by_designation: approvedByDesignation,
                      approved_by_signature: approvedBySignature,
                      column_order: wizardColumnOrder,
                      hidden_columns: wizardHiddenColumns,
                      custom_columns: wizardCustomColumns as any,
                      standard_columns_config: wizardStandardColumnConfigs,
                      acceptance_criteria: wizardAcceptanceCriteria,
                      diagram_image: wizardDiagramImage || undefined,
                      diagram_image_width: wizardDiagramWidth,
                      diagram_image_height: wizardDiagramHeight,
                      diagram_image_alignment: wizardDiagramAlignment,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="gap-2"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : step === 3 ? (
          <Button
            onClick={handleSaveAndContinue}
            disabled={saving}
            className="gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save & Generate Certificate
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => navigate("/calibration")}
            className="gap-2"
          >
            Done
          </Button>
        )}
      </div>

      {/* ═══ Recently Calibrated Warning Alert Modal ═══ */}
      <Dialog open={recentCalModalOpen} onOpenChange={setRecentCalModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              Instrument Recently Calibrated
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-sm text-foreground">
              <p>
                Notice: <strong>{pendingSelectedInstrument?.name}</strong> ({pendingSelectedInstrument?.id_code}) was already calibrated recently.
              </p>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-1 text-xs font-medium">
                <div><span className="text-muted-foreground">Previous Calibration Date:</span> <strong>{recentCalDetails?.lastCalDate ? formatDisplayDate(recentCalDetails.lastCalDate) : "Recent"}</strong></div>
                <div><span className="text-muted-foreground">Current Due Date:</span> <strong>{recentCalDetails?.dueDate ? formatDisplayDate(recentCalDetails.dueDate) : "N/A"}</strong></div>
              </div>
              <p className="text-xs text-muted-foreground">
                Are you sure you want to perform another calibration for this instrument?
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setRecentCalModalOpen(false);
              setPendingSelectedInstrument(null);
            }}>
              Cancel
            </Button>
            <Button variant="default" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
              if (pendingSelectedInstrument) {
                proceedWithInstrumentSelect(pendingSelectedInstrument);
              }
              setRecentCalModalOpen(false);
            }}>
              Proceed with Calibration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Modal for Saving New Template Variant ═══ */}
      <Dialog open={saveTemplateModalOpen} onOpenChange={setSaveTemplateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Copy className="w-4 h-4 text-primary" />
              Save as New Template Variant
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create a new reusable calibration template variant containing all current points, diagram image, document metadata, and environmental parameters without affecting the original master template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Template Variant Name</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., LF Gauge - Part 41311-076CL Variant"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description (Optional)</Label>
              <Textarea
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Specific calibration template variant for gauge drawing number..."
                className="text-xs h-20"
              />
            </div>

            <div className="p-3 bg-muted/40 rounded-lg text-[11px] space-y-1 text-muted-foreground border">
              <p className="font-semibold text-foreground">Included in this Template Variant:</p>
              <p>• {calPoints.length} Specification / Calibration Points</p>
              <p>• Gauge Diagram Image ({wizardDiagramImage ? "Attached" : "None"})</p>
              <p>• Document &amp; Procedure Metadata ({docNo || procedureNo || "Defined"})</p>
              <p>• Environmental Defaults ({envTemp ? `${envTemp}°C` : "Default"})</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSaveTemplateModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAsNewTemplate}
              disabled={savingTemplateVariant || !newTemplateName.trim()}
              className="text-xs gap-1.5"
            >
              {savingTemplateVariant ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save Template Variant
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Modal for Full Certificate Preview ═══ */}
      <Dialog open={showCertPreviewModal} onOpenChange={setShowCertPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-primary">
                <Eye className="w-5 h-5" />
                Full Certificate Preview
              </span>
              <Badge variant="outline" className="text-xs">
                {selectedInstrument?.id_code || "Draft"}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Live preview of how the final calibration certificate will look when printed, including layout, diagram image, and calibration points.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 flex justify-center bg-slate-100 dark:bg-slate-900/60 p-4 rounded-xl border min-h-[400px]">
            <CertificatePreview
              calibration={{
                instrument: selectedInstrument as any,
                certificate_number: nextCertNumber !== "—" ? nextCertNumber : "CERT-PREVIEW-001",
                ulr_number: ulrEnabled ? (nextUlrNumber !== "—" ? nextUlrNumber : "ULR-PREVIEW-001") : undefined,
                calibration_date: calDate,
                certificate_issue_date: certIssueDate || calDate,
                next_calibration_date: nextCalDate,
                reference_standards: referenceStandards,
                reference_standard_name: referenceStandards[0]?.name,
                reference_standard_id: referenceStandards[0]?.id,
                reference_standard_traceable_to: referenceStandards[0]?.traceable_to,
                reference_standard_validity: referenceStandards[0]?.validity,
                environmental_conditions: {
                  temperature: envTemp,
                  humidity: envHumidity,
                  soaking_time: envSoakingTime || undefined,
                  soaking_start_time: envSoakingStartTime || undefined,
                  soaking_end_time: envSoakingEndTime || undefined,
                },
                receipt_condition: effectiveReceiptCondition,
                doc_no: docNo || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_no : undefined) || undefined,
                doc_date: docDate || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_date : undefined) || undefined,
                doc_rev: docRev || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_rev : undefined) || undefined,
                procedure_reference: procedureNo || procedureReference || undefined,
                procedure_no: procedureNo || (selectedTemplateId && selectedTemplateId !== "none" ? (availableTemplates.find(t => t.id === selectedTemplateId) as any)?.procedure_no : undefined) || undefined,
                procedure_name: procedureName || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.procedure_name : undefined) || undefined,
                procedure_date: procedureDate || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.procedure_date : undefined) || undefined,
                procedure_rev: procedureRev || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.procedure_rev : undefined) || undefined,
                acceptance_criteria_doc_no: acceptanceCriteriaDocNo || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_doc_no : undefined) || undefined,
                acceptance_criteria_date: acceptanceCriteriaDate || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_date : undefined) || undefined,
                acceptance_criteria_rev: acceptanceCriteriaRev || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_rev : undefined) || undefined,
                acceptance_criteria_reference: acceptanceCriteriaReference || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.acceptance_criteria_reference : undefined) || undefined,
                standard_reference: standardReference || remarks,
                is_canvas_template: wizardIsCanvas,
                layout_blocks: wizardIsCanvas ? wizardLayoutBlocks : undefined,
                calibration_points: calPoints,
                uncertainty,
                verdict,
                remarks,
                calibrated_by: calibratedBy,
                calibrated_by_designation: calibratedByDesignation,
                calibrated_by_signature: calibratedBySignature,
                reviewed_by: reviewedBy,
                reviewed_by_designation: reviewedByDesignation,
                reviewed_by_signature: reviewedBySignature,
                approved_by: approvedBy,
                approved_by_designation: approvedByDesignation,
                approved_by_signature: approvedBySignature,
                column_order: wizardColumnOrder,
                hidden_columns: wizardHiddenColumns,
                custom_columns: wizardCustomColumns as any,
                standard_columns_config: wizardStandardColumnConfigs,
                acceptance_criteria: wizardAcceptanceCriteria,
                diagram_image: wizardDiagramImage || undefined,
                diagram_image_width: wizardDiagramWidth,
                diagram_image_height: wizardDiagramHeight,
                diagram_image_alignment: wizardDiagramAlignment,
              }}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCertPreviewModal(false)}
            >
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Template Modifications Detected Modal ═══ */}
      <Dialog open={templateModifiedModalOpen} onOpenChange={setTemplateModifiedModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold text-base">
              <Layers className="w-5 h-5 text-primary shrink-0" />
              Template Modifications Detected
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-xs text-foreground">
              <p>
                You modified the specifications or diagram drawing from original template{" "}
                <strong>
                  "{availableTemplates.find((t) => t.id === selectedTemplateId)?.name || "Original Template"}"
                </strong>.
              </p>
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1.5 text-xs">
                <div className="text-foreground font-medium">
                  ✓ These changes are <strong>automatically saved to this instrument ({selectedInstrument?.id_code})</strong>.
                </div>
                <div className="text-muted-foreground pt-1">
                  Would you also like to save these changes as a <strong>New Reusable Template Variant</strong> for other gauges to use?
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTemplateModifiedModalOpen(false);
                executeSaveAndContinue();
              }}
              className="text-xs"
            >
              Save for this Instrument Only
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                setTemplateModifiedModalOpen(false);
                proceedAfterTemplateVariantRef.current = true;
                if (selectedInstrument) {
                  setNewTemplateName(`${selectedInstrument.name} - ${selectedInstrument.id_code} Variant`);
                }
                setSaveTemplateModalOpen(true);
              }}
              className="text-xs gap-1.5 font-semibold"
            >
              <Copy className="w-3.5 h-3.5" />
              Save as New Template Variant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
