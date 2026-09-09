import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsObject } from 'class-validator';

export class CreateLabelPrintHistoryDto {
  @IsString()
  @IsNotEmpty()
  action: string; // 'PRINT_LABEL' | 'DOWNLOAD_XLSX'

  @IsString()
  @IsOptional()
  status?: string; // 'Print Label' | 'Download XLSX'

  @IsNumber()
  @IsOptional()
  itemsCount?: number;

  @IsArray()
  @IsOptional()
  selectedFields?: string[];

  @IsObject()
  @IsOptional()
  labelConfig?: Record<string, any>;

  @IsArray()
  @IsNotEmpty()
  items: Array<Record<string, any>>;
}
