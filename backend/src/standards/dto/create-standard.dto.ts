import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStandardDto {
  @IsNotEmpty()
  @IsString()
  standard_number: string;

  @IsNotEmpty()
  @IsString()
  standard_name: string;

  @IsNotEmpty()
  @IsString()
  standard_type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
