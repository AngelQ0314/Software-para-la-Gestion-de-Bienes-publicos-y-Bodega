import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @ValidateIf((o) => o.correoSecundario !== '' && o.correoSecundario !== null && o.correoSecundario !== undefined)
  @IsEmail({}, { message: 'El correo secundario no es válido' })
  correoSecundario?: string | null;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @Length(7, 15, { message: 'El teléfono debe tener entre 7 y 15 dígitos' })
  telefono?: string;
}
