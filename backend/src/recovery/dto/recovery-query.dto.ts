import { IsOptional, IsString, IsInt, Min, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class RecoveryQueryDto {
  @IsOptional()
  @IsString()
  module?: string; // 'all' | 'calibrations' | 'instruments' | 'templates' | 'calibration_procedures' | 'work_instructions' | 'gauge_diagrams'

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  deletedBy?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class RecoveryBulkItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  module: string;
}

export class BulkRestoreDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecoveryBulkItemDto)
  items: RecoveryBulkItemDto[];
}

export class BulkPermanentDeleteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecoveryBulkItemDto)
  items: RecoveryBulkItemDto[];
}

