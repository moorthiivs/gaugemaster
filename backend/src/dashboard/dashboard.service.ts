// dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Instrument } from 'src/instruments/instrument.entity';
import { CalibrationHistory } from 'src/instruments/calibration-history.entity';
import { User } from 'src/users/user.entity';
import { Between, LessThan, MoreThan, Repository, ILike, In } from 'typeorm';

@Injectable()
export class DashboardService {
    constructor(
        @InjectRepository(Instrument)
        private readonly instrumentRepository: Repository<Instrument>,
        @InjectRepository(CalibrationHistory)
        private readonly calibrationHistoryRepository: Repository<CalibrationHistory>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    private async getCompanyUserIds(userId?: string, companyId?: string): Promise<string[]> {
        const targetCompanyId = companyId || (userId ? (await this.userRepository.findOne({ where: { id: userId } }))?.companyId : undefined);
        if (targetCompanyId) {
            const companyUsers = await this.userRepository.find({
                where: { companyId: targetCompanyId },
                select: ['id'],
            });
            if (companyUsers.length > 0) {
                return companyUsers.map(u => u.id);
            }
        }
        return userId ? [userId] : [];
    }

    async fetchDashboard(userid: string, companyId?: string, startDateStr?: string, endDateStr?: string, itemStatus?: string, status?: string, location?: string, isReferenceStandard?: string) {
        const userIds = await this.getCompanyUserIds(userid, companyId);
        const targetUserIds = userIds.length > 0 ? userIds : [userid];

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

        // Helper to construct where filter with optional item_status, calibration status, and reference standard
        const getBaseWhere = (extraConditions: Record<string, any> = {}) => ({
            created_by: { id: In(targetUserIds) },
            ...(itemStatus && itemStatus !== 'All' ? { item_status: ILike(itemStatus) } : {}),
            ...(status && status !== 'All' ? { status: ILike(status) } : {}),
            ...(location && location !== 'All' ? { location: ILike(location) } : {}),
            ...(isReferenceStandard === 'true' ? { is_reference_standard: true } : isReferenceStandard === 'false' ? { is_reference_standard: false } : {}),
            ...extraConditions,
        });

        // Helper to count distinct instruments with history calibrations
        const countHistoryCalibrations = async (sDate: Date, eDate: Date) => {
            const q = this.calibrationHistoryRepository.createQueryBuilder('history')
                .innerJoin('history.instrument', 'instrument')
                .select('COUNT(DISTINCT instrument.id)', 'count')
                .where('instrument.created_by IN (:...targetUserIds)', { targetUserIds })
                .andWhere('history.created_at BETWEEN :sDate AND :eDate', { sDate, eDate });

            if (itemStatus && itemStatus !== 'All') {
                q.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
            }
            if (status && status !== 'All') {
                q.andWhere('instrument.status ILIKE :status', { status });
            }
            if (location && location !== 'All') {
                q.andWhere('instrument.location ILIKE :location', { location });
            }
            if (isReferenceStandard === 'true') {
                q.andWhere('instrument.is_reference_standard = :isRef', { isRef: true });
            } else if (isReferenceStandard === 'false') {
                q.andWhere('(instrument.is_reference_standard = :isRef OR instrument.is_reference_standard IS NULL)', { isRef: false });
            }

            const res = await q.getRawOne();
            return Number(res?.count || 0);
        };

        // ═══════════════════════════════════════════════════════════════
        // Single query for KPI summary counts & Working vs Reference standard breakdowns
        // ═══════════════════════════════════════════════════════════════
        const kpiQuery = this.instrumentRepository.createQueryBuilder('instrument')
            .select('COUNT(*)', 'total')
            .addSelect(`SUM(CASE WHEN instrument.is_reference_standard = false OR instrument.is_reference_standard IS NULL THEN 1 ELSE 0 END)`, 'workingTotal')
            .addSelect(`SUM(CASE WHEN instrument.is_reference_standard = true THEN 1 ELSE 0 END)`, 'referenceTotal')

            .addSelect(`SUM(CASE WHEN instrument.due_date < :now THEN 1 ELSE 0 END)`, 'overdue')
            .addSelect(`SUM(CASE WHEN instrument.due_date < :now AND (instrument.is_reference_standard = false OR instrument.is_reference_standard IS NULL) THEN 1 ELSE 0 END)`, 'workingOverdue')
            .addSelect(`SUM(CASE WHEN instrument.due_date < :now AND instrument.is_reference_standard = true THEN 1 ELSE 0 END)`, 'referenceOverdue')

            .addSelect(`SUM(CASE WHEN instrument.due_date BETWEEN :now AND :dueSoonEnd THEN 1 ELSE 0 END)`, 'dueSoon')
            .addSelect(`SUM(CASE WHEN instrument.due_date BETWEEN :now AND :dueSoonEnd AND (instrument.is_reference_standard = false OR instrument.is_reference_standard IS NULL) THEN 1 ELSE 0 END)`, 'workingDueSoon')
            .addSelect(`SUM(CASE WHEN instrument.due_date BETWEEN :now AND :dueSoonEnd AND instrument.is_reference_standard = true THEN 1 ELSE 0 END)`, 'referenceDueSoon')
            .where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });

