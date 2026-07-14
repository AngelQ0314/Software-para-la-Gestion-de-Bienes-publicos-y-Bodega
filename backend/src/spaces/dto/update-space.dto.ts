import {
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsArray,
  IsOptional,
  IsIn,
} from 'class-validator';
import { SpaceType } from '../entities/physical-space.entity';

export class UpdateSpaceDto {
  @IsString({ message: 'El número de espacio debe ser un texto.' })
  @IsOptional()
  roomNumber?: string;

  @IsString({ message: 'El nombre del espacio debe ser un texto.' })
  @IsOptional()
  name?: string;

  @IsEnum(SpaceType, {
    message: 'El tipo de espacio debe ser uno de: AULA, LABORATORIO, TALLER, OFICINA o BODEGA.',
  })
  @IsOptional()
  type?: SpaceType;

  @IsString({ message: 'La ubicación debe ser un texto.' })
  @IsOptional()
  location?: string;

  @IsInt({ message: 'La capacidad debe ser un número entero.' })
  @Min(1, { message: 'La capacidad mínima debe ser 1 persona.' })
  @Max(500, { message: 'La capacidad máxima permitida es de 500 personas.' })
  @IsOptional()
  capacity?: number;

  @IsArray({ message: 'Las jornadas deben enviarse como una lista.' })
  @IsOptional()
  @IsIn(['MATUTINA', 'VESPERTINA', 'NOCTURNA'], {
    each: true,
    message: 'Cada jornada debe ser una de: MATUTINA, VESPERTINA o NOCTURNA.',
  })
  jornadas?: string[];
}
