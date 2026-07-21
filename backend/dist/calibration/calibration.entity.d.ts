import { Company } from '../company/entities/company.entity';
import { Instrument } from '../instruments/instrument.entity';
import { User } from '../users/user.entity';
export declare class Calibration {
    id: string;
    instrument: Instrument;
    instrument_id: string;
    calibration_date: Date;
    calibration_type: string;
    reference_standard_name: string;
    reference_standard_id: string;
    reference_standard_traceable_to: string;
    reference_standard_validity: Date;
    reference_standard_range: string;
    reference_standard_least_count: string;
    reference_standards: any[];
    environmental_conditions: {
        temperature: string;
        humidity: string;
        pressure?: string;
    };
    calibration_points: CalibrationPoint[];
    uncertainty: string;
    verdict: string;
    remarks: string;
    calibrated_by: string;
    calibrated_by_designation: string;
    reviewed_by: string;
    reviewed_by_designation: string;
    approved_by: string;
    approved_by_designation: string;
    certificate_number: string;
    ulr_number?: string;
    ulr_enabled: boolean;
    certificate_generated: boolean;
    certificate_file: string;
    next_calibration_date: Date;
    company?: Company;
    companyId: string;
    created_by?: User;
    created_at: Date;
    updated_at: Date;
}
export interface CalibrationPoint {
    point_number: number;
    nominal: number;
    ascending_reading: number;
    descending_reading?: number;
    error: number;
    unit: string;
    tolerance?: number;
    status?: 'PASS' | 'FAIL';
}
