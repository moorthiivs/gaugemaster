import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCalibrationProcedureDto {
  @IsNotEmpty()
  @IsString()
  process: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
