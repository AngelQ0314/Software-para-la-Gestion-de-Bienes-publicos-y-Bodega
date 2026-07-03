import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
} from 'class-validator';

export class CompleteProfileDto {
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  @IsString()
  @MaxLength(100)
  apellidos: string;

  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  @IsString()
  @MaxLength(100)
  nombres: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo secundario no es válido' })
  correoSecundario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  telefono?: string;

  @IsOptional()
  @IsArray({ message: 'Las áreas deben ser un arreglo de textos' })
  areas?: string[];

  @IsOptional()
  @IsArray({ message: 'Las jornadas deben ser un arreglo de textos' })
  jornadas?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  horarioIngles?: string;
}
