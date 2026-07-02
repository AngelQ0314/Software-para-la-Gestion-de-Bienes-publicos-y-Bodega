import { IsString, IsOptional, IsUUID, IsObject } from 'class-validator';

export class UpdateInventoryItemDto {
  @IsUUID('4', { message: 'El ID de la subcategoría debe ser un UUID válido.' })
  @IsOptional()
  subcategoryId?: string;

  @IsString({ message: 'El nombre de la subcategoría debe ser un texto.' })
  @IsOptional()
  subcategoryName?: string;

  @IsUUID('4', { message: 'El ID del tipo de código debe ser un UUID válido.' })
  @IsOptional()
  codeTypeId?: string;

  @IsString({ message: 'El nombre del tipo de código debe ser un texto.' })
  @IsOptional()
  codeTypeName?: string;

  @IsString()
  @IsOptional()
  codeValue?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsObject({ message: 'Los valores dinámicos deben enviarse como un objeto.' })
  @IsOptional()
  dynamicValues?: Record<string, any>;

  @IsString({ message: 'El estado debe ser un texto.' })
  @IsOptional()
  status?: string;
}
