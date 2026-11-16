import { Entity, Column, PrimaryColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity({ name: 'copilot_daily_quotas' })
@Index(['companyId', 'userId', 'quotaDate'], { unique: true })
@Index(['quotaDate'])
export class CopilotDailyQuota {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ type: 'uuid' })
  companyId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'date' })
  quotaDate: string; // Format: YYYY-MM-DD

  @Column({ type: 'integer', default: 0 })
  messageCount: number;

  @Column({ type: 'integer', default: 0 })
  tokensUsed: number;

  @Column({ type: 'integer', default: 50 })
  dailyMessageLimit: number;

  @Column({ type: 'integer', default: 200000 })
  dailyTokenLimit: number;

  @Column({ type: 'timestamptz' })
  resetAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
