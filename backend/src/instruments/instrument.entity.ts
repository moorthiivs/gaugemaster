import { Company } from '../company/entities/company.entity';
import { User } from '../users/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('instruments')
export class Instrument {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ nullable: true })
  id_code: string;

  @Column({ nullable: true })
  sino: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  frequency: string;

  @Column({ type: 'timestamp', nullable: true })
  last_calibration_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  due_date: Date;

  @Column({ nullable: true })
  agency: string;

  @Column({ nullable: true })
  range: string;

  @Column({ nullable: true })
  serial_no: string;

  @Column({ nullable: true })
  least_count: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'boolean', default: false })
  is_reference_standard: boolean;

  @Column({ nullable: true })
  status: string;

  @Column({ nullable: true })
  item_status: string;

  @Column({ nullable: true })
  make: string;

  @Column({ nullable: true })
  item_type: string;

  @Column({ nullable: true })
  part_no: string;

  @Column({ nullable: true })
  part_name: string;

  @Column({ nullable: true })
  module: string;

  @Column({ nullable: true })
  calibration_source: string;

  @Column({ type: 'timestamp', nullable: true })
  gauge_issue_date: Date;

  @Column({ nullable: true })
  gauges_received_by: string;

  @Column({ nullable: true })
  gauges_issued_by: string;

  @Column({ type: 'text', nullable: true })
  calibration_procedure: string;

  @Column({ nullable: true })
  traceable: string;

  @Column({ nullable: true })
  customer: string;

  @Column({ nullable: true })
  sector: string;

  @Column({ nullable: true })
  criticality_level: string;

  @Column({ nullable: true })
  cert_no: string;

  @Column({ type: 'json', nullable: true })
  custom_parameters: Record<string, any>; // ✅ for dynamic extra fields

  @Column({ nullable: true })
  certificate_file: string;

  // Audit fields
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'created_by' })
  created_by?: User;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'updated_by' })
  updated_by?: User;


  @ManyToOne(() => Company, (company) => company.users, { eager: true })
  @JoinColumn({ name: 'companyId' })
  company?: Company;
  @Column({ nullable: true })
  companyId: string;

}
