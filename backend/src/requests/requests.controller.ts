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
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { ResolveRequestDto } from './dto/resolve-request.dto';
import { Response } from 'express';

@Controller('requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  // CREAR SOLICITUD (DOCENTE)
  @Post()
  @Roles(UserRole.DOCENTE)
  async createRequest(@Body() dto: CreateRequestDto, @Request() req) {
    const teacherId = req.user.id;
    return this.requestsService.createRequest(dto, teacherId);
  }

  // CONSULTAR TODAS LAS SOLICITUDES CON FILTROS (ADMINISTRADOR y RESPONSABLE DE BIENES)
  @Get()
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async getAllRequests(
    @Query('teacherId') teacherId?: string,
    @Query('status') status?: string,
    @Query('academicPeriodId') academicPeriodId?: string,
    @Query('spaceId') spaceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.requestsService.findAllRequests({
      teacherId,
      status,
      academicPeriodId,
      spaceId,
      startDate,
      endDate,
    });
  }

  // DETALLE COMPLETO DE UNA SOLICITUD
  @Get(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async getRequestById(@Param('id', ParseUUIDPipe) id: string) {
    return this.requestsService.findRequestById(id);
  }

  // APROBAR SOLICITUD (ADMINISTRADOR)
  @Post(':id/approve')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async approveRequest(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const adminId = req.user.id;
    const requestObj = await this.requestsService.approveRequest(id, adminId);
    return {
      message: 'Solicitud aprobada correctamente. El acta de entrega-recepción ha sido generada y el stock actualizado.',
      request: requestObj,
    };
  }

  // RECHAZAR SOLICITUD (ADMINISTRADOR)
  @Post(':id/reject')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async rejectRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveRequestDto,
    @Request() req,
  ) {
    const adminId = req.user.id;
    const requestObj = await this.requestsService.rejectRequest(id, adminId, dto);
    return {
      message: 'Solicitud rechazada correctamente y motivo archivado.',
      request: requestObj,
    };
  }

  // VISUALIZAR / DESCARGAR ACTA DE RECEPCIÓN (PDF)
  @Get(':id/acta')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async downloadActa(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { stream, filename } = await this.requestsService.getActPdfStream(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    stream.pipe(res);
  }
}
