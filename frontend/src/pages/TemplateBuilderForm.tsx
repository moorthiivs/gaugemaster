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
import { ArrowLeft, Save, Layers, Loader2, Plus, Sparkles, AlertTriangle, Maximize2, Minimize2 } from "lucide-react";
import { CALIBRATION_TYPES, CalibrationPoint } from "@/types/calibration";
import { CalibrationTemplate } from "@/types/template";
import { getTemplate, getTemplates, createTemplate, updateTemplate } from "@/lib/templateActions";
import { CalibrationDataGrid, CustomColumn } from "@/components/calibration/CalibrationDataGrid";

export default function TemplateBuilderForm() {
  useSEO({
    title: "Template Builder Editor — GaugeMaster",
    description: "Design custom calibration templates with formula engine and custom columns",
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("id");
  const { user } = useAuth();

  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [isFullView, setIsFullView] = useState(false);
  const [existingTemplates, setExistingTemplates] = useState<CalibrationTemplate[]>([]);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instrumentType, setInstrumentType] = useState("Dial Indicator (0.001 mm)");
  const [calibrationType, setCalibrationType] = useState("dimensional");
  const [defaultUnit, setDefaultUnit] = useState("mm");
  const [defaultTolerance, setDefaultTolerance] = useState<number | "">(0.001);

  // Environmental Defaults
  const [envTemp, setEnvTemp] = useState("20");
  const [envHumidity, setEnvHumidity] = useState("55");
  const [envPressure, setEnvPressure] = useState("1013");

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
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [remarks, setRemarks] = useState("Standard calibration per ISO/IEC 17025");
  
  // Status Formula
  const [statusRuleType, setStatusRuleType] = useState<"default" | "custom_formula">("default");
  const [statusFormula, setStatusFormula] = useState<string>("");

  // Fetch all templates to validate unique template names
  useEffect(() => {
    getTemplates()
      .then((tpls) => setExistingTemplates(tpls))
      .catch(() => {});
  }, []);

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
        setEnvPressure(tpl.environmental_defaults?.pressure || "");
        setRemarks(tpl.remarks || "");
        setStatusRuleType((tpl.status_rule_type as "default" | "custom_formula") || "default");
        setStatusFormula(tpl.status_formula || "");

        if ((tpl as any).acceptance_criteria) {
          setEnableAcceptance(!!(tpl as any).acceptance_criteria.enabled);
          setAcceptanceValue((tpl as any).acceptance_criteria.value ?? 2);
          setAcceptanceType((tpl as any).acceptance_criteria.type || "percentage");
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
        if ((tpl as any).column_order) {
          setColumnOrder((tpl as any).column_order);
        }
        if ((tpl as any).hidden_columns) {
          setHiddenColumns((tpl as any).hidden_columns);
        }
      })
      .catch(() => toast.error("Failed to load template"))
      .finally(() => setLoading(false));
  }, [templateId, user?.id]);

  const selectedTypeConfig =
    CALIBRATION_TYPES.find((c) => c.type === calibrationType) || CALIBRATION_TYPES[0];

  const isNameDuplicate = existingTemplates.some(
    (t) => t.id !== templateId && t.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

  const handleSave = async () => {
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
          pressure: envPressure,
        },
        acceptance_criteria: {
          enabled: enableAcceptance,
          value: acceptanceValue === "" ? 0 : Number(acceptanceValue),
          type: acceptanceType,
        },
        calibration_points: points,
        custom_columns: customColumns,
        column_order: columnOrder,
        hidden_columns: hiddenColumns,
        remarks,
        status_rule_type: statusRuleType,
        status_formula: statusFormula,
        userId: user?.id,
      };

      if (templateId) {
        await updateTemplate(templateId, payload);
        toast.success("Template updated successfully!");
      } else {
        await createTemplate(payload);
        toast.success("Calibration template created successfully!");
      }

      navigate("/calibration/templates");
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || "Failed to save template";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-6 px-4 max-w-[1700px] mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/calibration/templates")}
            className="shrink-0"
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
            </div>
            <p className="text-xs text-muted-foreground">
              Design standardized test points, tolerances, environmental defaults & custom formula columns
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/calibration/templates")}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isNameDuplicate || !name.trim()} className="gap-2 shadow-md">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : templateId ? "Update Template" : "Save Template"}
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Column: General Settings (Hidden when Full View Grid is enabled) */}
        <Card className={`${isFullView ? "hidden" : "lg:col-span-1"} space-y-4`}>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Template Properties
            </CardTitle>
            <CardDescription className="text-xs">
              Basic identification and calibration category metadata
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Template Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g., Dial Indicator (0.001 mm) — Template A"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              <Select value={calibrationType} onValueChange={setCalibrationType}>
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
                onChange={(e) => setInstrumentType(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Default Unit</Label>
                <Input
                  placeholder="e.g. mm, bar, °C, rpm"
                  value={defaultUnit}
                  onChange={(e) => setDefaultUnit(e.target.value)}
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
                  onChange={(e) =>
                    setDefaultTolerance(e.target.value === "" ? "" : parseFloat(e.target.value))
                  }
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description / Scope</Label>
              <Textarea
                placeholder="Optional description of template specifications or procedure..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs resize-none"
                rows={3}
              />
            </div>

            {/* Environmental Conditions */}
            <div className="p-3 bg-muted/40 rounded-xl space-y-2 border">
              <Label className="text-xs font-semibold">Default Environmental Conditions</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Temp (°C)</Label>
                  <Input
                    value={envTemp}
                    onChange={(e) => setEnvTemp(e.target.value)}
                    placeholder="20"
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Humidity (%)</Label>
                  <Input
                    value={envHumidity}
                    onChange={(e) => setEnvHumidity(e.target.value)}
                    placeholder="55"
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Press (hPa)</Label>
                  <Input
                    value={envPressure}
                    onChange={(e) => setEnvPressure(e.target.value)}
                    placeholder="1013"
                    className="text-xs h-8"
                  />
                </div>
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

            {/* Remarks Template */}
            <div className="space-y-1.5">
              <Label className="text-xs">Certificate Remarks Template</Label>
              <Textarea
                placeholder="Default certificate notes or compliance remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="text-xs resize-none"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Right Columns: Interactive Data Grid (Expands to 100% full width when in Full View) */}
        <Card className={`${isFullView ? "lg:col-span-3" : "lg:col-span-2"} space-y-4`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Test Points & Custom Formula Columns
                </CardTitle>
                <CardDescription className="text-xs">
                  Pre-configure test rows, add custom columns, edit formulas with clickable variable chips, and adjust column order
                </CardDescription>
              </div>

              <Button
                variant={isFullView ? "default" : "outline"}
                size="sm"
                onClick={() => setIsFullView(!isFullView)}
                className="text-xs gap-1.5 shadow-xs shrink-0"
                title={isFullView ? "Restore Split View" : "Expand Table Grid to 100% Full Screen View"}
              >
                {isFullView ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-primary" />}
                {isFullView ? "Exit Full View" : "Full View Grid"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <CalibrationDataGrid
              typeConfig={selectedTypeConfig}
              points={points}
              onPointsChange={setPoints}
              unit={defaultUnit}
              onUnitChange={setDefaultUnit}
              tolerance={typeof defaultTolerance === "number" ? defaultTolerance : 0}
              onToleranceChange={(tol) => setDefaultTolerance(tol)}
              initialCustomColumns={customColumns}
              initialColumnOrder={columnOrder}
              initialHiddenColumns={hiddenColumns}
              onCustomColumnsChange={setCustomColumns}
              onColumnOrderChange={setColumnOrder}
              onHiddenColumnsChange={setHiddenColumns}
              acceptanceCriteria={{
                enabled: enableAcceptance,
                value: typeof acceptanceValue === "number" ? acceptanceValue : 0,
                type: acceptanceType,
              }}
              onAcceptanceCriteriaChange={(config) => {
                setEnableAcceptance(!!config.enabled);
                setAcceptanceValue(config.value ?? 2);
                if (config.type) setAcceptanceType(config.type);
              }}
              initialStatusRuleType={statusRuleType}
              initialStatusFormula={statusFormula}
              onStatusRuleChange={(type, formula) => {
                setStatusRuleType(type);
                setStatusFormula(formula);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
