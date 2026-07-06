import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { PhysicalSpace } from './physical-space.entity';

@Entity('inventory_item_shifts')
export class InventoryItemShift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({ name: 'space_id' })
  spaceId: string;

  @ManyToOne(() => PhysicalSpace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'space_id' })
  space: PhysicalSpace;

  @Column()
  jornada: string; // Valores: 'MATUTINA', 'VESPERTINA', 'NOCTURNA'

  @Column({ name: 'estado_fisico', default: 'BUENO' })
  estadoFisico: string; // Valores: 'BUENO', 'REGULAR', 'MALO'

  @Column({ type: 'text', nullable: true })
  observacion: string | null;

  @Column({ type: 'text', nullable: true })
  novedades: string | null; // Novedades reportadas/anomalías

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
