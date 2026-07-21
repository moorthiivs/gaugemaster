export declare class CreateCalibrationDto {
    instrument_id: string;
    calibration_date: string;
    calibration_type?: string;
    reference_standard_name?: string;
    reference_standard_id?: string;
    reference_standard_traceable_to?: string;
    reference_standard_validity?: string;
    reference_standard_range?: string;
    reference_standard_least_count?: string;
    reference_standards?: any[];
    environmental_conditions?: {
        temperature: string;
        humidity: string;
        pressure?: string;
    };
    calibration_points?: any[];
    uncertainty?: string;
    verdict?: string;
    remarks?: string;
    calibrated_by?: string;
    calibrated_by_designation?: string;
    reviewed_by?: string;
    reviewed_by_designation?: string;
    approved_by?: string;
    approved_by_designation?: string;
    ulr_enabled?: boolean;
    next_calibration_date?: string;
    companyId?: string;
    created_by?: string;
}
