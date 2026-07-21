import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Instrument } from './instrument.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('calibration_history')
export class CalibrationHistory {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @ManyToOne(() => Instrument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instrument_id' })
  instrument: Instrument;

  @Column({ type: 'timestamp', nullable: true })
  last_calibration_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  due_date: Date;

  @Column({ nullable: true })
  certificate_file: string;

  @CreateDateColumn()
  created_at: Date;
}
