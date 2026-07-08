import { IsUUID, IsString, IsNotEmpty, IsIn, IsArray, ArrayNotEmpty, MinLength } from 'class-validator';

export class CreateIncidentReportDto {
  @IsUUID('4', { message: 'El ID del espacio físico debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El ID del espacio físico es obligatorio.' })
  spaceId: string;

  @IsString({ message: 'La jornada académica debe ser un texto.' })
  @IsNotEmpty({ message: 'La jornada académica es obligatoria.' })
  @IsIn(['MATUTINA', 'VESPERTINA', 'NOCTURNA'], {
    message: 'La jornada académica debe ser MATUTINA, VESPERTINA o NOCTURNA.',
  })
  jornada: string;

  @IsString({ message: 'La descripción de la novedad debe ser un texto.' })
  @IsNotEmpty({ message: 'La descripción de la novedad es obligatoria.' })
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres.' })
  description: string;

  @IsArray({ message: 'Debe proporcionar una lista de IDs de artículos.' })
  @ArrayNotEmpty({ message: 'Debe seleccionar al menos un artículo para reportar la novedad.' })
  @IsUUID('4', {
    each: true,
    message: 'Cada ID de artículo debe ser un UUID válido.',
  })
  itemIds: string[];
}
