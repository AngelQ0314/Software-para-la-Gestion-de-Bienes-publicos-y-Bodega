import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';

import { InventoryView, InventoryViewCode } from './entities/inventory-view.entity';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { CodeType } from './entities/code-type.entity';
import { CustomField, CustomFieldType } from './entities/custom-field.entity';
import { CustomFieldConfig } from './entities/custom-field-config.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { AcademicPeriod } from '../periods/entities/academic-period.entity';
import * as ExcelJS from 'exceljs';


import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { CreateCodeTypeDto } from './dto/create-code-type.dto';
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
    @InjectRepository(CodeType)
    private readonly codeTypeRepo: Repository<CodeType>,
    @InjectRepository(CustomField)
    private readonly customFieldRepo: Repository<CustomField>,
    @InjectRepository(CustomFieldConfig)
    private readonly fieldConfigRepo: Repository<CustomFieldConfig>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(AcademicPeriod)
    private readonly periodRepo: Repository<AcademicPeriod>,
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
      // Para los ítems afectados, también se desaciosa la vista
      await this.itemRepo
        .createQueryBuilder()
        .update(InventoryItem)
        .set({ inventoryViewId: null })
        .where('subcategory_id IN (SELECT sub.id FROM subcategories sub WHERE sub.category_id = :categoryId)', { categoryId: id })
        .execute();
    }

    // El borrado en cascada
    await this.categoryRepo.remove(category);

    return { desasociados: count };
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
      // Desasociamos de la vista
      await this.itemRepo
        .createQueryBuilder()
        .update(InventoryItem)
        .set({ inventoryViewId: null })
        .where('subcategory_id = :subId', { subId: id })
        .execute();
    }

    await this.subcategoryRepo.remove(sub);

    return { desasociados: count };
  }

  // TIPOS DE CÓDIGO
  async findAllCodeTypes(): Promise<CodeType[]> {
    return this.codeTypeRepo.find({
      relations: {
        configs: {
          customField: true,
        },
      },
      order: { name: 'ASC' },
    });
  }

  async createCodeType(dto: CreateCodeTypeDto): Promise<CodeType> {
    const existe = await this.codeTypeRepo.findOne({ where: { name: dto.name.toUpperCase() } });
    if (existe) {
      throw new ConflictException(`El tipo de código '${dto.name}' ya existe.`);
    }

    const nuevo = this.codeTypeRepo.create({
      name: dto.name.toUpperCase(),
      prefix: dto.prefix?.toUpperCase(),
    });

    return this.codeTypeRepo.save(nuevo);
  }

  async updateCodeType(id: string, dto: CreateCodeTypeDto): Promise<CodeType> {
    const codeType = await this.codeTypeRepo.findOne({ where: { id } });
    if (!codeType) {
      throw new NotFoundException('El tipo de código no existe.');
    }

    const existe = await this.codeTypeRepo.findOne({ where: { name: dto.name.toUpperCase() } });
    if (existe && existe.id !== id) {
      throw new ConflictException(`Ya existe otro tipo de código con el nombre '${dto.name}'.`);
    }

    codeType.name = dto.name.toUpperCase();
    if (dto.prefix !== undefined) {
      codeType.prefix = dto.prefix?.toUpperCase();
    }

    return this.codeTypeRepo.save(codeType);
  }

  async deleteCodeType(id: string): Promise<void> {
    const codeType = await this.codeTypeRepo.findOne({ where: { id } });
    if (!codeType) {
      throw new NotFoundException('El tipo de código no existe.');
    }
    await this.codeTypeRepo.remove(codeType);
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

    const existe = await this.customFieldRepo.findOne({ where: { name: normalizedName } });
    if (existe) {
      throw new ConflictException(`El campo técnico '${normalizedName}' ya existe.`);
    }

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

      const existe = await this.customFieldRepo.findOne({ where: { name: normalizedName } });
      if (existe && existe.id !== id) {
        throw new ConflictException(`Ya existe otro campo técnico con el nombre '${normalizedName}'.`);
      }
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

  // ASOCIACIÓN DE CAMPOS A TIPOS DE CÓDIGO (CONFIGURACIÓN)
  async associateFieldToCodeType(codeTypeId: string, dto: AssociateFieldDto): Promise<CustomFieldConfig> {
    const codeType = await this.codeTypeRepo.findOne({ where: { id: codeTypeId } });
    if (!codeType) {
      throw new NotFoundException('El tipo de código no existe.');
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

    // Verificar si ya está asociado
    let config = await this.fieldConfigRepo.findOne({
      where: { codeTypeId, customFieldId: fieldId },
    });

    if (config) {
      // Si ya existe, actualizamos su configuración
      config.isMandatory = dto.isMandatory ?? config.isMandatory;
      config.sortOrder = dto.sortOrder ?? config.sortOrder;
    } else {
      // Crear nueva asociación
      config = this.fieldConfigRepo.create({
        codeTypeId,
        customFieldId: fieldId,
        isMandatory: dto.isMandatory ?? false,
        sortOrder: dto.sortOrder ?? 0,
      });
    }

    return this.fieldConfigRepo.save(config);
  }

  async findFieldsByCodeType(codeTypeId: string): Promise<any[]> {
    const configs = await this.fieldConfigRepo.find({
      where: { codeTypeId },
      relations: { customField: true },
      order: { sortOrder: 'ASC' },
    });

    return configs.map((c) => ({
      id: c.customField.id,
      name: c.customField.name,
      label: c.customField.label,
      type: c.customField.type,
      options: c.customField.options,
      isMandatory: c.isMandatory,
      sortOrder: c.sortOrder,
    }));
  }

  async removeFieldFromCodeType(codeTypeId: string, customFieldId: string): Promise<void> {
    const config = await this.fieldConfigRepo.findOne({
      where: { codeTypeId, customFieldId },
    });
    if (!config) {
      throw new NotFoundException('La asociación especificada no existe.');
    }
    await this.fieldConfigRepo.remove(config);
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

    let codeTypeId = dto.codeTypeId;
    if (!codeTypeId && dto.codeTypeName) {
      const ct = await this.codeTypeRepo.findOne({
        where: { name: dto.codeTypeName.toUpperCase() },
      });
      if (!ct) {
        throw new NotFoundException(`El tipo de código con nombre '${dto.codeTypeName}' no existe.`);
      }
      codeTypeId = ct.id;
    }

    if (!codeTypeId) {
      throw new BadRequestException('Debe proporcionar el codeTypeId (UUID) o el codeTypeName.');
    }

    const codeType = await this.codeTypeRepo.findOne({ where: { id: codeTypeId } });
    if (!codeType) {
      throw new NotFoundException('El tipo de código seleccionado no existe.');
    }

    let formattedCodeValue: string | null = null;
    if (dto.codeValue && dto.codeValue.trim() !== '') {
      formattedCodeValue = dto.codeValue.trim();
      const existeCodigo = await this.itemRepo.findOne({
        where: { codeValue: formattedCodeValue, physicalSpaceId: IsNull() },
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
    }

    const validatedValues = await this.validateAndFormatDynamicValues(codeTypeId, dto.dynamicValues || {});

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
      codeTypeId: codeTypeId,
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

    let targetCodeTypeId = dto.codeTypeId;
    if (!targetCodeTypeId && dto.codeTypeName) {
      const ct = await this.codeTypeRepo.findOne({
        where: { name: dto.codeTypeName.toUpperCase() },
      });
      if (!ct) {
        throw new NotFoundException(`El tipo de código con nombre '${dto.codeTypeName}' no existe.`);
      }
      targetCodeTypeId = ct.id;
    }

    if (targetCodeTypeId) {
      const codeType = await this.codeTypeRepo.findOne({ where: { id: targetCodeTypeId } });
      if (!codeType) {
        throw new NotFoundException('El tipo de código seleccionado no existe.');
      }
      item.codeTypeId = targetCodeTypeId;
    }

    if (dto.codeValue !== undefined) {
      if (dto.codeValue && dto.codeValue.trim() !== '') {
        const formattedCode = dto.codeValue.trim();
        const existeCodigo = await this.itemRepo.findOne({
          where: { codeValue: formattedCode, physicalSpaceId: IsNull() },
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
            where: { codeValue: item.codeValue, physicalSpaceId: IsNull() },
          });
          if (duplicadoActivo && duplicadoActivo.id !== id) {
            throw new ConflictException(
              `No se puede activar este item porque el código '${item.codeValue}' ya está siendo usado por otro item activo.`
            );
          }
        }
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
      if (raw !== 'BUENO' && raw !== 'REGULAR' && raw !== 'MALO') {
        throw new BadRequestException('El estado físico debe ser BUENO, REGULAR o MALO.');
      }
      item.estadoFisico = raw;
    }

    if (dto.isPending !== undefined) {
      item.isPending = !!dto.isPending;
    }

    if (dto.dynamicValues) {
      const configs = await this.fieldConfigRepo.find({
        where: { codeTypeId: item.codeTypeId },
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
      item.dynamicValues = await this.validateAndFormatDynamicValues(item.codeTypeId, mergedDynamicValues);
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
        },
        codeType: {
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
    const resolvedValues = await this.resolveDynamicValuesLabels(item.codeTypeId, item.dynamicValues);

    let distribucionEspacios: any[] = [];
    const isInsumo = item.inventoryView?.code === 'INSUMOS';

    if (isInsumo) {
      const distributions = await this.itemRepo.find({
        where: {
          name: item.name,
          codeTypeId: item.codeTypeId,
          codeValue: item.codeValue === null ? IsNull() : item.codeValue,
          physicalSpaceId: Not(IsNull()),
          status: 'ACTIVO',
        },
        relations: { physicalSpace: true },
      });

      distribucionEspacios = distributions.map((d) => ({
        id: d.id,
        cantidad: d.cantidad,
        spaceId: d.physicalSpaceId,
        roomNumber: d.physicalSpace?.roomNumber || '',
        name: d.physicalSpace?.name || '',
      }));
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
    codeTypeId?: string;
    status?: string; // ACTIVO / INACTIVO
    search?: string;
    page?: number;
    limit?: number;
    onlyOrphans?: boolean;
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
      .leftJoinAndSelect('item.codeType', 'codeType')
      .leftJoinAndSelect('codeType.configs', 'configs')
      .leftJoinAndSelect('configs.customField', 'customField')
      .leftJoinAndSelect('item.physicalSpace', 'physicalSpace')
      .orderBy('item.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    // Para insumos, en el listado general solo mostrar el lote principal de bodega (evitar duplicados)
    query.andWhere("(inventoryView.code != 'INSUMOS' OR item.physicalSpaceId IS NULL)");

    if (filters.inventoryViewId) {
      query.andWhere('item.inventoryViewId = :inventoryViewId', { inventoryViewId: filters.inventoryViewId });
    } else if (filters.inventoryViewCode) {
      query.andWhere('inventoryView.code = :inventoryViewCode', { inventoryViewCode: filters.inventoryViewCode });
    }

    if (filters.onlyOrphans) {
      query.andWhere('item.subcategoryId IS NULL');
    } else {
      if (filters.subcategoryId) {
        query.andWhere('item.subcategoryId = :subcategoryId', { subcategoryId: filters.subcategoryId });
      } else if (filters.categoryId) {
        query.andWhere('subcategory.categoryId = :categoryId', { categoryId: filters.categoryId });
      }
    }

    if (filters.codeTypeId) {
      query.andWhere('item.codeTypeId = :codeTypeId', { codeTypeId: filters.codeTypeId });
    }

    if (filters.status) {
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
            codeTypeId: item.codeTypeId,
            codeValue: item.codeValue === null ? IsNull() : item.codeValue,
            physicalSpaceId: Not(IsNull()),
            status: 'ACTIVO',
          },
          relations: { physicalSpace: true },
        });

        distribucionEspacios = distributions.map((d) => ({
          id: d.id,
          cantidad: d.cantidad,
          spaceId: d.physicalSpaceId,
          roomNumber: d.physicalSpace?.roomNumber || '',
          name: d.physicalSpace?.name || '',
        }));
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

      const resolvedValues = await this.resolveDynamicValuesLabels(item.codeTypeId, item.dynamicValues);

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

    // Cambiar estado a INACTIVO
    item.status = 'INACTIVO';
    await this.itemRepo.save(item);

    // Aplicar borrado lógico
    await this.itemRepo.softRemove(item);
  }

  // MÉTODOS DE AYUDA
  private async validateAndFormatDynamicValues(
    codeTypeId: string,
    valuesInput: Record<string, any>,
  ): Promise<Record<string, any>> {
    const configs = await this.fieldConfigRepo.find({
      where: { codeTypeId },
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
          // Guardamos como string ISO de fecha corta
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
    codeTypeId: string,
    dynamicValues: Record<string, any>,
  ): Promise<any[]> {
    const configs = await this.fieldConfigRepo.find({
      where: { codeTypeId },
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
    
    // Pre-cargar vistas de inventario, subcategorías y tipos de código para optimizar velocidad
    const allViews = await this.findAllViews();
    const allSubcategories = await this.subcategoryRepo.find({ relations: { category: true } });
    const allCodeTypes = await this.codeTypeRepo.find();
    
    // Obtener todas las configuraciones de campos personalizados asociadas a los esquemas
    const allConfigs = await this.fieldConfigRepo.find({
      relations: { customField: true, codeType: true },
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
        // Si no se puede determinar la vista y no hay default, ignoramos la hoja
        continue;
      }

      const viewCodeName = allViews.find((v) => v.id === currentViewId)?.name || 'Inventario';

      // Cabecera: normalizamos para encontrar las columnas
      const headerRow = worksheet.getRow(1);
      const headers: Record<string, number> = {};
      const colMapByIndex: Record<number, string> = {};

      headerRow.eachCell((cell, colNumber) => {
        const rawVal = cell.value?.toString() || '';
        const val = rawVal.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quitar acentos
        if (val) {
          headers[val] = colNumber;
          colMapByIndex[colNumber] = rawVal.trim(); // Guardar el nombre real de la cabecera
        }
      });

      // Mapeo flexible de columnas obligatorias
      const nameCol = headers['nombre'] || headers['descripcion'] || headers['articulo'];
      const codeCol = headers['codigo yavirac'] || headers['codigo institucional'] || headers['codigo'] || headers['codigo_yavirac'];
      const subcategoryCol = headers['subcategoria'] || headers['subcategoria_nombre'] || headers['categoria'];
      const codeTypeCol = headers['tipo de codigo'] || headers['tipo codigo'] || headers['esquema'] || headers['tipo_codigo'];

      if (!nameCol || !codeCol || !subcategoryCol || !codeTypeCol) {
        errors.push(
          `Hoja "${worksheet.name}": Faltan columnas obligatorias (Nombre, Código Yavirac, Subcategoría y Tipo de Código).`
        );
        continue;
      }

      // Columnas opcionales
      const auxCol = headers['codigo auxiliar'] || headers['auxiliar'] || headers['codigo_auxiliar'];
      const statusCol = headers['estado fisico'] || headers['estado'] || headers['estado_fisico'];
      const quantityCol = headers['cantidad'] || headers['stock'];

      sheetsProcessed++;
      let sheetImportedCount = 0;

      for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const nameVal = row.getCell(nameCol).value?.toString().trim();
        const codeVal = row.getCell(codeCol).value?.toString().trim();
        const subVal = row.getCell(subcategoryCol).value?.toString().trim();
        const codeTypeVal = row.getCell(codeTypeCol).value?.toString().trim();

        // Fila vacía
        if (!nameVal && !codeVal && !subVal && !codeTypeVal) {
          continue;
        }

        if (!nameVal || !codeVal || !subVal || !codeTypeVal) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: Faltan campos obligatorios.`
          );
          continue;
        }

        // Buscar subcategoría
        const subcategory = allSubcategories.find(
          (s) => s.name.toLowerCase().trim() === subVal.toLowerCase()
        );
        if (!subcategory) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: La subcategoría "${subVal}" no existe.`
          );
          continue;
        }

        // Validar que corresponda a la vista
        if (subcategory.category?.inventoryViewId !== currentViewId) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: La subcategoría "${subVal}" no corresponde al tipo de inventario de la hoja.`
          );
          continue;
        }

        // Buscar tipo de código
        const codeType = allCodeTypes.find(
          (ct) => ct.name.toLowerCase().trim() === codeTypeVal.toLowerCase()
        );
        if (!codeType) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: El tipo de código "${codeTypeVal}" no existe.`
          );
          continue;
        }

        // Validar duplicado de código Yavirac en base de datos
        const formattedCodeValue = codeVal.toUpperCase();
        const existingItem = await this.itemRepo.findOne({
          where: { codeValue: formattedCodeValue },
          withDeleted: true,
        });
        if (existingItem) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: El código Yavirac "${formattedCodeValue}" ya está registrado.`
          );
          continue;
        }

        // Validar duplicado en el lote a guardar
        const duplicateInBatch = itemsToSave.some((item) => item.codeValue === formattedCodeValue);
        if (duplicateInBatch) {
          errors.push(
            `Hoja "${worksheet.name}" - Fila ${r}: El código Yavirac "${formattedCodeValue}" está duplicado en el archivo.`
          );
          continue;
        }

        // Campos opcionales
        const auxVal = auxCol ? row.getCell(auxCol).value?.toString().trim() || null : null;
        
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
        
        // Obtener campos permitidos para el tipo de código de esta fila
        const allowedConfigs = allConfigs.filter((c) => c.codeTypeId === codeType.id);

        row.eachCell((cell, colIndex) => {
          // Si el índice de columna está fuera del mapeo de cabecera o es una columna base, lo ignoramos
          if (
            colIndex === nameCol ||
            colIndex === codeCol ||
            colIndex === subcategoryCol ||
            colIndex === codeTypeCol ||
            colIndex === auxCol ||
            colIndex === statusCol ||
            colIndex === quantityCol
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
          }
        });

        // Validar e inicializar valores dinámicos
        const validatedValues = await this.validateAndFormatDynamicValues(codeType.id, dynamicValues);

        itemsToSave.push({
          name: nameVal,
          codeValue: formattedCodeValue,
          codigoAuxiliar: auxVal,
          subcategoryId: subcategory.id,
          codeTypeId: codeType.id,
          inventoryViewId: currentViewId,
          cantidad: qtyVal,
          status: 'ACTIVO',
          estadoFisico: statusVal,
          dynamicValues: validatedValues,
          academicPeriodId: activePeriod ? activePeriod.id : null,
          isPending: !activePeriod,
        });

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

  async generateExcelTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Obtener todos los esquemas y sus campos para colocarlos como columnas dinámicas
    const allConfigs = await this.fieldConfigRepo.find({
      relations: { customField: true, codeType: true },
      order: { sortOrder: 'ASC' },
    });

    const sheetsConfig = [
      {
        name: 'BIENES PUBLICOS',
        viewCode: 'BIENES_PUBLICOS',
        defaultSubcategory: 'EQUIPOS TECNOLOGICOS',
        defaultCodeType: 'BIENES GENERALES',
      },
      {
        name: 'BODEGA (INSUMOS)',
        viewCode: 'INSUMOS',
        defaultSubcategory: 'SUMINISTROS DE ASEO',
        defaultCodeType: 'INSUMOS GENERALES',
      },
      {
        name: 'BIBLIOTECA',
        viewCode: 'BIBLIOTECA',
        defaultSubcategory: 'LIBROS',
        defaultCodeType: 'LIBROS Y TEXTOS',
      },
    ];

    for (const sc of sheetsConfig) {
      const worksheet = workbook.addWorksheet(sc.name);

      // Columnas base
      const headers = [
        'Nombre',
        'Código Yavirac',
        'Código Auxiliar',
        'Subcategoría',
        'Tipo de Código',
        'Estado Físico',
        'Cantidad',
      ];

      // Buscar campos dinámicos asociados al tipo de código por defecto de esta hoja
      const dynamicFields = allConfigs
        .filter((c) => c.codeType?.name.toUpperCase().trim() === sc.defaultCodeType.toUpperCase().trim())
        .map((c) => c.customField?.label || c.customField?.name)
        .filter(Boolean);

      // Agregar los campos dinámicos como columnas adicionales a la derecha
      const allHeaders = [...headers, ...dynamicFields];
      worksheet.addRow(allHeaders);

      // Estilizar la cabecera
      const headerRow = worksheet.getRow(1);
      headerRow.height = 25;
      
      headerRow.eachCell((cell, colNum) => {
        const isDynamic = colNum > headers.length;
        cell.font = {
          bold: true,
          color: { argb: 'FFFFFF' },
          name: 'Arial',
          size: 10,
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isDynamic ? '6366F1' : 'F97316' }, // Lila para campos dinámicos, Naranja para base
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
      });

      // Agregar fila de ejemplo útil para guiar al usuario
      const exampleRow = [
        `Ejemplo de ${sc.name.toLowerCase()}`,
        `${sc.viewCode.substring(0,3)}-EX-001`,
        'AUX-999',
        sc.defaultSubcategory,
        sc.defaultCodeType,
        'BUENO',
        1,
      ];

      // Rellenar valores de ejemplo para los campos dinámicos
      for (let i = 0; i < dynamicFields.length; i++) {
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
}


