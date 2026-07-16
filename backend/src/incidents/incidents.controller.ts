import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateIncidentReportDto } from './dto/create-incident-report.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  // Registrar reporte de novedad
  @Post()
  @Roles(UserRole.DOCENTE)
  async createIncident(@Request() req, @Body() dto: CreateIncidentReportDto) {
    const teacherId = req.user.id;
    const report = await this.incidentsService.createIncidentReport(dto, teacherId);
    return {
      message: 'El reporte de novedad fue registrado y enviado correctamente al administrador.',
      report,
    };
  }

  // Consulta del historial de reportes
  @Get()
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES, UserRole.DOCENTE)
  async getIncidents(
    @Request() req,
    @Query('teacherId') teacherId?: string,
    @Query('spaceId') spaceId?: string,
    @Query('jornada') jornada?: string,
    @Query('status') status?: string,
    @Query('academicPeriodId') academicPeriodId?: string,
  ) {
    const userId = req.user.id;
    const userRol = req.user.rol;
    return this.incidentsService.findIncidents(
      { teacherId, spaceId, jornada, status, academicPeriodId },
      userId,
      userRol,
    );
  }

  // Consulta del detalle de un reporte individual
  @Get(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES, UserRole.DOCENTE)
  async getIncidentById(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user.id;
    const userRol = req.user.rol;
    return this.incidentsService.findOneIncident(id, userId, userRol);
  }

  // Actualizar el estado de la novedad
  @Patch(':id/status')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async updateIncidentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentStatusDto,
  ) {
    const report = await this.incidentsService.updateIncidentStatus(id, dto);
    return {
      message: `El estado del reporte de novedad ha sido actualizado a ${dto.status} correctamente.`,
      report,
    };
  }
}
