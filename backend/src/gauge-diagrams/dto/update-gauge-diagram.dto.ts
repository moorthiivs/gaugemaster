import { IsOptional, IsString } from 'class-validator';

export class UpdateGaugeDiagramDto {
  @IsOptional()
  @IsString()
  gauge_name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  actionDetails?: string;
}
