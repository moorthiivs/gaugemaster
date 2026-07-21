import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('notifications')
export class Notification {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column()
  type: string; // 'mail_success', 'mail_error', 'gauge_due', 'general'

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column({ default: false })
  is_read: boolean;

  @CreateDateColumn()
  created_at: Date;
}
