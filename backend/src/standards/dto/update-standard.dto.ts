import { IsOptional, IsString } from 'class-validator';

export class UpdateStandardDto {
  @IsOptional()
  @IsString()
  standard_number?: string;

  @IsOptional()
  @IsString()
  standard_name?: string;

  @IsOptional()
  @IsString()
  standard_type?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  actionDetails?: string;
}

