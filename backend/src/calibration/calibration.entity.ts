import { Company } from '../company/entities/company.entity';
import { Instrument } from '../instruments/instrument.entity';
import { User } from '../users/user.entity';
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { CalibrationAuditLog } from './calibration-audit-log.entity';

/**
 * Stores each calibration performed on an instrument.
 * Includes calibration data points, reference standard info,
 * environmental conditions, verdict, and certificate/ULR numbers.
 */
@Entity('calibrations')
export class Calibration {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  // ── Instrument being calibrated ──────────────────────────────
  @ManyToOne(() => Instrument, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instrument_id' })
  instrument: Instrument;

  @Column({ nullable: true })
  instrument_id: string;

  // ── Calibration metadata ─────────────────────────────────────
  @Column({ type: 'timestamp' })
  calibration_date: Date;

  @Column({ nullable: true })
  calibration_type: string; // "pressure", "temperature", "dimensional", "torque", "electrical", "weight", "flow"

  // ── Reference Standard / Master Instrument ───────────────────
  @Column({ nullable: true })
  reference_standard_name: string;

  @Column({ nullable: true })
  reference_standard_id: string;

  @Column({ nullable: true })
  reference_standard_traceable_to: string;

  @Column({ type: 'timestamp', nullable: true })
  reference_standard_validity: Date;

  @Column({ nullable: true })
  reference_standard_range: string;

  @Column({ nullable: true })
  reference_standard_least_count: string;

  @Column({ type: 'jsonb', nullable: true })
  reference_standards: any[];

  // ── Environmental Conditions ─────────────────────────────────
  @Column({ type: 'jsonb', nullable: true })
  environmental_conditions: {
    temperature: string;
    humidity: string;
    pressure?: string;
  };

  // ── Calibration Data Points ──────────────────────────────────
  @Column({ type: 'jsonb', nullable: true })
  calibration_points: CalibrationPoint[];

  @Column({ type: 'jsonb', nullable: true })
  custom_columns?: any[];

  @Column({ type: 'jsonb', nullable: true })
  column_order?: string[];

  @Column({ type: 'jsonb', nullable: true })
  hidden_columns?: string[];

  @Column({ type: 'jsonb', nullable: true })
  standard_columns_config?: Record<string, any>;

  @Column({ type: 'int', nullable: true })
  decimal_places?: number;

  @Column({ type: 'jsonb', nullable: true })
  acceptance_criteria?: {
    enabled?: boolean;
    value?: number;
    type?: 'percentage' | 'absolute';
  };

  // ── Results ──────────────────────────────────────────────────
  @Column({ nullable: true })
  uncertainty: string;

  @Column({ nullable: true })
  verdict: string; // "PASS" | "FAIL" | "CONDITIONAL"

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ nullable: true })
  status_rule_type?: string;

  @Column({ type: 'text', nullable: true })
  status_formula?: string;

  @Column({ nullable: true })
  procedure_reference?: string;

  // ── Signatories ──────────────────────────────────────────────
  @Column({ nullable: true })
  calibrated_by: string;

  @Column({ nullable: true })
  calibrated_by_designation: string;

  @Column({ nullable: true })
  reviewed_by: string;

  @Column({ nullable: true })
  reviewed_by_designation: string;

  @Column({ nullable: true })
  approved_by: string;

  @Column({ nullable: true })
  approved_by_designation: string;

  // ── Certificate & ULR Numbers ────────────────────────────────
  @Column({ nullable: true })
  certificate_number: string;

  @Column({ nullable: true })
  ulr_number?: string;

  @Column({ type: 'boolean', default: false })
  ulr_enabled: boolean;

  @Column({ type: 'boolean', default: false })
  certificate_generated: boolean;

  @Column({ nullable: true })
  certificate_file: string;

  @Column({ type: 'timestamp', nullable: true })
  next_calibration_date: Date;

  // ── Audit & Ownership ────────────────────────────────────────
  @ManyToOne(() => Company, { eager: true })
  @JoinColumn({ name: 'companyId' })
  company?: Company;

  @Column({ nullable: true })
  companyId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'created_by' })
  created_by?: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => CalibrationAuditLog, (log) => log.calibration, {
    cascade: true,
  })
  audit_logs: CalibrationAuditLog[];
}

/**
 * Shape of each calibration data point stored in the JSON array.
 */
export interface CalibrationPoint {
  point_number: number;
  nominal: number;
  ascending_reading: number;
  descending_reading?: number;
  error: number;
  unit: string;
  tolerance?: number;
  status?: 'PASS' | 'FAIL';
}
