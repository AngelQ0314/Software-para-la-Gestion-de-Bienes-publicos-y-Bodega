import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';

export class LinkTeachersDto {
  @IsArray({ message: 'Los IDs de los docentes deben enviarse como una lista.' })
  @ArrayNotEmpty({ message: 'Debe proporcionar al menos un ID de docente.' })
  @IsUUID('4', {
    each: true,
    message: 'Cada ID de docente debe ser un UUID válido.',
  })
  teacherIds: string[];
}
