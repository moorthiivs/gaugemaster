import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateWorkInstructionDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
