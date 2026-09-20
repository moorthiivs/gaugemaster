import { useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, Search, Loader2, PlusCircle, Trash2, CalendarIcon, ChevronsUpDown, X, Layers, FileCheck, ChevronDown, AlertTriangle, Sparkles, Table, Save, Copy, Upload, ImageIcon, AlignLeft, AlignCenter, AlignRight, Eye, ClipboardPaste } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import httpClient from "@/lib/httpClient";
import { Instrument } from "@/types/instrument";
import { CalibrationPoint, CALIBRATION_TYPES, CalibrationTypeConfig } from "@/types/calibration";
import { createCalibration, getNextNumbers, generateCertificate, getDraft, saveDraft, deleteDraft, getCalibration, updateCalibration } from "@/lib/calibrationActions";
import { getTemplates, getTemplate } from "@/lib/templateActions";
import { Skeleton } from "@/components/ui/skeleton";
import { CalibrationTemplate } from "@/types/template";
import { getEffectiveTableOrientation } from "@/lib/tableLayoutOptimizer";
import { evaluateCanvasRowFormulas } from "@/lib/formulaEngine";
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

const STEPS = [
  "Select Instrument",
  "Reference Standard",
  "Calibration Data",
  "Results & Verdict",
  "Certificate",
];

const parseFrequencyMonths = (freq?: string): number => {
  if (!freq) return 6;
  const normalized = freq.trim().toLowerCase();
  const match = normalized.match(/(\d+)/);
  if (!match) return 6;
  let val = parseInt(match[1], 10);
  if (normalized.includes("year")) {
    val *= 12;
  }
  return val > 0 ? val : 6;
};

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

