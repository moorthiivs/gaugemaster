import { User } from 'src/users/user.entity';
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

  @Column()
  id_code: string;

  @Column()
  name: string;


  @Column()
  location: string;

  @Column()
  frequency: string;

  @Column({ type: 'timestamp' })
  last_calibration_date: Date;

  @Column({ type: 'timestamp' })
  due_date: Date;

  @Column()
  agency: string;

  @Column()
  range: string;

  @Column()
  serial_no: string;

  @Column()
  least_count: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column() // e.g. "OK", "Overdue", "Pending"
  status: string;

  @Column({ type: 'json', nullable: true })
  custom_parameters: Record<string, any>; // ✅ for dynamic extra fields

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
}
