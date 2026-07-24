import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsObject,
} from 'class-validator';

export class CreateCalibrationTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  instrument_type: string;

  @IsString()
  calibration_type: string;

  @IsOptional()
  @IsString()
  default_unit?: string;

  @IsOptional()
  @IsNumber()
  default_tolerance?: number;

  @IsOptional()
  @IsObject()
  environmental_defaults?: {
    temperature?: string;
    humidity?: string;
    pressure?: string;
  };

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
  acceptance_criteria?: {
    enabled?: boolean;
    value?: number;
    type?: 'percentage' | 'absolute';
  };

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
  userId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
