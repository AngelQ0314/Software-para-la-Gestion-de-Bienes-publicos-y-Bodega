import { IsOptional, IsString } from 'class-validator';

export class ResolveRequestDto {
  @IsOptional()
  @IsString({ message: 'El motivo del rechazo debe ser una cadena de texto.' })
  rejectionReason?: string;
}
