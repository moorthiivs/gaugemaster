// src/reminder/reminder.job.ts
import { createJob } from '@loctax/nest-pg-boss';

export const ReminderJob = createJob<{ reminderId: string }>('reminder.check');
