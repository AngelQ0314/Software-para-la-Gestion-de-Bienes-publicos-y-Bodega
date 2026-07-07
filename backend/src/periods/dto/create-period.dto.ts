import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class CreatePeriodDto {
  @IsNotEmpty({ message: 'El nombre del período es obligatorio.' })
  @IsString({ message: 'El nombre del período debe ser una cadena de texto.' })
  name: string;

  @IsNotEmpty({ message: 'La fecha de inicio es obligatoria.' })
  @IsDateString({}, { message: 'La fecha de inicio debe ser una fecha válida (formato ISO).' })
  startDate: string;

  @IsNotEmpty({ message: 'La fecha de finalización es obligatoria.' })
  @IsDateString({}, { message: 'La fecha de finalización debe ser una fecha válida (formato ISO).' })
  endDate: string;
}
