import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PeriodsService } from './periods.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CreatePeriodDto } from './dto/create-period.dto';

@Controller('periods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Post()
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async createPeriod(@Body() dto: CreatePeriodDto) {
    return this.periodsService.createPeriod(dto);
  }

  @Get()
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async getAllPeriods() {
    return this.periodsService.findAllPeriods();
  }

  @Get(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async getPeriodById(@Param('id', ParseUUIDPipe) id: string) {
    return this.periodsService.findPeriodById(id);
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async activatePeriod(@Param('id', ParseUUIDPipe) id: string) {
    const period = await this.periodsService.activatePeriod(id);
    return {
      message: `Período académico '${period.name}' activado con éxito. Los artículos pendientes han sido incorporados.`,
      period,
    };
  }

  @Post(':id/close')
  @Roles(UserRole.ADMINISTRADOR, UserRole.RESPONSABLE_DE_BIENES)
  async closePeriod(@Param('id', ParseUUIDPipe) id: string) {
    const period = await this.periodsService.closePeriod(id);
    return {
      message: `Período académico '${period.name}' cerrado con éxito. El reporte histórico ha sido generado.`,
      period,
    };
  }
}
