import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Report } from './entities/report.entity';
import { ClosureReport } from './entities/closure-report.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { PhysicalSpace } from '../spaces/entities/physical-space.entity';
import { InventoryItemShift } from '../spaces/entities/inventory-item-shift.entity';
import { User } from '../users/entities/user.entity';
import { UserLog } from '../users/entities/user-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Report,
      ClosureReport,
      InventoryItem,
      PhysicalSpace,
      InventoryItemShift,
      User,
      UserLog,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
