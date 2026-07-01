import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '../entities/user.entity';

export class ChangeStatusDto {
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  @IsEnum(UserStatus, {
    message: 'El estado debe ser ACTIVO, INACTIVO o DADO_DE_BAJA',
  })
  estado: UserStatus;

  @IsOptional()
  @IsString()
  observacion?: string;
}
