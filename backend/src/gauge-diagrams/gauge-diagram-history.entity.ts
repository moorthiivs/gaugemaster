import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('gauge_diagram_history')
@Index('idx_gdh_diagram_id', ['diagram_id'])
@Index('idx_gdh_company', ['companyId'])
export class GaugeDiagramHistory {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid' })
  diagram_id: string;

  @Column()
  gauge_name: string;

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
