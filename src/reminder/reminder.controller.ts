import { Body, Controller, Delete, Get, Post, Put, Query } from '@nestjs/common';
import { ReminderService } from './reminder.service';

@Controller('api/reminder')
export class ReminderController {
    constructor(private readonly reminderService: ReminderService) { }

    // @Get('test')
    // async testReminder() {
    //     return this.reminderService.handleReminderJob();
    // }

    @Get('frequencyData')
    async fetchFrequencyData(@Query() query: any) {
        return this.reminderService.fetchrequencyData(query);
    }

    @Post('saveReminder')
    async saveReminder(@Body() data: any) {
        return this.reminderService.saveReminder(data)
    }


    @Delete('deleteReminder')
    async deleteReminder(@Body() body: { id: string }) {
        return this.reminderService.deleteReminder(body.id);
    }


    @Put('updateReminder')
    async updateReminder(@Body() payload: any) {
        return this.reminderService.updateReminder(payload);
    }


}
