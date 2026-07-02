import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CustomFieldConfig } from './custom-field-config.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity('code_types')
export class CodeType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  prefix: string;

  @OneToMany(() => CustomFieldConfig, (config) => config.codeType)
  configs: CustomFieldConfig[];

  @OneToMany(() => InventoryItem, (item) => item.codeType)
  items: InventoryItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
