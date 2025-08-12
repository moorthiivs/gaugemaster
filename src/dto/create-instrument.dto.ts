import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsDateString,
    IsIn,
} from 'class-validator';

export class CreateInstrumentDto {
    @IsString()
    @IsNotEmpty()
    id_code: string;

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

    @IsString()
    @IsIn(['OK', 'Overdue', 'Pending'])
    status: string;

    @IsOptional()
    custom_parameters?: Record<string, any>;

    @IsString()
    @IsNotEmpty()
    created_by: string;

    @IsString()
    @IsNotEmpty()
    updated_by: string;
}