const computeNextDueDate = (baseDateStr: string, frequencyStr?: string): string => {
  if (!baseDateStr) return "";
  const baseDate = parseISO(baseDateStr.includes("T") ? baseDateStr.split("T")[0] : baseDateStr);
  if (isNaN(baseDate.getTime())) return "";
  
  const monthsToAdd = parseFrequencyMonths(frequencyStr);
  const nextDate = addMonths(baseDate, monthsToAdd);
  
  return format(nextDate, "yyyy-MM-dd");
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
  const [calPoints, setCalPoints] = useState<CalibrationPoint[]>([]);
  const [calUnit, setCalUnit] = useState("");
  const [calTolerance, setCalTolerance] = useState(0);
  const [statusRuleType, setStatusRuleType] = useState<"default" | "custom_formula">("default");
  const [statusFormula, setStatusFormula] = useState<string>("");

  // Step 4 — Results
  const [uncertainty, setUncertainty] = useState("");
  const [verdict, setVerdict] = useState<"PASS" | "FAIL" | "CONDITIONAL">("PASS");
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
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            if (base64) {
              setWizardDiagramImage(base64);
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
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      if (base64) {
        setWizardDiagramImage(base64);
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
      if (cp.doc_properties.procedure_no) setProcedureNo(cp.doc_properties.procedure_no);
      if (cp.doc_properties.procedure_name) setProcedureName(cp.doc_properties.procedure_name);
      if (cp.doc_properties.procedure_date) setProcedureDate(cp.doc_properties.procedure_date);
      if (cp.doc_properties.procedure_rev) setProcedureRev(cp.doc_properties.procedure_rev);
      if (cp.doc_properties.procedure_reference) setProcedureReference(cp.doc_properties.procedure_reference);
      if (cp.doc_properties.acceptance_criteria_doc_no) setAcceptanceCriteriaDocNo(cp.doc_properties.acceptance_criteria_doc_no);
      if (cp.doc_properties.acceptance_criteria_date) setAcceptanceCriteriaDate(cp.doc_properties.acceptance_criteria_date);
      if (cp.doc_properties.acceptance_criteria_rev) setAcceptanceCriteriaRev(cp.doc_properties.acceptance_criteria_rev);
      if (cp.doc_properties.acceptance_criteria_reference) setAcceptanceCriteriaReference(cp.doc_properties.acceptance_criteria_reference);
    }

    // 3. Environmental Defaults
    if (cp.environmental_defaults) {
      if (cp.environmental_defaults.temperature) setEnvTemp(cp.environmental_defaults.temperature);
      if (cp.environmental_defaults.humidity) setEnvHumidity(cp.environmental_defaults.humidity);
      if (cp.environmental_defaults.soaking_time) setEnvSoakingTime(cp.environmental_defaults.soaking_time);
      if (cp.environmental_defaults.soaking_start_time) setEnvSoakingStartTime(cp.environmental_defaults.soaking_start_time);
      if (cp.environmental_defaults.soaking_end_time) setEnvSoakingEndTime(cp.environmental_defaults.soaking_end_time);
    }

    // 4. Specifications auto-merge into calPoints
    if (cp.specifications && Array.isArray(cp.specifications) && cp.specifications.length > 0) {
      const mergedPoints: CalibrationPoint[] = cp.specifications.map((spec: any, idx: number) => ({
        point_number: spec.point_number || idx + 1,
        description: spec.description || `Point ${idx + 1}`,
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
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              if (base64) {
                setWizardDiagramImage(base64);
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
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      if (base64) {
        setWizardDiagramImage(base64);
        toast.success("Diagram image uploaded");
      }
    };
    reader.readAsDataURL(file);
  };

  // Save current diagram, specifications, doc info to Instrument Master
  const handleSaveToInstrumentMaster = async () => {
    if (!selectedInstrument) {
      toast.error("No instrument selected");
      return;
    }
    setSavingInstrumentCustom(true);
    try {
      const updatedCustomParams = {
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
          procedure_reference: procedureReference || undefined,
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
        specifications: calPoints.map(p => ({
          point_number: p.point_number,
          description: p.description,
          nominal: p.nominal,
          unit: p.unit,
          tolerance: p.tolerance,
          customFields: p.customFields,
        })),
      };

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
        procedure_reference: procedureReference || undefined,
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
    if (cal.procedure_reference) setProcedureReference(cal.procedure_reference);
    if ((cal as any).procedure_no) setProcedureNo((cal as any).procedure_no);
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
    if (tpl.environmental_defaults) {
      if (tpl.environmental_defaults.temperature) setEnvTemp(tpl.environmental_defaults.temperature);
      if (tpl.environmental_defaults.humidity) setEnvHumidity(tpl.environmental_defaults.humidity);
      if (tpl.environmental_defaults.soaking_time) setEnvSoakingTime(tpl.environmental_defaults.soaking_time);
      if (tpl.environmental_defaults.soaking_start_time) setEnvSoakingStartTime(tpl.environmental_defaults.soaking_start_time);
      if (tpl.environmental_defaults.soaking_end_time) setEnvSoakingEndTime(tpl.environmental_defaults.soaking_end_time);
    }
    setDocNo((tpl as any).doc_no || (tpl as any).docNo || "");
    setDocDate(tpl.doc_date || "");
    setDocRev(tpl.doc_rev || "");
    if (tpl.remarks) setRemarks(tpl.remarks);
    if ((tpl as any).standard_reference || tpl.remarks) setStandardReference((tpl as any).standard_reference || tpl.remarks);
    if (tpl.procedure_reference) setProcedureReference(tpl.procedure_reference);
    if ((tpl as any).procedure_no) setProcedureNo((tpl as any).procedure_no);
    if (tpl.procedure_name) setProcedureName(tpl.procedure_name);
    if (tpl.procedure_date) setProcedureDate(tpl.procedure_date);
    if (tpl.procedure_rev) setProcedureRev(tpl.procedure_rev);
    if (tpl.acceptance_criteria_doc_no) setAcceptanceCriteriaDocNo(tpl.acceptance_criteria_doc_no);
    if (tpl.acceptance_criteria_date) setAcceptanceCriteriaDate(tpl.acceptance_criteria_date);
    if (tpl.acceptance_criteria_rev) setAcceptanceCriteriaRev(tpl.acceptance_criteria_rev);
    if (tpl.acceptance_criteria_reference) setAcceptanceCriteriaReference(tpl.acceptance_criteria_reference);
    if (tpl.status_rule_type) setStatusRuleType(tpl.status_rule_type as "default" | "custom_formula");
    if (tpl.status_formula) setStatusFormula(tpl.status_formula);

    // Check if canvas template
    if (tpl.is_canvas_template || (tpl.layout_blocks && tpl.layout_blocks.length > 0)) {
      setWizardIsCanvas(true);
      setWizardLayoutBlocks(JSON.parse(JSON.stringify(tpl.layout_blocks || [])));
    } else {
      setWizardIsCanvas(false);
      setWizardLayoutBlocks([]);
    }

    // Always set custom columns, column order, hidden columns, decimal places, acceptance criteria, diagram from template
    setWizardCustomColumns((tpl as any).custom_columns || []);
    setWizardStandardColumnConfigs((tpl as any).standard_columns_config || {});
    setWizardColumnOrder((tpl as any).column_order || []);
    setWizardHiddenColumns((tpl as any).hidden_columns || []);
    setWizardDecimalPlaces(tpl.decimal_places ?? 4);
    setWizardAcceptanceCriteria((tpl as any).acceptance_criteria || {});
    if (tpl.diagram_image) setWizardDiagramImage(tpl.diagram_image);
    else setWizardDiagramImage(null);
    if (tpl.diagram_image_width) setWizardDiagramWidth(tpl.diagram_image_width);
    if (tpl.diagram_image_height) setWizardDiagramHeight(tpl.diagram_image_height);
    if (tpl.diagram_image_alignment) setWizardDiagramAlignment(tpl.diagram_image_alignment);

    if (isEdit && existingPoints && existingPoints.length > 0) {
      setCalPoints(existingPoints);
    } else if (tpl.calibration_points && tpl.calibration_points.length > 0) {
      const formattedPoints: CalibrationPoint[] = tpl.calibration_points.map((pt: any, idx) => ({
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
      setCalPoints(formattedPoints);
    }
  };

  // Apply Calibration Template helper
  const handleApplyTemplate = (tplId: string) => {
    if (tplId === "none") {
      handleClearTemplate();
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
        if (cal.doc_no) {
          setDocNo(cal.doc_no);
        }
        if ((cal as any).procedure_reference) {
          setProcedureReference((cal as any).procedure_reference);
        }
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

        if (cal.custom_columns && cal.custom_columns.length > 0) setWizardCustomColumns(cal.custom_columns);
        if ((cal as any).standard_columns_config) setWizardStandardColumnConfigs((cal as any).standard_columns_config);
        if (cal.column_order && cal.column_order.length > 0) setWizardColumnOrder(cal.column_order);
        if (cal.hidden_columns && cal.hidden_columns.length > 0) setWizardHiddenColumns(cal.hidden_columns);
        if ((cal as any).decimal_places !== undefined) setWizardDecimalPlaces((cal as any).decimal_places);
        if ((cal as any).acceptance_criteria) setWizardAcceptanceCriteria((cal as any).acceptance_criteria);

        if ((cal as any).is_canvas_template || ((cal as any).layout_blocks && (cal as any).layout_blocks.length > 0)) {
          setWizardIsCanvas(true);
          setWizardLayoutBlocks((cal as any).layout_blocks || []);
        }

        setUncertainty(cal.uncertainty || "");
        setVerdict((cal.verdict as any) || "PASS");
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
        procedureReference,
        calPoints,
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
    calPoints, wizardCustomColumns, wizardColumnOrder, wizardHiddenColumns, calUnit, calTolerance, uncertainty, verdict, remarks, calibratedBy, calibratedByDesignation,
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
          setProcedureReference(d.procedureReference || "");
          setCalPoints(d.calPoints || []);
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

  // Auto-determine verdict from points
  useEffect(() => {
    if (calPoints.length > 0 && calTolerance > 0) {
      const allPass = calPoints.every((p) => p.status === "PASS");
      const anyFail = calPoints.some((p) => p.status === "FAIL");
      if (allPass) setVerdict("PASS");
      else if (anyFail) setVerdict("FAIL");
      else setVerdict("CONDITIONAL");
    }
  }, [calPoints, calTolerance]);

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
        },
        doc_no: docNo || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_no : undefined) || undefined,
        doc_date: docDate || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_date : undefined) || undefined,
        doc_rev: docRev || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_rev : undefined) || undefined,
        procedure_reference: procedureReference || undefined,
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
        const updated = await updateCalibration(
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
  };

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

    const tol = parseFloat(String(row.tolerance ?? targetTbl.tolerance ?? 0.02)) || 0.02;
    const dec = targetTbl.decimal_places !== undefined ? targetTbl.decimal_places : (wizardDecimalPlaces || 3);

    // Deterministic formula evaluation (topological order, formula string parsing, blank propagation)
    const evaluatedRow = evaluateCanvasRowFormulas(row, targetTbl.columns, tol, dec);

    targetTbl.rows[rowIndex] = evaluatedRow;
    setWizardLayoutBlocks(updatedBlocks);
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
            <span className="text-[10px] text-muted-foreground font-mono">
              Unit: {tbl.unit || "mm"} • Tol: ±{tbl.tolerance ?? "0.005"}
            </span>
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
                      if (col.type === "nominal") {
                        const val = row.nominal !== undefined ? Number(row.nominal).toFixed(colDec) : "-";
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
                      if (col.type === "formula") {
                        const val = row[col.id] ?? "-";
                        return (
                          <td key={rIdx} className="py-0.5 px-1 font-bold text-foreground text-[11px]">
                            {val}
                          </td>
                        );
                      }
                      if (col.type === "status") {
                        const st = row[col.id] || row.status || "-";
                        const isPass = st === "PASS" || st === "OK";
                        const isFail = st === "FAIL" || st === "REJECT";
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
                      return (
                        <td key={rIdx} className="py-0.5 px-1 text-[11px]">
                          {row[col.id] || "-"}
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
          <span className="text-[10px] text-muted-foreground font-mono">
            Unit: {tbl.unit || "mm"} • Tol: ±{tbl.tolerance ?? "0.02"}
          </span>
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
              </tr>
            </thead>
            <tbody className="divide-y font-mono text-xs">
              {tbl.rows.map((row: any, rIdx: number) => (
                <tr key={rIdx} className="divide-x hover:bg-muted/20">
                  {tbl.columns.map((col: any) => {
                    const isPointNo = col.id === "point_number" || col.id === "sl_no" || col.id === "sino";
                    if (isPointNo) {
                      return (
                        <td key={col.id} className="py-0.5 px-1 font-semibold text-muted-foreground text-[11px]">
                          {row.point_number ?? row[col.id] ?? (rIdx + 1)}
                        </td>
                      );
                    }
                    const colDec = col.decimal_places ?? col.decimalPrecision ?? (tbl.decimal_places !== undefined ? tbl.decimal_places : 3);
                    if (col.type === "nominal") {
                      const val = row.nominal !== undefined ? Number(row.nominal).toFixed(colDec) : (row[col.id] ?? "-");
                      return (
                        <td key={col.id} className="py-0.5 px-1.5 font-bold text-foreground text-[11px]">
                          {val}
                        </td>
                      );
                    }
                    if (col.type === "text") {
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
                    if (col.type === "formula") {
                      const val = row[col.id] ?? "-";
                      return (
                        <td key={col.id} className="py-0.5 px-1 font-bold text-foreground text-[11px]">
                          {val}
                        </td>
                      );
                    }
                    if (col.type === "status") {
                      const st = row[col.id] || row.status || "-";
                      const isPass = st === "PASS" || st === "OK";
                      const isFail = st === "FAIL" || st === "REJECT";
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
                    return <td key={col.id} className="py-0.5 px-1 text-[11px]">{row[col.id] || "-"}</td>;
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
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedInstrument && !!selectedType;
      case 1: return true; // Reference standard is optional
      case 2: return wizardIsCanvas ? wizardLayoutBlocks.length > 0 : calPoints.length > 0;
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
                          {calPoints.length} Test Points • Unit: {calUnit || "mm"} {procedureReference ? `• SOP: ${procedureReference}` : ""}
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
                        <div><span className="text-muted-foreground block text-[10px]">Procedure SOP</span><span className="font-medium">{procedureReference || "-"}</span></div>
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
                      <Input 
                        type="date" 
                        value={ref.validity ? toLocalYyyyMmDd(ref.validity) : ""} 
                        onChange={(e) => {
                          const newRefs = [...referenceStandards];
                          newRefs[index].validity = e.target.value;
                          setReferenceStandards(newRefs);
                        }} 
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
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-3 mb-6 p-3.5 bg-card border rounded-xl shadow-xs">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5 flex-1 min-w-[220px]">
                    <Label className="text-xs font-semibold">Standard Reference</Label>
                    <Input value={standardReference} onChange={(e) => setStandardReference(e.target.value)} placeholder="Standard calibration per ISO/IEC 17025" className="text-xs font-medium" />
                  </div>
                  <div className="space-y-1.5 w-36">
                    <Label className="text-xs font-semibold">Template Doc No</Label>
                    <Input value={docNo} onChange={(e) => setDocNo(e.target.value)} placeholder="e.g., DOC/CAL/01" className="text-xs font-medium" />
                  </div>
                  <div className="space-y-1.5 w-28">
                    <Label className="text-xs font-medium text-muted-foreground">Doc Date</Label>
                    <Input value={docDate} onChange={(e) => setDocDate(e.target.value)} placeholder="DD-MM-YYYY" className="text-xs font-medium text-center" />
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
                    <Label className="text-[11px] font-semibold text-foreground">Procedure Name</Label>
                    <Input value={procedureName} onChange={(e) => setProcedureName(e.target.value)} placeholder="e.g. Master procedure" className="text-xs h-8 font-medium" />
                  </div>
                  <div className="space-y-1 col-span-12 md:col-span-2">
                    <Label className="text-[11px] font-semibold text-foreground">Procedure No</Label>
                    <Input value={procedureNo} onChange={(e) => setProcedureNo(e.target.value)} placeholder="e.g. PC-01" className="text-xs h-8 font-medium" />
                  </div>
                  <div className="space-y-1 col-span-12 md:col-span-7">
                    <Label className="text-[11px] font-semibold text-foreground">Procedure Doc &amp; Rev/Date</Label>
                    <div className="flex gap-1.5 items-center">
                      <Input value={procedureReference} onChange={(e) => setProcedureReference(e.target.value)} placeholder="Doc No (e.g. AE/CAL)" className="text-xs h-8 min-w-[120px] flex-1 font-medium" />
                      <Input value={procedureRev} onChange={(e) => setProcedureRev(e.target.value)} placeholder="Rev" className="text-xs h-8 w-14 shrink-0 font-medium text-center" />
                      <Input value={procedureDate} onChange={(e) => setProcedureDate(e.target.value)} placeholder="Date" className="text-xs h-8 w-28 shrink-0 font-medium text-center" />
                    </div>
                  </div>

                  <div className="space-y-1 col-span-12 md:col-span-4">
                    <Label className="text-[11px] font-semibold text-foreground">Acceptance Criteria Doc No</Label>
                    <Input value={acceptanceCriteriaDocNo} onChange={(e) => setAcceptanceCriteriaDocNo(e.target.value)} placeholder="e.g. D/QCM/GI/001/03" className="text-xs h-8 font-medium" />
                  </div>
                  <div className="space-y-1 col-span-12 md:col-span-8">
                    <Label className="text-[11px] font-semibold text-foreground">Criteria Rev &amp; Date / Ref</Label>
                    <div className="flex gap-1.5 items-center">
                      <Input value={acceptanceCriteriaRev} onChange={(e) => setAcceptanceCriteriaRev(e.target.value)} placeholder="Rev" className="text-xs h-8 w-14 shrink-0 font-medium text-center" />
                      <Input value={acceptanceCriteriaDate} onChange={(e) => setAcceptanceCriteriaDate(e.target.value)} placeholder="Date" className="text-xs h-8 w-28 shrink-0 font-medium text-center" />
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

              {/* ═══ Diagram / Schematic Image (Optional) Card ═══ */}
              <div className="p-4 bg-card border rounded-xl shadow-xs space-y-3 mb-4">
                <div className="flex items-center justify-between gap-2 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">Diagram / Schematic Image (Optional)</span>
                  </div>

                  <div className="flex items-center gap-2">
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
                    {wizardDiagramImage && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
                        Uploaded
                      </Badge>
                    )}
                  </div>
                </div>

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

              {/* ═══ Template Variant & Instrument Master Action Bar ═══ */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gradient-to-r from-muted/50 via-card to-muted/50 border rounded-xl shadow-xs mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 font-semibold px-2 py-0.5">
                    REUSABLE TEMPLATES &amp; SPECIFICATIONS
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Save customized specifications &amp; drawing to Instrument Master or as a new Template Variant
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
                    <span className="text-[11px] text-muted-foreground">
                      Readings calculate automatically based on template formulas
                    </span>
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
                  <Label className="text-xs">Verdict</Label>
                  <Select value={verdict} onValueChange={(v) => setVerdict(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PASS">✅ PASS</SelectItem>
                      <SelectItem value="FAIL">❌ FAIL</SelectItem>
                      <SelectItem value="CONDITIONAL">⚠️ CONDITIONAL</SelectItem>
                    </SelectContent>
                  </Select>
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
                      procedure_reference: procedureReference,
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
                doc_no: docNo || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_no : undefined) || undefined,
                doc_date: docDate || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_date : undefined) || undefined,
                doc_rev: docRev || (selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.doc_rev : undefined) || undefined,
                procedure_reference: procedureReference,
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
    </div>
  );
}
