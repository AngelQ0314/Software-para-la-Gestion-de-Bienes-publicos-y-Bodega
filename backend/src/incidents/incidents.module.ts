import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { IncidentReport } from './entities/incident-report.entity';
import { IncidentReportItem } from './entities/incident-report-item.entity';
import { AcademicPeriod } from '../periods/entities/academic-period.entity';
import { PhysicalSpace } from '../spaces/entities/physical-space.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { User } from '../users/entities/user.entity';
import { InventoryItemShift } from '../spaces/entities/inventory-item-shift.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IncidentReport,
      IncidentReportItem,
      AcademicPeriod,
      PhysicalSpace,
      InventoryItem,
      User,
      InventoryItemShift,
    ]),
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
