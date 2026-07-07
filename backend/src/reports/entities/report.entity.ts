import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicPeriod } from '../../periods/entities/academic-period.entity';
import { User } from '../../users/entities/user.entity';

export enum ReportType {
  PERIODO_ACADEMICO = 'PERIODO_ACADEMICO',
  JORNADA = 'JORNADA',
  GESTION_USUARIOS = 'GESTION_USUARIOS',
  NOVEDADES = 'NOVEDADES',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'varchar', length: 50 })
  type: ReportType;

  @Column({ name: 'academic_period_id', type: 'uuid', nullable: true })
  academicPeriodId: string | null;

  @ManyToOne(() => AcademicPeriod, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'academic_period_id' })
  academicPeriod: AcademicPeriod | null;

  @Column({ name: 'jornada', type: 'varchar', nullable: true })
  jornada: string | null; // Valores: 'MATUTINA', 'VESPERTINA', 'NOCTURNA', null

  @Column({ type: 'jsonb', name: 'report_data' })
  reportData: any; // Datos consolidados del reporte (instantánea inmutable)

  @Column({ name: 'generated_by_id', type: 'uuid', nullable: true })
  generatedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'generated_by_id' })
  generatedBy: User | null;

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
