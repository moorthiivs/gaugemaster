import { Company } from '../company/entities/company.entity';
import { User } from '../users/user.entity';
export declare class ReminderFrequncy {
    id: string;
    no_of_mails: number;
    when: string;
    reminder_start: number;
    reminder_start_unit: string;
    reminder_field: string;
    reminder_date: Date;
    mail_times: {
        date: any;
        time: string;
    }[];
    priority: string;
    mail_template: string;
    recipient_role: string;
    email_mode: string;
    isactive: boolean;
    created_at: Date;
    updated_at: Date;
    created_by?: User;
    updated_by?: User;
    company?: Company;
    companyId: string;
}
