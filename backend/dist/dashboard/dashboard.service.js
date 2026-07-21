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
const calibration_history_entity_1 = require("../instruments/calibration-history.entity");
const typeorm_2 = require("typeorm");
let DashboardService = class DashboardService {
    instrumentRepository;
    calibrationHistoryRepository;
    constructor(instrumentRepository, calibrationHistoryRepository) {
        this.instrumentRepository = instrumentRepository;
        this.calibrationHistoryRepository = calibrationHistoryRepository;
    }
    async fetchDashboard(userid, startDateStr, endDateStr, itemStatus, status, location) {
        const tzOffsetMinutes = parseInt(process.env.TIMEZONE_OFFSET || '330', 10);
        const now = new Date();
        let startRange;
        let endRange;
        if (startDateStr && endDateStr) {
            const sParts = startDateStr.split('-').map(Number);
            const eParts = endDateStr.split('-').map(Number);
            startRange = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
            endRange = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
        }
        else {
            const nowUtc = new Date();
            const nowLocal = new Date(nowUtc.getTime() + tzOffsetMinutes * 60 * 1000);
            const startYear = nowLocal.getFullYear();
            const startMonth = nowLocal.getMonth();
            startRange = new Date(Date.UTC(startYear, startMonth, 1, 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
            endRange = new Date(Date.UTC(startYear, startMonth + 1, 0, 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
        }
        const getBaseWhere = (extraConditions = {}) => ({
            created_by: { id: userid },
            ...(itemStatus ? { item_status: (0, typeorm_2.ILike)(itemStatus) } : {}),
            ...(status ? { status: (0, typeorm_2.ILike)(status) } : {}),
            ...(location ? { location: (0, typeorm_2.ILike)(location) } : {}),
            ...extraConditions,
        });
        const countHistoryCalibrations = async (startDate, endDate) => {
            const query = this.calibrationHistoryRepository.createQueryBuilder('history')
                .innerJoin('history.instrument', 'instrument')
                .select('COUNT(DISTINCT instrument.id)', 'count')
                .where('instrument.created_by = :userid', { userid });
            if (itemStatus) {
                query.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
            }
            if (status) {
                query.andWhere('instrument.status ILIKE :status', { status });
            }
            if (location) {
                query.andWhere('instrument.location ILIKE :location', { location });
            }
            query.andWhere('history.created_at BETWEEN :startDate AND :endDate', { startDate, endDate });
            const result = await query.getRawOne();
            return Number(result.count || 0);
        };
        const total = await this.instrumentRepository.count({
            where: getBaseWhere(),
        });
        const overdue = await this.instrumentRepository.count({
            where: getBaseWhere({
                due_date: (0, typeorm_2.LessThan)(now),
            }),
        });
        const nextCalibrationInstrument = await this.instrumentRepository.findOne({
            where: getBaseWhere({
                due_date: (0, typeorm_2.MoreThan)(now),
            }),
            order: { due_date: 'ASC' },
        });
        const calibratedCount = await countHistoryCalibrations(startRange, endRange);
        const pendingCount = await this.instrumentRepository.count({
            where: getBaseWhere({
                due_date: (0, typeorm_2.Between)(startRange, endRange),
            }),
        });
        const dueThisMonth = pendingCount + calibratedCount;
        const monthsCount = [];
        if (startDateStr && endDateStr) {
            let current = new Date(startRange.getTime());
            let monthsChecked = 0;
            while (current <= endRange && monthsChecked < 24) {
                const curLocal = new Date(current.getTime() + tzOffsetMinutes * 60 * 1000);
                const firstDayLocal = new Date(Date.UTC(curLocal.getFullYear(), curLocal.getMonth(), 1, 0, 0, 0, 0));
                const lastDayLocal = new Date(Date.UTC(curLocal.getFullYear(), curLocal.getMonth() + 1, 0, 23, 59, 59, 999));
                const firstDay = new Date(firstDayLocal.getTime() - tzOffsetMinutes * 60 * 1000);
                const lastDay = new Date(lastDayLocal.getTime() - tzOffsetMinutes * 60 * 1000);
                const pendingCount = await this.instrumentRepository.count({
                    where: getBaseWhere({
                        due_date: (0, typeorm_2.Between)(firstDay, lastDay),
                    }),
                });
                const actualCount = await countHistoryCalibrations(firstDay, lastDay);
                const planCount = pendingCount + actualCount;
                monthsCount.push({
                    month: firstDayLocal.toLocaleString('default', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
                    plan: planCount,
                    actual: actualCount,
                });
                const nextMonthLocal = new Date(Date.UTC(curLocal.getFullYear(), curLocal.getMonth() + 1, 1));
                current = new Date(nextMonthLocal.getTime() - tzOffsetMinutes * 60 * 1000);
                monthsChecked++;
            }
        }
        else {
            for (let i = -5; i <= 6; i++) {
                const nowUtc = new Date();
                const nowLocal = new Date(nowUtc.getTime() + tzOffsetMinutes * 60 * 1000);
                const firstDayLocal = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth() + i, 1, 0, 0, 0, 0));
                const lastDayLocal = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth() + i + 1, 0, 23, 59, 59, 999));
                const firstDay = new Date(firstDayLocal.getTime() - tzOffsetMinutes * 60 * 1000);
                const lastDay = new Date(lastDayLocal.getTime() - tzOffsetMinutes * 60 * 1000);
                const pendingCount = await this.instrumentRepository.count({
                    where: getBaseWhere({
                        due_date: (0, typeorm_2.Between)(firstDay, lastDay),
                    }),
                });
                const actualCount = await countHistoryCalibrations(firstDay, lastDay);
                const planCount = pendingCount + actualCount;
                monthsCount.push({
                    month: firstDayLocal.toLocaleString('default', { month: 'short', timeZone: 'UTC' }),
                    plan: planCount,
                    actual: actualCount,
                });
            }
        }
        let dueSoonInstruments;
        if (startDateStr && endDateStr) {
            dueSoonInstruments = await this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: (0, typeorm_2.Between)(startRange, endRange),
                }),
                order: { due_date: 'ASC' },
                select: ['id', 'name', 'due_date'],
            });
        }
        else {
            const next30Days = new Date(now);
            next30Days.setDate(now.getDate() + 30);
            dueSoonInstruments = await this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: (0, typeorm_2.Between)(now, next30Days),
                }),
                order: { due_date: 'ASC' },
                select: ['id', 'name', 'due_date'],
            });
        }
        const dueSoonList = dueSoonInstruments.map(inst => ({
            id: inst.id,
            name: inst.name,
            dueDate: inst.due_date,
        }));
        const recentActivityRaw = await this.instrumentRepository.find({
            where: getBaseWhere(),
            take: 10,
            order: { updated_at: 'DESC' },
            select: ['id', 'name', 'status', 'updated_at'],
        });
        const recentActivityFormatted = recentActivityRaw.map(r => {
            let action = 'Updated';
            if (r.status === 'OK')
                action = 'Calibrated';
            else if (r.status === 'OVER DUE' || r.status === 'Overdue')
                action = 'Overdue';
            else if (r.status === 'DUE SOON')
                action = 'Due Soon';
            else if (r.status === 'Sent for Calibration')
                action = 'Sent for Calibration';
            else if (r.status)
                action = r.status;
            return {
                id: r.id,
                name: r.name,
                action,
                at: r.updated_at,
            };
        });
        const statusQuery = this.instrumentRepository
            .createQueryBuilder('instrument')
            .select('instrument.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .where('instrument.created_by = :userid', { userid });
        const itemStatusQuery = this.instrumentRepository
            .createQueryBuilder('instrument')
            .select('instrument.item_status', 'item_status')
            .addSelect('COUNT(*)', 'count')
            .where('instrument.created_by = :userid', { userid });
        if (startDateStr && endDateStr) {
            statusQuery.andWhere('instrument.due_date BETWEEN :startRange AND :endRange', { startRange, endRange });
            itemStatusQuery.andWhere('instrument.due_date BETWEEN :startRange AND :endRange', { startRange, endRange });
        }
        if (itemStatus) {
            statusQuery.andWhere('instrument.item_status = :itemStatus', { itemStatus });
            itemStatusQuery.andWhere('instrument.item_status = :itemStatus', { itemStatus });
        }
        if (status) {
            statusQuery.andWhere('instrument.status = :status', { status });
            itemStatusQuery.andWhere('instrument.status = :status', { status });
        }
        const statusGroups = await statusQuery.groupBy('instrument.status').getRawMany();
        const itemStatusGroups = await itemStatusQuery.groupBy('instrument.item_status').getRawMany();
        const statusDistribution = statusGroups.map(g => ({
            name: g.status || 'OK',
            value: Number(g.count),
        }));
        const itemStatusDistribution = itemStatusGroups.map(g => ({
            name: g.item_status || 'Active',
            value: Number(g.count),
        }));
        const weeklyCompleted = [];
        {
            const startRangeLocal = new Date(startRange.getTime() + tzOffsetMinutes * 60 * 1000);
            const endRangeLocal = new Date(endRange.getTime() + tzOffsetMinutes * 60 * 1000);
            const wStartLocal = new Date(Date.UTC(startRangeLocal.getFullYear(), startRangeLocal.getMonth(), startRangeLocal.getDate()));
            const dayOfWeek = wStartLocal.getUTCDay();
            const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const weekCursorLocal = new Date(wStartLocal);
            weekCursorLocal.setUTCDate(weekCursorLocal.getUTCDate() + mondayOffset);
            let weeksChecked = 0;
            while (weekCursorLocal <= endRangeLocal && weeksChecked < 52) {
                const wStartUtc = new Date(weekCursorLocal.getTime() - tzOffsetMinutes * 60 * 1000);
                const wEndUtc = new Date(weekCursorLocal.getTime() + 7 * 24 * 60 * 60 * 1000 - 1 - tzOffsetMinutes * 60 * 1000);
                const completed = await countHistoryCalibrations(wStartUtc, wEndUtc);
                const weekStartLocal = new Date(weekCursorLocal);
                const weekEndLocal = new Date(weekCursorLocal.getTime() + 6 * 24 * 60 * 60 * 1000);
                const label = `${weekStartLocal.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${weekEndLocal.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
                weeklyCompleted.push({ week: label, completed });
                weekCursorLocal.setUTCDate(weekCursorLocal.getUTCDate() + 7);
                weeksChecked++;
            }
        }
        const dailyCompleted = [];
        {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const nowUtc = new Date();
            const nowLocal = new Date(nowUtc.getTime() + tzOffsetMinutes * 60 * 1000);
            const endRangeLocal = new Date(endRange.getTime() + tzOffsetMinutes * 60 * 1000);
            const anchorLocal = endRangeLocal < nowLocal ? endRangeLocal : nowLocal;
            for (let i = 6; i >= 0; i--) {
                const dLocal = new Date(anchorLocal);
                dLocal.setDate(dLocal.getDate() - i);
                const dUtcStart = new Date(Date.UTC(dLocal.getFullYear(), dLocal.getMonth(), dLocal.getDate(), 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
                const dUtcEnd = new Date(Date.UTC(dLocal.getFullYear(), dLocal.getMonth(), dLocal.getDate(), 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
                if (dUtcEnd < startRange)
                    continue;
                const completed = await countHistoryCalibrations(dUtcStart, dUtcEnd);
                const year = dLocal.getFullYear();
                const month = String(dLocal.getMonth() + 1).padStart(2, '0');
                const dateVal = String(dLocal.getDate()).padStart(2, '0');
                const dateLabel = `${year}-${month}-${dateVal}`;
                dailyCompleted.push({
                    day: dayNames[dLocal.getDay()],
                    date: dateLabel,
                    completed,
                });
            }
        }
        return {
            total,
            dueThisMonth,
            overdue,
            calibratedCount,
            nextCalibrationDate: nextCalibrationInstrument?.due_date || null,
            dueDatesByMonth: monthsCount,
            dueSoonList,
            recentActivity: recentActivityFormatted,
            statusDistribution,
            itemStatusDistribution,
            weeklyCompleted,
            dailyCompleted,
        };
    }
    async fetchDashboardList(userid, listType, startDateStr, endDateStr, itemStatus, status, location) {
        const tzOffsetMinutes = parseInt(process.env.TIMEZONE_OFFSET || '330', 10);
        const now = new Date();
        let startRange;
        let endRange;
        if (startDateStr && endDateStr) {
            const sParts = startDateStr.split('-').map(Number);
            const eParts = endDateStr.split('-').map(Number);
            startRange = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
            endRange = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
        }
        else {
            const nowUtc = new Date();
            const nowLocal = new Date(nowUtc.getTime() + tzOffsetMinutes * 60 * 1000);
            const startYear = nowLocal.getFullYear();
            const startMonth = nowLocal.getMonth();
            startRange = new Date(Date.UTC(startYear, startMonth, 1, 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
            endRange = new Date(Date.UTC(startYear, startMonth + 1, 0, 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
        }
        const getBaseWhere = (extraConditions = {}) => ({
            created_by: { id: userid },
            ...(itemStatus ? { item_status: itemStatus } : {}),
            ...(status ? { status: status } : {}),
            ...(location ? { location: location } : {}),
            ...extraConditions,
        });
        const selectFields = ['id', 'name', 'status', 'item_status', 'due_date', 'last_calibration_date'];
        if (listType === 'total') {
            return this.instrumentRepository.find({
                where: getBaseWhere(),
                order: { name: 'ASC' },
                select: selectFields,
            });
        }
        if (listType === 'due') {
            return this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: (0, typeorm_2.Between)(startRange, endRange),
                }),
                order: { due_date: 'ASC' },
                select: selectFields,
            });
        }
        if (listType === 'overdue') {
            return this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: (0, typeorm_2.LessThan)(now),
                }),
                order: { due_date: 'ASC' },
                select: selectFields,
            });
        }
        if (listType === 'calibrated') {
            const query = this.calibrationHistoryRepository.createQueryBuilder('history')
                .innerJoinAndSelect('history.instrument', 'instrument')
                .where('instrument.created_by = :userid', { userid });
            if (itemStatus) {
                query.andWhere('instrument.item_status = :itemStatus', { itemStatus });
            }
            if (status) {
                query.andWhere('instrument.status = :status', { status });
            }
            if (location) {
                query.andWhere('instrument.location = :location', { location });
            }
            query.andWhere('history.created_at BETWEEN :startRange AND :endRange', { startRange, endRange })
                .orderBy('history.created_at', 'DESC');
            const historyEntries = await query.getMany();
            const instrumentsMap = new Map();
            for (const entry of historyEntries) {
                if (entry.instrument && !instrumentsMap.has(entry.instrument.id)) {
                    instrumentsMap.set(entry.instrument.id, entry.instrument);
                }
            }
            return Array.from(instrumentsMap.values());
        }
        return [];
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(instrument_entity_1.Instrument)),
    __param(1, (0, typeorm_1.InjectRepository)(calibration_history_entity_1.CalibrationHistory)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map