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

@Entity('ReminderFrequncy')
export class ReminderFrequncy {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column()
  no_of_mails: number;

  @Column()
  when: string;

  @Column()
  reminder_start: number;

  @Column()
  reminder_start_unit: string;

  @Column()
  reminder_field: string;

  @Column({ type: 'timestamp' })
  reminder_date: Date;

  @Column({ type: "json", nullable: true })
  mail_times: {
      date: any; time: string 
}[];


  @Column()
  priority: string;

  @Column({ type: "text" })
  mail_template: string;


  @Column()
  recipient_role: string;

  /** 'single' = one email per instrument (default), 'bulk' = all instruments grouped in one email */
  @Column({ default: 'single', nullable: true })
  email_mode: string;

  @Column({ default: true })
  isactive: boolean;

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
