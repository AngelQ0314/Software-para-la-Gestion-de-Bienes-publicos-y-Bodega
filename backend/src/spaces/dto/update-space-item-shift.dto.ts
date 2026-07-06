import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class UpdateSpaceItemShiftDto {
  @IsString({ message: 'La jornada debe ser un texto.' })
  @IsNotEmpty({ message: 'La jornada es obligatoria.' })
  @IsIn(['MATUTINA', 'VESPERTINA', 'NOCTURNA'], {
    message: 'La jornada debe ser una de: MATUTINA, VESPERTINA o NOCTURNA.',
  })
  jornada: string;

  @IsString({ message: 'El estado físico debe ser un texto.' })
  @IsNotEmpty({ message: 'El estado físico es obligatorio.' })
  @IsIn(['BUENO', 'REGULAR', 'MALO'], {
    message: 'El estado físico debe ser uno de: BUENO, REGULAR o MALO.',
  })
  estadoFisico: string;

  @IsString({ message: 'La observación debe ser un texto.' })
  @IsOptional()
  observacion?: string;

  @IsString({ message: 'Las novedades deben ser un texto.' })
  @IsOptional()
  novedades?: string;
}
