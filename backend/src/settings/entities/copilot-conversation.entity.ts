import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity({ name: 'copilot_conversations' })
@Index(['companyId', 'userId', 'status'])
@Index(['companyId', 'screenContext'])
export class CopilotConversation {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255, default: 'New Conversation' })
  title: string;

  @Column({ type: 'varchar', length: 100, default: 'general' })
  screenContext: string; // 'template_builder' | 'calibration_wizard' | 'instruments' | 'dashboard' | 'general'

  @Column({ type: 'varchar', length: 255, nullable: true })
  entityId?: string; // e.g. template ID or instrument ID

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'archived';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
