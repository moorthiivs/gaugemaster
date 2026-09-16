import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGaugeDiagramDto {
  @IsNotEmpty()
  @IsString()
  gauge_name: string;

  @IsOptional()
  @IsString()
  id_code?: string;

  @IsOptional()
  @IsString()
  part_name?: string;

  @IsOptional()
  @IsString()
  instrument_id?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
