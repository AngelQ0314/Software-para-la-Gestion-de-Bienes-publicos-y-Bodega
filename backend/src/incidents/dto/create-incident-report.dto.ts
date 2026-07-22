import { IsUUID, IsString, IsNotEmpty, IsIn, IsArray, ArrayNotEmpty, MinLength, IsOptional, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class IncidentItemPayloadDto {
  @IsUUID('4', { message: 'El ID del artículo debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El ID del artículo es obligatorio.' })
  itemId: string;

  @IsOptional()
  @IsNumber({}, { message: 'La cantidad afectada debe ser un número.' })
  @Min(1, { message: 'La cantidad afectada debe ser al menos 1.' })
  cantidadAfectada?: number;
}

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
  itemIds: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncidentItemPayloadDto)
  itemsPayload?: IncidentItemPayloadDto[];

  @IsString({ message: 'El estado físico debe ser un texto.' })
  @IsNotEmpty({ message: 'El estado físico es obligatorio.' })
  @IsIn(['BUENO', 'REGULAR', 'MALO'], {
    message: 'El estado físico debe ser BUENO, REGULAR o MALO.',
  })
  estadoFisico: string;
}
