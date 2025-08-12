// dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Instrument } from 'src/instruments/instrument.entity';
import { Between, LessThan, MoreThan, Repository } from 'typeorm';

@Injectable()
export class DashboardService {
    constructor(
        @InjectRepository(Instrument)
        private readonly instrumentRepository: Repository<Instrument>,
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


    async fetchDashboard(userid: string) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // 1. Total instruments count for this user
        const total = await this.instrumentRepository.count({
            where: { created_by: { id: userid } },
        });

        // 2. Instruments due this month for this user
        const dueThisMonth = await this.instrumentRepository.count({
            where: {
                due_date: Between(startOfMonth, endOfMonth),
                created_by: { id: userid },
            },
        });

        // 3. Instruments overdue for this user
        const overdue = await this.instrumentRepository.count({
            where: {
                due_date: LessThan(now),
                created_by: { id: userid },
            },
        });

        // 4. Next calibration instrument for this user
        const nextCalibrationInstrument = await this.instrumentRepository.findOne({
            where: {
                due_date: MoreThan(now),
                created_by: { id: userid },
            },
            order: { due_date: 'ASC' },
        });

        // 5. Due dates by month for last 6 + next 6 months, filtered by user
        const monthsCount: { month: string; count: number }[] = [];

        for (let i = -5; i <= 6; i++) {
            const firstDay = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);

            const count = await this.instrumentRepository.count({
                where: {
                    due_date: Between(firstDay, lastDay),
                    created_by: { id: userid },
                },
            });

            monthsCount.push({
                month: firstDay.toLocaleString('default', { month: 'short' }),
                count,
            });
        }

        // 6. Detailed instruments due in next 30 days for this user
        const next30Days = new Date(now);
        next30Days.setDate(now.getDate() + 30);

        const dueSoonInstruments = await this.instrumentRepository.find({
            where: {
                due_date: Between(now, next30Days),
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

        // 7. Recent activity for this user
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


}
