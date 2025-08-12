export declare class CreateInstrumentDto {
    id_code: string;
    name: string;
    location: string;
    frequency: string;
    last_calibration_date: string;
    due_date: string;
    agency: string;
    range: string;
    serial_no: string;
    least_count: string;
    notes?: string;
    status: string;
    custom_parameters?: Record<string, any>;
    created_by: string;
    updated_by: string;
}
