import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateSubcategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la subcategoría es requerido.' })
  name: string;

  @IsUUID('4', { message: 'El ID de la categoría padre debe ser un UUID válido.' })
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  categoryName?: string;
}
