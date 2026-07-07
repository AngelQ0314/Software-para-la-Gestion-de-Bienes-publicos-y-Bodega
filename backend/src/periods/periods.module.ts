import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicPeriod } from './entities/academic-period.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { PhysicalSpace } from '../spaces/entities/physical-space.entity';
import { InventoryItemShift } from '../spaces/entities/inventory-item-shift.entity';
import { User } from '../users/entities/user.entity';
import { PeriodsService } from './periods.service';
import { PeriodsSchedulerService } from './periods-scheduler.service';
import { PeriodsController } from './periods.controller';
import { MailModule } from '../mail/mail.module';
import { ConfigModule } from '@nestjs/config';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademicPeriod,
      InventoryItem,
      PhysicalSpace,
      InventoryItemShift,
      User,
    ]),
    MailModule,
    ConfigModule,
    ReportsModule,
  ],
  providers: [PeriodsService, PeriodsSchedulerService],
  controllers: [PeriodsController],
  exports: [PeriodsService],
})
export class PeriodsModule {}
