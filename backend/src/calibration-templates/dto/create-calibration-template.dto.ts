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
  standard_reference?: string;

  @IsOptional()
  @IsString()
  procedure_reference?: string;

  @IsOptional()
  @IsString()
  status_rule_type?: string;

  @IsOptional()
  @IsString()
  status_formula?: string;

  @IsOptional()
  @IsObject()
  standard_columns_config?: Record<string, any>;

  @IsOptional()
  @IsNumber()
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
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
