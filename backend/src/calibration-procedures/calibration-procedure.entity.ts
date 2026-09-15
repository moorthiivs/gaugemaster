import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('calibration_procedures')
@Index('idx_calib_proc_company', ['companyId'])
export class CalibrationProcedure {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

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

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  companyId?: string;

  @Column({ nullable: true })
  created_by_id?: string;

  @Column({ nullable: true })
  created_by_name?: string;

  @Column({ nullable: true })
  updated_by_id?: string;

  @Column({ nullable: true })
  updated_by_name?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
