import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('standard_history')
@Index('idx_sh_standard_id', ['standard_id'])
@Index('idx_sh_company', ['companyId'])
export class StandardHistory {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid' })
  standard_id: string;

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
  action_details?: string;

  @Column({ nullable: true })
  created_by_id?: string;

  @Column({ nullable: true })
  created_by_name?: string;

  @Column({ nullable: true })
  companyId?: string;

  @CreateDateColumn()
  created_at: Date;
}
