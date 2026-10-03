import { Instrument } from "./instrument";
import type { CanvasBlock } from "./template";

/**
 * A single calibration data point.
 */
export interface CalibrationPoint {
  point_number: number;
  description?: string;
  required_dimension?: number | string;
  nominal: number;
  ascending_reading: number;
  descending_reading?: number;
  error: number;
  unit: string;
  tolerance?: number;
  status?: "PASS" | "FAIL";
  customFields?: Record<string, unknown>;
}

/**
 * A complete calibration record.
 */
export interface CalibrationRecord {
  id: string;
  instrument: Instrument;
  instrument_id: string;
  calibration_date: string;
  calibration_type: string;

  // Reference Standard
  reference_standard_name: string;
  reference_standard_id: string;
  reference_standard_traceable_to: string;
  reference_standard_validity?: string;
  reference_standard_range?: string;
  reference_standard_least_count?: string;
  reference_standards?: Record<string, unknown>[];

  // Environmental
  environmental_conditions: {
    temperature: string;
    humidity: string;
    pressure?: string;
    soaking_time?: string;
    soaking_start_time?: string;
    soaking_end_time?: string;
    receipt_condition?: string;
  };
  receipt_condition?: string;

  procedure_reference?: string;
  procedure_no?: string;
  procedure_name?: string;
  procedure_date?: string;
  procedure_rev?: string;
  doc_no?: string;
  doc_date?: string;
  doc_rev?: string;
  acceptance_criteria_doc_no?: string;
  acceptance_criteria_date?: string;
  acceptance_criteria_rev?: string;
  acceptance_criteria_reference?: string;

  // Data
  is_canvas_template?: boolean;
  layout_blocks?: CanvasBlock[] | Record<string, unknown>[];
  calibration_points: CalibrationPoint[];
  custom_columns?: Record<string, unknown>[];
  standard_columns_config?: Record<string, unknown>;
  acceptance_criteria?: Record<string, unknown> | string;
  decimal_places?: number;
  column_order?: string[];
  hidden_columns?: string[];
  template_id?: string;
  template_name?: string;
  template?: Record<string, unknown>;
  diagram_image?: string;
  diagram_image_width?: number;
  diagram_image_height?: number;
  diagram_image_alignment?: "center" | "left" | "right";

  // Results
  uncertainty: string;
  verdict: "PASS" | "FAIL" | "CONDITIONAL";
  remarks?: string;
  standard_reference?: string;
  status_rule_type?: string;
  status_formula?: string;

  // Signatories
  calibrated_by: string;
  calibrated_by_designation?: string;
  calibrated_by_signature?: string;
  reviewed_by: string;
  reviewed_by_designation?: string;
  reviewed_by_signature?: string;
  approved_by: string;
  approved_by_designation?: string;
  approved_by_signature?: string;

  // Certificate & ULR
  certificate_number: string;
  ulr_number?: string;
  ulr_enabled: boolean;
  certificate_generated: boolean;
  certificate_file?: string;
  next_calibration_date?: string;
  certificate_issue_date?: string;

  // Audit
  companyId?: string;
  created_by?: string | Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

/**
 * Certificate & ULR configuration stored in Settings.
 */
export interface CertificateConfig {
  certPrefix: string;
  certSeparator: string;
  certYearFormat: string;
  certSeqLength: number;
  certNextSeq: number;
  ulrPrefix: string;
  ulrSeparator: string;
  ulrYearFormat: string;
  ulrSeqLength: number;
  ulrNextSeq: number;
}

/**
 * Calibration statistics for the dashboard.
 */
export interface CalibrationStats {
  total: number;
  passed: number;
  failed: number;
  pendingCerts: number;
  passRate: number;
}

/**
 * Column configuration for each instrument calibration type.
 */
export interface CalibrationTypeConfig {
  type: string;
  label: string;
  icon: string;
  description: string;
  columns: {
    key: string;
    label: string;
    unit?: string;
  }[];
  defaultUnit: string;
  units: string[];
}

/**
 * All supported calibration type configurations.
 */
export const CALIBRATION_TYPES: CalibrationTypeConfig[] = [
  {
    type: "pressure",
    label: "Pressure Gauge",
    icon: "Gauge",
    description: "Dial, Digital & Differential Pressure Gauges",
    columns: [
      { key: "nominal", label: "Nominal" },
      { key: "ascending_reading", label: "Ascending" },
      { key: "descending_reading", label: "Descending" },
      { key: "error", label: "Error" },
    ],
    defaultUnit: "Bar",
    units: ["Bar", "PSI", "kPa", "MPa", "kg/cm²", "mmHg"],
  },
  {
    type: "temperature",
    label: "Temperature Instrument",
    icon: "Thermometer",
    description: "Thermocouples, RTDs, Thermometers",
    columns: [
      { key: "nominal", label: "Set Point" },
      { key: "ascending_reading", label: "Indicated" },
      { key: "error", label: "Correction" },
    ],
    defaultUnit: "°C",
    units: ["°C", "°F", "K"],
  },
  {
    type: "dimensional",
    label: "Dimensional / Length",
    icon: "Ruler",
    description: "Calipers, Micrometers, Gauge Blocks, Height Gauges",
    columns: [
      { key: "nominal", label: "Nominal" },
      { key: "ascending_reading", label: "Actual" },
      { key: "error", label: "Error" },
    ],
    defaultUnit: "mm",
    units: ["mm", "inch", "µm"],
  },
  {
    type: "torque",
    label: "Torque",
    icon: "RotateCw",
    description: "Torque Wrenches, Torque Analyzers",
    columns: [
      { key: "nominal", label: "Set Torque" },
      { key: "ascending_reading", label: "Measured" },
      { key: "error", label: "Error %" },
    ],
    defaultUnit: "Nm",
    units: ["Nm", "ft-lb", "kg-cm", "in-lb"],
  },
  {
    type: "electrical",
    label: "Electrical Meter",
    icon: "Zap",
    description: "Multimeters, Clamp Meters, Insulation Testers",
    columns: [
      { key: "nominal", label: "Applied" },
      { key: "ascending_reading", label: "Indicated" },
      { key: "error", label: "Error" },
    ],
    defaultUnit: "V",
    units: ["V", "mV", "A", "mA", "Ω", "kΩ", "MΩ"],
  },
  {
    type: "weight",
    label: "Weighing Scale / Balance",
    icon: "Scale",
    description: "Digital Balances, Platform Scales",
    columns: [
      { key: "nominal", label: "Standard Weight" },
      { key: "ascending_reading", label: "Indicated" },
      { key: "error", label: "Error" },
    ],
    defaultUnit: "kg",
    units: ["kg", "g", "mg", "lb"],
  },
  {
    type: "flow",
    label: "Flow Meter",
    icon: "Droplets",
    description: "Flow Meters, Rotameters",
    columns: [
      { key: "nominal", label: "Set Flow" },
      { key: "ascending_reading", label: "Measured" },
      { key: "error", label: "Error %" },
    ],
    defaultUnit: "L/min",
    units: ["L/min", "m³/h", "GPM"],
  },
];

export interface CalibrationAuditLog {
  id: string;
  calibration_id: string;
  edited_by_id?: string;
  edited_by_name?: string;
  edited_by?: string | Record<string, unknown>;
  changes_summary: { field: string; oldValue: unknown; newValue: unknown }[];
  remarks?: string;
  edited_at: string;
}