        const dueSoonEnd = new Date(now);
        dueSoonEnd.setDate(now.getDate() + 30);
        kpiQuery.setParameter('now', now);
        kpiQuery.setParameter('dueSoonEnd', dueSoonEnd);

        if (itemStatus && itemStatus !== 'All') {
            kpiQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }
        if (status && status !== 'All') {
            kpiQuery.andWhere('instrument.status ILIKE :status', { status });
        }
        if (location && location !== 'All') {
            kpiQuery.andWhere('instrument.location ILIKE :location', { location });
        }

        const kpiResult = await kpiQuery.getRawOne();
        const total = Number(kpiResult.total || 0);
        const overdue = Number(kpiResult.overdue || 0);
        const dueSoonCount = Number(kpiResult.dueSoon || 0);

        // Calibrated count for selected range (from calibration history)
        const calibratedCount = await countHistoryCalibrations(startRange, endRange);

        // Pending (due in range) count
        const pendingCount = await this.instrumentRepository.count({
            where: getBaseWhere({
                due_date: Between(startRange, endRange),
            }),
        });

        const dueThisMonth = pendingCount + calibratedCount;

        // Today's due and completed counts
        const nowLocal = new Date(now.getTime() + tzOffsetMinutes * 60 * 1000);
        const todayStartLocal = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 0, 0, 0, 0));
        const todayEndLocal = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 23, 59, 59, 999));
        const todayStart = new Date(todayStartLocal.getTime() - tzOffsetMinutes * 60 * 1000);
        const todayEnd = new Date(todayEndLocal.getTime() - tzOffsetMinutes * 60 * 1000);

        const dueTodayCount = await this.instrumentRepository.count({
            where: getBaseWhere({
                due_date: Between(todayStart, todayEnd),
            }),
        });

        const workingDueTodayCount = await this.instrumentRepository.count({
            where: getBaseWhere({
                due_date: Between(todayStart, todayEnd),
                is_reference_standard: false,
            }),
        });

        const referenceDueTodayCount = await this.instrumentRepository.count({
            where: getBaseWhere({
                due_date: Between(todayStart, todayEnd),
                is_reference_standard: true,
            }),
        });

        const completedTodayCount = await countHistoryCalibrations(todayStart, todayEnd);

        // Next calibration instrument
        const nextCalibrationInstrument = await this.instrumentRepository.findOne({
            where: getBaseWhere({
                due_date: MoreThan(now),
            }),
            order: { due_date: 'ASC' },
        });

        // ═══════════════════════════════════════════════════════════════
        // OPTIMIZED: Monthly trend data via single GROUP BY query
        // Replaces the 12-24 iteration loop (2 queries per iteration)
        // ═══════════════════════════════════════════════════════════════
        const monthsCount: { month: string; plan: number; actual: number }[] = [];

        // Determine month range
        let monthStart: Date;
        let monthEnd: Date;
        if (startDateStr && endDateStr) {
            monthStart = startRange;
            monthEnd = endRange;
        } else {
            const nowUtc = new Date();
            const nowLocal = new Date(nowUtc.getTime() + tzOffsetMinutes * 60 * 1000);
            const fiveMonthsAgo = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth() - 5, 1, 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
            const sixMonthsAhead = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth() + 7, 0, 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
            monthStart = fiveMonthsAgo;
            monthEnd = sixMonthsAhead;
        }

        // Plan counts (instruments due) grouped by month — single query
        const planQuery = this.instrumentRepository.createQueryBuilder('instrument')
            .select(`TO_CHAR(instrument.due_date AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes', 'YYYY-MM')`, 'month_key')
            .addSelect(`TO_CHAR(instrument.due_date AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes', 'Mon')`, 'month_label')
            .addSelect('COUNT(*)', 'count')
            .where('instrument.created_by IN (:...targetUserIds)', { targetUserIds })
            .andWhere('instrument.due_date BETWEEN :monthStart AND :monthEnd', { monthStart, monthEnd });

        if (itemStatus) {
            planQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }
        if (status) {
            planQuery.andWhere('instrument.status ILIKE :status', { status });
        }
        if (location) {
            planQuery.andWhere('instrument.location ILIKE :location', { location });
        }

        planQuery.groupBy('month_key').addGroupBy('month_label').orderBy('month_key', 'ASC');
        const planRows = await planQuery.getRawMany();

        // Actual completed counts grouped by month — single query
        const actualQuery = this.calibrationHistoryRepository.createQueryBuilder('history')
            .innerJoin('history.instrument', 'instrument')
            .select(`TO_CHAR(history.created_at AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes', 'YYYY-MM')`, 'month_key')
            .addSelect(`TO_CHAR(history.created_at AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes', 'Mon')`, 'month_label')
            .addSelect('COUNT(DISTINCT instrument.id)', 'count')
            .where('instrument.created_by IN (:...targetUserIds)', { targetUserIds })
            .andWhere('history.created_at BETWEEN :monthStart AND :monthEnd', { monthStart, monthEnd });

        if (itemStatus) {
            actualQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }
        if (status) {
            actualQuery.andWhere('instrument.status ILIKE :status', { status });
        }
        if (location) {
            actualQuery.andWhere('instrument.location ILIKE :location', { location });
        }

        actualQuery.groupBy('month_key').addGroupBy('month_label').orderBy('month_key', 'ASC');
        const actualRows = await actualQuery.getRawMany();

        // Merge plan + actual into monthly series
        const planMap = new Map(planRows.map(r => [r.month_key, { label: r.month_label, count: Number(r.count) }]));
        const actualMap = new Map(actualRows.map(r => [r.month_key, Number(r.count)]));

        const allMonthKeys = new Set([...planMap.keys(), ...actualMap.keys()]);
        const sortedKeys = [...allMonthKeys].sort();

        for (const key of sortedKeys) {
            const planInfo = planMap.get(key);
            const actualCount = actualMap.get(key) || 0;
            const planCount = (planInfo?.count || 0) + actualCount;
            monthsCount.push({
                month: planInfo?.label || key.split('-')[1] || key,
                plan: planCount,
                actual: actualCount,
            });
        }

        // ═══════════════════════════════════════════════════════════════
        // Due soon instruments (paginated, limited)
        // ═══════════════════════════════════════════════════════════════
        let dueSoonInstruments;
        if (startDateStr && endDateStr) {
            dueSoonInstruments = await this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: Between(startRange, endRange),
                }),
                order: { due_date: 'ASC' },
                select: ['id', 'name', 'due_date', 'location', 'status'],
                take: 50,
            });
        } else {
            const next30Days = new Date(now);
            next30Days.setDate(now.getDate() + 30);
            dueSoonInstruments = await this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: Between(now, next30Days),
                }),
                order: { due_date: 'ASC' },
                select: ['id', 'name', 'due_date', 'location', 'status'],
                take: 50,
            });
        }

        const dueSoonList = dueSoonInstruments.map(inst => ({
            id: inst.id,
            name: inst.name,
            dueDate: inst.due_date,
            location: inst.location,
            status: inst.status,
        }));

        // ═══════════════════════════════════════════════════════════════
        // Recent activity
        // ═══════════════════════════════════════════════════════════════
        const recentActivityRaw = await this.instrumentRepository.find({
            where: getBaseWhere(),
            take: 10,
            order: { updated_at: 'DESC' },
            select: ['id', 'name', 'status', 'updated_at', 'id_code', 'location'],
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
                idCode: r.id_code,
                location: r.location,
            };
        });

        // ═══════════════════════════════════════════════════════════════
        // FIXED: Status & Item Status distributions
        // Now uses targetUserIds (company tenant) instead of single userid
        // ═══════════════════════════════════════════════════════════════
        const statusQuery = this.instrumentRepository
            .createQueryBuilder('instrument')
            .select('instrument.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });

        const itemStatusQuery = this.instrumentRepository
            .createQueryBuilder('instrument')
            .select('instrument.item_status', 'item_status')
            .addSelect('COUNT(*)', 'count')
            .where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });

        if (startDateStr && endDateStr) {
            statusQuery.andWhere('instrument.due_date BETWEEN :startRange AND :endRange', { startRange, endRange });
            itemStatusQuery.andWhere('instrument.due_date BETWEEN :startRange AND :endRange', { startRange, endRange });
        }

        if (itemStatus) {
            statusQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
            itemStatusQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }

        if (status) {
            statusQuery.andWhere('instrument.status ILIKE :status', { status });
            itemStatusQuery.andWhere('instrument.status ILIKE :status', { status });
        }

        if (location) {
            statusQuery.andWhere('instrument.location ILIKE :location', { location });
            itemStatusQuery.andWhere('instrument.location ILIKE :location', { location });
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

        // ═══════════════════════════════════════════════════════════════
        // Module distribution (GROUP BY TRIM(instrument.module))
        // ═══════════════════════════════════════════════════════════════
        // Module distribution (Full Inventory breakdown with UPPER case normalization)
        // ═══════════════════════════════════════════════════════════════
        const moduleQuery = this.instrumentRepository
            .createQueryBuilder('instrument')
            .select("COALESCE(NULLIF(UPPER(TRIM(instrument.module)), ''), 'Unassigned')", 'module_name')
            .addSelect('COUNT(*)', 'count')
            .where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });

        if (itemStatus && itemStatus !== 'All') {
            moduleQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }
        if (status && status !== 'All') {
            moduleQuery.andWhere('instrument.status ILIKE :status', { status });
        }
        if (location && location !== 'All') {
            moduleQuery.andWhere('instrument.location ILIKE :location', { location });
        }
        if (isReferenceStandard === 'true') {
            moduleQuery.andWhere('instrument.is_reference_standard = :isRef', { isRef: true });
        } else if (isReferenceStandard === 'false') {
            moduleQuery.andWhere('(instrument.is_reference_standard = :isRef OR instrument.is_reference_standard IS NULL)', { isRef: false });
        }

        const moduleGroups = await moduleQuery
            .groupBy("COALESCE(NULLIF(UPPER(TRIM(instrument.module)), ''), 'Unassigned')")
            .orderBy('COUNT(*)', 'DESC')
            .getRawMany();

        let rawModuleDistribution = moduleGroups.map(g => ({
            name: g.module_name || 'Others',
            value: Number(g.count),
        }));

        rawModuleDistribution.sort((a, b) => b.value - a.value);

        let moduleDistribution: { name: string; value: number }[] = [];
        if (rawModuleDistribution.length > 10) {
            const top10 = rawModuleDistribution.slice(0, 10);
            const othersCount = rawModuleDistribution.slice(10).reduce((sum, item) => sum + item.value, 0);
            if (othersCount > 0) {
                top10.push({ name: 'Others', value: othersCount });
            }
            moduleDistribution = top10;
        } else {
            moduleDistribution = rawModuleDistribution;
        }

        // ═══════════════════════════════════════════════════════════════
        // OPTIMIZED: Weekly completed — single GROUP BY query
        // Replaces 52-iteration loop with single SQL
        // ═══════════════════════════════════════════════════════════════
        const weeklyCompleted: { week: string; completed: number }[] = [];
        {
            const weeklyQuery = this.calibrationHistoryRepository.createQueryBuilder('history')
                .innerJoin('history.instrument', 'instrument')
                .select(`TO_CHAR(DATE_TRUNC('week', history.created_at AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes'), 'Mon DD')`, 'week_start')
                .addSelect(`TO_CHAR(DATE_TRUNC('week', history.created_at AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes') + INTERVAL '6 days', 'Mon DD')`, 'week_end')
                .addSelect('COUNT(DISTINCT instrument.id)', 'count')
                .where('instrument.created_by IN (:...targetUserIds)', { targetUserIds })
                .andWhere('history.created_at BETWEEN :startRange AND :endRange', { startRange, endRange });

            if (itemStatus) {
                weeklyQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
            }
            if (status) {
                weeklyQuery.andWhere('instrument.status ILIKE :status', { status });
            }
            if (location) {
                weeklyQuery.andWhere('instrument.location ILIKE :location', { location });
            }

            weeklyQuery.groupBy('week_start').addGroupBy('week_end')
                .orderBy('MIN(history.created_at)', 'ASC');

            const weeklyRows = await weeklyQuery.getRawMany();
            for (const row of weeklyRows) {
                weeklyCompleted.push({
                    week: `${row.week_start} - ${row.week_end}`,
                    completed: Number(row.count),
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // OPTIMIZED: Daily completed — single GROUP BY query
        // Replaces 7-iteration loop
        // ═══════════════════════════════════════════════════════════════
        const dailyCompleted: { day: string; date: string; completed: number }[] = [];
        {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            
            const nowUtc = new Date();
            const nowLocal = new Date(nowUtc.getTime() + tzOffsetMinutes * 60 * 1000);
            const endRangeLocal = new Date(endRange.getTime() + tzOffsetMinutes * 60 * 1000);
            const anchorLocal = endRangeLocal < nowLocal ? endRangeLocal : nowLocal;

            const sevenDaysAgo = new Date(anchorLocal);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

            const dStart = new Date(Date.UTC(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate(), 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
            const dEnd = new Date(Date.UTC(anchorLocal.getFullYear(), anchorLocal.getMonth(), anchorLocal.getDate(), 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);

            // Clamp to filter range
            const effectiveStart = dStart < startRange ? startRange : dStart;

            const dailyQuery = this.calibrationHistoryRepository.createQueryBuilder('history')
                .innerJoin('history.instrument', 'instrument')
                .select(`TO_CHAR(history.created_at AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes', 'YYYY-MM-DD')`, 'date_key')
                .addSelect(`EXTRACT(DOW FROM history.created_at AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes')`, 'dow')
                .addSelect('COUNT(DISTINCT instrument.id)', 'count')
                .where('instrument.created_by IN (:...targetUserIds)', { targetUserIds })
                .andWhere('history.created_at BETWEEN :effectiveStart AND :dEnd', { effectiveStart, dEnd });

            if (itemStatus) {
                dailyQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
            }
            if (status) {
                dailyQuery.andWhere('instrument.status ILIKE :status', { status });
            }
            if (location) {
                dailyQuery.andWhere('instrument.location ILIKE :location', { location });
            }

            dailyQuery.groupBy('date_key').addGroupBy('dow').orderBy('date_key', 'ASC');

            const dailyRows = await dailyQuery.getRawMany();
            for (const row of dailyRows) {
                const dow = Number(row.dow);
                dailyCompleted.push({
                    day: dayNames[dow] || 'N/A',
                    date: row.date_key,
                    completed: Number(row.count),
                });
            }
        }

        const grandTotal = Number(kpiResult.total || 0);
        const activeTotal = isReferenceStandard === 'true'
            ? Number(kpiResult.referenceTotal || 0)
            : isReferenceStandard === 'false'
                ? Number(kpiResult.workingTotal || 0)
                : grandTotal;

        const activeOverdue = isReferenceStandard === 'true'
            ? Number(kpiResult.referenceOverdue || 0)
            : isReferenceStandard === 'false'
                ? Number(kpiResult.workingOverdue || 0)
                : Number(kpiResult.overdue || 0);

        const activeDueSoon = isReferenceStandard === 'true'
            ? Number(kpiResult.referenceDueSoon || 0)
            : isReferenceStandard === 'false'
                ? Number(kpiResult.workingDueSoon || 0)
                : Number(kpiResult.dueSoon || 0);

        const overallCalibrated = calibratedCount || 0;
        const overallPercentage = activeTotal > 0 ? Number(((overallCalibrated / activeTotal) * 100).toFixed(2)) : 0;

        return {
            total: activeTotal,
            grandTotal,
            overallProgress: {
                total: activeTotal,
                calibrated: overallCalibrated,
                percentage: overallPercentage,
            },
            workingTotal: Number(kpiResult.workingTotal || 0),
            referenceTotal: Number(kpiResult.referenceTotal || 0),
            dueThisMonth,
            overdue: activeOverdue,
            workingOverdue: Number(kpiResult.workingOverdue || 0),
            referenceOverdue: Number(kpiResult.referenceOverdue || 0),
            dueSoonCount: activeDueSoon,
            workingDueSoonCount: Number(kpiResult.workingDueSoon || 0),
            referenceDueSoonCount: Number(kpiResult.referenceDueSoon || 0),
            calibratedCount,
            dueTodayCount,
            workingDueTodayCount,
            referenceDueTodayCount,
            completedTodayCount,
            nextCalibrationDate: nextCalibrationInstrument?.due_date || null,
            dueDatesByMonth: monthsCount,
            dueSoonList,
            recentActivity: recentActivityFormatted,
            statusDistribution,
            itemStatusDistribution,
            moduleDistribution,
            weeklyCompleted,
            dailyCompleted,
        };
    }

    async fetchDashboardList(
        userid: string,
        listType: 'total' | 'due' | 'overdue' | 'calibrated',
        companyId?: string,
        startDateStr?: string,
        endDateStr?: string,
        itemStatus?: string,
        status?: string,
        location?: string
    ) {
        const userIds = await this.getCompanyUserIds(userid, companyId);
        const targetUserIds = userIds.length > 0 ? userIds : [userid];

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
            created_by: { id: In(targetUserIds) },
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
