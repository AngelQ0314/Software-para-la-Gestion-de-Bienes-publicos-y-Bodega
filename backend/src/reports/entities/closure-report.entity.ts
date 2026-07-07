import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicPeriod } from '../../periods/entities/academic-period.entity';

@Entity('closure_reports')
export class ClosureReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'academic_period_id' })
  academicPeriodId: string;

  @OneToOne(() => AcademicPeriod, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_period_id' })
  academicPeriod: AcademicPeriod;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'jsonb', name: 'report_data' })
  reportData: any; // Contiene la instantánea JSON del inventario y sus novedades

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
