import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
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
}
