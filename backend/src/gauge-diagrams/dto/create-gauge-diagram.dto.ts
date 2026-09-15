import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGaugeDiagramDto {
  @IsNotEmpty()
  @IsString()
  gauge_name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
