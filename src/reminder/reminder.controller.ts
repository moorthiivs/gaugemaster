import { Controller, Get } from '@nestjs/common';
import { ReminderService } from './reminder.service';

@Controller('api/reminder')
export class ReminderController {
    constructor(private readonly reminderService: ReminderService) { }

    @Get('test')
    async testReminder() {
        return this.reminderService.handleReminderJob();
    }
}
