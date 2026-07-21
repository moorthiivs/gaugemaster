import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsDateString,
    IsIn,
    IsNumber,
    IsBoolean,
} from 'class-validator';

export class CreateInstrumentDto {
    @IsString()
    @IsNotEmpty()
    id_code: string;

    @IsNumber()
    @IsOptional()
    sino: string;

    @IsString()
    @IsNotEmpty()
    name: string;


    @IsString()
    @IsNotEmpty()
    location: string;

    @IsString()
    @IsNotEmpty()
    frequency: string;

    @IsDateString()
    last_calibration_date: string;

    @IsDateString()
    due_date: string;

    @IsString()
    @IsNotEmpty()
    agency: string;

    @IsString()
    @IsNotEmpty()
    range: string;

    @IsString()
    @IsNotEmpty()
    serial_no: string;

    @IsString()
    @IsNotEmpty()
    least_count: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    remarks?: string;

    @IsString()
    @IsNotEmpty()
    status: string;

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
