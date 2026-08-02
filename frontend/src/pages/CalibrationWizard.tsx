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
import { ArrowLeft, ArrowRight, Check, Search, Loader2, PlusCircle, Trash2, CalendarIcon, ChevronsUpDown, X, Layers, FileCheck, ChevronDown, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import httpClient from "@/lib/httpClient";
import { Instrument } from "@/types/instrument";
import { CalibrationPoint, CALIBRATION_TYPES, CalibrationTypeConfig } from "@/types/calibration";
import { createCalibration, getNextNumbers, generateCertificate, getDraft, saveDraft, deleteDraft, getCalibration, updateCalibration } from "@/lib/calibrationActions";
import { getTemplates, getTemplate } from "@/lib/templateActions";
import { Skeleton } from "@/components/ui/skeleton";
import { CalibrationTemplate } from "@/types/template";
import { getInstrument } from "@/lib/instrumentActions";
import { InstrumentTypeSelector } from "@/components/calibration/InstrumentTypeSelector";
import { CalibrationDataGrid, CustomColumn } from "@/components/calibration/CalibrationDataGrid";
import { CertificatePreview } from "@/components/calibration/CertificatePreview";
import { UlrGate } from "@/components/calibration/UlrGate";
import { VerdictBadge } from "@/components/calibration/VerdictBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarPicker } from "@/components/ui/calendar";
import { YearMonthDatePicker } from "@/components/ui/year-month-date-picker";
import { format, addMonths, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

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

const computeNextDueDate = (baseDateStr: string, frequencyStr?: string): string => {
  if (!baseDateStr) return "";
  const baseDate = new Date(baseDateStr);
  if (isNaN(baseDate.getTime())) return "";
  
  const monthsToAdd = parseFrequencyMonths(frequencyStr);
  const nextDate = new Date(baseDate);
  nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
  
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
  const [envPressure, setEnvPressure] = useState("");
  const [procedureReference, setProcedureReference] = useState("");
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
  const [calDate, setCalDate] = useState(new Date().toISOString().split("T")[0]);
  const [certIssueDate, setCertIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [nextCalDate, setNextCalDate] = useState("");
  const [systemUsers, setSystemUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchSystemUsers = async () => {
      try {
        const res = await httpClient.get(`/users?companyId=${user?.companyId || ""}`);
        const list = Array.isArray(res.data) ? res.data : [];
        if (user?.name && !list.some((u: any) => u.name === user.name || u.id === user.id)) {
          list.unshift({ id: user.id, name: user.name, designation: user.role || "Calibration Engineer", signature: (user as any).signature || user.name });
        }
        setSystemUsers(list);
      } catch (err) {
        console.error("Failed to load users for signatories", err);
        if (user?.name) {
          setSystemUsers([{ id: user.id, name: user.name, designation: user.role || "Calibration Engineer", signature: (user as any).signature || user.name }]);
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
      setCalibratedByDesignation(user.role || "Calibration Engineer");
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
      const prevDueDate = cal.next_calibration_date.split("T")[0];
      setCalDate(prevDueDate);
      setCertIssueDate(prevDueDate);
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
          validity: cal.reference_standard_validity ? cal.reference_standard_validity.split("T")[0] : "",
          range: cal.reference_standard_range || "",
          least_count: cal.reference_standard_least_count || "",
        },
      ]);
    }

    // 2. Environmental conditions
    if (cal.environmental_conditions) {
      if (cal.environmental_conditions.temperature) setEnvTemp(cal.environmental_conditions.temperature);
      if (cal.environmental_conditions.humidity) setEnvHumidity(cal.environmental_conditions.humidity);
      if (cal.environmental_conditions.pressure) setEnvPressure(cal.environmental_conditions.pressure);
    }

    // 3. SOP & Standard Reference
    if (cal.procedure_reference) setProcedureReference(cal.procedure_reference);
    if (cal.standard_reference) setStandardReference(cal.standard_reference);
    else if (cal.remarks) setStandardReference(cal.remarks);

    // 4. Custom Formula & Rule Type
    if (cal.status_rule_type) setStatusRuleType(cal.status_rule_type as "default" | "custom_formula");
    if (cal.status_formula) setStatusFormula(cal.status_formula);

    // 5. Custom grid schema & columns
    if (cal.custom_columns && cal.custom_columns.length > 0) setWizardCustomColumns(cal.custom_columns);
    if (cal.standard_columns_config) setWizardStandardColumnConfigs(cal.standard_columns_config);
    if (cal.column_order && cal.column_order.length > 0) setWizardColumnOrder(cal.column_order);
    if (cal.hidden_columns && cal.hidden_columns.length > 0) setWizardHiddenColumns(cal.hidden_columns);
    if (cal.decimal_places !== undefined) setWizardDecimalPlaces(cal.decimal_places);
    if (cal.acceptance_criteria) setWizardAcceptanceCriteria(cal.acceptance_criteria);

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
    setWizardCustomColumns([]);
    setWizardStandardColumnConfigs({});
    setWizardColumnOrder([]);
    setWizardHiddenColumns([]);
    setWizardDecimalPlaces(4);
    setWizardAcceptanceCriteria({});
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
      if (tpl.environmental_defaults.pressure) setEnvPressure(tpl.environmental_defaults.pressure);
    }
    if (tpl.remarks) setRemarks(tpl.remarks);
    if ((tpl as any).standard_reference || tpl.remarks) setStandardReference((tpl as any).standard_reference || tpl.remarks);
    if (tpl.procedure_reference) setProcedureReference(tpl.procedure_reference);
    if (tpl.status_rule_type) setStatusRuleType(tpl.status_rule_type as "default" | "custom_formula");
    if (tpl.status_formula) setStatusFormula(tpl.status_formula);

    // Always set custom columns, column order, hidden columns, decimal places, acceptance criteria from template
    setWizardCustomColumns((tpl as any).custom_columns || []);
    setWizardStandardColumnConfigs((tpl as any).standard_columns_config || {});
    setWizardColumnOrder((tpl as any).column_order || []);
    setWizardHiddenColumns((tpl as any).hidden_columns || []);
    setWizardDecimalPlaces(tpl.decimal_places ?? 4);
    setWizardAcceptanceCriteria((tpl as any).acceptance_criteria || {});

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
                ? cal.reference_standard_validity.split("T")[0]
                : "",
              range: cal.reference_standard_range || "",
              least_count: cal.reference_standard_least_count || "",
            },
          ]);
        }

        if (cal.environmental_conditions) {
          if (cal.environmental_conditions.temperature) setEnvTemp(cal.environmental_conditions.temperature);
          if (cal.environmental_conditions.humidity) setEnvHumidity(cal.environmental_conditions.humidity);
          if (cal.environmental_conditions.pressure) setEnvPressure(cal.environmental_conditions.pressure);
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
          cal.calibration_date
            ? cal.calibration_date.split("T")[0]
            : new Date().toISOString().split("T")[0]
        );
        setCertIssueDate(
          (cal as any).certificate_issue_date
            ? (cal as any).certificate_issue_date.split("T")[0]
            : cal.calibration_date
              ? cal.calibration_date.split("T")[0]
              : new Date().toISOString().split("T")[0]
        );
        setNextCalDate(
          cal.next_calibration_date ? cal.next_calibration_date.split("T")[0] : ""
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
        envPressure,
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
    step, selectedInstrument, selectedType, referenceStandards, envTemp, envHumidity, envPressure, procedureReference,
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
          setEnvPressure(d.envPressure || "");
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
        if (inst.due_date) {
          const prevDueDate = inst.due_date.split("T")[0];
          setCalDate(prevDueDate);
          setCertIssueDate(prevDueDate);
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
    if (inst.due_date) {
      const prevDueDate = inst.due_date.split("T")[0];
      setCalDate(prevDueDate);
      setCertIssueDate(prevDueDate);
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
          pressure: envPressure || undefined,
        },
        procedure_reference: procedureReference || undefined,
        standard_reference: standardReference || remarks || undefined,
        calibration_points: calPoints,
        custom_columns: wizardCustomColumns,
        standard_columns_config: wizardStandardColumnConfigs,
        column_order: wizardColumnOrder,
        hidden_columns: wizardHiddenColumns,
        template_id: selectedTemplateId && selectedTemplateId !== "none" ? selectedTemplateId : undefined,
        template_name: selectedTemplateId && selectedTemplateId !== "none" ? availableTemplates.find(t => t.id === selectedTemplateId)?.name : undefined,
        decimal_places: wizardDecimalPlaces,
        acceptance_criteria: wizardAcceptanceCriteria,
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

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedInstrument && !!selectedType;
      case 1: return true; // Reference standard is optional
      case 2: return calPoints.length > 0;
      case 3: return true;
      default: return true;
    }
  };

  if (isInitializing || editLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 overflow-y-auto animate-in fade-in-50 duration-200">
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
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 overflow-y-auto">
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
      <div className="flex items-center gap-1 overflow-x-auto pb-2 min-w-full">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full ${
              i === step
                ? "bg-primary text-primary-foreground shadow-md"
                : i < step
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i < step ? "bg-emerald-500 text-white" : i === step ? "bg-white/20" : "bg-muted-foreground/20"
              }`}>
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline truncate">{s}</span>
            </div>
          </div>
        ))}
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
                  <div className="p-4 border-t bg-card text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in-50 duration-200">
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Instrument Name</span><span className="font-semibold text-sm">{selectedInstrument.name}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">ID Code</span><span className="font-medium">{selectedInstrument.id_code}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Make</span><span className="font-medium">{selectedInstrument.make || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Range</span><span className="font-medium">{selectedInstrument.range || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Least Count</span><span className="font-medium">{selectedInstrument.least_count || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Serial No</span><span className="font-medium">{selectedInstrument.serial_no || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Location</span><span className="font-medium">{selectedInstrument.location || "-"}</span></div>
                    <div><span className="text-muted-foreground block text-[10px] font-semibold uppercase">Calibration Type</span><span className="font-medium text-primary">{selectedType?.label || "-"}</span></div>
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
                          <div><span className="text-muted-foreground block text-[10px]">Validity</span><span className="font-medium">{ref.validity ? ref.validity.split('T')[0] : "-"}</span></div>
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-muted/20 p-2.5 rounded-lg border">
                        <div><span className="text-muted-foreground block text-[10px]">Procedure SOP</span><span className="font-medium">{procedureReference || "-"}</span></div>
                        <div><span className="text-muted-foreground block text-[10px]">Temperature</span><span className="font-medium">{envTemp || "-"}</span></div>
                        <div><span className="text-muted-foreground block text-[10px]">Humidity</span><span className="font-medium">{envHumidity || "-"}</span></div>
                        <div><span className="text-muted-foreground block text-[10px]">Pressure</span><span className="font-medium">{envPressure || "-"}</span></div>
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
                      <div className="text-xs text-muted-foreground mt-1">
                        {inst.make && `Make: ${inst.make}`} {inst.range && `• Range: ${inst.range}`} {inst.location && `• Location: ${inst.location}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Instrument Details */}
              {selectedInstrument && (
                <div className="border rounded-lg p-4 bg-primary/5">
                  <h4 className="font-semibold text-sm mb-2">Selected Instrument</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span><b>Name:</b> {selectedInstrument.name}</span>
                    <span><b>ID Code:</b> {selectedInstrument.id_code}</span>
                    <span><b>Make:</b> {selectedInstrument.make || "-"}</span>
                    <span><b>Range:</b> {selectedInstrument.range || "-"}</span>
                    <span><b>Least Count:</b> {selectedInstrument.least_count || "-"}</span>
                    <span><b>Serial No:</b> {selectedInstrument.serial_no || "-"}</span>
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
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs text-primary font-semibold">Select from Master Inventory (Optional)</Label>
                      <Select 
                        value={masterStandards.find(m => m.id === ref.id || m.id_code === ref.id || (ref.name && m.name.toLowerCase() === ref.name.toLowerCase()))?.id || ""}
                        onValueChange={(val) => {
                          const master = masterStandards.find(m => m.id === val);
                          if (master) {
                            const initialCertNo = master.cert_no || master.traceable || (master as any).certificate_no || (master as any).cert_number || (master as any).calibration_agency || (master as any).calibration_source || master.id_code || master.id || "";
                            const newRefs = [...referenceStandards];
                            newRefs[index] = {
                              ...newRefs[index],
                              name: master.name,
                              make: master.make || (master as any).manufacturer || (master as any).brand || "",
                              id: master.id_code || master.id || "",
                              range: master.range || "",
                              least_count: master.least_count || "",
                              validity: master.due_date ? master.due_date.split('T')[0] : "",
                              traceable_to: initialCertNo,
                              cert_no: initialCertNo,
                              agency: (master as any).calibration_agency || (master as any).agency || (master as any).calibration_source || master.traceable || master.location || ""
                            };
                            setReferenceStandards(newRefs);

                            // Asynchronously fetch latest calibration certificate for this master instrument
                            httpClient.get(`/calibrations/latest/${master.id}`).then((res) => {
                              if (res.data && res.data.certificate_number) {
                                const fetchedCert = res.data.certificate_number;
                                setReferenceStandards((prevRefs) => {
                                  const updated = [...prevRefs];
                                  if (updated[index]) {
                                    updated[index] = {
                                      ...updated[index],
                                      traceable_to: fetchedCert,
                                      cert_no: fetchedCert,
                                    };
                                  }
                                  return updated;
                                });
                              }
                            }).catch(() => {});
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
                      <Label className="text-xs">Reference Standard Name</Label>
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
                      <Label className="text-xs">ID / Serial Number</Label>
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
                      <Label className="text-xs">Traceable To (Cert No)</Label>
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
                      <Label className="text-xs">Validity / Due Date</Label>
                      <Input 
                        type="date" 
                        value={ref.validity ? ref.validity.split('T')[0] : ""} 
                        onChange={(e) => {
                          const newRefs = [...referenceStandards];
                          newRefs[index].validity = e.target.value;
                          setReferenceStandards(newRefs);
                        }} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Range</Label>
                      <Input 
                        value={ref.range} 
                        onChange={(e) => {
                          const newRefs = [...referenceStandards];
                          newRefs[index].range = e.target.value;
                          setReferenceStandards(newRefs);
                        }} 
                        placeholder="e.g., 0-100 Bar" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Least Count</Label>
                      <Input 
                        value={ref.least_count} 
                        onChange={(e) => {
                          const newRefs = [...referenceStandards];
                          newRefs[index].least_count = e.target.value;
                          setReferenceStandards(newRefs);
                        }} 
                        placeholder="e.g., 0.01 Bar" 
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full border-dashed"
                onClick={() => setReferenceStandards([...referenceStandards, { name: "", id: "", traceable_to: "", validity: "", range: "", least_count: "" }])}
              >
                <PlusCircle className="w-4 h-4 mr-2" /> Add Another Reference Standard
              </Button>
            </div>
          )}

          {/* ═══ Step 3: Environmental + Data Entry ═══ */}
          {step === 2 && selectedType && (
            <>
              {/* Calibration Template Selector */}
              <div className="p-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/5 border border-blue-200 dark:border-blue-900 rounded-xl space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold">Calibration Template</span>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {selectedType.label}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Search and select a template to auto-fill test points & tolerances
                  </span>
                </div>

                {/* Searchable Combobox Dropdown */}
                <Popover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={templatePopoverOpen}
                      className="w-full justify-between bg-background text-xs h-9 font-normal border-input"
                    >
                      {selectedTemplateId && selectedTemplateId !== "none" ? (
                        <span className="truncate font-semibold text-foreground">
                          {availableTemplates.find((t) => t.id === selectedTemplateId)?.name}
                          {" "}
                          <span className="text-muted-foreground font-normal">
                            ({availableTemplates.find((t) => t.id === selectedTemplateId)?.instrument_type}) — {availableTemplates.find((t) => t.id === selectedTemplateId)?.calibration_points?.length || 0} points
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-medium">
                          {availableTemplates.length > 0
                            ? "-- None / Custom (No Template Selected) --"
                            : "-- No Templates Found (Using Custom Grid) --"}
                        </span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 space-y-2 z-50 bg-popover shadow-xl border">
                    {/* Search Filter Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={templateSearchQuery}
                        onChange={(e) => setTemplateSearchQuery(e.target.value)}
                        placeholder="Search template name, instrument type..."
                        className="pl-8 pr-7 h-8 text-xs bg-background"
                      />
                      {templateSearchQuery && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setTemplateSearchQuery("")}
                          className="h-6 w-6 absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>

                    {/* Filtered Suggestion List */}
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {/* Default Option: None */}
                      <div
                        onClick={() => {
                          handleApplyTemplate("none");
                          setTemplatePopoverOpen(false);
                          setTemplateSearchQuery("");
                        }}
                        className={`p-2 rounded-md cursor-pointer text-xs flex items-center justify-between transition-colors ${
                          !selectedTemplateId || selectedTemplateId === "none"
                            ? "bg-primary/10 text-primary font-bold"
                            : "hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        <span>-- None / Custom (No Template) --</span>
                        {(!selectedTemplateId || selectedTemplateId === "none") && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>

                      {/* Templates List */}
                      {availableTemplates
                        .filter((tpl) => {
                          if (!templateSearchQuery.trim()) return true;
                          const q = templateSearchQuery.toLowerCase();
                          return (
                            tpl.name.toLowerCase().includes(q) ||
                            tpl.instrument_type.toLowerCase().includes(q)
                          );
                        })
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
                              className={`p-2 rounded-md cursor-pointer text-xs flex items-center justify-between transition-colors ${
                                isSelected ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent"
                              }`}
                            >
                              <div className="truncate pr-2">
                                <p className="font-semibold text-foreground">{tpl.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {tpl.instrument_type} • {tpl.calibration_points?.length || 0} test points
                                </p>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </div>
                          );
                        })}

                      {availableTemplates.length === 0 && (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          No templates found. Go to <span className="font-semibold text-primary cursor-pointer hover:underline" onClick={() => navigate("/templates")}>Calibration Templates</span> to create one.
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-wrap items-end gap-3 mb-6">
                <div className="space-y-1.5 flex-1 min-w-[260px]">
                  <Label className="text-xs font-semibold">Standard Reference</Label>
                  <Input value={standardReference} onChange={(e) => setStandardReference(e.target.value)} placeholder="Standard calibration per ISO/IEC 17025" className="text-xs font-medium" />
                </div>
                <div className="space-y-1.5 w-48 sm:w-56">
                  <Label className="text-xs font-semibold">Procedure Reference</Label>
                  <Input value={procedureReference} onChange={(e) => setProcedureReference(e.target.value)} placeholder="e.g., AE/CAL-SOP/01" className="text-xs font-medium" />
                </div>
                <div className="space-y-1.5 w-24">
                  <Label className="text-xs font-medium">Temperature</Label>
                  <Input value={envTemp} onChange={(e) => setEnvTemp(e.target.value)} placeholder="20" className="text-xs text-center font-medium" />
                </div>
                <div className="space-y-1.5 w-24">
                  <Label className="text-xs font-medium">Humidity</Label>
                  <Input value={envHumidity} onChange={(e) => setEnvHumidity(e.target.value)} placeholder="55" className="text-xs text-center font-medium" />
                </div>
                <div className="space-y-1.5 w-28">
                  <Label className="text-xs font-medium truncate" title="Pressure (optional)">Pressure (opt)</Label>
                  <Input value={envPressure} onChange={(e) => setEnvPressure(e.target.value)} placeholder="1013" className="text-xs text-center font-medium" />
                </div>
              </div>

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
                        Prev Due: {format(parseISO(selectedInstrument.due_date.split("T")[0]), "dd-MMM-yyyy")}
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
                    {(user?.role?.toLowerCase().includes("admin") || user?.role === "Admin" || user?.role === "Administrator") ? (
                      <Select
                        value={systemUsers.find((u) => u.name === calibratedBy || u.id === calibratedBy)?.id || calibratedBy}
                        onValueChange={(val) => {
                          const selectedUser = systemUsers.find((u) => u.id === val || u.name === val);
                          if (selectedUser) {
                            setCalibratedBy(selectedUser.name);
                            setCalibratedByDesignation(selectedUser.designation || selectedUser.role || "Calibration Engineer");
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
                              {u.name} ({u.designation || u.role || "Engineer"})
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
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-950/50 rounded-md border border-sky-200 dark:border-sky-800 text-xs shadow-sm">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Designation:</span>
                      <span className="font-bold text-sky-950 dark:text-sky-100 uppercase tracking-wide text-[11px]">
                        {calibratedByDesignation || user?.role || "CALIBRATION ENGINEER"}
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
                      environmental_conditions: { temperature: envTemp, humidity: envHumidity, pressure: envPressure },
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
                      procedure_reference: procedureReference,
                      standard_reference: standardReference || remarks,
                      column_order: wizardColumnOrder,
                      hidden_columns: wizardHiddenColumns,
                      custom_columns: wizardCustomColumns as any,
                      standard_columns_config: wizardStandardColumnConfigs,
                      acceptance_criteria: wizardAcceptanceCriteria,
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
                <div><span className="text-muted-foreground">Previous Calibration Date:</span> <strong>{recentCalDetails?.lastCalDate ? format(parseISO(recentCalDetails.lastCalDate.split('T')[0]), "dd-MMM-yyyy") : "Recent"}</strong></div>
                <div><span className="text-muted-foreground">Current Due Date:</span> <strong>{recentCalDetails?.dueDate ? format(parseISO(recentCalDetails.dueDate.split('T')[0]), "dd-MMM-yyyy") : "N/A"}</strong></div>
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
    </div>
  );
}
