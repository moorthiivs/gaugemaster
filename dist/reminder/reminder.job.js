"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderJob = void 0;
const nest_pg_boss_1 = require("@loctax/nest-pg-boss");
exports.ReminderJob = (0, nest_pg_boss_1.createJob)('reminder.check');
//# sourceMappingURL=reminder.job.js.map