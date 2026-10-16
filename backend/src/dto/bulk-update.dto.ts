import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BulkUpdatePreviewOptionsDto {
    @IsOptional()
    @IsBoolean()
    overwrite?: boolean;

    @IsOptional()
    @IsString()
    matchBy?: 'auto' | 'name_and_id_code' | 'id_code';

    @IsOptional()
    @IsString()
    companyId?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    selectedColumns?: string[];
}

export class BulkUpdatePreviewDto {
    @IsArray()
    @IsNotEmpty()
    rows: Array<{
        rowIndex: number;
        raw: Record<string, any>;
        id_code?: string;
        name?: string;
        sino?: number;
        serial_no?: string;
        part_name?: string;
        module?: string;
        [key: string]: any;
    }>;

    @IsOptional()
    options?: BulkUpdatePreviewOptionsDto;
}

export class BulkUpdateExecuteItemDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsNotEmpty()
    changes: Record<string, any>;
}

export class BulkUpdateExecuteDto {
    @IsArray()
    @IsNotEmpty()
    updates: BulkUpdateExecuteItemDto[];

    @IsOptional()
    @IsString()
    companyId?: string;
}
