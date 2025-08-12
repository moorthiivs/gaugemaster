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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const instrument_entity_1 = require("../instruments/instrument.entity");
const typeorm_2 = require("typeorm");
let DashboardService = class DashboardService {
    instrumentRepository;
    constructor(instrumentRepository) {
        this.instrumentRepository = instrumentRepository;
    }
    async fetchDashboard(userid) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const total = await this.instrumentRepository.count({
            where: { created_by: { id: userid } },
        });
        const dueThisMonth = await this.instrumentRepository.count({
            where: {
                due_date: (0, typeorm_2.Between)(startOfMonth, endOfMonth),
                created_by: { id: userid },
            },
        });
        const overdue = await this.instrumentRepository.count({
            where: {
                due_date: (0, typeorm_2.LessThan)(now),
                created_by: { id: userid },
            },
        });
        const nextCalibrationInstrument = await this.instrumentRepository.findOne({
            where: {
                due_date: (0, typeorm_2.MoreThan)(now),
                created_by: { id: userid },
            },
            order: { due_date: 'ASC' },
        });
        const monthsCount = [];
        for (let i = -5; i <= 6; i++) {
            const firstDay = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
            const count = await this.instrumentRepository.count({
                where: {
                    due_date: (0, typeorm_2.Between)(firstDay, lastDay),
                    created_by: { id: userid },
                },
            });
            monthsCount.push({
                month: firstDay.toLocaleString('default', { month: 'short' }),
                count,
            });
        }
        const next30Days = new Date(now);
        next30Days.setDate(now.getDate() + 30);
        const dueSoonInstruments = await this.instrumentRepository.find({
            where: {
                due_date: (0, typeorm_2.Between)(now, next30Days),
                created_by: { id: userid },
            },
            order: { due_date: 'ASC' },
            select: ['id', 'name', 'due_date'],
        });
        const dueSoonList = dueSoonInstruments.map(inst => ({
            id: inst.id,
            name: inst.name,
            dueDate: inst.due_date,
        }));
        const recentActivityRaw = await this.instrumentRepository.find({
            where: { created_by: { id: userid } },
            take: 10,
            order: { updated_at: 'DESC' },
            select: ['id', 'name', 'updated_at'],
        });
        const recentActivityFormatted = recentActivityRaw.map(r => ({
            id: r.id,
            name: r.name,
            action: 'Calibrated',
            at: r.updated_at,
        }));
        return {
            total,
            dueThisMonth,
            overdue,
            nextCalibrationDate: nextCalibrationInstrument?.due_date || null,
            dueDatesByMonth: monthsCount,
            dueSoonList,
            recentActivity: recentActivityFormatted,
        };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(instrument_entity_1.Instrument)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map