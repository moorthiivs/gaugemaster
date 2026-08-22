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
import { User } from '../../users/user.entity';

@Entity('calibration_templates')
export class CalibrationTemplate {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  instrument_type: string; // e.g. "Dial Indicator (0.001 mm)", "Snap Gauge", "Plug Gauge"

  @Column()
  calibration_type: string; // e.g. "dimensional", "length", "pressure", "temperature", "torque", "electrical", "weight", "flow"

  @Column({ nullable: true })
  default_unit: string;

  @Column({ type: 'float', nullable: true })
  default_tolerance: number;

  @Column({ type: 'jsonb', nullable: true })
  environmental_defaults: {
    temperature?: string;
    humidity?: string;
    pressure?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  calibration_points: any[]; // Array of template calibration points with nominal, description, tolerance, etc.

  @Column({ type: 'jsonb', nullable: true })
  custom_columns: any[]; // Saved custom column definitions (id, name, type, formulaType, customFormula)

  @Column({ type: 'jsonb', nullable: true })
  standard_columns_config?: Record<string, any>; // Saved configuration for standard columns (id: { name, type, formulaType, customFormula })

  @Column({ type: 'jsonb', nullable: true })
  column_order: string[]; // Saved column order IDs

  @Column({ type: 'jsonb', nullable: true })
  hidden_columns: string[]; // Saved hidden column IDs (e.g. ['description', 'tolerance'])

  @Column({ type: 'jsonb', nullable: true })
  acceptance_criteria?: {
    enabled?: boolean;
    value?: number;
    type?: 'percentage' | 'absolute';
  };

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ type: 'text', nullable: true })
  standard_reference?: string;

  @Column({ nullable: true })
  procedure_reference?: string;

  @Column({ nullable: true })
  status_rule_type?: string;

  @Column({ type: 'text', nullable: true })
  status_formula?: string;

  @Column({ type: 'int', nullable: true })
  decimal_places?: number;

  @Column({ type: 'text', nullable: true })
  diagram_image?: string;

  @Column({ type: 'int', nullable: true })
  diagram_image_width?: number;

  @Column({ type: 'int', nullable: true })
  diagram_image_height?: number;

  @Column({ nullable: true })
  diagram_image_alignment?: 'center' | 'left' | 'right';

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ nullable: true })
  companyId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
