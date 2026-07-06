import { IsArray, IsUUID, IsInt, Min, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignItemInfo {
  @IsUUID('4', { message: 'El ID del artículo debe ser un UUID válido.' })
  itemId: string;

  @IsInt({ message: 'La cantidad a asignar debe ser un número entero.' })
  @Min(1, { message: 'La cantidad mínima a asignar debe ser 1.' })
  @IsOptional()
  cantidad?: number;
}

export class AssignItemsDto {
  @IsArray({ message: 'Debe enviar una lista de artículos.' })
  @ValidateNested({ each: true })
  @Type(() => AssignItemInfo)
  items: AssignItemInfo[];
}
