import { IsOptional, IsString } from 'class-validator';

export class UpdateWorkInstructionDto {
  @IsOptional()
  @IsString()
  title?: string;

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
  actionDetails?: string;
}
