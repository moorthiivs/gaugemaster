import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('standards')
@Index('idx_standards_company', ['companyId'])
@Index('idx_standards_type', ['standard_type'])
@Index('idx_standards_deleted_at', ['deleted_at'])
export class Standard {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column()
  standard_number: string;

  @Column()
  standard_name: string;

  @Column()
  standard_type: string;

  @Column({ nullable: true })
  document_name?: string;

  @Column({ nullable: true })
  file_type?: string;

  @Column({ nullable: true })
  file_path?: string;

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

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deleted_at?: Date;

  @Column({ nullable: true })
  deleted_by_id?: string;

  @Column({ nullable: true })
  deleted_by_name?: string;

  @Column({ type: 'text', nullable: true })
  deletion_reason?: string | null;
}
