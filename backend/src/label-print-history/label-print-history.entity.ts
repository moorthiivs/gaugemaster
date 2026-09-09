import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Company } from '../company/entities/company.entity';

@Entity('label_print_histories')
@Index('idx_label_hist_company_created', ['companyId', 'createdAt'])
export class LabelPrintHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  companyId: string;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  action: string; // 'PRINT_LABEL' | 'DOWNLOAD_XLSX'

  @Column({ default: 'Print Label' })
  status: string; // 'Print Label' | 'Download XLSX' | 'Completed'

  @Column({ type: 'int', default: 0 })
  itemsCount: number;

  @Column({ type: 'jsonb', nullable: true })
  selectedFields: string[]; // List of user-selected columns for this print/download

  @Column({ type: 'jsonb', nullable: true })
  labelConfig: {
    presetId?: string;
    presetName?: string;
    width?: number;
    height?: number;
    columns?: number;
    layoutMode?: string;
    fontSize?: number;
    showBorder?: boolean;
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  items: Array<Record<string, any>>; // Full snapshots of instruments with all columns

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
