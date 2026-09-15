import { IsOptional, IsString } from 'class-validator';

export class UpdateWorkInstructionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  actionDetails?: string;
}
