export interface CalibrationTemplatePoint {
  point_number: number;
  description?: string;
  nominal: number;
  tolerance?: number;
  ascending_reading?: number;
  descending_reading?: number;
  error?: number;
  unit?: string;
  status?: "PASS" | "FAIL";
  customFields?: Record<string, any>;
}

export type ColumnRole =
  | "INPUT"
  | "SPECIFICATION"
  | "NOMINAL"
  | "TOLERANCE"
  | "LOWER_LIMIT"
  | "UPPER_LIMIT"
  | "READING"
  | "CALCULATED"
  | "JUDGEMENT"
  | "METADATA"
  | "DISPLAY_ONLY"
  | "UNKNOWN";

export type ColumnSemanticRole =
  | "METADATA"
  | "SPECIFICATION"
  | "INPUT"
  | "CALCULATED"
  | "JUDGEMENT"
  | "TRIAL"
  | "SUMMARY"
  | "TRACEABILITY"
  | "PRESENTATION"
  | "UNKNOWN";

export type ColumnDataType =
  | "TEXT"
  | "NUMBER"
  | "INTEGER"
  | "BOOLEAN"
  | "DATE"
  | "DATETIME"
  | "STATUS"
  | "MEASUREMENT"
  | "DIMENSION"
  | "PERCENTAGE"
  | "FORMULA";

export type CalibrationCalculationModel =
  | "DIRECT_DEVIATION"
  | "LIMIT_COMPARISON"
  | "MULTI_TRIAL_AVERAGE"
  | "MULTI_TRIAL_ERROR"
  | "REPEATABILITY"
  | "MPE_COMPARISON"
  | "UNCERTAINTY"
  | "PASS_FAIL"
  | "CUSTOM";

export interface CanvasColumnDef {
  id: string;
  name?: string;
  label: string;
  type: "nominal" | "reading" | "trial" | "formula" | "text" | "status" | "tolerance" | "number";
  role?: ColumnRole;
  semanticRole?: ColumnSemanticRole;
  dataType?: ColumnDataType;
  formula?: string; // e.g. "actual - nominal", "AVERAGE(t1,t2,t3,t4,t5)", "actual >= lowerLimit AND actual <= upperLimit"
  sourceFormula?: string; // Original Excel formula if extracted (e.g. "=D31-C31")
  dependsOn?: string[]; // Column IDs or semantic variables required for calculation
  formulaSource?: "SOURCE_EXCEL" | "EXCEL_TRANSLATED" | "AI_INFERRED" | "SYSTEM_GENERATED" | "USER_DEFINED";
  formulaOrigin?: "SOURCE_EXCEL" | "EXCEL_TRANSLATED" | "AI_INFERRED" | "SYSTEM_GENERATED" | "USER_DEFINED";
  formulaStatus?: "VALID" | "VALIDATED" | "NEEDS_REVIEW" | "INVALID";
  formulaConfidence?: "HIGH" | "MEDIUM" | "LOW";
  formulaReviewMessage?: string;
  formulaBlankBehavior?: "DASH" | "ZERO" | "BLANK";
  blankBehavior?: "DASH" | "ZERO" | "BLANK";
  translationReason?: string;
  aiSuggestedFormula?: string;
  aiReason?: string;
  aiConfidence?: "HIGH" | "MEDIUM" | "LOW";
  aiTimestamp?: string;
  groupName?: string; // Multi-level grouped headers (e.g. "Calibration of external jaws" or "Observations")
  width?: string;
  readOnly?: boolean;
  editable?: boolean;
  unit?: string;
  decimal_places?: number;
  decimalPrecision?: number;
  hideInCertificate?: boolean;
  visibleInCertificate?: boolean;
  validationMetadata?: any;
}

export interface CanvasRowData {
  point_number: number;
  nominal?: number;
  description?: string;
  tolerance?: number;
  unit?: string;
  status?: "PASS" | "FAIL";
  customFields?: Record<string, any>;
  [key: string]: any;
}

