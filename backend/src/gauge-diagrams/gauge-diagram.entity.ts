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

@Entity('gauge_diagrams')
@Index('idx_gauge_diagram_company', ['companyId'])
export class GaugeDiagram {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column()
  gauge_name: string;

  @Column({ nullable: true })
  id_code?: string;

  @Column({ nullable: true })
  part_name?: string;

  @Column({ nullable: true })
  instrument_id?: string;

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

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deleted_at?: Date;

  @Column({ nullable: true })
  deleted_by_id?: string;

  @Column({ nullable: true })
  deleted_by_name?: string;

  @Column({ type: 'text', nullable: true })
  deletion_reason?: string | null;
}
