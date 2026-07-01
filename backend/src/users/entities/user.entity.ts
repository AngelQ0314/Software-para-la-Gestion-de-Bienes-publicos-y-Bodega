import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

export enum UserRole {
  ADMINISTRADOR = 'ADMINISTRADOR',
  DOCENTE = 'DOCENTE',
  RESPONSABLE_DE_BIENES = 'RESPONSABLE_DE_BIENES',
}

export enum UserStatus {
  PENDIENTE = 'PENDIENTE',
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  DADO_DE_BAJA = 'DADO_DE_BAJA',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 10 })
  cedula: string;

  @Column({ name: 'correo_institucional', unique: true })
  correoInstitucional: string;

  @Column({ name: 'correo_secundario', nullable: true })
  correoSecundario: string;

  @Column({ nullable: true })
  nombres: string;

  @Column({ nullable: true })
  apellidos: string;

  @Column({ nullable: true })
  telefono: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.DOCENTE })
  rol: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDIENTE,
  })
  estado: UserStatus;

  //obliga cambio de contraseña en primer inicio
  @Column({ name: 'is_first_login', default: true })
  isFirstLogin: boolean;

  //obliga completar perfil después del primer cambio de contraseña
  @Column({ name: 'profile_completed', default: false })
  profileCompleted: boolean;

  //token temporal para recuperación de contraseña
  @Column({ name: 'reset_token', nullable: true, type: 'varchar' })
  resetToken: string | null;

  @Column({ name: 'reset_token_expires', nullable: true, type: 'timestamp' })
  resetTokenExpires: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column('simple-array', { nullable: true })
  areas: string[];

  @Column('simple-array', { nullable: true })
  jornadas: string[];

  @Column({ name: 'horario_ingles', nullable: true })
  horarioIngles: string;
}
