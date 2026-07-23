import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request } from './entities/request.entity';
import { RequestItem } from './entities/request-item.entity';
import { HandoverAct } from './entities/handover-act.entity';
import { AcademicPeriod } from '../periods/entities/academic-period.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { PhysicalSpace } from '../spaces/entities/physical-space.entity';
import { InventoryItemShift } from '../spaces/entities/inventory-item-shift.entity';
import { User } from '../users/entities/user.entity';
import { IncidentReportItem } from '../incidents/entities/incident-report-item.entity';

import { RequestsService } from './requests.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { RequestsController } from './requests.controller';
import { MailModule } from '../mail/mail.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Request,
      RequestItem,
      HandoverAct,
      AcademicPeriod,
      InventoryItem,
      PhysicalSpace,
      InventoryItemShift,
      User,
      IncidentReportItem,
    ]),
    MailModule,
    ConfigModule,
  ],
  providers: [RequestsService, PdfGeneratorService],
  controllers: [RequestsController],
  exports: [RequestsService],
})
export class RequestsModule {}
