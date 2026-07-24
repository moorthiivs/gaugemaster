import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Calibration } from './calibration.entity';
import { User } from '../users/user.entity';

@Entity('calibration_audit_logs')
export class CalibrationAuditLog {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid' })
  calibration_id: string;

  @ManyToOne(() => Calibration, (calibration) => calibration.audit_logs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'calibration_id' })
  calibration: Calibration;

  @Column({ nullable: true })
  edited_by_id?: string;

  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'edited_by_id' })
  edited_by?: User;

  @Column({ nullable: true })
  edited_by_name?: string;

  @Column({ type: 'jsonb', nullable: true })
  changes_summary: { field: string; oldValue: any; newValue: any }[];

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn()
  edited_at: Date;
}
