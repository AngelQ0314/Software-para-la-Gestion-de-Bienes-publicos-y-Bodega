import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, In, ILike } from 'typeorm';

import { InventoryView, InventoryViewCode } from './entities/inventory-view.entity';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { CustomField, CustomFieldType } from './entities/custom-field.entity';
import { CustomFieldConfig } from './entities/custom-field-config.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { AcademicPeriod } from '../periods/entities/academic-period.entity';
import { IncidentReportItem } from '../incidents/entities/incident-report-item.entity';
import * as ExcelJS from 'exceljs';


import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { AssociateFieldDto } from './dto/associate-field.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryView)
    private readonly viewRepo: Repository<InventoryView>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Subcategory)
    private readonly subcategoryRepo: Repository<Subcategory>,
    @InjectRepository(CustomField)
    private readonly customFieldRepo: Repository<CustomField>,
    @InjectRepository(CustomFieldConfig)
    private readonly fieldConfigRepo: Repository<CustomFieldConfig>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(AcademicPeriod)
    private readonly periodRepo: Repository<AcademicPeriod>,
    @InjectRepository(IncidentReportItem)
    private readonly reportItemRepo: Repository<IncidentReportItem>,
  ) {}

  // VISTAS DE INVENTARIO
  async findAllViews(): Promise<InventoryView[]> {
    return this.viewRepo.find({ order: { name: 'ASC' } });
  }

  async findViewByCode(code: string): Promise<InventoryView> {
    const view = await this.viewRepo.findOne({ where: { code: code as any } });
    if (!view) {
      throw new NotFoundException(`La vista de inventario con código '${code}' no existe.`);
    }
    return view;
  }

  // CATEGORÍAS
  async findAllCategories(inventoryViewId?: string): Promise<Category[]> {
    const query = this.categoryRepo
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.subcategories', 'subcategories')
      .leftJoinAndSelect('category.inventoryView', 'inventoryView')
      .orderBy('category.name', 'ASC');

    if (inventoryViewId) {
      query.where('category.inventoryViewId = :inventoryViewId', { inventoryViewId });
    }

    return query.getMany();
  }

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    let viewId = dto.inventoryViewId;

    if (!viewId && dto.inventoryViewCode) {
      const view = await this.viewRepo.findOne({
        where: { code: dto.inventoryViewCode.toUpperCase() as any },
      });
      if (!view) {
        throw new NotFoundException(`La vista con código '${dto.inventoryViewCode}' no existe.`);
      }
      viewId = view.id;
    }

    if (!viewId) {
      throw new BadRequestException('Debe proporcionar el inventoryViewId (UUID) o el inventoryViewCode (código de vista).');
    }

    // Validar que exista la vista
    const view = await this.viewRepo.findOne({ where: { id: viewId } });
    if (!view) {
      throw new NotFoundException('La vista de inventario seleccionada no existe.');
    }

    // Evitar nombres duplicados dentro de la misma vista
    const existe = await this.categoryRepo.findOne({
      where: { name: dto.name.toUpperCase(), inventoryViewId: viewId },
    });
    if (existe) {
      throw new ConflictException(`Ya existe una categoría llamada '${dto.name}' en esta vista.`);
    }

    const nueva = this.categoryRepo.create({
      name: dto.name.toUpperCase(),
      inventoryViewId: viewId,
    });

    return this.categoryRepo.save(nueva);
  }

  async updateCategory(id: string, name: string): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('La categoría no existe.');
    }

    const existe = await this.categoryRepo.findOne({
      where: { name: name.toUpperCase(), inventoryViewId: category.inventoryViewId },
    });
    if (existe && existe.id !== id) {
      throw new ConflictException(`Ya existe otra categoría llamada '${name}' en esta vista.`);
    }

    category.name = name.toUpperCase();
    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string): Promise<{ desasociados: number }> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('La categoría no existe.');
    }

    // Contar cuántos ítems se verán afectados (asociados a subcategorías de esta categoría)
    const count = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.subcategory', 'sub')
      .where('sub.categoryId = :categoryId', { categoryId: id })
      .getCount();

    if (count > 0) {
      throw new BadRequestException(
        `No se puede eliminar la categoría porque tiene ${count} artículo(s) asociado(s).`,
      );
    }

    // Buscar todas las subcategorías pertenecientes a esta categoría
    const subcategories = await this.subcategoryRepo.find({
      where: { categoryId: id },
    });
    const subcategoryIds = subcategories.map((s) => s.id);

    // Obtener los customFieldId asociados a estas subcategorías antes de eliminar
    let fieldIds: string[] = [];
    if (subcategoryIds.length > 0) {
      const configs = await this.fieldConfigRepo.find({
        where: { subcategoryId: In(subcategoryIds) },
      });
      fieldIds = [...new Set(configs.map((c) => c.customFieldId))];
    }

    // El borrado en cascada (elimina categoría, sus subcategorías y sus configuraciones)
    await this.categoryRepo.remove(category);

    // Limpiar los atributos dinámicos globales que quedaron huérfanos
    for (const fieldId of fieldIds) {
      const remainingCount = await this.fieldConfigRepo.count({
        where: { customFieldId: fieldId },
      });
      if (remainingCount === 0) {
        const field = await this.customFieldRepo.findOne({ where: { id: fieldId } });
        if (field) {
          await this.customFieldRepo.remove(field);
        }
      }
    }

    return { desasociados: 0 };
  }

  // SUBCATEGORÍAS
  async createSubcategory(dto: CreateSubcategoryDto): Promise<Subcategory> {
    let catId = dto.categoryId;

    if (!catId && dto.categoryName) {
      const category = await this.categoryRepo.findOne({
        where: { name: dto.categoryName.toUpperCase() },
      });
      if (!category) {
        throw new NotFoundException(`La categoría con nombre '${dto.categoryName}' no existe.`);
      }
      catId = category.id;
    }

    if (!catId) {
      throw new BadRequestException('Debe proporcionar el categoryId (UUID) o el categoryName (nombre de categoría).');
    }

    const category = await this.categoryRepo.findOne({ where: { id: catId } });
    if (!category) {
      throw new NotFoundException('La categoría seleccionada no existe.');
    }

    const existe = await this.subcategoryRepo.findOne({
      where: { name: dto.name.toUpperCase(), categoryId: catId },
    });
    if (existe) {
      throw new ConflictException(`Ya existe una subcategoría llamada '${dto.name}' dentro de esta categoría.`);
    }

    const nueva = this.subcategoryRepo.create({
      name: dto.name.toUpperCase(),
      categoryId: catId,
    });

    return this.subcategoryRepo.save(nueva);
  }

  async findAllSubcategories(categoryId?: string): Promise<Subcategory[]> {
    const query = this.subcategoryRepo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.category', 'category')
      .leftJoinAndSelect('category.inventoryView', 'inventoryView')
      .orderBy('sub.name', 'ASC');

    if (categoryId) {
      query.where('sub.categoryId = :categoryId', { categoryId });
    }

    return query.getMany();
  }

  async updateSubcategory(
    id: string,
    dto: { name?: string; categoryId?: string; categoryName?: string },
  ): Promise<Subcategory> {
    const sub = await this.subcategoryRepo.findOne({ where: { id }, relations: { category: true } });
    if (!sub) {
      throw new NotFoundException('La subcategoría no existe.');
    }

    let targetCatId = dto.categoryId || sub.categoryId;

    if (!dto.categoryId && dto.categoryName) {
      const category = await this.categoryRepo.findOne({
        where: { name: dto.categoryName.toUpperCase() },
      });
      if (!category) {
        throw new NotFoundException(`La categoría con nombre '${dto.categoryName}' no existe.`);
      }
      targetCatId = category.id;
    }

    if (dto.name) {
      const normalizedName = dto.name.toUpperCase();
      const existe = await this.subcategoryRepo.findOne({
        where: { name: normalizedName, categoryId: targetCatId },
      });
      if (existe && existe.id !== id) {
        throw new ConflictException(`Ya existe una subcategoría llamada '${dto.name}' dentro de esta categoría.`);
      }
      sub.name = normalizedName;
    }

    sub.categoryId = targetCatId;
    return this.subcategoryRepo.save(sub);
  }

  async deleteSubcategory(id: string): Promise<{ desasociados: number }> {
    const sub = await this.subcategoryRepo.findOne({ where: { id } });
    if (!sub) {
      throw new NotFoundException('La subcategoría no existe.');
    }

    // Contar cuántos ítems están asociados directamente a esta subcategoría
    const count = await this.itemRepo.count({ where: { subcategoryId: id } });

    if (count > 0) {
      throw new BadRequestException(
        `No se puede eliminar la subcategoría porque tiene ${count} artículo(s) asociado(s).`,
      );
    }

    // Obtener los customFieldId asociados a esta subcategoría antes de eliminar
    const configs = await this.fieldConfigRepo.find({
      where: { subcategoryId: id },
    });
    const fieldIds = configs.map((c) => c.customFieldId);

    // Eliminar la subcategoría (esto hace cascade delete en custom_fields_configs)
    await this.subcategoryRepo.remove(sub);

    // Limpiar los atributos dinámicos globales que quedaron huérfanos
    for (const fieldId of fieldIds) {
      const remainingCount = await this.fieldConfigRepo.count({
        where: { customFieldId: fieldId },
      });
      if (remainingCount === 0) {
        const field = await this.customFieldRepo.findOne({ where: { id: fieldId } });
        if (field) {
          await this.customFieldRepo.remove(field);
        }
      }
    }

    return { desasociados: 0 };
  }

  // CAMPOS PERSONALIZADOS
  async findAllCustomFields(): Promise<CustomField[]> {
    return this.customFieldRepo.find({ order: { name: 'ASC' } });
  }

  async createCustomField(dto: CreateCustomFieldDto): Promise<CustomField> {
    const normalizedName = dto.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    if (dto.type === CustomFieldType.OPTIONS_LIST && (!dto.options || dto.options.length === 0)) {
      throw new BadRequestException('Los campos tipo OPTIONS_LIST requieren ingresar opciones.');
    }

    const nuevo = this.customFieldRepo.create({
      name: normalizedName,
      label: dto.label,
      type: dto.type,
      options: (dto.type === CustomFieldType.OPTIONS_LIST ? dto.options : null) as any,
    });

    return this.customFieldRepo.save(nuevo);
  }

  async updateCustomField(id: string, dto: UpdateCustomFieldDto): Promise<CustomField> {
    const field = await this.customFieldRepo.findOne({ where: { id } });
    if (!field) {
      throw new NotFoundException('El campo personalizado no existe.');
    }

    if (dto.name) {
      const normalizedName = dto.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

      field.name = normalizedName;
    }

    if (dto.label !== undefined) {
      field.label = dto.label;
    }

    if (dto.type !== undefined) {
      field.type = dto.type;
    }

    if (dto.options !== undefined) {
      field.options = (field.type === CustomFieldType.OPTIONS_LIST ? dto.options : null) as any;
    }

    return this.customFieldRepo.save(field);
  }

  async deleteCustomField(id: string): Promise<void> {
    const field = await this.customFieldRepo.findOne({ where: { id } });
    if (!field) {
      throw new NotFoundException('El campo personalizado no existe.');
    }

    await this.itemRepo.createQueryBuilder()
      .update(InventoryItem)
      .set({
        dynamicValues: () => `dynamic_values - '${id}'`
      })
      .execute();

    await this.customFieldRepo.remove(field);
  }

  // ASOCIACIÓN DE CAMPOS A SUBCATEGORÍAS (CONFIGURACIÓN)
  async associateFieldToSubcategory(subId: string, dto: AssociateFieldDto): Promise<CustomFieldConfig> {
    const subcategory = await this.subcategoryRepo.findOne({ where: { id: subId } });
    if (!subcategory) {
      throw new NotFoundException('La subcategoría no existe.');
    }

    let fieldId = dto.customFieldId;

    if (!fieldId && dto.customFieldName) {
      const normalizedName = dto.customFieldName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

      const customField = await this.customFieldRepo.findOne({
        where: { name: normalizedName },
      });
      if (!customField) {
        throw new NotFoundException(`El campo personalizado con nombre técnico '${dto.customFieldName}' no existe.`);
      }
      fieldId = customField.id;
    }

    if (!fieldId) {
      throw new BadRequestException('Debe proporcionar el customFieldId (UUID) o el customFieldName (nombre técnico).');
    }

    const field = await this.customFieldRepo.findOne({ where: { id: fieldId } });
    if (!field) {
      throw new NotFoundException('El campo personalizado no existe.');
    }

    // Validar que la subcategoría no tenga ya asociado un campo con el mismo nombre técnico
    const existingConfigs = await this.fieldConfigRepo.find({
      where: { subcategoryId: subId },
      relations: { customField: true },
    });

    const isDuplicateName = existingConfigs.some(
      (c) => c.customFieldId !== fieldId && c.customField.name === field.name
    );

    if (isDuplicateName) {
      throw new ConflictException(
        `La subcategoría ya cuenta con un atributo configurado con el nombre '${field.label}'.`
      );
    }

    // Verificar si ya está asociado
    let config = await this.fieldConfigRepo.findOne({
      where: { subcategoryId: subId, customFieldId: fieldId },
    });

    if (config) {
      // Si ya existe, actualizamos su configuración
      config.isMandatory = dto.isMandatory ?? config.isMandatory;
      config.sortOrder = dto.sortOrder ?? config.sortOrder;
    } else {
      // Crear nueva asociación
      config = this.fieldConfigRepo.create({
        subcategoryId: subId,
        customFieldId: fieldId,
        isMandatory: dto.isMandatory ?? false,
        sortOrder: dto.sortOrder ?? 0,
      });
    }

    return this.fieldConfigRepo.save(config);
  }

  async findFieldsBySubcategory(subId: string): Promise<any[]> {
    const configs = await this.fieldConfigRepo.find({
      where: { subcategoryId: subId },
      relations: { customField: true },
      order: { sortOrder: 'ASC' },
    });

    return configs.map((c) => ({
      id: c.id,
      customFieldId: c.customField.id,
      customField: {
        id: c.customField.id,
        name: c.customField.name,
        label: c.customField.label,
        type: c.customField.type,
        options: c.customField.options,
      },
      isMandatory: c.isMandatory,
      sortOrder: c.sortOrder,
    }));
  }

  async removeFieldFromSubcategory(subId: string, customFieldId: string): Promise<void> {
    const config = await this.fieldConfigRepo.findOne({
      where: { subcategoryId: subId, customFieldId },
    });
    if (!config) {
      throw new NotFoundException('La asociación especificada no existe.');
    }
    await this.fieldConfigRepo.remove(config);

    // Limpiar la propiedad en el JSONB de los artículos de esta subcategoría
    await this.itemRepo.createQueryBuilder()
      .update(InventoryItem)
      .set({
        dynamicValues: () => `dynamic_values - '${customFieldId}'`
      })
      .where('subcategory_id = :subId', { subId })
      .execute();

    // Contar las asociaciones restantes de este campo dinámico global
    const remainingCount = await this.fieldConfigRepo.count({
      where: { customFieldId }
    });

    // Si ya no está asociado a ninguna subcategoría, se borra físicamente
    if (remainingCount === 0) {
      const field = await this.customFieldRepo.findOne({ where: { id: customFieldId } });
      if (field) {
        await this.customFieldRepo.remove(field);
      }
    }
  }

  // ELEMENTOS DEL INVENTARIO
  async createInventoryItem(dto: CreateInventoryItemDto): Promise<InventoryItem> {
    let subId = dto.subcategoryId;
    if (!subId && dto.subcategoryName) {
      const sub = await this.subcategoryRepo.findOne({
        where: { name: dto.subcategoryName.toUpperCase() },
        relations: { category: { inventoryView: true } },
      });
      if (!sub) {
        throw new NotFoundException(`La subcategoría con nombre '${dto.subcategoryName}' no existe.`);
      }
      subId = sub.id;
    }

    if (!subId) {
      throw new BadRequestException('Debe proporcionar el subcategoryId (UUID) o el subcategoryName.');
    }

    const subcategory = await this.subcategoryRepo.findOne({
      where: { id: subId },
      relations: { category: { inventoryView: true } },
    });
    if (!subcategory) {
      throw new NotFoundException('La subcategoría seleccionada no existe.');
    }

    let formattedCodeValue: string | null = null;
    if (dto.codeValue && dto.codeValue.trim() !== '') {
      formattedCodeValue = dto.codeValue.trim().toUpperCase();
      const existeCodigo = await this.itemRepo.findOne({
        where: { codeValue: ILike(formattedCodeValue), physicalSpaceId: IsNull() },
        withDeleted: true,
      });

      if (existeCodigo) {
        if (existeCodigo.status === 'INACTIVO' || existeCodigo.deletedAt !== null) {
          throw new ConflictException(
            `El código '${dto.codeValue}' ya pertenece a un item inactivo. Si desea utilizarlo, edite el estado del item existente a ACTIVO.`
          );
        } else {
          throw new ConflictException(`El código '${dto.codeValue}' ya está registrado.`);
        }
      }
    } else {
      // Validar duplicidad de Nombre + Subcategoría para artículos sin Código Yavirac
      const existeNombre = await this.itemRepo.findOne({
        where: {
          name: ILike(dto.name.trim()),
          subcategoryId: subId,
          status: 'ACTIVO',
        },
      });
      if (existeNombre) {
        throw new ConflictException(
          `El artículo con nombre '${dto.name}' ya está registrado en esta subcategoría.`
        );
      }
    }

    const validatedValues = await this.validateAndFormatDynamicValues(subId, dto.dynamicValues || {});

    // Validar cantidad según la vista
    const viewCode = subcategory.category.inventoryView?.code;
    let cantidadToSave = 1;
    if (viewCode === InventoryViewCode.INSUMOS) {
      if (dto.cantidad === undefined || dto.cantidad === null) {
        throw new BadRequestException('La cantidad es obligatoria para la vista de Insumos y Suministros.');
      }
      if (dto.cantidad < 0) {
        throw new BadRequestException('La cantidad no puede ser menor a 0.');
      }
      cantidadToSave = dto.cantidad;
    } else {
      if (dto.cantidad !== undefined && dto.cantidad !== null) {
        cantidadToSave = dto.cantidad;
      }
    }

    const activePeriod = await this.periodRepo.findOne({ where: { status: 'ACTIVO' } });

    const nuevoItem = {
      name: dto.name,
      codeValue: formattedCodeValue,
      subcategoryId: subId,
      inventoryViewId: subcategory.category.inventoryViewId,
      cantidad: cantidadToSave,
      dynamicValues: validatedValues,
      status: dto.status ? dto.status.toUpperCase().trim() : 'ACTIVO',
      estadoFisico: dto.estadoFisico ? dto.estadoFisico.toUpperCase().trim() : 'BUENO',
      academicPeriodId: activePeriod ? activePeriod.id : null,
      isPending: dto.isPending !== undefined ? !!dto.isPending : !activePeriod,
    };

    return this.itemRepo.save(nuevoItem);
  }

  async updateInventoryItem(id: string, dto: UpdateInventoryItemDto): Promise<InventoryItem> {
    const activePeriod = await this.periodRepo.findOne({ where: { status: 'ACTIVO' } });
    if (!activePeriod) {
      throw new BadRequestException('No se pueden realizar operaciones de inventario porque no hay un período académico activo.');
    }

    const item = await this.itemRepo.findOne({ 
      where: { id },
      relations: { inventoryView: true },
      withDeleted: true, // Permite cargar ítems inactivos para poder editarlos y reactivarlos
    });
    if (!item) {
      throw new NotFoundException('El elemento de inventario no existe.');
    }

    let targetSubId = dto.subcategoryId;
    if (!targetSubId && dto.subcategoryName) {
      const sub = await this.subcategoryRepo.findOne({
        where: { name: dto.subcategoryName.toUpperCase() },
        relations: { category: { inventoryView: true } },
      });
      if (!sub) {
        throw new NotFoundException(`La subcategoría con nombre '${dto.subcategoryName}' no existe.`);
      }
      targetSubId = sub.id;
    }

    if (targetSubId) {
      const subcategory = await this.subcategoryRepo.findOne({
        where: { id: targetSubId },
        relations: { category: { inventoryView: true } },
      });
      if (!subcategory) {
        throw new NotFoundException('La subcategoría seleccionada no existe.');
      }
      item.subcategoryId = targetSubId;
      item.inventoryViewId = subcategory.category.inventoryViewId;
      item.inventoryView = subcategory.category.inventoryView;
    }

    if (dto.codeValue !== undefined) {
      if (dto.codeValue && dto.codeValue.trim() !== '') {
        const formattedCode = dto.codeValue.trim().toUpperCase();
        const existeCodigo = await this.itemRepo.findOne({
          where: { codeValue: ILike(formattedCode), physicalSpaceId: IsNull() },
          withDeleted: true,
        });
        if (existeCodigo && existeCodigo.id !== id) {
          if (existeCodigo.status === 'INACTIVO' || existeCodigo.deletedAt !== null) {
            throw new ConflictException(
              `El código '${dto.codeValue}' ya pertenece a un item inactivo. Si desea utilizarlo, edite el estado del item existente a ACTIVO.`
            );
          } else {
            throw new ConflictException(`El código '${dto.codeValue}' ya está registrado.`);
          }
        }
        item.codeValue = formattedCode;
      } else {
        item.codeValue = null; 
      }
    }

    if (dto.name) item.name = dto.name;

    // Validar y actualizar cantidad
    const finalViewCode = item.inventoryView?.code;
    if (dto.cantidad !== undefined) {
      if (dto.cantidad === null) {
        if (finalViewCode === InventoryViewCode.INSUMOS) {
          throw new BadRequestException('La cantidad es obligatoria para la vista de Insumos y Suministros.');
        }
        item.cantidad = 1;
      } else {
        if (finalViewCode === InventoryViewCode.INSUMOS && dto.cantidad < 0) {
          throw new BadRequestException('La cantidad no puede ser menor a 0.');
        }
        item.cantidad = dto.cantidad;
      }
    }

    if (dto.status !== undefined) {
      if (dto.status !== 'ACTIVO' && dto.status !== 'INACTIVO') {
        throw new BadRequestException('El estado debe ser ACTIVO o INACTIVO.');
      }
      
      if (dto.status === 'ACTIVO' && item.status === 'INACTIVO') {
        // Validar si el código ya está siendo usado por otro item activo
        if (item.codeValue) {
          const duplicadoActivo = await this.itemRepo.findOne({
            where: { codeValue: ILike(item.codeValue), physicalSpaceId: IsNull() },
          });
          if (duplicadoActivo && duplicadoActivo.id !== id) {
            throw new ConflictException(
              `No se puede activar este item porque el código '${item.codeValue}' ya está siendo usado por otro item activo.`
            );
          }
        }

        // Si se reactiva, validar que tenga subcategoría y campos dinámicos obligatorios
        const subId = dto.subcategoryId || item.subcategoryId;
        if (!subId) {
          throw new BadRequestException('Para reactivar este artículo debe asociarlo a una subcategoría.');
        }

        const valuesToValidate = {
          ...(item.dynamicValues || {}),
          ...(dto.dynamicValues || {}),
        };
        item.dynamicValues = await this.validateAndFormatDynamicValues(subId, valuesToValidate);

        item.deletedAt = null;
      } else if (dto.status === 'INACTIVO') {
        if (!item.deletedAt) {
          item.deletedAt = new Date();
        }
      }
      item.status = dto.status;
    }

    if (dto.estadoFisico !== undefined) {
      const raw = dto.estadoFisico.toUpperCase().trim();
      if (raw !== 'BUENO' && raw !== 'REGULAR' && raw !== 'MALO' && raw !== 'EN_MANTENIMIENTO') {
        throw new BadRequestException('El estado físico debe ser BUENO, REGULAR, MALO o EN_MANTENIMIENTO.');
      }
      item.estadoFisico = raw;
    }

    if (dto.isPending !== undefined) {
      item.isPending = !!dto.isPending;
    }

    if (dto.dynamicValues && !(dto.status === 'ACTIVO' && item.status === 'INACTIVO')) {
      const subId = dto.subcategoryId || item.subcategoryId;
      if (!subId) {
        throw new BadRequestException('No se pueden asignar campos dinámicos a un artículo sin subcategoría.');
      }

      const configs = await this.fieldConfigRepo.find({
        where: { subcategoryId: subId },
        relations: { customField: true },
      });

      const normalizedDtoValues: Record<string, any> = {};
      for (const key of Object.keys(dto.dynamicValues)) {
        const config = configs.find(
          (c) => c.customField.id === key || c.customField.name === key,
        );
        if (config) {
          normalizedDtoValues[config.customField.id] = dto.dynamicValues[key];
        } else {
          normalizedDtoValues[key] = dto.dynamicValues[key];
        }
      }

      const mergedDynamicValues = {
        ...(item.dynamicValues || {}),
        ...normalizedDtoValues,
      };
      item.dynamicValues = await this.validateAndFormatDynamicValues(subId, mergedDynamicValues);
    }

    return this.itemRepo.save(item);
  }

  async findInventoryItemById(id: string, userId?: string, userRol?: string): Promise<any> {
    const item = await this.itemRepo.findOne({
      where: { id },
      withDeleted: true, // Permite ver detalles de ítems inactivos
      relations: {
        inventoryView: true,
        subcategory: {
          category: true,
          configs: {
            customField: true,
          },
        },
        physicalSpace: {
          responsibleTeachers: true,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('El elemento de inventario no existe.');
    }

    if (userRol === 'DOCENTE' && item.physicalSpaceId !== null) {
      const isAssigned = item.physicalSpace?.responsibleTeachers?.some((t) => t.id === userId);
      if (!isAssigned) {
        throw new ForbiddenException('No tienes permiso para ver los detalles de este artículo porque pertenece a un espacio físico fuera de tu responsabilidad.');
      }
    }

    // Resolver los nombres legibles de las propiedades dinámicas
    const resolvedValues = item.subcategoryId
      ? await this.resolveDynamicValuesLabels(item.subcategoryId, item.dynamicValues || {})
      : [];

    let distribucionEspacios: any[] = [];
    const isInsumo = item.inventoryView?.code === 'INSUMOS';

    if (isInsumo) {
      const distributions = await this.itemRepo.find({
        where: {
          name: item.name,
          subcategoryId: item.subcategoryId === null ? IsNull() : item.subcategoryId,
          codeValue: item.codeValue === null ? IsNull() : item.codeValue,
          physicalSpaceId: Not(IsNull()),
          status: 'ACTIVO',
        },
        relations: {
          physicalSpace: {
            responsibleTeachers: true,
          },
        },
      });

      distribucionEspacios = await Promise.all(
        distributions.map(async (d) => {
          const responsables = d.physicalSpace?.responsibleTeachers
            ? d.physicalSpace.responsibleTeachers.map((u) => `${u.nombres} ${u.apellidos || ''}`.trim()).join(', ')
            : '';

          // Consultar reporte de novedades activo para esta asignación de insumo
          const activeIncidents = await this.reportItemRepo
            .createQueryBuilder('reportItem')
            .innerJoin('reportItem.incidentReport', 'report')
            .where('reportItem.itemId = :itemId', { itemId: d.id })
            .andWhere('report.status IN (:...statuses)', { statuses: ['PENDIENTE', 'REVISADO'] })

            .select('SUM(reportItem.cantidadAfectada)', 'totalNovedad')
            .getRawOne();

          const cantidadNovedad = Number(activeIncidents?.totalNovedad || 0);
          const cantidadBuenEstado = Math.max(0, Number(d.cantidad || 0) - cantidadNovedad);

          return {
            id: d.id,
            cantidad: d.cantidad,
            cantidadBuenEstado,
            cantidadNovedad,
            spaceId: d.physicalSpaceId,
            roomNumber: d.physicalSpace?.roomNumber || '',
            name: d.physicalSpace?.name || '',
            responsables: responsables || 'Sin responsable',
          };
        }),
      );
    }

    const disponible = item.physicalSpaceId === null ? (isInsumo ? item.cantidad > 0 : true) : false;

    let mensajeDisponibilidad = 'Disponible';
    if (item.physicalSpaceId !== null) {
      mensajeDisponibilidad = `Asignado al espacio '${item.physicalSpace?.name || ''}' (Número ${item.physicalSpace?.roomNumber || ''})`;
    } else if (isInsumo) {
      const totalAsignado = distribucionEspacios.reduce((sum, d) => sum + d.cantidad, 0);
      mensajeDisponibilidad = `En Bodega: ${item.cantidad} unidades.` +
        (totalAsignado > 0
          ? ` Distribuido en: ${distribucionEspacios.map((d) => `${d.roomNumber} (${d.cantidad} ud)`).join(', ')}.`
          : ' Sin asignaciones.');
    }

    return {
      ...item,
      disponible,
      mensajeDisponibilidad,
      distribucionEspacios,
      resolvedValues,
    };
  }

  async findItems(filters: {
    inventoryViewId?: string;
    inventoryViewCode?: string;
    categoryId?: string;
    subcategoryId?: string;
    status?: string; // ACTIVO / INACTIVO
    search?: string;
    page?: number;
    limit?: number;
    onlyOrphans?: boolean;
    showOrphansAndDeleted?: boolean;
    onlyInWarehouse?: boolean;
  }): Promise<{ data: InventoryItem[]; total: number; page: number; lastPage: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const query = this.itemRepo
      .createQueryBuilder('item')
      .withDeleted() // Permite incluir ítems inactivos (soft-deleted) en la consulta
      .leftJoinAndSelect('item.inventoryView', 'inventoryView')
      .leftJoinAndSelect('item.subcategory', 'subcategory')
      .leftJoinAndSelect('subcategory.category', 'category')
      .leftJoinAndSelect('subcategory.configs', 'configs')
      .leftJoinAndSelect('configs.customField', 'customField')
      .leftJoinAndSelect('item.physicalSpace', 'physicalSpace')
      .leftJoinAndSelect('physicalSpace.responsibleTeachers', 'responsibleTeachers')
      .orderBy('item.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    // Para insumos, en el listado general solo mostrar el lote principal de bodega
    query.andWhere("(inventoryView.code != 'INSUMOS' OR item.physicalSpaceId IS NULL)");

    if (filters.onlyInWarehouse) {
      query.andWhere('item.physicalSpaceId IS NULL');
    }

    if (filters.inventoryViewId) {
      query.andWhere('item.inventoryViewId = :inventoryViewId', { inventoryViewId: filters.inventoryViewId });
    } else if (filters.inventoryViewCode) {
      query.andWhere('inventoryView.code = :inventoryViewCode', { inventoryViewCode: filters.inventoryViewCode });
    }

    if (filters.showOrphansAndDeleted) {
      query.andWhere('(item.subcategoryId IS NULL OR item.status = :inactivoStatus)', { inactivoStatus: 'INACTIVO' });
    } else if (filters.onlyOrphans) {
      query.andWhere('item.subcategoryId IS NULL');
    } else {
      if (filters.subcategoryId) {
        query.andWhere('item.subcategoryId = :subcategoryId', { subcategoryId: filters.subcategoryId });
      } else if (filters.categoryId) {
        query.andWhere('subcategory.categoryId = :categoryId', { categoryId: filters.categoryId });
      }
    }

    if (filters.showOrphansAndDeleted) {
      // Permite activos e inactivos al unificar huérfanos y eliminados
    } else if (filters.status) {
      query.andWhere('item.status = :status', { status: filters.status });
    } else {
      // Por defecto, listar solo los activos si no se especifica estado
      query.andWhere('item.status = :status', { status: 'ACTIVO' });
    }

    if (filters.search) {
      query.andWhere(
        '(item.name ILIKE :search OR item.codeValue ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    const [data, total] = await query.getManyAndCount();

    const mappedData: any[] = [];
    for (const item of data) {
      const isInsumo = item.inventoryView?.code === 'INSUMOS';
      let distribucionEspacios: any[] = [];

      if (isInsumo) {
        const distributions = await this.itemRepo.find({
          where: {
            name: item.name,
            subcategoryId: item.subcategoryId === null ? IsNull() : item.subcategoryId,
            codeValue: item.codeValue === null ? IsNull() : item.codeValue,
            physicalSpaceId: Not(IsNull()),
            status: 'ACTIVO',
          },
          relations: {
            physicalSpace: {
              responsibleTeachers: true,
            },
          },
        });

        distribucionEspacios = distributions.map((d) => {
          const responsables = d.physicalSpace?.responsibleTeachers
            ? d.physicalSpace.responsibleTeachers.map((u) => `${u.nombres} ${u.apellidos || ''}`.trim()).join(', ')
            : '';
          return {
            id: d.id,
            cantidad: d.cantidad,
            spaceId: d.physicalSpaceId,
            roomNumber: d.physicalSpace?.roomNumber || '',
            name: d.physicalSpace?.name || '',
            responsables: responsables || 'Sin responsable',
          };
        });
      }

      const disponible = item.physicalSpaceId === null ? (isInsumo ? item.cantidad > 0 : true) : false;

      let mensajeDisponibilidad = 'Disponible';
      if (item.physicalSpaceId !== null) {
        const responsables = item.physicalSpace?.responsibleTeachers
          ? item.physicalSpace.responsibleTeachers.map((u) => `${u.nombres} ${u.apellidos || ''}`.trim()).join(', ')
          : '';
        mensajeDisponibilidad = `Asignado al espacio '${item.physicalSpace?.name || ''}' (Número ${item.physicalSpace?.roomNumber || ''}).` +
          (responsables ? ` Responsable(s): ${responsables}.` : ' Sin responsable.');
      } else if (isInsumo) {
        const totalAsignado = distribucionEspacios.reduce((sum, d) => sum + d.cantidad, 0);
        mensajeDisponibilidad = `En Bodega: ${item.cantidad} unidades.` +
          (totalAsignado > 0
            ? ` Distribuido en: ${distribucionEspacios.map((d) => `${d.roomNumber} (${d.cantidad} ud)`).join(', ')}.`
            : ' Sin asignaciones.');
      }

      const resolvedValues = item.subcategoryId
        ? await this.resolveDynamicValuesLabels(item.subcategoryId, item.dynamicValues || {})
        : [];

      mappedData.push({
        ...item,
        disponible,
        mensajeDisponibilidad,
        distribucionEspacios,
        resolvedValues,
      });
    }

    return {
      data: mappedData as any[],
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async deleteInventoryItem(id: string): Promise<void> {
    const activePeriod = await this.periodRepo.findOne({ where: { status: 'ACTIVO' } });
    if (!activePeriod) {
      throw new BadRequestException('No se pueden realizar operaciones de inventario porque no hay un período académico activo.');
    }

    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('El elemento no existe.');
    }

    // Desvincular de espacio físico si es insumo distribuido o artículo principal
    const isBienesOBiblioteca = item.inventoryViewId !== null; // O validar mediante consulta
    
    // Si es insumo, desactivar y desvincular todos sus registros distribuidos asociados
    if (item.subcategoryId) {
      await this.itemRepo.update(
        {
          name: item.name,
          subcategoryId: item.subcategoryId,
          physicalSpaceId: Not(IsNull()),
        },
        {
          status: 'INACTIVO',
          physicalSpaceId: null,
        }
      );
    }

    // Cambiar estado a INACTIVO, limpiar valores dinámicos, quitar subcategoría y desvincular del espacio físico
    item.status = 'INACTIVO';
    item.dynamicValues = {};
    item.subcategoryId = null;
    item.physicalSpaceId = null;
    await this.itemRepo.save(item);

    // Aplicar borrado lógico
    await this.itemRepo.softRemove(item);
  }

  // MÉTODOS DE AYUDA
  private async validateAndFormatDynamicValues(
    subId: string,
    valuesInput: Record<string, any>,
  ): Promise<Record<string, any>> {
    const configs = await this.fieldConfigRepo.find({
      where: { subcategoryId: subId },
      relations: { customField: true },
    });

    const validated: Record<string, any> = {};

    for (const config of configs) {
      const field = config.customField;
      const rawValue = valuesInput[field.id] !== undefined ? valuesInput[field.id] : valuesInput[field.name];

      // Validar obligatoriedad
      const isEmpty = rawValue === undefined || rawValue === null || String(rawValue).trim() === '';
      if (config.isMandatory && isEmpty) {
        throw new BadRequestException(`El campo dinámico '${field.label}' es obligatorio.`);
      }

      if (isEmpty) {
        validated[field.id] = null; // Guardar nulo explícitamente en el JSONB
        continue;
      }

      // Validar según tipo de datos
      switch (field.type) {
        case CustomFieldType.TEXT:
          validated[field.id] = String(rawValue).trim();
          break;

        case CustomFieldType.NUMBER_INT:
          const parsedInt = parseInt(rawValue, 10);
          if (isNaN(parsedInt)) {
            throw new BadRequestException(`El valor del campo '${field.label}' debe ser un número entero válido.`);
          }
          validated[field.id] = parsedInt;
          break;

        case CustomFieldType.NUMBER_DECIMAL:
          const parsedFloat = parseFloat(rawValue);
          if (isNaN(parsedFloat)) {
            throw new BadRequestException(`El valor del campo '${field.label}' debe ser un número decimal válido.`);
          }
          validated[field.id] = parsedFloat;
          break;

        case CustomFieldType.DATE:
          const dateObj = new Date(rawValue);
          if (isNaN(dateObj.getTime())) {
            throw new BadRequestException(
              `El valor del campo '${field.label}' debe ser una fecha válida (YYYY-MM-DD).`,
            );
          }
          validated[field.id] = dateObj.toISOString().split('T')[0];
          break;

        case CustomFieldType.OPTIONS_LIST:
          const valString = String(rawValue).trim();
          if (!field.options || !field.options.includes(valString)) {
            throw new BadRequestException(
              `El valor '${valString}' no es válido para el campo '${field.label}'. Opciones permitidas: ${field.options?.join(', ')}`,
            );
          }
          validated[field.id] = valString;
          break;

        default:
          validated[field.id] = rawValue;
      }
    }

    return validated;
  }

  private async resolveDynamicValuesLabels(
    subId: string,
    dynamicValues: Record<string, any>,
  ): Promise<any[]> {
    const configs = await this.fieldConfigRepo.find({
      where: { subcategoryId: subId },
      relations: { customField: true },
      order: { sortOrder: 'ASC' },
    });

    return configs.map((config) => {
      const field = config.customField;
      const rawValue = dynamicValues[field.id];
      return {
        fieldId: field.id,
        fieldName: field.name,
        label: field.label,
        type: field.type,
        value: rawValue !== undefined ? rawValue : null,
      };
    });
  }

  async importItemsFromExcel(fileBuffer: any, defaultInventoryViewId?: string): Promise<any> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    if (workbook.worksheets.length === 0) {
      throw new BadRequestException('El archivo de Excel no contiene hojas.');
    }

    const activePeriod = await this.periodRepo.findOne({ where: { status: 'ACTIVO' } });
    
    // Pre-cargar vistas, categorías y subcategorías para optimizar velocidad
    const allViews = await this.findAllViews();
    const allCategories = await this.categoryRepo.find();
    const allSubcategories = await this.subcategoryRepo.find({ relations: { category: true } });
    
    // Obtener todas las configuraciones de campos personalizados asociadas a las subcategorías
    const allConfigs = await this.fieldConfigRepo.find({
      relations: { customField: true, subcategory: true },
    });

    const itemsToSave: any[] = [];
    const errors: string[] = [];
    let sheetsProcessed = 0;
    const importedBreakdown: Record<string, number> = {};

    for (const worksheet of workbook.worksheets) {
      // Ignorar hojas ocultas o vacías
      if (!worksheet || worksheet.rowCount <= 1) {
        continue;
      }

      // Determinar la vista de inventario correspondiente a esta hoja
      const sheetNameUpper = worksheet.name.toUpperCase().trim();
      let currentViewId = defaultInventoryViewId;

      if (sheetNameUpper.includes('BIEN')) {
        currentViewId = allViews.find((v) => v.code === 'BIENES_PUBLICOS')?.id;
      } else if (sheetNameUpper.includes('BOD') || sheetNameUpper.includes('INSUM')) {
        currentViewId = allViews.find((v) => v.code === 'INSUMOS')?.id;
      } else if (sheetNameUpper.includes('BIBL') || sheetNameUpper.includes('LIBR')) {
        currentViewId = allViews.find((v) => v.code === 'BIBLIOTECA')?.id;
      }

      if (!currentViewId) {
        continue;
      }

      const currentView = allViews.find((v) => v.id === currentViewId);
      const currentViewCode = currentView?.code || '';
      const viewCodeName = currentView?.name || 'Inventario';

      // Cabecera: normalizamos para encontrar las columnas
      const headerRow = worksheet.getRow(1);
      const headers: Record<string, number> = {};
      const colMapByIndex: Record<number, string> = {};

      headerRow.eachCell((cell, colNumber) => {
        const rawVal = cell.value?.toString() || '';
        const val = rawVal.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
        if (val) {
          headers[val] = colNumber;
          colMapByIndex[colNumber] = rawVal.trim();
        }
      });

      // Mapeo flexible de columnas obligatorias
      const nameCol = headers['nombre'] || headers['descripcion'] || headers['articulo'];
      const codeCol = headers['codigo yavirac'] || headers['codigo institucional'] || headers['codigo'] || headers['codigo_yavirac'];
      const categoryCol = headers['categoria'] || headers['categoria_nombre'];
      const subcategoryCol = headers['subcategoria'] || headers['subcategoria_nombre'];

      if (!nameCol || !subcategoryCol) {
        errors.push(
          `Hoja "${worksheet.name}": Faltan columnas obligatorias (Nombre, Subcategoría) en la cabecera.`
        );
        continue;
      }

      // Columnas opcionales
      const statusCol = headers['estado fisico'] || headers['estado'] || headers['estado_fisico'];
      const quantityCol = headers['cantidad'] || headers['stock'];

      sheetsProcessed++;
      let sheetImportedCount = 0;

      for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const nameVal = row.getCell(nameCol).value?.toString().trim();
        const codeVal = codeCol ? row.getCell(codeCol).value?.toString().trim() : null;
        const catVal = categoryCol ? row.getCell(categoryCol).value?.toString().trim() : null;
        const subVal = row.getCell(subcategoryCol).value?.toString().trim();

        // Fila vacía
        if (!nameVal && !codeVal && !subVal && !catVal) {
          continue;
        }

        if (!nameVal || !subVal) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: El Nombre y la Subcategoría son obligatorios.`
          );
          continue;
        }

        // Si es Bienes o Biblioteca, el Código Yavirac es obligatorio y único
        const isBienesOBiblioteca = currentViewCode === 'BIENES_PUBLICOS' || currentViewCode === 'BIBLIOTECA';
        if (isBienesOBiblioteca && !codeVal) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: El Código Yavirac es obligatorio para Bienes Públicos y Biblioteca.`
          );
          continue;
        }

        // Buscar categoría en la base de datos para la vista actual
        let category: any = null;
        if (catVal) {
          category = allCategories.find(
            (c) =>
              c.name.toLowerCase().trim() === catVal.toLowerCase().trim() &&
              c.inventoryViewId === currentViewId
          );
          if (!category) {
            errors.push(
              `Hoja "${worksheet.name}" - Fila ${r}: La categoría '${catVal}' no existe para esta sección del inventario.`
            );
            continue;
          }
        }

        // Buscar subcategoría en la base de datos
        const subcategory = allSubcategories.find(
          (s) => s.name.toLowerCase().trim() === subVal.toLowerCase().trim()
        );
        if (!subcategory) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: La subcategoría '${subVal}' no existe.`
          );
          continue;
        }

        // Si el usuario especificó categoría en el excel, validar que la subcategoría pertenezca a ella
        if (category && subcategory.categoryId !== category.id) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: La subcategoría '${subVal}' no pertenece a la categoría '${catVal}'.`
          );
          continue;
        }

        // Validar que la subcategoría pertenezca a la vista actual
        if (subcategory.category?.inventoryViewId !== currentViewId) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: La subcategoría '${subVal}' no corresponde al tipo de inventario de esta sección.`
          );
          continue;
        }

        // Detección de artículo existente (para actualizar en lote en vez de fallar o duplicar)
        let matchedItem: any = null;
        let isNew = true;
        let formattedCodeValue: string | null = null;

        if (codeVal) {
          const codeUpper = codeVal.toUpperCase();
          formattedCodeValue = codeUpper;
          
          // Buscar primero en el lote en memoria actual
          matchedItem = itemsToSave.find((item) => item.codeValue === codeUpper);
          if (matchedItem) {
            isNew = false;
          } else {
            // Buscar en la base de datos
            const dbItem = await this.itemRepo.findOne({
              where: { codeValue: ILike(codeUpper), status: 'ACTIVO' },
            });
            if (dbItem) {
              matchedItem = dbItem;
              isNew = false;
            }
          }
        } else {
          const nameUpper = nameVal.toUpperCase().trim();
          
          // Buscar primero en el lote en memoria (por Nombre + Subcategoría)
          matchedItem = itemsToSave.find(
            (item) => !item.codeValue && item.name.toUpperCase().trim() === nameUpper && item.subcategoryId === subcategory.id
          );
          if (matchedItem) {
            isNew = false;
          } else {
            // Buscar en la base de datos
            const dbItem = await this.itemRepo.findOne({
              where: {
                name: ILike(nameVal.trim()),
                subcategoryId: subcategory.id,
                status: 'ACTIVO',
              },
            });
            if (dbItem) {
              matchedItem = dbItem;
              isNew = false;
            }
          }
        }

        // Campos opcionales
        let statusVal = 'BUENO';
        if (statusCol) {
          const rawStatus = row.getCell(statusCol).value?.toString().toUpperCase().trim();
          if (rawStatus === 'REGULAR' || rawStatus === 'MALO') {
            statusVal = rawStatus;
          }
        }

        let qtyVal = 1;
        if (quantityCol) {
          const cellValue = row.getCell(quantityCol).value;
          const rawQty = cellValue ? parseInt(cellValue.toString(), 10) : NaN;
          if (!isNaN(rawQty) && rawQty >= 0) {
            qtyVal = rawQty;
          }
        }

        // ==========================================================
        // DETECCIÓN DINÁMICA DE CAMPOS PERSONALIZADOS
        // ==========================================================
        const dynamicValues: Record<string, any> = {};
        
        // Obtener campos permitidos para la subcategoría de esta fila
        const allowedConfigs = allConfigs.filter((c) => c.subcategoryId === subcategory.id);

        row.eachCell((cell, colIndex) => {
          if (
            colIndex === nameCol ||
            (codeCol && colIndex === codeCol) ||
            (categoryCol && colIndex === categoryCol) ||
            colIndex === subcategoryCol ||
            (statusCol && colIndex === statusCol) ||
            (quantityCol && colIndex === quantityCol)
          ) {
            return;
          }

          const headerName = colMapByIndex[colIndex];
          if (!headerName) return;

          // Buscar si esta columna de Excel coincide con la etiqueta o el nombre técnico del campo dinámico
          const matchedConfig = allowedConfigs.find(
            (c) =>
              c.customField?.label.toLowerCase().trim() === headerName.toLowerCase().trim() ||
              c.customField?.name.toLowerCase().trim() === headerName.toLowerCase().trim()
          );

          if (matchedConfig) {
            const rawCellVal = cell.value?.toString().trim() || '';
            dynamicValues[matchedConfig.customField.id] = rawCellVal;
          } else {
            // Si la celda tiene algún valor escrito en esa columna, pero no está asociado a la subcategoría, lanzar error
            const rawCellVal = cell.value?.toString().trim() || '';
            if (rawCellVal) {
              errors.push(
                `Hoja "${worksheet.name}" - Fila ${r}: El atributo '${headerName}' no está configurado para la subcategoría '${subcategory.name}'. Por favor, regístralo primero en la interfaz web.`
              );
            }
          }
        });

        // Validar e inicializar valores dinámicos
        let validatedValues = {};
        try {
          validatedValues = await this.validateAndFormatDynamicValues(subcategory.id, dynamicValues);
        } catch (err: any) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: ${err.message}`
          );
          continue;
        }

        if (!isNew) {
          matchedItem.name = nameVal;
          matchedItem.estadoFisico = statusVal;
          if (currentViewCode === 'INSUMOS') {
            // Si es insumo y ya existe en la DB o lote, acumulamos la cantidad del Excel
            matchedItem.cantidad = (matchedItem.cantidad || 0) + qtyVal;
          } else {
            matchedItem.cantidad = qtyVal;
          }
          matchedItem.dynamicValues = {
            ...(matchedItem.dynamicValues || {}),
            ...validatedValues,
          };
        } else {
          matchedItem = {
            name: nameVal,
            codeValue: formattedCodeValue,
            subcategoryId: subcategory.id,
            inventoryViewId: currentViewId,
            cantidad: qtyVal,
            status: 'ACTIVO',
            estadoFisico: statusVal,
            dynamicValues: validatedValues,
            academicPeriodId: activePeriod ? activePeriod.id : null,
            isPending: !activePeriod,
          };
          itemsToSave.push(matchedItem);
        }

        sheetImportedCount++;
      }

      if (sheetImportedCount > 0) {
        importedBreakdown[viewCodeName] = (importedBreakdown[viewCodeName] || 0) + sheetImportedCount;
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Se encontraron errores al procesar el archivo Excel.',
        errors: errors,
      });
    }

    if (itemsToSave.length === 0) {
      throw new BadRequestException('No se encontraron hojas ni filas con datos válidos para importar.');
    }

    await this.itemRepo.save(itemsToSave);

    const breakdownMsg = Object.entries(importedBreakdown)
      .map(([name, count]) => `${count} en ${name}`)
      .join(', ');

    return {
      message: `Importación masiva completada con éxito. Se importaron: ${breakdownMsg}.`,
      importedCount: itemsToSave.length,
    };
  }

  async generateExcelTemplate(inventoryViewId?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Obtener todas las configuraciones de campos personalizados
    const allConfigs = await this.fieldConfigRepo.find({
      relations: { customField: true, subcategory: true },
      order: { sortOrder: 'ASC' },
    });

    const allViews = await this.findAllViews();
    const allSubcategories = await this.subcategoryRepo.find({ relations: { category: { inventoryView: true } } });
    let viewsToGenerate = allViews;

    if (inventoryViewId) {
      const filtered = allViews.filter((v) => v.id === inventoryViewId);
      if (filtered.length > 0) {
        viewsToGenerate = filtered;
      }
    }

    const sheetsConfig = viewsToGenerate.map((view) => {
      let defaultSubcategory = 'LIBROS';
      let name = 'BIBLIOTECA';
      if (view.code === 'BIENES_PUBLICOS') {
        name = 'BIENES PUBLICOS';
        defaultSubcategory = 'EQUIPOS TECNOLOGICOS';
      } else if (view.code === 'INSUMOS') {
        name = 'BODEGA (INSUMOS)';
        defaultSubcategory = 'SUMINISTROS DE ASEO';
      }
      return {
        name,
        viewCode: view.code,
        defaultSubcategory,
      };
    });

    for (const sc of sheetsConfig) {
      const worksheet = workbook.addWorksheet(sc.name);

      // Columnas base
      const headers = [
        'Nombre',
        'Código Yavirac',
        'Categoría',
        'Subcategoría',
        'Estado Físico',
        'Cantidad',
      ];

      // Obtener todas las subcategorías que pertenecen a la vista actual
      const viewSubcategories = allSubcategories.filter(
        (s) => s.category?.inventoryView?.code === sc.viewCode
      );
      const viewSubIds = viewSubcategories.map((s) => s.id);

      // Buscar campos dinámicos unificados de forma insensible a mayúsculas/minúsculas
      const uniqueDynamicFieldsMap = new Map<string, string>();
      for (const config of allConfigs) {
        if (!viewSubIds.includes(config.subcategoryId)) continue;
        const nameOrLabel = config.customField?.label || config.customField?.name;
        if (!nameOrLabel) continue;
        const key = nameOrLabel.toUpperCase().trim();
        if (!uniqueDynamicFieldsMap.has(key)) {
          uniqueDynamicFieldsMap.set(key, nameOrLabel);
        }
      }
      const uniqueDynamicFields = Array.from(uniqueDynamicFieldsMap.values());

      // Agregar los campos dinámicos como columnas adicionales a la derecha
      const allHeaders = [...headers, ...uniqueDynamicFields];
      worksheet.addRow(allHeaders);

      // Estilizar la cabecera
      const headerRow = worksheet.getRow(1);
      headerRow.height = 25;
      
      headerRow.eachCell((cell, colNum) => {
        const isDynamic = colNum > headers.length;
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFFFF' },
          name: 'Arial',
          size: 10,
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isDynamic ? 'FF6366F1' : 'FFF97316' }, // Lila para campos dinámicos, Naranja para base
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
      });

      // Agregar fila de ejemplo útil para guiar al usuario
      const exampleRow = [
        `Ejemplo de ${sc.name.toLowerCase()}`,
        sc.viewCode === 'INSUMOS' ? '' : `${sc.viewCode.substring(0, 3)}-EX-001`,
        sc.viewCode === 'BIENES_PUBLICOS' ? 'TECNOLOGIA' : sc.viewCode === 'INSUMOS' ? 'LIMPIEZA' : 'LITERATURA',
        sc.defaultSubcategory,
        'BUENO',
        sc.viewCode === 'INSUMOS' ? 10 : 1,
      ];

      // Rellenar valores de ejemplo para los campos dinámicos
      for (let i = 0; i < uniqueDynamicFields.length; i++) {
        exampleRow.push('Ejemplo Valor');
      }

      worksheet.addRow(exampleRow);

      // Formatear el ancho de las columnas
      worksheet.columns.forEach((column) => {
        column.width = 22;
      });
    }

    return workbook.xlsx.writeBuffer() as any;
  }

  async exportItemsToExcel(inventoryViewId: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const allViews = await this.findAllViews();
    const currentView = allViews.find((v) => v.id === inventoryViewId);
    if (!currentView) {
      throw new NotFoundException('La vista de inventario seleccionada no existe.');
    }

    const allSubcategories = await this.subcategoryRepo.find({ relations: { category: true } });
    
    // Obtener las subcategorías de esta vista
    const viewSubcategories = allSubcategories.filter(
      (s) =>
        s.category?.inventoryViewId === inventoryViewId ||
        s.category?.inventoryView?.id === inventoryViewId
    );
    const viewSubIds = viewSubcategories.map((s) => s.id);

    // Obtener todas las configuraciones de campos personalizados de estas subcategorías
    let allConfigs: CustomFieldConfig[] = [];
    if (viewSubIds.length > 0) {
      allConfigs = await this.fieldConfigRepo.find({
        where: { subcategoryId: In(viewSubIds) },
        relations: { customField: true },
        order: { sortOrder: 'ASC' },
      });
    }

    // Consolidar campos dinámicos unificados por nombre (insensible a mayúsculas/minúsculas)
    const unifiedFieldsMap = new Map<string, { label: string; fieldIds: string[] }>();
    for (const c of allConfigs) {
      const f = c.customField;
      if (!f) continue;
      const labelOrName = f.label || f.name;
      const key = labelOrName.toUpperCase().trim();
      if (!unifiedFieldsMap.has(key)) {
        unifiedFieldsMap.set(key, { label: labelOrName, fieldIds: [] });
      }
      unifiedFieldsMap.get(key)!.fieldIds.push(f.id);
    }
    const unifiedFields = Array.from(unifiedFieldsMap.values());

    // Cargar los artículos de la vista actual
    const items = await this.itemRepo.find({
      where: { inventoryViewId, status: 'ACTIVO' },
      relations: { subcategory: { category: true } },
      order: { name: 'ASC' },
    });

    let sheetName = 'BIBLIOTECA';
    if (currentView.code === 'BIENES_PUBLICOS') {
      sheetName = 'BIENES PUBLICOS';
    } else if (currentView.code === 'INSUMOS') {
      sheetName = 'BODEGA (INSUMOS)';
    }

    const worksheet = workbook.addWorksheet(sheetName);

    // Cabeceras base
    const headers = [
      'Nombre',
      'Código Yavirac',
      'Categoría',
      'Subcategoría',
      'Estado Físico',
      'Cantidad',
    ];

    // Cabeceras dinámicas unificadas
    const dynamicHeaders = unifiedFields.map((f) => f.label);
    const allHeaders = [...headers, ...dynamicHeaders];
    worksheet.addRow(allHeaders);

    // Estilizar la cabecera
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell((cell, colNum) => {
      const isDynamic = colNum > headers.length;
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        name: 'Arial',
        size: 10,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isDynamic ? 'FF6366F1' : 'FFF97316' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
      };
    });

    // Agregar filas de artículos
    for (const item of items) {
      const rowData = [
        item.name,
        item.codeValue || '',
        item.subcategory?.category?.name || '',
        item.subcategory?.name || '',
        item.estadoFisico || 'BUENO',
        item.cantidad,
      ];

      // Escribir los valores de los atributos dinámicos
      for (const fieldGroup of unifiedFields) {
        let val = '';
        for (const fieldId of fieldGroup.fieldIds) {
          if (item.dynamicValues?.[fieldId] !== undefined && item.dynamicValues?.[fieldId] !== null) {
            val = item.dynamicValues[fieldId].toString();
            break;
          }
        }
        rowData.push(val);
      }

      worksheet.addRow(rowData);
    }

    worksheet.columns.forEach((column) => {
      column.width = 22;
    });

    return workbook.xlsx.writeBuffer() as any;
  }
}


