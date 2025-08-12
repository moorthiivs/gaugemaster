import { User } from 'src/users/user.entity';
export declare class Instrument {
    id: string;
    id_code: string;
    name: string;
    location: string;
    frequency: string;
    last_calibration_date: Date;
    due_date: Date;
    agency: string;
    range: string;
    serial_no: string;
    least_count: string;
    notes: string;
    status: string;
    custom_parameters: Record<string, any>;
    created_at: Date;
    updated_at: Date;
    created_by?: User;
    updated_by?: User;
}
