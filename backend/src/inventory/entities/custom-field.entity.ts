import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CustomFieldConfig } from './custom-field-config.entity';

export enum CustomFieldType {
  TEXT = 'TEXT',
  NUMBER_INT = 'NUMBER_INT',
  NUMBER_DECIMAL = 'NUMBER_DECIMAL',
  DATE = 'DATE',
  OPTIONS_LIST = 'OPTIONS_LIST',
}

@Entity('custom_fields')
export class CustomField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  label: string;

  @Column({
    type: 'enum',
    enum: CustomFieldType,
  })
  type: CustomFieldType;

  @Column({ type: 'jsonb', nullable: true })
  options: string[]; // Opciones válidas en formato JSON Array si es OPTIONS_LIST

  @OneToMany(() => CustomFieldConfig, (config) => config.customField)
  configs: CustomFieldConfig[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
