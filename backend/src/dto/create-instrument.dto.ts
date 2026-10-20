import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsDateString,
    IsIn,
    IsBoolean,
    ValidateIf,
} from 'class-validator';

export class CreateInstrumentDto {
    @IsString()
    @IsNotEmpty()
    id_code: string;

    @IsOptional()
    sino?: number;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    location?: string;

    @IsOptional()
    @IsString()
    frequency?: string;

    @IsOptional()
    @ValidateIf((o, v) => v != null && v !== '')
    @IsDateString()
    last_calibration_date?: string;

    @IsOptional()
    @ValidateIf((o, v) => v != null && v !== '')
    @IsDateString()
    due_date?: string;

    @IsOptional()
    @IsString()
    agency?: string;

    @IsOptional()
    @IsString()
    range?: string;

    @IsOptional()
    @IsString()
    serial_no?: string;

    @IsOptional()
    @IsString()
    least_count?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    remarks?: string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    item_status?: string;

    @IsOptional()
    @IsString()
    make?: string;

    @IsOptional()
    @IsString()
    item_type?: string;

    @IsOptional()
    @IsString()
    device_type?: string;

    @IsOptional()
    @IsString()
    part_no?: string;

    @IsOptional()
    @IsString()
    part_name?: string;

    @IsOptional()
    @IsString()
    module?: string;

    @IsOptional()
    @IsString()
    calibration_source?: string;

    @IsOptional()
    @ValidateIf((o, v) => v != null && v !== '')
    @IsDateString()
    gauge_issue_date?: string;

    @IsOptional()
    @IsString()
    gauges_received_by?: string;

    @IsOptional()
    @IsString()
    gauges_issued_by?: string;

    @IsOptional()
    @IsString()
    calibration_procedure?: string;

    @IsOptional()
    @IsString()
    traceable?: string;

    @IsOptional()
    @IsString()
    customer?: string;

    @IsOptional()
    @IsString()
    sector?: string;

    @IsOptional()
    @IsString()
    criticality_level?: string;

    @IsOptional()
    @IsString()
    cert_no?: string;

    @IsOptional()
    custom_parameters?: Record<string, any>;

    @IsOptional()
    @IsString()
    certificate_file?: string;

    @IsString()
    @IsNotEmpty()
    created_by: string;

    @IsOptional()
    @IsString()
    updated_by?: string;

    @IsString()
    @IsNotEmpty()
    companyId: string;

    @IsOptional()
    @IsBoolean()
    is_reference_standard?: boolean;
}
