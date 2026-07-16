import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { FilterReportDto } from './dto/filter-report.dto';
import { Response } from 'express';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Consulta e historial de reportes con filtros
  @Get()
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async getReports(@Query() filters: FilterReportDto) {
    return this.reportsService.findAll(filters);
  }

  // Consulta de novedades o incidencias activas
  @Get('novedades/activas')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async getActiveNovelties() {
    return this.reportsService.getActiveNovelties();
  }

  // Generar un reporte consolidado de novedades histórico
  @Post('novedades/generar')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async generateNoveltyReport(
    @Request() req,
    @Body('academicPeriodId') periodId?: string,
  ) {
    const adminId = req.user.id;
    const report = await this.reportsService.generateNoveltyReport(adminId, periodId);
    return {
      message: 'Reporte histórico de novedades generado exitosamente.',
      report,
    };
  }

  // Obtener reporte de cierre de período académico
  @Get('period/:periodId')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async getClosureReport(@Param('periodId', ParseUUIDPipe) periodId: string) {
    return this.reportsService.getClosureReportByPeriod(periodId);
  }

  // Obtener detalles de un reporte específico
  @Get(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async getReportDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.findOne(id);
  }

  // Descarga de reporte en formato PDF
  @Get(':id/download')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async downloadReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { stream, filename } = await this.reportsService.exportToPdfStream(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    stream.pipe(res);
  }
}
