import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InventoryView, InventoryViewCode } from './entities/inventory-view.entity';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { CustomField } from './entities/custom-field.entity';
import { CustomFieldConfig } from './entities/custom-field-config.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { AcademicPeriod } from '../periods/entities/academic-period.entity';

import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryView,
      Category,
      Subcategory,
      CustomField,
      CustomFieldConfig,
      InventoryItem,
      AcademicPeriod,
    ]),
  ],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService, TypeOrmModule],
})
export class InventoryModule implements OnModuleInit {
  constructor(
    @InjectRepository(InventoryView)
    private readonly viewRepo: Repository<InventoryView>,
  ) {}

  // Sembrador automático de las 3 Vistas de Inventario al iniciar el módulo
  async onModuleInit() {
    const defaultViews = [
      {
        name: 'Bienes Públicos',
        code: InventoryViewCode.BIENES_PUBLICOS,
      },
      {
        name: 'Insumos y Suministros',
        code: InventoryViewCode.INSUMOS,
      },
      {
        name: 'Biblioteca',
        code: InventoryViewCode.BIBLIOTECA,
      },
    ];

    for (const view of defaultViews) {
      const existe = await this.viewRepo.findOne({ where: { code: view.code } });
      if (!existe) {
        const nuevaVista = this.viewRepo.create(view);
        await this.viewRepo.save(nuevaVista);
        console.log(`[InventorySeeder] Vista creada: ${view.name} (${view.code})`);
      }
    }
  }
}
