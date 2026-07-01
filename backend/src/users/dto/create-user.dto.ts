import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsNotEmpty({ message: 'La cédula es obligatoria' })
  @IsString()
  @Length(10, 10, { message: 'La cédula debe tener exactamente 10 dígitos' })
  @Matches(/^\d+$/, { message: 'La cédula solo debe contener números' })
  cedula: string;

  @IsNotEmpty({ message: 'El correo institucional es obligatorio' })
  @IsEmail({}, { message: 'El correo institucional no es válido' })
  correoInstitucional: string;

  @IsNotEmpty({ message: 'El rol es obligatorio' })
  @IsEnum(UserRole, { message: 'El rol debe ser ADMINISTRADOR o DOCENTE' })
  rol: UserRole;

  @IsNotEmpty({ message: 'Debe asignar al menos un área de clases' })
  @IsString({ each: true, message: 'Cada área debe ser un texto válido' })
  areas: string[];

  @IsOptional()
  @IsString({ each: true, message: 'Cada jornada debe ser un texto válido' })
  jornadas?: string[];

  @IsOptional()
  @IsString({ message: 'El horario de inglés debe ser un texto' })
  horarioIngles?: string;
}
