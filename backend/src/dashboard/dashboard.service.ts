// dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Instrument } from 'src/instruments/instrument.entity';
import { CalibrationHistory } from 'src/instruments/calibration-history.entity';
import { User } from 'src/users/user.entity';
import { Between, LessThan, MoreThan, Repository, ILike, In, Not } from 'typeorm';

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

    private async resolveTargetCompanyId(userId?: string, companyId?: string): Promise<string | undefined> {
        if (companyId) return companyId;
        if (userId) {
            const user = await this.userRepository.findOne({ where: { id: userId }, select: ['id', 'companyId'] });
            if (user?.companyId) return user.companyId;
        }
        return undefined;
    }

    private async getCompanyUserIds(userId?: string, companyId?: string): Promise<string[]> {
        const targetCompanyId = await this.resolveTargetCompanyId(userId, companyId);
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

    private normalizeItemStatus(status?: string | null): string {
        if (!status) return 'Active';
        const trimmed = status.toString().trim();
        if (!trimmed) return 'Active';
        const lower = trimmed.toLowerCase();
        if (lower === 'active' || lower === 'ok') return 'Active';
        if (lower === 'spare') return 'SPARE';
        if (lower === 'stock') return 'STOCK';
        if (lower === 'inactive') return 'Inactive';
        if (lower === 'scrapped') return 'Scrapped';
        if (lower === 'lost') return 'Lost';
        if (lower === 'under repair' || lower === 'under_repair') return 'Under Repair';
        if (lower === 'rejected') return 'Rejected';
        return trimmed;
    }

    async fetchDashboard(userid: string, companyId?: string, startDateStr?: string, endDateStr?: string, itemStatus?: string, status?: string, location?: string, isReferenceStandard?: string) {
        const targetCompanyId = await this.resolveTargetCompanyId(userid, companyId);
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

        // Today's local date boundaries taking into account timezone offset
        const nowLocal = new Date(now.getTime() + tzOffsetMinutes * 60 * 1000);
        const todayStartLocal = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 0, 0, 0, 0));
        const todayEndLocal = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 23, 59, 59, 999));
        const todayStart = new Date(todayStartLocal.getTime() - tzOffsetMinutes * 60 * 1000);
        const todayEnd = new Date(todayEndLocal.getTime() - tzOffsetMinutes * 60 * 1000);

        // Helper to construct where filter with optional item_status, calibration status, and reference standard
        const getBaseWhere = (extraConditions: Record<string, any> = {}) => ({
            ...(targetCompanyId ? { companyId: targetCompanyId } : { created_by: { id: In(targetUserIds) } }),
            ...(itemStatus && itemStatus !== 'All' ? { item_status: ILike(itemStatus) } : {}),
            ...(status && status !== 'All' ? { status: ILike(status) } : {}),
            ...(location && location !== 'All' ? { location: ILike(location) } : {}),
            ...(isReferenceStandard === 'true' ? { is_reference_standard: true } : isReferenceStandard === 'false' ? { is_reference_standard: false } : {}),
            ...extraConditions,
        });

        // Helper to count distinct instruments with history calibrations (in date range AND today in a single query)
        const countCombinedCalibrations = async () => {
            const q = this.calibrationHistoryRepository.createQueryBuilder('history')
                .innerJoin('history.instrument', 'instrument')
                .select(`COUNT(DISTINCT CASE WHEN history.last_calibration_date BETWEEN :startRange AND :endRange THEN instrument.id END)`, 'calibratedCount')
                .addSelect(`COUNT(DISTINCT CASE WHEN history.last_calibration_date BETWEEN :todayStart AND :todayEnd THEN instrument.id END)`, 'completedTodayCount');

            if (targetCompanyId) {
                q.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
            } else {
                q.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
            }
            const minDate = todayStart < startRange ? todayStart : startRange;
            const maxDate = todayEnd > endRange ? todayEnd : endRange;
            q.andWhere('history.last_calibration_date BETWEEN :minDate AND :maxDate', { minDate, maxDate });
            q.setParameter('startRange', startRange);
            q.setParameter('endRange', endRange);
            q.setParameter('todayStart', todayStart);
            q.setParameter('todayEnd', todayEnd);

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
            return {
                calibratedCount: Number(res?.calibratedCount || 0),
                completedTodayCount: Number(res?.completedTodayCount || 0),
            };
        };

        // ═══════════════════════════════════════════════════════════════
        // 1. Single query for all KPI summary counts, Working vs Ref breakdowns, and Due Today counts
        // ═══════════════════════════════════════════════════════════════
        const kpiQuery = this.instrumentRepository.createQueryBuilder('instrument')
            .select('COUNT(*)', 'total')
            .addSelect(`SUM(CASE WHEN instrument.is_reference_standard = false OR instrument.is_reference_standard IS NULL THEN 1 ELSE 0 END)`, 'workingTotal')
            .addSelect(`SUM(CASE WHEN instrument.is_reference_standard = true THEN 1 ELSE 0 END)`, 'referenceTotal')

            .addSelect(`SUM(CASE WHEN instrument.due_date < :todayStart AND (instrument.status IS NULL OR instrument.status NOT IN ('Under Calibration', 'UNDER_CALIBRATION', 'REJECTED')) THEN 1 ELSE 0 END)`, 'overdue')
            .addSelect(`SUM(CASE WHEN instrument.due_date < :todayStart AND (instrument.status IS NULL OR instrument.status NOT IN ('Under Calibration', 'UNDER_CALIBRATION', 'REJECTED')) AND (instrument.is_reference_standard = false OR instrument.is_reference_standard IS NULL) THEN 1 ELSE 0 END)`, 'workingOverdue')
            .addSelect(`SUM(CASE WHEN instrument.due_date < :todayStart AND (instrument.status IS NULL OR instrument.status NOT IN ('Under Calibration', 'UNDER_CALIBRATION', 'REJECTED')) AND instrument.is_reference_standard = true THEN 1 ELSE 0 END)`, 'referenceOverdue')

            .addSelect(`SUM(CASE WHEN instrument.due_date BETWEEN :todayStart AND :dueSoonEnd THEN 1 ELSE 0 END)`, 'dueSoon')
            .addSelect(`SUM(CASE WHEN instrument.due_date BETWEEN :todayStart AND :dueSoonEnd AND (instrument.is_reference_standard = false OR instrument.is_reference_standard IS NULL) THEN 1 ELSE 0 END)`, 'workingDueSoon')
            .addSelect(`SUM(CASE WHEN instrument.due_date BETWEEN :todayStart AND :dueSoonEnd AND instrument.is_reference_standard = true THEN 1 ELSE 0 END)`, 'referenceDueSoon')

            .addSelect(`SUM(CASE WHEN instrument.due_date BETWEEN :todayStart AND :todayEnd THEN 1 ELSE 0 END)`, 'dueToday')
            .addSelect(`SUM(CASE WHEN instrument.due_date BETWEEN :todayStart AND :todayEnd AND (instrument.is_reference_standard = false OR instrument.is_reference_standard IS NULL) THEN 1 ELSE 0 END)`, 'workingDueToday')
            .addSelect(`SUM(CASE WHEN instrument.due_date BETWEEN :todayStart AND :todayEnd AND instrument.is_reference_standard = true THEN 1 ELSE 0 END)`, 'referenceDueToday');

        if (targetCompanyId) {
            kpiQuery.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
        } else {
            kpiQuery.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
        }

        const dueSoonEnd = new Date(todayEnd);
        dueSoonEnd.setDate(dueSoonEnd.getDate() + 30);
        kpiQuery.setParameter('todayStart', todayStart);
        kpiQuery.setParameter('todayEnd', todayEnd);
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

        // ═══════════════════════════════════════════════════════════════
        // 2. Pending (due in range) count query excluding instruments already calibrated
        // ═══════════════════════════════════════════════════════════════
        const pendingQuery = this.instrumentRepository.createQueryBuilder('instrument')
            .select('COUNT(*)', 'count');

        if (targetCompanyId) {
            pendingQuery.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
        } else {
            pendingQuery.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
        }
        pendingQuery.andWhere('instrument.due_date BETWEEN :startRange AND :endRange', { startRange, endRange });
        pendingQuery.andWhere(
            'instrument.id NOT IN (SELECT h.instrument_id FROM calibration_history h WHERE h.instrument_id IS NOT NULL AND h.last_calibration_date BETWEEN :startRange AND :endRange)',
            { startRange, endRange },
        );

        if (itemStatus && itemStatus !== 'All') {
            pendingQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }
        if (status && status !== 'All') {
            pendingQuery.andWhere('instrument.status ILIKE :status', { status });
        }
        if (location && location !== 'All') {
            pendingQuery.andWhere('instrument.location ILIKE :location', { location });
        }
        if (isReferenceStandard === 'true') {
            pendingQuery.andWhere('instrument.is_reference_standard = :isRef', { isRef: true });
        } else if (isReferenceStandard === 'false') {
            pendingQuery.andWhere('(instrument.is_reference_standard = :isRef OR instrument.is_reference_standard IS NULL)', { isRef: false });
        }

        // ═══════════════════════════════════════════════════════════════
        // 3. Monthly trend queries (Plan vs Actual)
        // ═══════════════════════════════════════════════════════════════
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

        const planQuery = this.instrumentRepository.createQueryBuilder('instrument')
            .select(`TO_CHAR(instrument.due_date AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes', 'YYYY-MM')`, 'month_key')
            .addSelect(`TO_CHAR(instrument.due_date AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes', 'Mon')`, 'month_label')
            .addSelect('COUNT(*)', 'count');

        if (targetCompanyId) {
            planQuery.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
        } else {
            planQuery.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
        }
        planQuery.andWhere('instrument.due_date BETWEEN :monthStart AND :monthEnd', { monthStart, monthEnd });

        if (itemStatus && itemStatus !== 'All') {
            planQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }
        if (status && status !== 'All') {
            planQuery.andWhere('instrument.status ILIKE :status', { status });
        }
        if (location && location !== 'All') {
            planQuery.andWhere('instrument.location ILIKE :location', { location });
        }
        if (isReferenceStandard === 'true') {
            planQuery.andWhere('instrument.is_reference_standard = :isRef', { isRef: true });
        } else if (isReferenceStandard === 'false') {
            planQuery.andWhere('(instrument.is_reference_standard = :isRef OR instrument.is_reference_standard IS NULL)', { isRef: false });
        }
        planQuery.groupBy('month_key').addGroupBy('month_label').orderBy('month_key', 'ASC');

        const actualQuery = this.calibrationHistoryRepository.createQueryBuilder('history')
            .innerJoin('history.instrument', 'instrument')
            .select(`TO_CHAR(history.last_calibration_date AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes', 'YYYY-MM')`, 'month_key')
            .addSelect(`TO_CHAR(history.last_calibration_date AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes', 'Mon')`, 'month_label')
            .addSelect('COUNT(DISTINCT instrument.id)', 'count');

        if (targetCompanyId) {
            actualQuery.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
        } else {
            actualQuery.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
        }
        actualQuery.andWhere('history.last_calibration_date BETWEEN :monthStart AND :monthEnd', { monthStart, monthEnd });

        if (itemStatus && itemStatus !== 'All') {
            actualQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }
        if (status && status !== 'All') {
            actualQuery.andWhere('instrument.status ILIKE :status', { status });
        }
        if (location && location !== 'All') {
            actualQuery.andWhere('instrument.location ILIKE :location', { location });
        }
        if (isReferenceStandard === 'true') {
            actualQuery.andWhere('instrument.is_reference_standard = :isRef', { isRef: true });
        } else if (isReferenceStandard === 'false') {
            actualQuery.andWhere('(instrument.is_reference_standard = :isRef OR instrument.is_reference_standard IS NULL)', { isRef: false });
        }
        actualQuery.groupBy('month_key').addGroupBy('month_label').orderBy('month_key', 'ASC');

        // ═══════════════════════════════════════════════════════════════
        // 4. Device Type Workload Queries (GAUGES, INSTRUMENTS, EXTERNAL/REF STANDARDS)
        // ═══════════════════════════════════════════════════════════════
        const deviceCategorySql = `
            CASE
                WHEN instrument.is_reference_standard = true 
                     OR instrument.device_type ILIKE '%reference%' 
                     OR instrument.device_type ILIKE '%master%' 
                THEN 'EXTERNAL/REF STANDARDS'
                WHEN instrument.device_type ILIKE '%gauge%' 
                     OR (instrument.device_type IS NULL AND instrument.name ILIKE '%gauge%') 
                THEN 'GAUGES'
                ELSE 'INSTRUMENTS'
            END
        `;

        const devicePendingQuery = this.instrumentRepository.createQueryBuilder('instrument')
            .select(deviceCategorySql, 'device_category')
            .addSelect('COUNT(*)', 'count');

        if (targetCompanyId) {
            devicePendingQuery.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
        } else {
            devicePendingQuery.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
        }
        devicePendingQuery.andWhere('instrument.due_date BETWEEN :startRange AND :endRange', { startRange, endRange });
        devicePendingQuery.andWhere(
            'instrument.id NOT IN (SELECT h.instrument_id FROM calibration_history h WHERE h.instrument_id IS NOT NULL AND h.last_calibration_date BETWEEN :startRange AND :endRange)',
            { startRange, endRange },
        );

        if (itemStatus && itemStatus !== 'All') {
            devicePendingQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }
        if (status && status !== 'All') {
            devicePendingQuery.andWhere('instrument.status ILIKE :status', { status });
        }
        if (location && location !== 'All') {
            devicePendingQuery.andWhere('instrument.location ILIKE :location', { location });
        }
        devicePendingQuery.groupBy(deviceCategorySql);

        const deviceActualQuery = this.calibrationHistoryRepository.createQueryBuilder('history')
            .innerJoin('history.instrument', 'instrument')
            .select(deviceCategorySql, 'device_category')
            .addSelect('COUNT(DISTINCT instrument.id)', 'count');

        if (targetCompanyId) {
            deviceActualQuery.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
        } else {
            deviceActualQuery.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
        }
        deviceActualQuery.andWhere('history.last_calibration_date BETWEEN :startRange AND :endRange', { startRange, endRange });

        if (itemStatus && itemStatus !== 'All') {
            deviceActualQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }
        if (status && status !== 'All') {
            deviceActualQuery.andWhere('instrument.status ILIKE :status', { status });
        }
        if (location && location !== 'All') {
            deviceActualQuery.andWhere('instrument.location ILIKE :location', { location });
        }
        deviceActualQuery.groupBy(deviceCategorySql);

        // ═══════════════════════════════════════════════════════════════
        // 5. Due soon and recent activity queries
        // ═══════════════════════════════════════════════════════════════
        let dueSoonPromise;
        if (startDateStr && endDateStr) {
            dueSoonPromise = this.instrumentRepository.find({
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
            dueSoonPromise = this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: Between(now, next30Days),
                }),
                order: { due_date: 'ASC' },
                select: ['id', 'name', 'due_date', 'location', 'status'],
                take: 50,
            });
        }

        const recentActivityPromise = this.instrumentRepository.find({
            where: getBaseWhere(),
            take: 10,
            order: { updated_at: 'DESC' },
            select: ['id', 'name', 'status', 'updated_at', 'id_code', 'location'],
        });

        // ═══════════════════════════════════════════════════════════════
        // 6. Distributions: Item Status, Calibration Status, Module
        // ═══════════════════════════════════════════════════════════════
        const itemStatusQuery = this.instrumentRepository
            .createQueryBuilder('instrument')
            .select("COALESCE(NULLIF(TRIM(instrument.item_status), ''), 'Active')", 'item_status')
            .addSelect('COUNT(*)', 'count');

        if (targetCompanyId) {
            itemStatusQuery.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
        } else {
            itemStatusQuery.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
        }
        if (location && location !== 'All') {
            itemStatusQuery.andWhere('instrument.location ILIKE :location', { location });
        }
        if (isReferenceStandard === 'true') {
            itemStatusQuery.andWhere('instrument.is_reference_standard = :isRef', { isRef: true });
        } else if (isReferenceStandard === 'false') {
            itemStatusQuery.andWhere('(instrument.is_reference_standard = :isRef OR instrument.is_reference_standard IS NULL)', { isRef: false });
        }
        itemStatusQuery.groupBy("COALESCE(NULLIF(TRIM(instrument.item_status), ''), 'Active')");

        const statusQuery = this.instrumentRepository
            .createQueryBuilder('instrument')
            .select("COALESCE(NULLIF(TRIM(instrument.status), ''), 'OK')", 'status')
            .addSelect('COUNT(*)', 'count');

        if (targetCompanyId) {
            statusQuery.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
        } else {
            statusQuery.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
        }
        if (itemStatus && itemStatus !== 'All') {
            statusQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }
        if (location && location !== 'All') {
            statusQuery.andWhere('instrument.location ILIKE :location', { location });
        }
        if (isReferenceStandard === 'true') {
            statusQuery.andWhere('instrument.is_reference_standard = :isRef', { isRef: true });
        } else if (isReferenceStandard === 'false') {
            statusQuery.andWhere('(instrument.is_reference_standard = :isRef OR instrument.is_reference_standard IS NULL)', { isRef: false });
        }
        statusQuery.groupBy("COALESCE(NULLIF(TRIM(instrument.status), ''), 'OK')");

        const moduleQuery = this.instrumentRepository
            .createQueryBuilder('instrument')
            .select("COALESCE(NULLIF(UPPER(TRIM(instrument.module)), ''), 'Unassigned')", 'module_name')
            .addSelect('COUNT(*)', 'count');

        if (targetCompanyId) {
            moduleQuery.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
        } else {
            moduleQuery.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
        }
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
        moduleQuery.groupBy("COALESCE(NULLIF(UPPER(TRIM(instrument.module)), ''), 'Unassigned')").orderBy('COUNT(*)', 'DESC');

        // ═══════════════════════════════════════════════════════════════
        // 7. Weekly and Daily queries
        // ═══════════════════════════════════════════════════════════════
        const weeklyQuery = this.calibrationHistoryRepository.createQueryBuilder('history')
            .innerJoin('history.instrument', 'instrument')
            .select(`TO_CHAR(DATE_TRUNC('week', history.last_calibration_date AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes'), 'Mon DD')`, 'week_start')
            .addSelect(`TO_CHAR(DATE_TRUNC('week', history.last_calibration_date AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes') + INTERVAL '6 days', 'Mon DD')`, 'week_end')
            .addSelect('COUNT(DISTINCT instrument.id)', 'count');

        if (targetCompanyId) {
            weeklyQuery.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
        } else {
            weeklyQuery.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
        }
        weeklyQuery.andWhere('history.last_calibration_date BETWEEN :startRange AND :endRange', { startRange, endRange });

        if (itemStatus) {
            weeklyQuery.andWhere('instrument.item_status ILIKE :itemStatus', { itemStatus });
        }
        if (status) {
            weeklyQuery.andWhere('instrument.status ILIKE :status', { status });
        }
        if (location) {
            weeklyQuery.andWhere('instrument.location ILIKE :location', { location });
        }
        weeklyQuery.groupBy('week_start').addGroupBy('week_end').orderBy('MIN(history.last_calibration_date)', 'ASC');

        const nowUtc = new Date();
        const nowLocalDaily = new Date(nowUtc.getTime() + tzOffsetMinutes * 60 * 1000);
        const endRangeLocal = new Date(endRange.getTime() + tzOffsetMinutes * 60 * 1000);
        const anchorLocal = endRangeLocal < nowLocalDaily ? endRangeLocal : nowLocalDaily;

        const sevenDaysAgo = new Date(anchorLocal);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

        const dStart = new Date(Date.UTC(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate(), 0, 0, 0, 0) - tzOffsetMinutes * 60 * 1000);
        const dEnd = new Date(Date.UTC(anchorLocal.getFullYear(), anchorLocal.getMonth(), anchorLocal.getDate(), 23, 59, 59, 999) - tzOffsetMinutes * 60 * 1000);
        const effectiveStart = dStart < startRange ? startRange : dStart;

        const dailyQuery = this.calibrationHistoryRepository.createQueryBuilder('history')
            .innerJoin('history.instrument', 'instrument')
            .select(`TO_CHAR(history.last_calibration_date AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes', 'YYYY-MM-DD')`, 'date_key')
            .addSelect(`EXTRACT(DOW FROM history.last_calibration_date AT TIME ZONE 'UTC' + INTERVAL '${tzOffsetMinutes} minutes')`, 'dow')
            .addSelect('COUNT(DISTINCT instrument.id)', 'count');

        if (targetCompanyId) {
            dailyQuery.where('instrument."companyId" = :targetCompanyId', { targetCompanyId });
        } else {
            dailyQuery.where('instrument.created_by IN (:...targetUserIds)', { targetUserIds });
        }
        dailyQuery.andWhere('history.last_calibration_date BETWEEN :effectiveStart AND :dEnd', { effectiveStart, dEnd });

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

        // ═══════════════════════════════════════════════════════════════
        // MASTER CONCURRENT BATCH: All 15 database operations run in parallel
        // ═══════════════════════════════════════════════════════════════
        const [
            kpiResult,
            calibrationsResult,
            pendingRes,
            nextCalibrationInstrument,
            planRows,
            actualRows,
            devicePendingRows,
            deviceActualRows,
            dueSoonInstruments,
            recentActivityRaw,
            rawItemStatusGroups,
            rawStatusGroups,
            moduleGroups,
            weeklyRows,
            dailyRows,
        ] = await Promise.all([
            kpiQuery.getRawOne(),
            countCombinedCalibrations(),
            pendingQuery.getRawOne(),
            this.instrumentRepository.findOne({
                where: getBaseWhere({
                    due_date: MoreThan(now),
                }),
                order: { due_date: 'ASC' },
                select: ['id', 'due_date'],
            }),
            planQuery.getRawMany(),
            actualQuery.getRawMany(),
            devicePendingQuery.getRawMany(),
            deviceActualQuery.getRawMany(),
            dueSoonPromise,
            recentActivityPromise,
            itemStatusQuery.getRawMany(),
            statusQuery.getRawMany(),
            moduleQuery.getRawMany(),
            weeklyQuery.getRawMany(),
            dailyQuery.getRawMany(),
        ]);

        const total = Number(kpiResult?.total || 0);
        const overdue = Number(kpiResult?.overdue || 0);
        const dueSoonCount = Number(kpiResult?.dueSoon || 0);
        const calibratedCount = calibrationsResult.calibratedCount;
        const completedTodayCount = calibrationsResult.completedTodayCount;
        const dueTodayCount = Number(kpiResult?.dueToday || 0);
        const workingDueTodayCount = Number(kpiResult?.workingDueToday || 0);
        const referenceDueTodayCount = Number(kpiResult?.referenceDueToday || 0);
        const pendingCount = Number(pendingRes?.count || 0);
        const dueThisMonth = pendingCount + calibratedCount;

        // Merge plan + actual into monthly series
        const monthsCount: { month: string; plan: number; actual: number }[] = [];
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

        // Format device category workload
        const devicePendingMap = new Map<string, number>(devicePendingRows.map(r => [r.device_category, Number(r.count)]));
        const deviceActualMap = new Map<string, number>(deviceActualRows.map(r => [r.device_category, Number(r.count)]));

        const deviceCategories = ['GAUGES', 'INSTRUMENTS', 'EXTERNAL/REF STANDARDS'];
        const workloadByDeviceType = deviceCategories.map(cat => {
            const act = deviceActualMap.get(cat) || 0;
            const pnd = devicePendingMap.get(cat) || 0;
            return {
                deviceType: cat,
                plan: pnd + act,
                actual: act,
            };
        });

        // Format due soon instruments
        const dueSoonList = dueSoonInstruments.map(inst => ({
            id: inst.id,
            name: inst.name,
            dueDate: inst.due_date,
            location: inst.location,
            status: inst.status,
        }));

        // Format recent activity
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

        // Normalize and format item status distribution
        const itemStatusMap = new Map<string, number>();
        for (const g of rawItemStatusGroups) {
            const normalized = this.normalizeItemStatus(g.item_status);
            itemStatusMap.set(normalized, (itemStatusMap.get(normalized) || 0) + Number(g.count));
        }

        const itemStatusDistribution = Array.from(itemStatusMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const statusDistribution = rawStatusGroups
            .map(g => ({
                name: g.status || 'OK',
                value: Number(g.count),
            }))
            .sort((a, b) => b.value - a.value);

        const moduleDistribution = moduleGroups
            .map(g => ({
                name: g.module_name || 'Unassigned',
                value: Number(g.count),
            }))
            .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

        // Format weekly and daily completed
        const weeklyCompleted: { week: string; completed: number }[] = [];
        for (const row of weeklyRows) {
            weeklyCompleted.push({
                week: `${row.week_start} - ${row.week_end}`,
                completed: Number(row.count),
            });
        }

        const dailyCompleted: { day: string; date: string; completed: number }[] = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (const row of dailyRows) {
            const dow = Number(row.dow);
            dailyCompleted.push({
                day: dayNames[dow] || 'N/A',
                date: row.date_key,
                completed: Number(row.count),
            });
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
            workloadByDeviceType,
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
        const targetCompanyId = await this.resolveTargetCompanyId(userid, companyId);
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

        const nowLocal = new Date(now.getTime() + tzOffsetMinutes * 60 * 1000);
        const todayStartLocal = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 0, 0, 0, 0));
        const todayStart = new Date(todayStartLocal.getTime() - tzOffsetMinutes * 60 * 1000);

        const getBaseWhere = (extraConditions: Record<string, any> = {}) => ({
            ...(targetCompanyId ? { companyId: targetCompanyId } : { created_by: { id: In(targetUserIds) } }),
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
                take: 1000,
            });
        }

        if (listType === 'due') {
            return this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: Between(startRange, endRange),
                }),
                order: { due_date: 'ASC' },
                select: selectFields as any,
                take: 1000,
            });
        }

        if (listType === 'overdue') {
            return this.instrumentRepository.find({
                where: getBaseWhere({
                    due_date: LessThan(todayStart),
                    status: Not(In(['Under Calibration', 'UNDER_CALIBRATION', 'REJECTED'])),
                }),
                order: { due_date: 'ASC' },
                select: selectFields as any,
                take: 1000,
            });
        }

        if (listType === 'calibrated') {
            const historyInstIds = await this.calibrationHistoryRepository.createQueryBuilder('history')
                .innerJoin('history.instrument', 'instrument')
                .select('DISTINCT instrument.id', 'id')
                .where(targetCompanyId ? 'instrument."companyId" = :targetCompanyId' : 'instrument.created_by IN (:...targetUserIds)', targetCompanyId ? { targetCompanyId } : { targetUserIds })
                .andWhere('history.last_calibration_date BETWEEN :startRange AND :endRange', { startRange, endRange })
                .limit(1000)
                .getRawMany();

            const distinctIds = historyInstIds.map(h => h.id).filter(Boolean);
            if (distinctIds.length === 0) return [];

            return this.instrumentRepository.find({
                where: getBaseWhere({ id: In(distinctIds) }),
                order: { name: 'ASC' },
                select: selectFields as any,
                take: 1000,
            });
        }
        return [];
    }
}

