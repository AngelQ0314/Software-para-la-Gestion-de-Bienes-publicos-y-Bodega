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
} from '@nestjs/common';
import { SpacesService } from './spaces.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { LinkTeachersDto } from './dto/link-teachers.dto';
import { AssignItemsDto } from './dto/assign-items.dto';
import { SpaceType } from './entities/physical-space.entity';

@Controller('spaces')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES) // Protegido para Administradores y Responsables
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  // OBTENER TODOS LOS ESPACIOS
  @Get()
  async getAllSpaces(
    @Query('roomNumber') roomNumber?: string,
    @Query('name') name?: string,
    @Query('type') type?: SpaceType,
    @Query('location') location?: string,
  ) {
    return this.spacesService.findAllSpaces({ roomNumber, name, type, location });
  }

  // OBTENER DETALLE DE UN ESPACIO
  @Get(':id')
  async getSpaceById(@Param('id', ParseUUIDPipe) id: string) {
    return this.spacesService.findOneSpace(id);
  }

  // CREAR UN ESPACIO FÍSICO
  @Post()
  async createSpace(@Body() dto: CreateSpaceDto) {
    return this.spacesService.createSpace(dto);
  }

  // EDITAR UN ESPACIO FÍSICO (CAMPOS OPCIONALES)
  @Patch(':id')
  async updateSpace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpaceDto,
  ) {
    return this.spacesService.updateSpace(id, dto);
  }

  // ELIMINAR UN ESPACIO FÍSICO
  @Delete(':id')
  async deleteSpace(@Param('id', ParseUUIDPipe) id: string) {
    await this.spacesService.deleteSpace(id);
    return { message: 'Espacio físico eliminado correctamente.' };
  }

  // VINCULAR DOCENTES A UN ESPACIO FÍSICO
  @Post(':id/teachers')
  async linkTeachers(
    @Param('id', ParseUUIDPipe) spaceId: string,
    @Body() dto: LinkTeachersDto,
  ) {
    await this.spacesService.linkTeachersToSpace(spaceId, dto);
    return { message: 'Docentes vinculados al espacio físico correctamente.' };
  }

  // DESVINCULAR UN DOCENTE DEL ESPACIO FÍSICO
  @Delete(':id/teachers/:teacherId')
  async unlinkTeacher(
    @Param('id', ParseUUIDPipe) spaceId: string,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
  ) {
    await this.spacesService.unlinkTeacherFromSpace(spaceId, teacherId);
    return { message: 'Docente desvinculado del espacio físico correctamente.' };
  }

  // ASIGNAR ARTÍCULOS A UN ESPACIO (CON SOPORTE DE FRACCIONAMIENTO)
  @Post(':id/items')
  async assignItems(
    @Param('id', ParseUUIDPipe) spaceId: string,
    @Body() dto: AssignItemsDto,
  ) {
    await this.spacesService.assignItemsToSpace(spaceId, dto);
    return { message: 'Elementos del inventario asignados al espacio físico correctamente.' };
  }

  // DESASOCIAR UN ARTÍCULO DEL ESPACIO
  @Delete(':id/items/:itemId')
  async removeItem(
    @Param('id', ParseUUIDPipe) spaceId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await this.spacesService.removeItemFromSpace(spaceId, itemId);
    return { message: 'Elemento del inventario desasociado del espacio físico correctamente.' };
  }

  // OBTENER INVENTARIO DEL ESPACIO FILTRADO POR JORNADA
  @Get(':id/inventory')
  async getInventoryByShift(
    @Param('id', ParseUUIDPipe) spaceId: string,
    @Query('jornada') jornada: string,
  ) {
    return this.spacesService.getSpaceInventoryByShift(spaceId, jornada);
  }

}
