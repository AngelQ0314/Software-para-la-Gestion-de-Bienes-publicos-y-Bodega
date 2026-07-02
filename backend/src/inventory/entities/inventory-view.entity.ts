import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Category } from './category.entity';
import { InventoryItem } from './inventory-item.entity';

export enum InventoryViewCode {
  BIENES_PUBLICOS = 'BIENES_PUBLICOS',
  INSUMOS = 'INSUMOS',
  BIBLIOTECA = 'BIBLIOTECA',
}

@Entity('inventory_views')
export class InventoryView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({
    type: 'enum',
    enum: InventoryViewCode,
    unique: true,
  })
  code: InventoryViewCode; // Slug para filtros y lógica interna

  @OneToMany(() => Category, (category) => category.inventoryView)
  categories: Category[];

  @OneToMany(() => InventoryItem, (item) => item.inventoryView)
  items: InventoryItem[];
}
