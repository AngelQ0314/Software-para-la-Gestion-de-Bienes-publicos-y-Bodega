import { IsString, IsNotEmpty, IsEnum, IsArray, IsOptional } from 'class-validator';
import { CustomFieldType } from '../entities/custom-field.entity';

export class CreateCustomFieldDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre técnico del campo es requerido.' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'La etiqueta del campo es requerida.' })
  label: string;

  @IsEnum(CustomFieldType, {
    message: 'El tipo debe ser: TEXT, NUMBER_INT, NUMBER_DECIMAL, DATE, o OPTIONS_LIST',
  })
  type: CustomFieldType;

  @IsArray({ message: 'Las opciones deben ser una lista (array) de textos.' })
  @IsString({ each: true, message: 'Cada opción en la lista debe ser un texto.' })
  @IsOptional()
  options?: string[]; // Obligatorio únicamente si es OPTIONS_LIST
}
