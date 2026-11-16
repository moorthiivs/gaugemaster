import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity({ name: 'copilot_messages' })
@Index(['conversationId', 'createdAt'])
@Index(['companyId', 'userId'])
export class CopilotMessage {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid' })
  conversationId: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  role: 'user' | 'assistant' | 'system';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  model?: string;

  @Column({ type: 'integer', default: 0 })
  promptTokens: number;

  @Column({ type: 'integer', default: 0 })
  candidateTokens: number;

  @Column({ type: 'integer', default: 0 })
  totalTokens: number;

  @Column({ type: 'jsonb', nullable: true })
  actionPayload?: any;

  @Column({ type: 'jsonb', nullable: true })
  attachments?: any[];

  @Column({ type: 'jsonb', nullable: true })
  suggestions?: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
