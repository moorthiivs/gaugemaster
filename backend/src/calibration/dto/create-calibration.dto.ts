import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsArray,
  IsObject,
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
  };

  // Calibration Data Points
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
  decimal_places?: number;

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
  status_rule_type?: string;

  @IsOptional()
  @IsString()
  status_formula?: string;

  @IsOptional()
  @IsString()
  procedure_reference?: string;

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
