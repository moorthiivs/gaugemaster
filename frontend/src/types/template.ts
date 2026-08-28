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

export interface CanvasColumnDef {
  id: string;
  label: string;
  type: "nominal" | "reading" | "trial" | "formula" | "text" | "status" | "tolerance";
  formula?: string; // e.g. "AVERAGE(t1,t2,t3,t4,t5)", "avg - nominal", "IF(ABS(err)<=0.02, 'PASS', 'FAIL')"
  groupName?: string; // Multi-level grouped headers (e.g. "Calibration of external jaws" or "Observations")
  width?: string;
  readOnly?: boolean;
  unit?: string;
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
  orientation?: "vertical" | "horizontal";
  unit?: string;
  tolerance?: number;
  decimal_places?: number;
  columns: CanvasColumnDef[];
  rows: CanvasRowData[];
  footerNote?: string;
  marginBottom?: number;
}

export interface SplitRowBlock {
  id: string;
  type: "split_row";
  columnsCount: 2 | 3;
  columnRatio?: string; // e.g. "50/50" or "60/40"
  children: (TableGridBlock | TextBlock | MatrixTableBlock | BlankBlock)[];
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
  marginBottom?: number;
}

export interface TextBlock {
  id: string;
  type: "text_block";
  content: string;
  style?: "standard" | "callout" | "bold" | "centered" | "bordered";
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
}

export interface PageBreakBlock {
  id: string;
  type: "page_break";
  label?: string;
}

export interface BlankBlock {
  id: string;
  type: "blank" | "empty";
  content?: string;
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
  doc_no?: string;
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

