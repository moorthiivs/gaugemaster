"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderController = void 0;
const common_1 = require("@nestjs/common");
const reminder_service_1 = require("./reminder.service");
let ReminderController = class ReminderController {
    reminderService;
    constructor(reminderService) {
        this.reminderService = reminderService;
    }
    async testReminder() {
        return this.reminderService.handleReminderJob();
    }
};
exports.ReminderController = ReminderController;
__decorate([
    (0, common_1.Get)('test'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReminderController.prototype, "testReminder", null);
exports.ReminderController = ReminderController = __decorate([
    (0, common_1.Controller)('api/reminder'),
    __metadata("design:paramtypes", [reminder_service_1.ReminderService])
], ReminderController);
//# sourceMappingURL=reminder.controller.js.map