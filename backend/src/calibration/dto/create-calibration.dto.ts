import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsArray,
  IsObject,
  IsNumber,
  ValidateIf,
} from 'class-validator';

export class CreateCalibrationDto {
  @IsString()
  instrument_id: string;

  @IsDateString()
  calibration_date: string;

  @IsOptional()
  @IsDateString()
  certificate_issue_date?: string;

  @IsOptional()
  @IsString()
  calibration_type?: string;

  // Reference Standard
  @IsOptional()
  @IsString()
  reference_standard_name?: string;

  @IsOptional()
  @IsString()
  reference_standard_id?: string;

  @IsOptional()
  @IsString()
  reference_standard_traceable_to?: string;

  @IsOptional()
  @IsDateString()
  reference_standard_validity?: string;

  @IsOptional()
  @IsString()
  reference_standard_range?: string;

  @IsOptional()
  @IsString()
  reference_standard_least_count?: string;

  @IsOptional()
  @IsArray()
  reference_standards?: any[];

  // Environmental Conditions
  @IsOptional()
  @IsObject()
  environmental_conditions?: {
    temperature: string;
    humidity: string;
    pressure?: string;
    soaking_time?: string;
    soaking_start_time?: string;
    soaking_end_time?: string;
  };

  // Calibration Data Points & Canvas Layout
  @IsOptional()
  @IsBoolean()
  is_canvas_template?: boolean;

  @IsOptional()
  @IsArray()
  layout_blocks?: any[];

  @IsOptional()
  @IsArray()
  calibration_points?: any[];

  @IsOptional()
  @IsArray()
  custom_columns?: any[];

  @IsOptional()
  @IsArray()
  column_order?: string[];

  @IsOptional()
  @IsArray()
  hidden_columns?: string[];

  @IsOptional()
  @IsObject()
  standard_columns_config?: Record<string, any>;

  @IsOptional()
  @IsString()
  template_id?: string;

  @IsOptional()
  @IsString()
  template_name?: string;

  @IsOptional()
  decimal_places?: number;

  @IsOptional()
  @IsString()
  diagram_image?: string;

  @IsOptional()
  @IsNumber()
  diagram_image_width?: number;

  @IsOptional()
  @IsNumber()
  diagram_image_height?: number;

  @IsOptional()
  @IsString()
  diagram_image_alignment?: 'center' | 'left' | 'right';

  @IsOptional()
  @IsObject()
  acceptance_criteria?: any;

  // Results
  @IsOptional()
  @IsString()
  uncertainty?: string;

  @IsOptional()
  @IsString()
  verdict?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  standard_reference?: string;

  @IsOptional()
  @IsString()
  status_rule_type?: string;

  @IsOptional()
  @IsString()
  status_formula?: string;

  @IsOptional()
  @IsString()
  procedure_reference?: string;

  @IsOptional()
  @IsString()
  doc_no?: string;

  // Approval Workflow
  @IsOptional()
  @IsString()
  approval_status?: string;

  @IsOptional()
  @IsDateString()
  approved_at?: string;

  @IsOptional()
  @IsDateString()
  rejected_at?: string;

  @IsOptional()
  @IsString()
  rejected_by?: string;

  @IsOptional()
  @IsString()
  rejection_reason?: string;

  // Signatories
  @IsOptional()
  @IsString()
  calibrated_by?: string;

  @IsOptional()
  @IsString()
  calibrated_by_designation?: string;

  @IsOptional()
  @IsString()
  calibrated_by_signature?: string;

  @IsOptional()
  @IsString()
  reviewed_by?: string;

  @IsOptional()
  @IsString()
  reviewed_by_designation?: string;

  @IsOptional()
  @IsString()
  reviewed_by_signature?: string;

  @IsOptional()
  @IsString()
  approved_by?: string;

  @IsOptional()
  @IsString()
  approved_by_designation?: string;

  @IsOptional()
  @IsString()
  approved_by_signature?: string;

  // ULR
  @IsOptional()
  @IsBoolean()
  ulr_enabled?: boolean;

  // Next calibration
  @IsOptional()
  @IsDateString()
  next_calibration_date?: string;

  // Ownership
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  created_by?: string;
}
