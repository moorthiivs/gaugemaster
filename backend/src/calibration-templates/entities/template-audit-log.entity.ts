import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('template_audit_logs')
export class TemplateAuditLog {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'varchar', length: 50 })
  action: 'EXPORT' | 'IMPORT';

  @Column({ nullable: true })
  sourceCompanyId?: string;

  @Column({ nullable: true })
  destinationCompanyId?: string;

  @Column({ nullable: true })
  performedByUserId?: string;

  @Column({ nullable: true })
  performedByName?: string;

  @Column({ type: 'int', default: 0 })
  templateCount: number;

  @Column({ type: 'int', default: 0 })
  successCount: number;

  @Column({ type: 'int', default: 0 })
  failureCount: number;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
