import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
  ValidateIf,
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
  @ValidateIf((o) => o.correoSecundario !== '' && o.correoSecundario !== null && o.correoSecundario !== undefined)
  @IsEmail({}, { message: 'El correo secundario no es válido' })
  correoSecundario?: string | null;

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
