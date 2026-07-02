import { IsString, IsEnum, IsArray, IsOptional } from 'class-validator';
import { CustomFieldType } from '../entities/custom-field.entity';

export class UpdateCustomFieldDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsEnum(CustomFieldType, {
    message: 'El tipo debe ser: TEXT, NUMBER_INT, NUMBER_DECIMAL, DATE, o OPTIONS_LIST',
  })
  @IsOptional()
  type?: CustomFieldType;

  @IsArray({ message: 'Las opciones deben ser una lista (array) de textos.' })
  @IsString({ each: true, message: 'Cada opción en la lista debe ser un texto.' })
  @IsOptional()
  options?: string[];
}
