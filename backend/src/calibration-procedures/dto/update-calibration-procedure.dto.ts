import { IsOptional, IsString } from 'class-validator';

export class UpdateCalibrationProcedureDto {
  @IsOptional()
  @IsString()
  process?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  actionDetails?: string;
}
