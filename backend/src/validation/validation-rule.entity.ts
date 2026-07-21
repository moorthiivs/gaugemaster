import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('validation_rules')
export class ValidationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @Column()
  fieldName: string; // Internal name like 'id_code', 'name'

  @Column()
  displayName: string; // UI name like 'IMTE', 'Description'

  @Column({ default: false })
  isRequired: boolean;

  @Column({ default: false })
  isUnique: boolean;

  @Column({ default: true })
  isStrictDate: boolean;

  @Column({ default: 'text' })
  validationType: string; // 'text', 'date', 'number'

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
