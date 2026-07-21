import { Instrument } from './instrument.entity';
export declare class CalibrationHistory {
    id: string;
    instrument: Instrument;
    last_calibration_date: Date;
    due_date: Date;
    certificate_file: string;
    created_at: Date;
}
