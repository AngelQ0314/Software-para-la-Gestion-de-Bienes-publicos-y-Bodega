import { IsArray, IsUUID, IsInt, Min, IsOptional, ValidateNested, IsString, IsNotEmpty, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class RequestItemDto {
  @IsUUID('4', { message: 'El ID del artículo debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El ID del artículo es obligatorio.' })
  itemId: string;

  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad mínima solicitada debe ser 1.' })
  cantidad: number;
}

export class CreateRequestDto {
  @IsUUID('4', { message: 'El ID del espacio físico debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El ID del espacio físico es obligatorio.' })
  spaceId: string;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto.' })
  motive?: string;

  @IsOptional()
  @IsIn(['NUEVO_INVENTARIO', 'TRANSFERENCIA', 'TRASPASO_DOCENTE', 'SOLICITUD_TRASPASO'], {
    message: 'El tipo de solicitud debe ser NUEVO_INVENTARIO, TRANSFERENCIA, TRASPASO_DOCENTE o SOLICITUD_TRASPASO.',
  })
  type?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del espacio físico destino debe ser un UUID válido.' })
  destinationSpaceId?: string;

  @IsArray({ message: 'Debe enviar una lista de artículos.' })
  @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items: RequestItemDto[];
}
