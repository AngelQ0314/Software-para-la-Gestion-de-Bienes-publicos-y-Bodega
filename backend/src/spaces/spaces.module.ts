import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhysicalSpace } from './entities/physical-space.entity';
import { InventoryItemShift } from './entities/inventory-item-shift.entity';
import { SpacesService } from './spaces.service';
import { SpacesController } from './spaces.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { UserLog } from '../users/entities/user-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PhysicalSpace,
      InventoryItemShift,
      User,
      InventoryItem,
      UserLog,
    ]),
    InventoryModule,
    UsersModule,
  ],
  controllers: [SpacesController],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}
