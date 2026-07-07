import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PhysicalSpace } from '../../spaces/entities/physical-space.entity';
import { AcademicPeriod } from '../../periods/entities/academic-period.entity';
import { RequestItem } from './request-item.entity';
import { HandoverAct } from './handover-act.entity';

@Entity('requests')
export class Request {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ name: 'space_id' })
  spaceId: string;

  @ManyToOne(() => PhysicalSpace)
  @JoinColumn({ name: 'space_id' })
  space: PhysicalSpace;

  @Column({ name: 'academic_period_id' })
  academicPeriodId: string;

  @ManyToOne(() => AcademicPeriod)
  @JoinColumn({ name: 'academic_period_id' })
  academicPeriod: AcademicPeriod;

  @Column({ type: 'varchar', default: 'EN_PROCESO' })
  status: string; // 'EN_PROCESO', 'APROBADA', 'RECHAZADA'

  @Column({ type: 'text', nullable: true })
  motive: string | null;

  @Column({ type: 'text', name: 'rejection_reason', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamp', name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by_id', nullable: true })
  resolvedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by_id' })
  resolvedBy: User | null;

  @OneToMany(() => RequestItem, (item) => item.request, { cascade: true })
  items: RequestItem[];

  @OneToOne(() => HandoverAct, (act) => act.request, { nullable: true })
  handoverAct: HandoverAct | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
