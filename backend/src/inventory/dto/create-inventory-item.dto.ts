import { IsString, IsNotEmpty, IsUUID, IsObject, IsOptional, IsInt, Min } from 'class-validator';

export class CreateInventoryItemDto {
  @IsUUID('4', { message: 'El ID de la subcategoría debe ser un UUID válido.' })
  @IsOptional()
  subcategoryId?: string;

  @IsString({ message: 'El nombre de la subcategoría debe ser un texto.' })
  @IsOptional()
  subcategoryName?: string;

  @IsString()
  @IsOptional()
  codeValue?: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre del elemento es requerido.' })
  name: string;

  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(0, { message: 'La cantidad no puede ser menor a 0.' })
  @IsOptional()
  cantidad?: number;

  @IsObject({ message: 'Los valores dinámicos deben enviarse como un objeto.' })
  @IsOptional()
  dynamicValues?: Record<string, any> = {};

  @IsString({ message: 'El estado físico debe ser un texto.' })
  @IsOptional()
  estadoFisico?: string;

  @IsString({ message: 'El estado lógico debe ser un texto.' })
  @IsOptional()
  status?: string;

  @IsOptional()
  isPending?: boolean;
}
