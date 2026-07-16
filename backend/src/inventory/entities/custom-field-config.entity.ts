import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Subcategory } from './subcategory.entity';
import { CustomField } from './custom-field.entity';

@Entity('custom_fields_configs')
@Unique(['subcategoryId', 'customFieldId'])
export class CustomFieldConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subcategory_id' })
  subcategoryId: string;

  @ManyToOne(() => Subcategory, (sub) => sub.configs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory: Subcategory;

  @Column({ name: 'custom_field_id' })
  customFieldId: string;

  @ManyToOne(() => CustomField, (field) => field.configs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'custom_field_id' })
  customField: CustomField;

  @Column({ name: 'is_mandatory', default: false })
  isMandatory: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
