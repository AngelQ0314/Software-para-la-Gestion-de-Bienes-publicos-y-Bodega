import { IsArray, IsUUID } from 'class-validator';

export class LinkTeachersDto {
  @IsArray({ message: 'Los IDs de los docentes deben enviarse como una lista.' })
  @IsUUID('4', {
    each: true,
    message: 'Cada ID de docente debe ser un UUID válido.',
  })
  teacherIds: string[];
}
