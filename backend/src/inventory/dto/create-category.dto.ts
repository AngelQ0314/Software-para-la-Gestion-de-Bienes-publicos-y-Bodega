import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la categoría es requerido.' })
  name: string;

  @IsUUID('4', { message: 'El ID de la vista de inventario debe ser un UUID válido.' })
  @IsOptional()
  inventoryViewId?: string;

  @IsString()
  @IsOptional()
  inventoryViewCode?: string; // 'BIENES_PUBLICOS', 'INSUMOS', 'BIBLIOTECA'
}