export interface TableGridBlock {
  id: string;
  type: "table_grid";
  title: string;
  width?: "100%" | "50%" | "33%" | "66%";
  orientation?: "vertical" | "horizontal" | "auto";
  unit?: string;
  tolerance?: number;
  decimal_places?: number;
  toleranceType?: "symmetric" | "asymmetric" | "mixed" | "row_specific";
  calculationModel?: CalibrationCalculationModel;
  tableSemanticSummary?: string;
  columns: CanvasColumnDef[];
  rows: CanvasRowData[];
  aiAuditHistory?: Array<{
    timestamp: string;
    action: string;
    summary: string;
    columnId?: string;
    before?: string;
    after?: string;
    reason?: string;
  }>;
  footerNote?: string;
  marginTop?: number;
  marginBottom?: number;
}

export interface SplitRowBlock {
  id: string;
  type: "split_row";
  columnsCount: 2 | 3;
  columnRatio?: string; // e.g. "50/50" or "60/40"
  children: (TableGridBlock | TextBlock | MatrixTableBlock | BlankBlock)[];
  marginTop?: number;
  marginBottom?: number;
}

export interface MatrixHeaderCell {
  text: string;
  colSpan?: number;
  rowSpan?: number;
}

export interface MatrixTableBlock {
  id: string;
  type: "matrix_table";
  title: string;
  width?: "100%" | "50%";
  headers: MatrixHeaderCell[][];
  rows: (string | number)[][];
  footerNote?: string;
  marginTop?: number;
  marginBottom?: number;
}

export interface TextBlock {
  id: string;
  type: "text_block";
  content: string;
  style?: "standard" | "callout" | "bold" | "centered" | "bordered";
  marginTop?: number;
  marginBottom?: number;
}

export interface DiagramBlock {
  id: string;
  type: "diagram_block";
  imageUrl: string;
  width: number;
  height: number;
  alignment: "center" | "left" | "right";
  caption?: string;
  marginTop?: number;
  marginBottom?: number;
}

export interface PageBreakBlock {
  id: string;
  type: "page_break";
  label?: string;
  marginTop?: number;
  marginBottom?: number;
}

export interface BlankBlock {
  id: string;
  type: "blank" | "empty";
  content?: string;
  marginTop?: number;
  marginBottom?: number;
}

export type CanvasBlock =
  | TableGridBlock
  | SplitRowBlock
  | MatrixTableBlock
  | TextBlock
  | DiagramBlock
  | PageBreakBlock
  | BlankBlock;

export interface CalibrationTemplate {
  id: string;
  name: string;
  description?: string;
  instrument_type: string; // e.g. "Dial Indicator (0.001 mm)", "Snap Gauge", "Plug Gauge", "Vernier Caliper"
  calibration_type: string; // e.g. "dimensional", "length", "pressure", "temperature", "torque", "electrical", "weight", "flow"
  default_unit?: string;
  default_tolerance?: number;
  environmental_defaults?: {
    temperature?: string;
    humidity?: string;
    pressure?: string;
    soaking_time?: string;
    soaking_start_time?: string;
    soaking_end_time?: string;
  };
  is_canvas_template?: boolean;
  layout_blocks?: CanvasBlock[];
  calibration_points?: CalibrationTemplatePoint[];
  custom_columns?: any[];
  standard_columns_config?: Record<string, any>;
  column_order?: string[];
  hidden_columns?: string[];
  acceptance_criteria?: {
    enabled?: boolean;
    value?: number;
    type?: "percentage" | "absolute";
  };
  remarks?: string;
  standard_reference?: string;
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
  status_rule_type?: string;
  status_formula?: string;
  decimal_places?: number;
  diagram_image?: string;
  diagram_image_width?: number;
  diagram_image_height?: number;
  diagram_image_alignment?: "center" | "left" | "right";
  userId?: string;
  user?: any;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

