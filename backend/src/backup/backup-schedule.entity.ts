import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('backup_schedules')
export class BackupSchedule {
    @PrimaryColumn('uuid')
    id: string = uuidv4();

    @Column()
    companyId: string;

    @Column({ default: true })
    enabled: boolean;

    @Column({ type: 'varchar', length: 20 })
    frequency: string; // 'daily' | 'weekly' | 'monthly'

    @Column({ type: 'varchar', length: 10, default: '02:00' })
    timeOfDay: string; // HH:mm in 24h format

    @Column({ type: 'int', nullable: true })
    dayOfWeek: number; // 0=Sun..6=Sat (for weekly)

    @Column({ type: 'int', nullable: true })
    dayOfMonth: number; // 1..28 (for monthly)

    @Column({ type: 'int', default: 7 })
    retentionDays: number; // auto-delete backups older than N days

    @Column({ type: 'varchar', length: 50, default: 'local' })
    storageType: string; // 'local' | 'google_drive'

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
