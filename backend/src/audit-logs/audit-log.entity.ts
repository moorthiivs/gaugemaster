import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Company } from '../company/entities/company.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  companyId: string;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column()
  action: string; // e.g., 'CALIBRATION_APPROVE', 'CERTIFICATE_GENERATE', 'INSTRUMENT_CREATE'

  @Column({ default: 'SUCCESS' })
  status: string; // 'SUCCESS' | 'FAILED'

  @Column({ type: 'int', nullable: true })
  statusCode: number; // e.g. 200, 201, 400, 403, 500

  @Column({ nullable: true })
  description: string; // Human readable description

  @Column({ nullable: true })
  resourceType: string; // 'Calibration', 'Instrument', 'Template', 'User', etc.

  @Column()
  resource: string; // e.g., '/api/calibrations/123/approve'

  @Column({ nullable: true })
  method: string; // 'GET', 'POST', 'PUT', 'DELETE', etc.

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ type: 'int', nullable: true })
  durationMs: number;

  @Column({ type: 'jsonb', nullable: true })
  details: any;

  @CreateDateColumn()
  createdAt: Date;
}
