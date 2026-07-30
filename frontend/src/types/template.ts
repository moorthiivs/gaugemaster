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

export interface CalibrationTemplate {
  id: string;
  name: string;
  description?: string;
  instrument_type: string; // e.g. "Dial Indicator (0.001 mm)", "Snap Gauge", "Plug Gauge"
  calibration_type: string; // e.g. "dimensional", "length", "pressure", "temperature", "torque", "electrical", "weight", "flow"
  default_unit?: string;
  default_tolerance?: number;
  environmental_defaults?: {
    temperature?: string;
    humidity?: string;
    pressure?: string;
  };
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
  status_rule_type?: string;
  status_formula?: string;
  decimal_places?: number;
  userId?: string;
  user?: any;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}
