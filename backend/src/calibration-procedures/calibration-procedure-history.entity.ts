import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('calibration_procedure_history')
@Index('idx_cph_procedure_id', ['procedure_id'])
@Index('idx_cph_company', ['companyId'])
export class CalibrationProcedureHistory {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid' })
  procedure_id: string;

  @Column()
  process: string;

  @Column({ nullable: true })
  document_name: string;

  @Column({ nullable: true })
  file_type: string;

  @Column({ nullable: true })
  file_path: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ nullable: true })
  created_by_id?: string;

  @Column({ nullable: true })
  created_by_name?: string;

  @Column({ type: 'text', nullable: true })
  action_details?: string;

  @Column({ nullable: true })
  companyId?: string;

  @CreateDateColumn()
  created_at: Date;
}
