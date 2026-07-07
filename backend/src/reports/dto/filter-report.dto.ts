import { IsOptional, IsEnum, IsUUID, IsString, IsDateString } from 'class-validator';
import { ReportType } from '../entities/report.entity';

export class FilterReportDto {
  @IsOptional()
  @IsEnum(ReportType, { message: 'El tipo de reporte ingresado no es válido.' })
  type?: ReportType;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del período académico debe ser un UUID válido.' })
  academicPeriodId?: string;

  @IsOptional()
  @IsString({ message: 'La jornada debe ser un texto.' })
  jornada?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe ser una fecha válida.' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe ser una fecha válida.' })
  endDate?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del usuario debe ser un UUID válido.' })
  userId?: string;
}
