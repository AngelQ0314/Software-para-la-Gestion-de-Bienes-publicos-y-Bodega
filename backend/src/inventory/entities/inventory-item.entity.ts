import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { InventoryView } from './inventory-view.entity';
import { Subcategory } from './subcategory.entity';
import { CodeType } from './code-type.entity';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inventory_view_id', nullable: true })
  inventoryViewId: string | null;

  @ManyToOne(() => InventoryView, (view) => view.items, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'inventory_view_id' })
  inventoryView: InventoryView;

  @Column({ name: 'subcategory_id', nullable: true })
  subcategoryId: string | null;

  @ManyToOne(() => Subcategory, (subcategory) => subcategory.items, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory: Subcategory;

  @Column({ name: 'code_type_id' })
  codeTypeId: string;

  @ManyToOne(() => CodeType, (codeType) => codeType.items)
  @JoinColumn({ name: 'code_type_id' })
  codeType: CodeType;

  @Column({ type: 'varchar', name: 'code_value', unique: true, nullable: true })
  codeValue: string | null;

  @Column()
  name: string;

  @Column({ type: 'jsonb', name: 'dynamic_values', default: {} })
  dynamicValues: Record<string, any>; // Estructura JSON: {"id_del_custom_field": "valor"}

  @Column({ type: 'varchar', default: 'ACTIVO' })
  status: string; // Valores válidos: 'ACTIVO', 'INACTIVO'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
