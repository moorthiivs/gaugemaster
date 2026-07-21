import { Entity, PrimaryColumn, Column, UpdateDateColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';
import { Company } from '../company/entities/company.entity';

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

  @Column({ default: false })   
  onboarded: boolean;
}
