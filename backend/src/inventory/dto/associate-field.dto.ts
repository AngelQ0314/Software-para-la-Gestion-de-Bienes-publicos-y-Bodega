import { IsUUID, IsString, IsBoolean, IsInt, Min, IsOptional } from 'class-validator';

export class AssociateFieldDto {
  @IsUUID('4', { message: 'El ID del campo personalizado debe ser un UUID válido.' })
  @IsOptional()
  customFieldId?: string;

  @IsString({ message: 'El nombre técnico del campo debe ser un texto.' })
  @IsOptional()
  customFieldName?: string;

  @IsBoolean({ message: 'El campo isMandatory debe ser booleano.' })
  @IsOptional()
  isMandatory?: boolean = false;

  @IsInt({ message: 'El orden de ordenación debe ser un número entero.' })
  @Min(0, { message: 'El orden de ordenación no puede ser menor a 0.' })
  @IsOptional()
  sortOrder?: number = 0;
}
