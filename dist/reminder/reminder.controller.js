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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
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
    async fetchFrequencyData(query) {
        return this.reminderService.fetchrequencyData(query);
    }
    async saveReminder(data) {
        return this.reminderService.saveReminder(data);
    }
    async deleteReminder(body) {
        return this.reminderService.deleteReminder(body.id);
    }
    async updateReminder(payload) {
        return this.reminderService.updateReminder(payload);
    }
};
exports.ReminderController = ReminderController;
__decorate([
    (0, common_1.Get)('frequencyData'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReminderController.prototype, "fetchFrequencyData", null);
__decorate([
    (0, common_1.Post)('saveReminder'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReminderController.prototype, "saveReminder", null);
__decorate([
    (0, common_1.Delete)('deleteReminder'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReminderController.prototype, "deleteReminder", null);
__decorate([
    (0, common_1.Put)('updateReminder'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReminderController.prototype, "updateReminder", null);
exports.ReminderController = ReminderController = __decorate([
    (0, common_1.Controller)('api/reminder'),
    __metadata("design:paramtypes", [reminder_service_1.ReminderService])
], ReminderController);
//# sourceMappingURL=reminder.controller.js.map