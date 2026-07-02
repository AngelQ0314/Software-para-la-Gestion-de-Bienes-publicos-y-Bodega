import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InventoryView, InventoryViewCode } from './entities/inventory-view.entity';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { CodeType } from './entities/code-type.entity';
import { CustomField, CustomFieldType } from './entities/custom-field.entity';
import { CustomFieldConfig } from './entities/custom-field-config.entity';
import { InventoryItem } from './entities/inventory-item.entity';

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
    return this.codeTypeRepo.find({ order: { name: 'ASC' } });
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
        relations: { category: true },
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
      relations: { category: true },
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
        where: { codeValue: formattedCodeValue },
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

    const nuevoItem = {
      name: dto.name,
      codeValue: formattedCodeValue,
      subcategoryId: subId,
      codeTypeId: codeTypeId,
      inventoryViewId: subcategory.category.inventoryViewId,
      dynamicValues: validatedValues,
      status: 'ACTIVO',
    };

    return this.itemRepo.save(nuevoItem);
  }

  async updateInventoryItem(id: string, dto: UpdateInventoryItemDto): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({ 
      where: { id },
      withDeleted: true, // Permite cargar ítems inactivos para poder editarlos y reactivarlos
    });
    if (!item) {
      throw new NotFoundException('El elemento de inventario no existe.');
    }

    let targetSubId = dto.subcategoryId;
    if (!targetSubId && dto.subcategoryName) {
      const sub = await this.subcategoryRepo.findOne({
        where: { name: dto.subcategoryName.toUpperCase() },
        relations: { category: true },
      });
      if (!sub) {
        throw new NotFoundException(`La subcategoría con nombre '${dto.subcategoryName}' no existe.`);
      }
      targetSubId = sub.id;
    }

    if (targetSubId) {
      const subcategory = await this.subcategoryRepo.findOne({
        where: { id: targetSubId },
        relations: { category: true },
      });
      if (!subcategory) {
        throw new NotFoundException('La subcategoría seleccionada no existe.');
      }
      item.subcategoryId = targetSubId;
      item.inventoryViewId = subcategory.category.inventoryViewId;
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
          where: { codeValue: formattedCode },
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

    if (dto.status !== undefined) {
      if (dto.status !== 'ACTIVO' && dto.status !== 'INACTIVO') {
        throw new BadRequestException('El estado debe ser ACTIVO o INACTIVO.');
      }
      
      if (dto.status === 'ACTIVO' && item.status === 'INACTIVO') {
        // Validar si el código ya está siendo usado por otro item activo
        if (item.codeValue) {
          const duplicadoActivo = await this.itemRepo.findOne({
            where: { codeValue: item.codeValue },
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

  async findInventoryItemById(id: string): Promise<any> {
    const item = await this.itemRepo.findOne({
      where: { id },
      withDeleted: true, // Permite ver detalles de ítems inactivos
      relations: {
        inventoryView: true,
        subcategory: {
          category: true,
        },
        codeType: true,
      },
    });

    if (!item) {
      throw new NotFoundException('El elemento de inventario no existe.');
    }

    // Resolver los nombres legibles de las propiedades dinámicas
    const resolvedValues = await this.resolveDynamicValuesLabels(item.codeTypeId, item.dynamicValues);

    return {
      ...item,
      resolvedValues,
    };
  }

  async findItems(filters: {
    inventoryViewId?: string;
    categoryId?: string;
    subcategoryId?: string;
    codeTypeId?: string;
    status?: string; // ACTIVO / INACTIVO
    search?: string;
    page?: number;
    limit?: number;
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
      .orderBy('item.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (filters.inventoryViewId) {
      query.andWhere('item.inventoryViewId = :inventoryViewId', { inventoryViewId: filters.inventoryViewId });
    }

    if (filters.subcategoryId) {
      query.andWhere('item.subcategoryId = :subcategoryId', { subcategoryId: filters.subcategoryId });
    } else if (filters.categoryId) {
      query.andWhere('subcategory.categoryId = :categoryId', { categoryId: filters.categoryId });
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

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async deleteInventoryItem(id: string): Promise<void> {
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
}
