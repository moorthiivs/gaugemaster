import { ReminderService } from './reminder.service';
export declare class ReminderController {
    private readonly reminderService;
    constructor(reminderService: ReminderService);
    fetchFrequencyData(query: any): Promise<import("./reminder.entity").ReminderFrequncy[]>;
    saveReminder(data: any): Promise<{
        message: string;
    }>;
    deleteReminder(body: {
        id: string;
    }): Promise<{
        message: string;
    }>;
    updateReminder(payload: any): Promise<any>;
}
