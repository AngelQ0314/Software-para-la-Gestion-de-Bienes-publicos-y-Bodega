import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

export enum SpaceType {
  AULA = 'AULA',
  LABORATORIO = 'LABORATORIO',
  TALLER = 'TALLER',
  OFICINA = 'OFICINA',
  BODEGA = 'BODEGA',
}

@Entity('physical_spaces')
export class PhysicalSpace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_number', unique: true })
  roomNumber: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: SpaceType,
    default: SpaceType.AULA,
  })
  type: SpaceType;

  @Column()
  location: string;

  @Column({ type: 'int' })
  capacity: number;

  @Column('simple-array')
  jornadas: string[]; // Valores esperados: 'MATUTINA', 'VESPERTINA', 'NOCTURNA'

  @ManyToMany(() => User)
  @JoinTable({
    name: 'space_teachers',
    joinColumn: { name: 'space_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  responsibleTeachers: User[];

  @OneToMany(() => InventoryItem, (item) => item.physicalSpace)
  items: InventoryItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
