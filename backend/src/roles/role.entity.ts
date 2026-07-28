import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Company } from '../company/entities/company.entity';

export interface ModulePermission {
  create: boolean;
  edit: boolean;
  view: boolean;
  delete: boolean;
}

export type RolePermissions = Record<string, ModulePermission>;

@Entity('roles')
export class Role {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'jsonb', default: {} })
  permissions: RolePermissions;

  @ManyToOne(() => Company, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'companyId' })
  company?: Company;

  @Column({ nullable: true })
  companyId?: string;

  @Column({ default: false })
  isSystemDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
