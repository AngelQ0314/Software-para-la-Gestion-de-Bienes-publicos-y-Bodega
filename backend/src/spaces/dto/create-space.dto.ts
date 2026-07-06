import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  Min,
  IsArray,
  IsUUID,
  IsOptional,
  ArrayNotEmpty,
  IsIn,
} from 'class-validator';
import { SpaceType } from '../entities/physical-space.entity';

export class CreateSpaceDto {
  @IsString({ message: 'El número de espacio debe ser un texto.' })
  @IsNotEmpty({ message: 'El número de espacio es obligatorio.' })
  roomNumber: string;

  @IsString({ message: 'El nombre del espacio debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre del espacio es obligatorio.' })
  name: string;

  @IsEnum(SpaceType, {
    message: 'El tipo de espacio debe ser uno de: AULA, LABORATORIO, TALLER, OFICINA o BODEGA.',
  })
  type: SpaceType;

  @IsString({ message: 'La ubicación debe ser un texto.' })
  @IsNotEmpty({ message: 'La ubicación es obligatoria.' })
  location: string;

  @IsInt({ message: 'La capacidad debe ser un número entero.' })
  @Min(1, { message: 'La capacidad mínima debe ser 1 persona.' })
  capacity: number;

  @IsArray({ message: 'Las jornadas deben enviarse como una lista.' })
  @ArrayNotEmpty({ message: 'Debe configurar al menos una jornada académica.' })
  @IsIn(['MATUTINA', 'VESPERTINA', 'NOCTURNA'], {
    each: true,
    message: 'Cada jornada debe ser una de: MATUTINA, VESPERTINA o NOCTURNA.',
  })
  jornadas: string[];
}
