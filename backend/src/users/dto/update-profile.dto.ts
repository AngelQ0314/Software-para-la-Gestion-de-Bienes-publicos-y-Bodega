import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsEmail({}, { message: 'El correo secundario no es válido' })
  correoSecundario?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @Length(7, 15, { message: 'El teléfono debe tener entre 7 y 15 dígitos' })
  telefono?: string;
}
