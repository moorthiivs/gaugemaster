// dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Instrument } from 'src/instruments/instrument.entity';
import { CalibrationHistory } from 'src/instruments/calibration-history.entity';
import { Between, LessThan, MoreThan, Repository, ILike } from 'typeorm';

@Injectable()
export class DashboardService {
    constructor(
        @InjectRepository(Instrument)
        private readonly instrumentRepository: Repository<Instrument>,
        @InjectRepository(CalibrationHistory)
        private readonly calibrationHistoryRepository: Repository<CalibrationHistory>,
    ) { }

    // async fetchDashboard(id: string) {
    //     const now = new Date();
    //     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    //     const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    //     // 1. Total instruments count
    //     const total = await this.instrumentRepository.count();

    //     // 2. Instruments due this month
    //     const dueThisMonth = await this.instrumentRepository.count({
    //         where: {
    //             due_date: Between(startOfMonth, endOfMonth),
    //         },
    //     });

    //     // 3. Instruments overdue (due date before now)
    //     const overdue = await this.instrumentRepository.count({
    //         where: {
    //             due_date: LessThan(now),
    //         },
    //     });

    //     // 4. Next calibration instrument (earliest due_date in future)
    //     const nextCalibrationInstrument = await this.instrumentRepository.findOne({
    //         where: {
    //             due_date: MoreThan(now),
    //         },
    //         order: {
    //             due_date: 'ASC',
    //         },
    //     });

    //     // 5. Due dates by month for last 6 months + next 6 months
    //     const monthsCount: { month: string; count: number }[] = [];

    //     for (let i = -5; i <= 6; i++) {
    //         const firstDay = new Date(now.getFullYear(), now.getMonth() + i, 1);
    //         const lastDay = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);

    //         const count = await this.instrumentRepository.count({
    //             where: {
    //                 due_date: Between(firstDay, lastDay),
    //             },
    //         });

    //         monthsCount.push({
    //             month: firstDay.toLocaleString('default', { month: 'short' }),
    //             count,
    //         });
    //     }

    //     // 6. Detailed instruments due in next 30 days
    //     const next30Days = new Date(now);
    //     next30Days.setDate(now.getDate() + 30);

    //     const dueSoonInstruments = await this.instrumentRepository.find({
    //         where: {
    //             due_date: Between(now, next30Days),
    //         },
    //         order: {
    //             due_date: 'ASC',
    //         },
    //         select: ['id', 'name', 'due_date'],
    //     });

    //     const dueSoonList = dueSoonInstruments.map((inst) => ({
    //         id: inst.id,
    //         name: inst.name,
    //         dueDate: inst.due_date,
    //     }));

    //     // 7. Recent activity — example: last 10 instruments updated, map to action "Calibrated"
    //     const recentActivityRaw = await this.instrumentRepository.find({
    //         take: 10,
    //         order: {
    //             updated_at: 'DESC',
    //         },
    //         select: ['id', 'name', 'updated_at'],
    //     });

    //     const recentActivityFormatted = recentActivityRaw.map((r) => ({
    //         id: r.id,
    //         name: r.name,
    //         action: 'Calibrated',
    //         at: r.updated_at,
    //     }));

    //     // Return all data
    //     return {
    //         total,
    //         dueThisMonth,
    //         overdue,
    //         nextCalibrationDate: nextCalibrationInstrument?.due_date || null,
    //         dueDatesByMonth: monthsCount,
    //         dueSoonList,
    //         recentActivity: recentActivityFormatted,
    //     };
    // }


