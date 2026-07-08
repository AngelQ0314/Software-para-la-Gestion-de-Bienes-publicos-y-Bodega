import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IncidentReport } from './incident-report.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

@Entity('incident_report_items')
export class IncidentReportItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'incident_report_id', type: 'uuid' })
  incidentReportId: string;

  @ManyToOne(() => IncidentReport, (report) => report.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incident_report_id' })
  incidentReport: IncidentReport;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
