import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { IsEnum } from 'class-validator';

class ChangeRolDto {
  @IsEnum(UserRole)
  rol: UserRole;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  findAll(@Query() filters: FilterUsersDto, @Request() req) {
    const requesterId = req.user?.id;
    return this.usersService.findAll(filters, requesterId);
  }

  // PD001: Consulta del perfil por el usuario autenticado (Docente, Admin, Responsable de Bienes)
  @Get('profile')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES, UserRole.DOCENTE)
  getProfile(@Request() req) {
    return this.usersService.findOne(req.user.id);
  }

  // PD002 & PD003 & PD004: Actualización del perfil propio
  @Patch('profile')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES, UserRole.DOCENTE)
  updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  // Editar perfil de usuario por el Admin
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Request() req,
  ) {
    return this.usersService.updateAdminUser(id, dto, req.user.id);
  }

  // Detalle de un usuario
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  //Cambiar rol
  @Patch(':id/rol')
  changeRol(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeRolDto,
    @Request() req,
  ) {
    return this.usersService.changeRol(id, body.rol, req.user.id);
  }

  //Cambiar estado
  @Patch(':id/estado')
  changeEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @Request() req,
  ) {
    return this.usersService.changeEstado(id, dto, req.user.id);
  }

  //Reset administrativo de contraseña
  @Post(':id/reset-password')
  adminResetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/reset-password`;
    return this.usersService.adminResetPassword(id, req.user.id, resetUrl);
  }

  //Historial de cambios
  @Get(':id/logs')
  getLogs(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getLogs(id);
  }
}
