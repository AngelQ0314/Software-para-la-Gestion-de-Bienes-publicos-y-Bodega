import { IsNotEmpty, IsIn } from 'class-validator';

export class UpdateIncidentStatusDto {
  @IsNotEmpty({ message: 'El estado del reporte es obligatorio.' })
  @IsIn(['PENDIENTE', 'REVISADO', 'RESUELTO'], {
    message: 'El estado debe ser PENDIENTE, REVISADO o RESUELTO.',
  })
  status: string;
}
