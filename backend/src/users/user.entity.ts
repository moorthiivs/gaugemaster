import { Entity, PrimaryColumn, Column, UpdateDateColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';
import { Company } from '../company/entities/company.entity';
import { Role } from '../roles/role.entity';

@Entity('users')
export class User {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column({ unique: true })
  @ApiProperty()
  email: string;

  @Column()
  @ApiProperty()
  name: string;

  @Column({ nullable: true })
  @ApiProperty()
  password: string;

  @Column({ nullable: true })
  googleId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Company, (company) => company.users, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ nullable: true })
  companyId: string;

  @ManyToOne(() => Role, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roleId' })
  role?: Role;

  @Column({ nullable: true })
  roleId?: string;

  @Column({ nullable: true })
  designation?: string;

  @Column({ type: 'text', nullable: true })
  signature?: string;

  @Column({ type: 'jsonb', default: [] })
  additionalEmails: string[];

  @Column({ default: false })   
  onboarded: boolean;
}
