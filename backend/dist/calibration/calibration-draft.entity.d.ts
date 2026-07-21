import { User } from '../users/user.entity';
export declare class CalibrationDraft {
    id: string;
    user_id: string;
    user: User;
    data: any;
    created_at: Date;
    updated_at: Date;
}
