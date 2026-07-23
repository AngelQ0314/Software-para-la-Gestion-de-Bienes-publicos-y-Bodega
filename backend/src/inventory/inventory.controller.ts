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

  // ASOCIACIÓN DE CAMPOS A SUBCATEGORÍAS
  @Get('subcategories/:id/fields')
  async getFieldsBySubcategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findFieldsBySubcategory(id);
  }

  @Post('subcategories/:id/fields')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async associateField(
    @Param('id', ParseUUIDPipe) subId: string,
    @Body() dto: AssociateFieldDto,
  ) {
    return this.inventoryService.associateFieldToSubcategory(subId, dto);
  }

  @Delete('subcategories/:subId/fields/:customFieldId')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async removeField(
    @Param('subId', ParseUUIDPipe) subId: string,
    @Param('customFieldId', ParseUUIDPipe) customFieldId: string,
  ) {
    await this.inventoryService.removeFieldFromSubcategory(subId, customFieldId);
    return { message: 'Asociación del campo eliminada correctamente.' };
  }

  // ELEMENTOS DEL INVENTARIO (CRUD)
  @Get('items')
  async getItems(
    @Query('inventoryViewId') inventoryViewId?: string,
    @Query('inventoryViewCode') inventoryViewCode?: string,
    @Query('categoryId') categoryId?: string,
    @Query('subcategoryId') subcategoryId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('onlyOrphans') onlyOrphans?: string,
    @Query('showOrphansAndDeleted') showOrphansAndDeleted?: string,
    @Query('searchOnlyInWarehouse') searchOnlyInWarehouse?: string,
  ) {
    return this.inventoryService.findItems({
      inventoryViewId,
      inventoryViewCode,
      categoryId,
      subcategoryId,
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      onlyOrphans: onlyOrphans === 'true',
      showOrphansAndDeleted: showOrphansAndDeleted === 'true',
      onlyInWarehouse: searchOnlyInWarehouse === 'true',
    });
  }

  @Get('items/export')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async exportItems(
    @Query('inventoryViewId') inventoryViewId: string,
    @Res() res: Response,
  ) {
    if (!inventoryViewId) {
      throw new BadRequestException('Debe proporcionar el inventoryViewId.');
    }
    const buffer = await this.inventoryService.exportItemsToExcel(inventoryViewId);
    
    // Obtener nombre dinámico para el archivo según la vista
    const allViews = await this.inventoryService.findAllViews();
    const currentView = allViews.find((v) => v.id === inventoryViewId);
    const viewCode = currentView?.code?.toLowerCase() || 'inventario';

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=inventario_exportado_${viewCode}.xlsx`,
    );
    res.end(Buffer.from(buffer));
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
  async downloadTemplate(
    @Query('inventoryViewId') inventoryViewId: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.inventoryService.generateExcelTemplate(inventoryViewId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=plantilla_inventario.xlsx',
    );
    res.end(Buffer.from(buffer));
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

