import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateCodeTypeDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del tipo de código es requerido.' })
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(20, { message: 'El prefijo no puede exceder los 20 caracteres.' })
  prefix?: string;
}
