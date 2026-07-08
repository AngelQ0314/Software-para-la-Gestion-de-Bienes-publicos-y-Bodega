import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicPeriod } from '../../periods/entities/academic-period.entity';
import { User } from '../../users/entities/user.entity';
import { PhysicalSpace } from '../../spaces/entities/physical-space.entity';
import { IncidentReportItem } from './incident-report-item.entity';

@Entity('incident_reports')
export class IncidentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ name: 'space_id', type: 'uuid' })
  spaceId: string;

  @ManyToOne(() => PhysicalSpace, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'space_id' })
  space: PhysicalSpace;

  @Column({ name: 'academic_period_id', type: 'uuid' })
  academicPeriodId: string;

  @ManyToOne(() => AcademicPeriod, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'academic_period_id' })
  academicPeriod: AcademicPeriod;

  @Column({ name: 'jornada', type: 'varchar', length: 50 })
  jornada: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 50, default: 'PENDIENTE' })
  status: string; // 'PENDIENTE', 'REVISADO', 'RESUELTO'

  @OneToMany(() => IncidentReportItem, (item) => item.incidentReport, { cascade: true })
  items: IncidentReportItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
