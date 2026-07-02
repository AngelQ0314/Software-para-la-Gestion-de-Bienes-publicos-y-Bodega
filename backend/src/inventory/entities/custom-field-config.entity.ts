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
import { CodeType } from './code-type.entity';
import { CustomField } from './custom-field.entity';

@Entity('custom_fields_configs')
@Unique(['codeTypeId', 'customFieldId'])
export class CustomFieldConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'code_type_id' })
  codeTypeId: string;

  @ManyToOne(() => CodeType, (codeType) => codeType.configs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'code_type_id' })
  codeType: CodeType;

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
