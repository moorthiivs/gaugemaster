import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('backup_records')
export class BackupRecord {
    @PrimaryColumn('uuid')
    id: string = uuidv4();

    @Column()
    companyId: string;

    @Column({ nullable: true })
    triggeredBy: string; // userId who triggered it, null for scheduled

    @Column({ type: 'varchar', length: 20 })
    type: string; // 'manual' | 'scheduled'

    @Column({ type: 'varchar', length: 20 })
    status: string; // 'pending' | 'in_progress' | 'completed' | 'failed'

    @Column({ nullable: true })
    fileName: string;

    @Column({ type: 'bigint', nullable: true })
    fileSizeBytes: number;

    @Column({ type: 'varchar', length: 50, default: 'local' })
    storageType: string; // 'local' | 'google_drive'

    @Column({ nullable: true })
    storagePath: string; // local path or Google Drive file ID

    @Column({ nullable: true })
    errorMessage: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @Column({ nullable: true, type: 'timestamptz' })
    completedAt: Date;
}
