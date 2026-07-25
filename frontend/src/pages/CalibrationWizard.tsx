import { useState, useEffect, useRef } from "react";
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
import { ArrowLeft, ArrowRight, Check, Search, Loader2, PlusCircle, Trash2, CalendarIcon, ChevronsUpDown, X, Layers, FileCheck } from "lucide-react";
import httpClient from "@/lib/httpClient";
import { Instrument } from "@/types/instrument";
import { CalibrationPoint, CALIBRATION_TYPES, CalibrationTypeConfig } from "@/types/calibration";
import { createCalibration, getNextNumbers, generateCertificate, getDraft, saveDraft, deleteDraft, getCalibration, updateCalibration } from "@/lib/calibrationActions";
import { getTemplates } from "@/lib/templateActions";
import { CalibrationTemplate } from "@/types/template";
import { getInstrument } from "@/lib/instrumentActions";
import { InstrumentTypeSelector } from "@/components/calibration/InstrumentTypeSelector";
import { CalibrationDataGrid, CustomColumn } from "@/components/calibration/CalibrationDataGrid";
import { CertificatePreview } from "@/components/calibration/CertificatePreview";
import { UlrGate } from "@/components/calibration/UlrGate";
import { VerdictBadge } from "@/components/calibration/VerdictBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarPicker } from "@/components/ui/calendar";
import { format, addMonths, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
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

const STEPS = [
  "Select Instrument",
  "Reference Standard",
  "Calibration Data",
  "Results & Verdict",
  "Certificate",
];

export default function CalibrationWizard() {
  useSEO({ title: "New Calibration — GaugeMaster", description: "Perform instrument calibration" });
  const navigate = useNavigate();
  const { instrumentId } = useParams();
  const { user } = useAuth();

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
  const [reviewedBy, setReviewedBy] = useState("");
  const [reviewedByDesignation, setReviewedByDesignation] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [approvedByDesignation, setApprovedByDesignation] = useState("");
  const [calDate, setCalDate] = useState(new Date().toISOString().split("T")[0]);
  const [nextCalDate, setNextCalDate] = useState("");

  // Step 5 — ULR & Certificate
  const [ulrEnabled, setUlrEnabled] = useState(false);
  const [nextCertNumber, setNextCertNumber] = useState("—");
  const [nextUlrNumber, setNextUlrNumber] = useState("—");
  const [savedCalibrationId, setSavedCalibrationId] = useState<string | null>(null);
  const [certificateGenerated, setCertificateGenerated] = useState(false);

  // Draft & Edit state
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get("draftId");
  const editIdParam = searchParams.get("editId");
  const typeParam = searchParams.get("type");
  const [isEditMode, setIsEditMode] = useState(!!editIdParam);
  const [availableTemplates, setAvailableTemplates] = useState<CalibrationTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);

  const draftIdRef = useRef<string | null>(draftIdParam || null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(draftIdParam || null);
  const [isInitializing, setIsInitializing] = useState(true);

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

  // Fetch templates for selected Calibration Type
  useEffect(() => {
    if (!user || !selectedType) return;
    getTemplates({ userId: user.id, calibrationType: selectedType.type })
      .then((tpls) => {
        setAvailableTemplates(tpls || []);
      })
      .catch(console.error);
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

  // Apply Calibration Template helper
  const handleApplyTemplate = (tplId: string) => {
    if (tplId === "none") {
      handleClearTemplate();
      return;
    }
    const tpl = availableTemplates.find((t) => t.id === tplId);
    if (!tpl) return;

    setSelectedTemplateId(tplId);
    if (tpl.default_unit) setCalUnit(tpl.default_unit);
    if (tpl.default_tolerance !== undefined) setCalTolerance(tpl.default_tolerance);
    if (tpl.environmental_defaults) {
      if (tpl.environmental_defaults.temperature) setEnvTemp(tpl.environmental_defaults.temperature);
      if (tpl.environmental_defaults.humidity) setEnvHumidity(tpl.environmental_defaults.humidity);
      if (tpl.environmental_defaults.pressure) setEnvPressure(tpl.environmental_defaults.pressure);
    }
    if (tpl.remarks) setRemarks(tpl.remarks);
    if (tpl.status_rule_type) setStatusRuleType(tpl.status_rule_type as "default" | "custom_formula");
    if (tpl.status_formula) setStatusFormula(tpl.status_formula);

    // Always reset/set custom columns, column order, and hidden columns from selected template
    setWizardCustomColumns((tpl as any).custom_columns || []);
    setWizardStandardColumnConfigs((tpl as any).standard_columns_config || {});
    setWizardColumnOrder((tpl as any).column_order || []);
    setWizardHiddenColumns((tpl as any).hidden_columns || []);
    setWizardDecimalPlaces(tpl.decimal_places ?? 4);
    setWizardAcceptanceCriteria((tpl as any).acceptance_criteria || {});

    if (tpl.calibration_points && tpl.calibration_points.length > 0) {
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
    toast.success(`Applied template "${tpl.name}"`);
  };

  // Auto-apply matching template when templates load or instrument changes (for new calibrations)
  useEffect(() => {
    if (!availableTemplates || availableTemplates.length === 0) return;
    if (selectedTemplateId || isEditMode || draftIdParam) return;

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
      handleApplyTemplate(match.id);
    }
  }, [availableTemplates, selectedInstrument, selectedTemplateId, isEditMode, draftIdParam]);

  // Load existing calibration if in Edit mode
  useEffect(() => {
    if (!user || !editIdParam) return;
    setIsEditMode(true);
    getCalibration(editIdParam)
      .then((cal) => {
        setSavedCalibrationId(cal.id);
        setSelectedInstrument(cal.instrument);
        const typeMatch =
          CALIBRATION_TYPES.find((t) => t.type === cal.calibration_type) ||
          CALIBRATION_TYPES[0];
        setSelectedType(typeMatch);

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
          setEnvTemp(cal.environmental_conditions.temperature || "");
          setEnvHumidity(cal.environmental_conditions.humidity || "");
          setEnvPressure(cal.environmental_conditions.pressure || "");
        }
        if ((cal as any).procedure_reference) {
          setProcedureReference((cal as any).procedure_reference);
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

        if (cal.custom_columns) setWizardCustomColumns(cal.custom_columns);
        if ((cal as any).standard_columns_config) setWizardStandardColumnConfigs((cal as any).standard_columns_config);
        if (cal.column_order) setWizardColumnOrder(cal.column_order);
        if (cal.hidden_columns) setWizardHiddenColumns(cal.hidden_columns);
        if ((cal as any).decimal_places !== undefined) setWizardDecimalPlaces((cal as any).decimal_places);
        if ((cal as any).acceptance_criteria) setWizardAcceptanceCriteria((cal as any).acceptance_criteria);

        setUncertainty(cal.uncertainty || "");
        setVerdict((cal.verdict as any) || "PASS");
        setRemarks(cal.remarks || "");
        setCalibratedBy(cal.calibrated_by || "");
        setCalibratedByDesignation(cal.calibrated_by_designation || "");
        setReviewedBy(cal.reviewed_by || "");
        setReviewedByDesignation(cal.reviewed_by_designation || "");
        setApprovedBy(cal.approved_by || "");
        setApprovedByDesignation(cal.approved_by_designation || "");
        setCalDate(
          cal.calibration_date
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
        setIsInitializing(false);
      })
      .catch((err) => {
        toast.error("Failed to load calibration for editing");
        setIsInitializing(false);
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
    reviewedBy, reviewedByDesignation, approvedBy, approvedByDesignation, calDate, nextCalDate, user, savedCalibrationId, isInitializing
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
            const cal = res.data;
            if (cal.reference_standards && cal.reference_standards.length > 0) {
              setReferenceStandards(cal.reference_standards);
            }
            if (cal.environmental_conditions) {
              setEnvTemp(cal.environmental_conditions.temperature || "");
              setEnvHumidity(cal.environmental_conditions.humidity || "");
              setEnvPressure(cal.environmental_conditions.pressure || "");
            }
            if (cal.calibration_points && cal.calibration_points.length > 0) {
              setCalPoints(cal.calibration_points);
            }
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

  const handleInstrumentSelect = (inst: Instrument) => {
    setSelectedInstrument(inst);
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
        const cal = res.data;
        if (cal.reference_standards && cal.reference_standards.length > 0) {
          setReferenceStandards(cal.reference_standards);
        }
        if (cal.environmental_conditions) {
          setEnvTemp(cal.environmental_conditions.temperature || "");
          setEnvHumidity(cal.environmental_conditions.humidity || "");
          setEnvPressure(cal.environmental_conditions.pressure || "");
        }
        if (cal.calibration_points && cal.calibration_points.length > 0) {
          const loadedTol = cal.calibration_points[0].tolerance !== undefined ? cal.calibration_points[0].tolerance : calTolerance;
          if (loadedTol !== undefined) {
            setCalTolerance(loadedTol);
          }
          
          const hasDescending = typeMatch?.columns?.some((c: any) => c.key === "descending_reading") || false;
          
          // Recalculate error and status to ensure correctness
          const fixedPoints = cal.calibration_points.map((pt: any) => {
            const rowTol = pt.tolerance !== undefined && pt.tolerance > 0 ? pt.tolerance : loadedTol;
            let error = 0;
            if (hasDescending) {
              const avg = ((pt.ascending_reading || 0) + (pt.descending_reading || 0)) / 2;
              error = parseFloat((avg - (pt.nominal || 0)).toFixed(4));
            } else {
              error = parseFloat(((pt.ascending_reading || 0) - (pt.nominal || 0)).toFixed(4));
            }
            
            return {
              ...pt,
              description: pt.description || "",
              error,
              tolerance: rowTol,
              status: rowTol > 0 ? (Math.abs(error) <= rowTol ? "PASS" : "FAIL") : undefined
            };
          });
          
          setCalPoints(fixedPoints);
        }
        toast.success(`Auto-filled template from previous calibration for ${inst.name}`);
      }
    }).catch(() => {});
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
        calibration_type: selectedType.type,
        reference_standards: referenceStandards.filter(r => r.name || r.id),
        environmental_conditions: {
          temperature: envTemp,
          humidity: envHumidity,
          pressure: envPressure || undefined,
        },
        procedure_reference: procedureReference || undefined,
        calibration_points: calPoints,
        custom_columns: wizardCustomColumns,
        standard_columns_config: wizardStandardColumnConfigs,
        column_order: wizardColumnOrder,
        hidden_columns: wizardHiddenColumns,
        decimal_places: wizardDecimalPlaces,
        acceptance_criteria: wizardAcceptanceCriteria,
        uncertainty,
        verdict,
        remarks,
        status_rule_type: statusRuleType,
        status_formula: statusFormula,
        calibrated_by: calibratedBy,
        calibrated_by_designation: calibratedByDesignation,
        reviewed_by: reviewedBy,
        reviewed_by_designation: reviewedByDesignation,
        approved_by: approvedBy,
        approved_by_designation: approvedByDesignation,
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

  const handlePrint = () => {
    if (!savedCalibrationId) return;
    const BASE_URL = (httpClient.defaults.baseURL || "http://localhost:5000/api").replace(/\/api$/, "");
    window.open(`${BASE_URL}/api/calibrations/${savedCalibrationId}/certificate/download`, "_blank");
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedInstrument && !!selectedType;
      case 1: return true; // Reference standard is optional
      case 2: return calPoints.length > 0;
      case 3: return true;
      default: return true;
    }
  };

  if (isInitializing) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
                <div key={index} className="relative p-4 border rounded-xl bg-card relative">
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
                        onValueChange={(val) => {
                          const master = masterStandards.find(m => m.id === val);
                          if (master) {
                            const newRefs = [...referenceStandards];
                            newRefs[index] = {
                              ...newRefs[index],
                              name: master.name,
                              id: master.id_code,
                              range: master.range || "",
                              least_count: master.least_count || "",
                              validity: master.due_date ? master.due_date.split('T')[0] : "",
                              traceable_to: master.traceable || ""
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
                        value={ref.traceable_to} 
                        onChange={(e) => {
                          const newRefs = [...referenceStandards];
                          newRefs[index].traceable_to = e.target.value;
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
              {availableTemplates.length > 0 && (
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
                          <span className="text-muted-foreground font-medium">-- None / Custom (No Template) --</span>
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
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="space-y-1.5">
                  <Label className="text-xs">Procedure Reference</Label>
                  <Input value={procedureReference} onChange={(e) => setProcedureReference(e.target.value)} placeholder="e.g., AE/CAL-SOP/01" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Temperature</Label>
                  <Input value={envTemp} onChange={(e) => setEnvTemp(e.target.value)} placeholder="e.g., 23°C ± 2°C" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Humidity</Label>
                  <Input value={envHumidity} onChange={(e) => setEnvHumidity(e.target.value)} placeholder="e.g., 55% ± 5%" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pressure (optional)</Label>
                  <Input value={envPressure} onChange={(e) => setEnvPressure(e.target.value)} placeholder="e.g., 1013 hPa" />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 flex flex-col">
                  <Label className="text-xs">Date of Calibration</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !calDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {calDate ? format(parseISO(calDate), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarPicker
                        mode="single"
                        selected={calDate ? parseISO(calDate) : undefined}
                        onSelect={(d: Date | undefined) => setCalDate(d ? format(d, "yyyy-MM-dd") : "")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <Label className="text-xs">Next Calibration Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !nextCalDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {nextCalDate ? format(parseISO(nextCalDate), "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarPicker
                        mode="single"
                        selected={nextCalDate ? parseISO(nextCalDate) : undefined}
                        onSelect={(d: Date | undefined) => setNextCalDate(d ? format(d, "yyyy-MM-dd") : "")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
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
                  <div className="space-y-2">
                    <Label className="text-xs">Calibrated By</Label>
                    <Input value={calibratedBy} onChange={(e) => setCalibratedBy(e.target.value)} placeholder="Name" />
                    <Input value={calibratedByDesignation} onChange={(e) => setCalibratedByDesignation(e.target.value)} placeholder="Designation" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Reviewed By</Label>
                    <Input value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} placeholder="Name" />
                    <Input value={reviewedByDesignation} onChange={(e) => setReviewedByDesignation(e.target.value)} placeholder="Designation" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Approved By</Label>
                    <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Name" />
                    <Input value={approvedByDesignation} onChange={(e) => setApprovedByDesignation(e.target.value)} placeholder="Designation" />
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
                <div className="flex justify-center">
                  <CertificatePreview
                    calibration={{
                      instrument: selectedInstrument as any,
                      certificate_number: nextCertNumber,
                      ulr_number: ulrEnabled ? nextUlrNumber : undefined,
                      calibration_date: calDate,
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
                      reviewed_by: reviewedBy,
                      reviewed_by_designation: reviewedByDesignation,
                      approved_by: approvedBy,
                      approved_by_designation: approvedByDesignation,
                      procedure_reference: procedureReference,
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
    </div>
  );
}
