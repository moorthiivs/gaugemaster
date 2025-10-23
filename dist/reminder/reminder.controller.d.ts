import { ReminderService } from './reminder.service';
export declare class ReminderController {
    private readonly reminderService;
    constructor(reminderService: ReminderService);
    testReminder(): Promise<void>;
}
