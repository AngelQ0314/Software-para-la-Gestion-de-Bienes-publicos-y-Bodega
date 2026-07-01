import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum LogType {
  CAMBIO_ROL = 'CAMBIO_ROL',
  CAMBIO_ESTADO = 'CAMBIO_ESTADO',
  RESET_PASSWORD = 'RESET_PASSWORD',
}

@Entity('user_logs')
export class UserLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Usuario afectado por el cambio
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  // Administrador que realizó el cambio
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'admin_id' })
  admin: User;

  @Column({ name: 'admin_id' })
  adminId: string;

  @Column({ name: 'tipo_cambio', type: 'enum', enum: LogType })
  tipoCambio: LogType;

  @Column({ name: 'valor_anterior', nullable: true })
  valorAnterior: string;

  @Column({ name: 'valor_nuevo', nullable: true })
  valorNuevo: string;

  // Obligatorio para INACTIVO y DADO_DE_BAJA
  @Column({ type: 'text', nullable: true })
  observacion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
