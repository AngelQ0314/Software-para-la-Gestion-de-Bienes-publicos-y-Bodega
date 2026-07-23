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
  @IsIn([
    'NUEVO_INVENTARIO',
    'TRASPASO_DOCENTE',
    'TRANSFERENCIA_AULAS',
    'SOLICITUD_EXTERNA',
    'DEVOLUCION_BODEGA',
    'BAJA_DEFINITIVA',
    'MANTENIMIENTO'
  ], {
    message: 'El tipo de solicitud debe ser uno de los 7 tipos válidos.',
  })
  type?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del espacio físico destino debe ser un UUID válido.' })
  destinationSpaceId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del docente destino debe ser un UUID válido.' })
  destinationTeacherId?: string;

  @IsArray({ message: 'Debe enviar una lista de artículos.' })
  @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items: RequestItemDto[];
}
