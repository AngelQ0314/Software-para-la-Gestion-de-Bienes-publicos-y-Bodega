import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
  Request,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { CreateCodeTypeDto } from './dto/create-code-type.dto';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { AssociateFieldDto } from './dto/associate-field.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // VISTAS DE INVENTARIO
  @Get('views')
  async getAllViews() {
    return this.inventoryService.findAllViews();
  }

  // CATEGORÍAS 
  @Get('categories')
  async getAllCategories(@Query('inventoryViewId') inventoryViewId?: string) {
    return this.inventoryService.findAllCategories(inventoryViewId);
  }

  @Post('categories')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.inventoryService.createCategory(dto);
  }

  @Patch('categories/:id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('name') name: string,
  ) {
    return this.inventoryService.updateCategory(id, name);
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.inventoryService.deleteCategory(id);
    return {
      message: `Categoría eliminada correctamente. ${result.desasociados} elementos se desasociaron y quedaron sin categoría.`,
    };
  }

  // SUBCATEGORÍAS
  @Get('subcategories')
  async getAllSubcategories(@Query('categoryId') categoryId?: string) {
    return this.inventoryService.findAllSubcategories(categoryId);
  }

  @Post('subcategories')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async createSubcategory(@Body() dto: CreateSubcategoryDto) {
    return this.inventoryService.createSubcategory(dto);
  }

  @Patch('subcategories/:id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async updateSubcategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { name?: string; categoryId?: string; categoryName?: string },
  ) {
    return this.inventoryService.updateSubcategory(id, dto);
  }

  @Delete('subcategories/:id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async deleteSubcategory(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.inventoryService.deleteSubcategory(id);
    return {
      message: `Subcategoría eliminada correctamente. ${result.desasociados} elementos se desasociaron y quedaron sin subcategoría.`,
    };
  }

  // TIPOS DE CÓDIGO
  @Get('code-types')
  async getAllCodeTypes() {
    return this.inventoryService.findAllCodeTypes();
  }

  @Post('code-types')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async createCodeType(@Body() dto: CreateCodeTypeDto) {
    return this.inventoryService.createCodeType(dto);
  }

  @Patch('code-types/:id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async updateCodeType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCodeTypeDto,
  ) {
    return this.inventoryService.updateCodeType(id, dto);
  }

  @Delete('code-types/:id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async deleteCodeType(@Param('id', ParseUUIDPipe) id: string) {
    await this.inventoryService.deleteCodeType(id);
    return { message: 'Tipo de código eliminado correctamente.' };
  }

  // CAMPOS PERSONALIZADOS
  @Get('custom-fields')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async getAllCustomFields() {
    return this.inventoryService.findAllCustomFields();
  }

  @Post('custom-fields')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async createCustomField(@Body() dto: CreateCustomFieldDto) {
    return this.inventoryService.createCustomField(dto);
  }

  @Patch('custom-fields/:id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async updateCustomField(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.inventoryService.updateCustomField(id, dto);
  }

  @Delete('custom-fields/:id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async deleteCustomField(@Param('id', ParseUUIDPipe) id: string) {
    await this.inventoryService.deleteCustomField(id);
    return { message: 'Campo personalizado eliminado correctamente.' };
  }

  // ASOCIACIÓN DE CAMPOS A TIPOS DE CÓDIGO
  @Get('code-types/:id/fields')
  async getFieldsByCodeType(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findFieldsByCodeType(id);
  }

  @Post('code-types/:id/fields')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async associateField(
    @Param('id', ParseUUIDPipe) codeTypeId: string,
    @Body() dto: AssociateFieldDto,
  ) {
    return this.inventoryService.associateFieldToCodeType(codeTypeId, dto);
  }

  @Delete('code-types/:codeTypeId/fields/:customFieldId')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async removeField(
    @Param('codeTypeId', ParseUUIDPipe) codeTypeId: string,
    @Param('customFieldId', ParseUUIDPipe) customFieldId: string,
  ) {
    await this.inventoryService.removeFieldFromCodeType(codeTypeId, customFieldId);
    return { message: 'Asociación del campo eliminada correctamente.' };
  }

  // ELEMENTOS DEL INVENTARIO (CRUD)
  @Get('items')
  async getItems(
    @Query('inventoryViewId') inventoryViewId?: string,
    @Query('inventoryViewCode') inventoryViewCode?: string,
    @Query('categoryId') categoryId?: string,
    @Query('subcategoryId') subcategoryId?: string,
    @Query('codeTypeId') codeTypeId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('onlyOrphans') onlyOrphans?: string,
  ) {
    return this.inventoryService.findItems({
      inventoryViewId,
      inventoryViewCode,
      categoryId,
      subcategoryId,
      codeTypeId,
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      onlyOrphans: onlyOrphans === 'true',
    });
  }

  @Get('items/:id')
  async getItemById(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user?.id;
    const userRol = req.user?.rol;
    return this.inventoryService.findInventoryItemById(id, userId, userRol);
  }

  @Post('items')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async createItem(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.createInventoryItem(dto);
  }

  @Patch('items/:id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateInventoryItem(id, dto);
  }

  @Delete('items/:id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async deleteItem(@Param('id', ParseUUIDPipe) id: string) {
    await this.inventoryService.deleteInventoryItem(id);
    return { message: 'Elemento eliminado del inventario correctamente.' };
  }

  @Get('template')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.inventoryService.generateExcelTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=plantilla_inventario_unificada.xlsx',
    );
    return res.send(buffer);
  }

  @Post('items/import')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  @UseInterceptors(FileInterceptor('file'))
  async importItems(
    @UploadedFile() file: any,
    @Query('inventoryViewId') inventoryViewId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Debe subir un archivo de Excel (.xlsx).');
    }
    return this.inventoryService.importItemsFromExcel(file.buffer, inventoryViewId);
  }
}

