import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Los nombres deben ser texto' })
  nombres?: string;

  @IsOptional()
  @IsString({ message: 'Los apellidos deben ser texto' })
  apellidos?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo secundario no es válido' })
  correoSecundario?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @Length(7, 15, { message: 'El teléfono debe tener entre 7 y 15 dígitos' })
  telefono?: string;

  @IsOptional()
  @IsString({ each: true, message: 'Cada área debe ser un texto válido' })
  areas?: string[];

  @IsOptional()
  @IsString({ each: true, message: 'Cada jornada debe ser un texto válido' })
  jornadas?: string[];

  @IsOptional()
  @IsString({ message: 'El horario de inglés debe ser un texto' })
  horarioIngles?: string;
}
