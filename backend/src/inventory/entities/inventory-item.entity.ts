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

  @Column({ name: 'physical_space_id', nullable: true })
  physicalSpaceId: string | null;

  @ManyToOne('PhysicalSpace', 'items', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'physical_space_id' })
  physicalSpace: any;

  @Column({ type: 'varchar', name: 'code_value', nullable: true })
  codeValue: string | null;

  @Column({ name: 'academic_period_id', nullable: true })
  academicPeriodId: string | null;

  @ManyToOne('AcademicPeriod', 'items', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'academic_period_id' })
  academicPeriod: any;

  @Column({ type: 'boolean', name: 'is_pending', default: false })
  isPending: boolean;

  @Column()
  name: string;

  @Column({ type: 'int', name: 'cantidad', default: 1 })
  cantidad: number;

  @Column({ type: 'jsonb', name: 'dynamic_values', default: {} })
  dynamicValues: Record<string, any>; // Estructura JSON: {"id_del_custom_field": "valor"}

  @Column({ type: 'varchar', default: 'ACTIVO' })
  status: string; // Valores válidos: 'ACTIVO', 'INACTIVO'

  @Column({ type: 'varchar', name: 'estado_fisico', default: 'BUENO' })
  estadoFisico: string; // Valores válidos: 'BUENO', 'REGULAR', 'MALO'


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