    async fetchDashboard(userid: string, startDateStr?: string, endDateStr?: string, itemStatus?: string, status?: string, location?: string) {
        const tzOffsetMinutes = parseInt(process.env.TIMEZONE_OFFSET || '330', 10);
        const now = new Date();
        let startRange: Date;
        let endRange: Date;

        if (startDateStr && endDateStr) {
            const sParts = startDateStr.split('-').map(Number);
            const eParts = endDateStr.split('-').map(Number);
            startRange = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
            endRange = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
        } else {
            // Default to current month in user's local timezone
            const nowUtc = new Date();
            const nowLocal = new Date(nowUtc.getTime() + tzOffsetMinutes * 60 * 1000);
            const startYear = nowLocal.getFullYear();
            const startMonth = nowLocal.getMonth();
            
            startRange = new Date(Date.UTC(startYear, startMonth, 1, 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
            endRange = new Date(Date.UTC(startYear, startMonth + 1, 0, 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
        }

        // Helper to construct where filter with optional item_status and calibration status
        const getBaseWhere = (extraConditions: Record<string, any> = {}) => ({
            created_by: { id: userid },
            ...(itemStatus ? { item_status: ILike(itemStatus) } : {}),
            ...(status ? { status: ILike(status) } : {}),
            ...(location ? { location: ILike(location) } : {}),
            ...extraConditions,
        });

        // Helper to count distinct instruments with history calibrations
        const countHistoryCalibrations = async (startDate: Date, endDate: Date) => {
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

        // 1. Total instruments count for this user
        const total = await this.instrumentRepository.count({
            where: getBaseWhere(),
        });

        // 3. Instruments overdue for this user
        const overdue = await this.instrumentRepository.count({
            where: getBaseWhere({
                due_date: LessThan(now),
            }),
        });

        // 4. Next calibration instrument for this user
        const nextCalibrationInstrument = await this.instrumentRepository.findOne({
            where: getBaseWhere({
                due_date: MoreThan(now),
            }),
            order: { due_date: 'ASC' },
        });

        // 5. Instruments calibrated in selected range (based on calibration history)
        const calibratedCount = await countHistoryCalibrations(startRange, endRange);

        // 2. Instruments currently due in selected range (pending)
        const pendingCount = await this.instrumentRepository.count({
            where: getBaseWhere({
                due_date: Between(startRange, endRange),
            }),
        });

        // The total target plan is pending + completed
        const dueThisMonth = pendingCount + calibratedCount;

        // 6. Due dates by month (dynamically generates months in the range, or default 12 months)
        const monthsCount: { month: string; plan: number; actual: number }[] = [];

        if (startDateStr && endDateStr) {
            let current = new Date(startRange.getTime());
            // Cap at 24 months to avoid performance issues
            let monthsChecked = 0;
            while (current <= endRange && monthsChecked < 24) {
                const curLocal = new Date(current.getTime() + tzOffsetMinutes * 60 * 1000);
                const firstDayLocal = new Date(Date.UTC(curLocal.getFullYear(), curLocal.getMonth(), 1, 0, 0, 0, 0));
                const lastDayLocal = new Date(Date.UTC(curLocal.getFullYear(), curLocal.getMonth() + 1, 0, 23, 59, 59, 999));

                const firstDay = new Date(firstDayLocal.getTime() - tzOffsetMinutes * 60 * 1000);
                const lastDay = new Date(lastDayLocal.getTime() - tzOffsetMinutes * 60 * 1000);

                const pendingCount = await this.instrumentRepository.count({
                    where: getBaseWhere({
                        due_date: Between(firstDay, lastDay),
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
        } else {
            for (let i = -5; i <= 6; i++) {
                const nowUtc = new Date();
                const nowLocal = new Date(nowUtc.getTime() + tzOffsetMinutes * 60 * 1000);
                
                const firstDayLocal = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth() + i, 1, 0, 0, 0, 0));
                const lastDayLocal = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth() + i + 1, 0, 23, 59, 59, 999));

                const firstDay = new Date(firstDayLocal.getTime() - tzOffsetMinutes * 60 * 1000);
                const lastDay = new Date(lastDayLocal.getTime() - tzOffsetMinutes * 60 * 1000);

                const pendingCount = await this.instrumentRepository.count({
                    where: getBaseWhere({
                        due_date: Between(firstDay, lastDay),
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

        // 7. Detailed instruments due in selected range or next 30 days
        let dueSoonInstruments;
        if (startDateStr && endDateStr) {
            dueSoonInstruments = await this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: Between(startRange, endRange),
                }),
                order: { due_date: 'ASC' },
                select: ['id', 'name', 'due_date'],
            });
        } else {
            const next30Days = new Date(now);
            next30Days.setDate(now.getDate() + 30);
            dueSoonInstruments = await this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: Between(now, next30Days),
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

        // 8. Recent activity for this user
        const recentActivityRaw = await this.instrumentRepository.find({
            where: getBaseWhere(),
            take: 10,
            order: { updated_at: 'DESC' },
            select: ['id', 'name', 'status', 'updated_at'],
        });

        const recentActivityFormatted = recentActivityRaw.map(r => {
            let action = 'Updated';
            if (r.status === 'OK') action = 'Calibrated';
            else if (r.status === 'OVER DUE' || r.status === 'Overdue') action = 'Overdue';
            else if (r.status === 'DUE SOON') action = 'Due Soon';
            else if (r.status === 'Sent for Calibration') action = 'Sent for Calibration';
            else if (r.status) action = r.status;
            return {
                id: r.id,
                name: r.name,
                action,
                at: r.updated_at,
            };
        });

        // 9. Fetch dynamic group counts for Status and Item Status
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

        // 10. Week-wise completed calibrations (last_calibration_date in range)
        const weeklyCompleted: { week: string; completed: number }[] = [];
        {
            // Build weeks covering the selected range
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

        // 11. Day-wise completed calibrations (last 7 days from today, clamped to filter range)
        const dailyCompleted: { day: string; date: string; completed: number }[] = [];
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

                if (dUtcEnd < startRange) continue;

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

    async fetchDashboardList(
        userid: string,
        listType: 'total' | 'due' | 'overdue' | 'calibrated',
        startDateStr?: string,
        endDateStr?: string,
        itemStatus?: string,
        status?: string,
        location?: string
    ) {
        const tzOffsetMinutes = parseInt(process.env.TIMEZONE_OFFSET || '330', 10);
        const now = new Date();
        let startRange: Date;
        let endRange: Date;

        if (startDateStr && endDateStr) {
            const sParts = startDateStr.split('-').map(Number);
            const eParts = endDateStr.split('-').map(Number);
            startRange = new Date(Date.UTC(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
            endRange = new Date(Date.UTC(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
        } else {
            // Default to current month in user's local timezone
            const nowUtc = new Date();
            const nowLocal = new Date(nowUtc.getTime() + tzOffsetMinutes * 60 * 1000);
            const startYear = nowLocal.getFullYear();
            const startMonth = nowLocal.getMonth();
            
            startRange = new Date(Date.UTC(startYear, startMonth, 1, 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
            endRange = new Date(Date.UTC(startYear, startMonth + 1, 0, 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
        }

        const getBaseWhere = (extraConditions: Record<string, any> = {}) => ({
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
                select: selectFields as any,
            });
        }

        if (listType === 'due') {
            return this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: Between(startRange, endRange),
                }),
                order: { due_date: 'ASC' },
                select: selectFields as any,
            });
        }

        if (listType === 'overdue') {
            return this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: LessThan(now),
                }),
                order: { due_date: 'ASC' },
                select: selectFields as any,
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

            const instrumentsMap = new Map<string, Instrument>();
            for (const entry of historyEntries) {
                if (entry.instrument && !instrumentsMap.has(entry.instrument.id)) {
                    instrumentsMap.set(entry.instrument.id, entry.instrument);
                }
            }
            return Array.from(instrumentsMap.values());
        }

        return [];
    }
}
