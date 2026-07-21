import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('upload_jobs')
export class UploadJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ default: 'pending' })
  status: string; // 'pending' | 'processing' | 'completed' | 'failed'

  @Column({ default: 0 })
  totalRows: number;

  @Column({ default: 0 })
  processedRows: number;

  @Column({ default: 0 })
  successCount: number;

  @Column({ default: 0 })
  failedCount: number;

  @Column({ type: 'jsonb', default: [] })
  errors: any[];

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
