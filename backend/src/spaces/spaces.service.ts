import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { PhysicalSpace, SpaceType } from './entities/physical-space.entity';
import { InventoryItemShift } from './entities/inventory-item-shift.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { UserLog, LogType } from '../users/entities/user-log.entity';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { LinkTeachersDto } from './dto/link-teachers.dto';
import { AssignItemsDto } from './dto/assign-items.dto';

@Injectable()
export class SpacesService {
  constructor(
    @InjectRepository(PhysicalSpace)
    private readonly spaceRepo: Repository<PhysicalSpace>,
    @InjectRepository(InventoryItemShift)
    private readonly shiftRepo: Repository<InventoryItemShift>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserLog)
    private readonly userLogRepo: Repository<UserLog>,
  ) {}

  // CREAR ESPACIO FÍSICO
  async createSpace(dto: CreateSpaceDto): Promise<PhysicalSpace> {
    const formattedRoomNumber = dto.roomNumber.toUpperCase().trim();
    const existe = await this.spaceRepo.findOne({ where: { roomNumber: formattedRoomNumber } });
    if (existe) {
      throw new ConflictException(`El número de espacio '${dto.roomNumber}' ya está registrado.`);
    }

    const space = this.spaceRepo.create({
      roomNumber: formattedRoomNumber,
      name: dto.name.toUpperCase().trim(),
      type: dto.type,
      location: dto.location.trim(),
      capacity: dto.capacity,
      jornadas: dto.jornadas,
      responsibleTeachers: [], // Creación pura sin docentes asignados
    });

    return this.spaceRepo.save(space);
  }

  // OBTENER TODOS LOS ESPACIOS
  async findAllSpaces(filters: {
    roomNumber?: string;
    name?: string;
    type?: SpaceType;
    location?: string;
  }): Promise<PhysicalSpace[]> {
    const query = this.spaceRepo
      .createQueryBuilder('space')
      .leftJoinAndSelect('space.responsibleTeachers', 'responsibleTeachers')
      .leftJoinAndSelect('space.items', 'items')
      .leftJoinAndSelect('items.codeType', 'codeType')
      .orderBy('space.roomNumber', 'ASC');

    if (filters.roomNumber) {
      query.andWhere('space.roomNumber ILIKE :roomNumber', { roomNumber: `%${filters.roomNumber}%` });
    }

    if (filters.name) {
      query.andWhere('space.name ILIKE :name', { name: `%${filters.name}%` });
    }

    if (filters.type) {
      query.andWhere('space.type = :type', { type: filters.type });
    }

    if (filters.location) {
      query.andWhere('space.location ILIKE :location', { location: `%${filters.location}%` });
    }

    return query.getMany();
  }

  // OBTENER UN ESPACIO POR ID
  async findOneSpace(id: string): Promise<PhysicalSpace> {
    const space = await this.spaceRepo.findOne({
      where: { id },
      relations: {
        responsibleTeachers: true,
        items: {
          codeType: true,
        },
      },
    });

    if (!space) {
      throw new NotFoundException(`El espacio físico con ID '${id}' no existe.`);
    }

    return space;
  }

  // ACTUALIZAR ESPACIO FÍSICO (CAMPOS OPCIONALES)
  async updateSpace(id: string, dto: UpdateSpaceDto): Promise<PhysicalSpace> {
    const space = await this.spaceRepo.findOne({
      where: { id },
    });
    if (!space) {
      throw new NotFoundException(`El espacio físico con ID '${id}' no existe.`);
    }

    if (dto.roomNumber !== undefined) {
      const formattedRoomNumber = dto.roomNumber.toUpperCase().trim();
      const existe = await this.spaceRepo.findOne({ where: { roomNumber: formattedRoomNumber } });
      if (existe && existe.id !== id) {
        throw new ConflictException(`El número de espacio '${dto.roomNumber}' ya está registrado por otro espacio.`);
      }
      space.roomNumber = formattedRoomNumber;
    }

    if (dto.name !== undefined) {
      space.name = dto.name.toUpperCase().trim();
    }

    if (dto.type !== undefined) {
      space.type = dto.type;
    }

    if (dto.location !== undefined) {
      space.location = dto.location.trim();
    }

    if (dto.capacity !== undefined) {
      space.capacity = dto.capacity;
    }

    let savedSpace: PhysicalSpace;

    if (dto.jornadas !== undefined) {
      const oldJornadas = space.jornadas;
      const newJornadas = dto.jornadas;
      space.jornadas = newJornadas;

      savedSpace = await this.spaceRepo.save(space);

      // Actualizar jornadas dinámicamente para los artículos actuales del aula
      const addedJornadas = newJornadas.filter((j) => !oldJornadas.includes(j));
      const removedJornadas = oldJornadas.filter((j) => !newJornadas.includes(j));

      // Eliminar estados de jornadas removidas
      if (removedJornadas.length > 0) {
        await this.shiftRepo.delete({
          spaceId: id,
          jornada: In(removedJornadas),
        });
      }

      // Inicializar estados de jornadas nuevas
      if (addedJornadas.length > 0) {
        const items = await this.itemRepo.find({ where: { physicalSpaceId: id } });
        for (const item of items) {
          for (const jornada of addedJornadas) {
            const existeShift = await this.shiftRepo.findOne({
              where: { spaceId: id, itemId: item.id, jornada },
            });
            if (!existeShift) {
              const nuevoShift = this.shiftRepo.create({
                spaceId: id,
                itemId: item.id,
                jornada,
                estadoFisico: 'BUENO',
              });
              await this.shiftRepo.save(nuevoShift);
            }
          }
        }
      }
    } else {
      savedSpace = await this.spaceRepo.save(space);
    }

    return savedSpace;
  }

  // ELIMINAR ESPACIO FÍSICO (CON RESTRICCIÓN DE SEGURIDAD)
  async deleteSpace(id: string): Promise<void> {
    const space = await this.spaceRepo.findOne({
      where: { id },
      relations: { responsibleTeachers: true, items: true },
    });

    if (!space) {
      throw new NotFoundException(`El espacio físico con ID '${id}' no existe.`);
    }

    // Restricción: No poder eliminar un espacio si tiene docentes o items vinculados
    if (space.responsibleTeachers.length > 0 || space.items.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar el espacio físico porque tiene docentes responsables o artículos de inventario vinculados. Desvincúlelos primero.',
      );
    }

    // Limpiar registros de jornadas antes de eliminar el espacio
    await this.shiftRepo.delete({ spaceId: id });
    await this.spaceRepo.remove(space);
  }

  // VINCULAR DOCENTES A UN ESPACIO FÍSICO
  async linkTeachersToSpace(spaceId: string, dto: LinkTeachersDto): Promise<void> {
    const space = await this.spaceRepo.findOne({
      where: { id: spaceId },
      relations: { responsibleTeachers: true },
    });
    if (!space) {
      throw new NotFoundException(`El espacio físico no existe.`);
    }

    const teachers = await this.userRepo.find({
      where: {
        id: In(dto.teacherIds),
        rol: UserRole.DOCENTE,
      },
    });

    if (teachers.length !== dto.teacherIds.length) {
      throw new BadRequestException('Uno o varios IDs de docentes no son válidos o no pertenecen al rol DOCENTE.');
    }

    // Validación de Estado Activo y recuperación de justificación
    for (const teacher of teachers) {
      if (teacher.estado !== UserStatus.ACTIVO) {
        const lastLog = await this.userLogRepo.findOne({
          where: {
            userId: teacher.id,
            tipoCambio: LogType.CAMBIO_ESTADO,
          },
          order: { createdAt: 'DESC' },
        });

        const observacion = lastLog?.observacion || 'Sin observaciones registradas.';
        throw new BadRequestException(
          `El docente '${teacher.nombres || ''} ${teacher.apellidos || ''}' está inactivo (${teacher.estado}). Motivo: "${observacion}"`,
        );
      }
    }

    // Vincular al espacio (evitar duplicados)
    const currentTeacherIds = space.responsibleTeachers.map((t) => t.id);
    for (const teacher of teachers) {
      if (!currentTeacherIds.includes(teacher.id)) {
        space.responsibleTeachers.push(teacher);
      }
    }

    await this.spaceRepo.save(space);
  }

  // DESVINCULAR UN DOCENTE DE UN ESPACIO FÍSICO
  async unlinkTeacherFromSpace(spaceId: string, teacherId: string): Promise<void> {
    const space = await this.spaceRepo.findOne({
      where: { id: spaceId },
      relations: { responsibleTeachers: true },
    });
    if (!space) {
      throw new NotFoundException(`El espacio físico no existe.`);
    }

    const teacherIndex = space.responsibleTeachers.findIndex((t) => t.id === teacherId);
    if (teacherIndex === -1) {
      throw new NotFoundException(`El docente no está vinculado a este espacio físico.`);
    }

    space.responsibleTeachers.splice(teacherIndex, 1);
    await this.spaceRepo.save(space);
  }

  // ASIGNAR ARTÍCULOS A UN ESPACIO (CON SOPORTE DE FRACCIONAMIENTO PARA INSUMOS)
  async assignItemsToSpace(spaceId: string, dto: AssignItemsDto): Promise<void> {
    const space = await this.spaceRepo.findOne({ where: { id: spaceId } });
    if (!space) {
      throw new NotFoundException(`El espacio físico no existe.`);
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debe proporcionar al menos un artículo a asignar.');
    }

    for (const assignInfo of dto.items) {
      const item = await this.itemRepo.findOne({
        where: { id: assignInfo.itemId, status: 'ACTIVO' },
        relations: { inventoryView: true },
      });

      if (!item) {
        throw new NotFoundException(
          `El artículo con ID '${assignInfo.itemId}' no existe o no está activo.`,
        );
      }

      const isInsumo = item.inventoryView?.code === 'INSUMOS';

      if (!isInsumo) {
        // BIENES PÚBLICOS / BIBLIOTECA: Asignación normal completa
        if (item.physicalSpaceId && item.physicalSpaceId !== spaceId) {
          await this.shiftRepo.delete({
            spaceId: item.physicalSpaceId,
            itemId: item.id,
          });
        }

        item.physicalSpaceId = spaceId;
        await this.itemRepo.save(item);

        // Inicializar jornadas
        for (const jornada of space.jornadas) {
          const existeShift = await this.shiftRepo.findOne({
            where: { spaceId, itemId: item.id, jornada },
          });

          if (!existeShift) {
            const shift = this.shiftRepo.create({
              spaceId,
              itemId: item.id,
              jornada,
              estadoFisico: 'BUENO',
              observacion: null,
              novedades: null,
            });
            await this.shiftRepo.save(shift);
          }
        }
      } else {
        // INSUMOS: Lógica de fraccionamiento de stock
        const cantidadAsignar = assignInfo.cantidad ?? item.cantidad;

        if (cantidadAsignar <= 0) {
          throw new BadRequestException(
            `La cantidad a asignar del insumo '${item.name}' debe ser mayor a 0.`,
          );
        }

        if (item.cantidad < cantidadAsignar) {
          throw new BadRequestException(
            `Cantidad insuficiente de '${item.name}'. Cantidad disponible en inventario: ${item.cantidad}.`,
          );
        }

        // Restar de la bodega general
        item.cantidad -= cantidadAsignar;
        await this.itemRepo.save(item);

        // Verificar si ya existe un registro de este mismo insumo asignado a este espacio
        const existingSpaceItem = await this.itemRepo.findOne({
          where: {
            name: item.name,
            codeTypeId: item.codeTypeId,
            codeValue: item.codeValue === null ? IsNull() : item.codeValue,
            physicalSpaceId: spaceId,
            status: 'ACTIVO',
          },
        });

        if (existingSpaceItem) {
          // Si ya existe en el aula, sumamos la cantidad directamente al registro existente
          existingSpaceItem.cantidad += cantidadAsignar;
          await this.itemRepo.save(existingSpaceItem);
        } else {
          // Si no existe, creamos la fila clonada y asociamos jornadas normalmente
          const spaceItem = this.itemRepo.create({
            ...item,
            id: undefined, // TypeORM generará un nuevo UUID
            createdAt: undefined,
            updatedAt: undefined,
            cantidad: cantidadAsignar,
            physicalSpaceId: spaceId,
          });

          const savedSpaceItem = await this.itemRepo.save(spaceItem);

          // Inicializar jornadas para este nuevo registro
          for (const jornada of space.jornadas) {
            const shift = this.shiftRepo.create({
              spaceId,
              itemId: savedSpaceItem.id,
              jornada,
              estadoFisico: 'BUENO',
              observacion: null,
              novedades: null,
            });
            await this.shiftRepo.save(shift);
          }
        }
      }
    }
  }

  // DESASOCIAR UN ARTÍCULO DEL ESPACIO
  async removeItemFromSpace(spaceId: string, itemId: string): Promise<void> {
    const space = await this.spaceRepo.findOne({ where: { id: spaceId } });
    if (!space) {
      throw new NotFoundException(`El espacio físico no existe.`);
    }

    const item = await this.itemRepo.findOne({
      where: { id: itemId, physicalSpaceId: spaceId },
      relations: { inventoryView: true },
    });

    if (!item) {
      throw new NotFoundException(`El artículo no se encuentra asignado a este espacio físico.`);
    }

    const isInsumo = item.inventoryView?.code === 'INSUMOS';

    if (!isInsumo) {
      // Bienes / Biblioteca: Limpiar asignación de espacio física
      item.physicalSpaceId = null;
      await this.itemRepo.save(item);
    } else {
      // INSUMOS: Consolidar de vuelta la cantidad en el stock general
      const generalItem = await this.itemRepo.findOne({
        where: {
          name: item.name,
          codeTypeId: item.codeTypeId,
          codeValue: item.codeValue === null ? IsNull() : item.codeValue,
          physicalSpaceId: IsNull(),
          status: 'ACTIVO',
        },
      });

      if (generalItem) {
        generalItem.cantidad += item.cantidad;
        await this.itemRepo.save(generalItem);
        // Eliminar físicamente el registro clonado del aula
        await this.itemRepo.remove(item);
      } else {
        // Si no existe stock general, el lote del aula vuelve a ser general (bodega)
        item.physicalSpaceId = null;
        await this.itemRepo.save(item);
      }
    }

    // Eliminar los históricos de jornadas asociados a este ítem en el espacio
    await this.shiftRepo.delete({
      spaceId,
      itemId,
    });
  }

  // OBTENER INVENTARIO DEL ESPACIO FILTRADO POR JORNADA
  async getSpaceInventoryByShift(spaceId: string, jornada: string): Promise<any[]> {
    const space = await this.spaceRepo.findOne({ where: { id: spaceId } });
    if (!space) {
      throw new NotFoundException(`El espacio físico no existe.`);
    }

    const normalizedJornada = jornada.toUpperCase().trim();
    if (!space.jornadas.includes(normalizedJornada)) {
      throw new BadRequestException(
        `La jornada '${jornada}' no está configurada para este espacio. Jornadas habilitadas: ${space.jornadas.join(', ')}`,
      );
    }

    const items = await this.itemRepo.find({
      where: { physicalSpaceId: spaceId, status: 'ACTIVO' },
      relations: { codeType: true },
      order: { name: 'ASC' },
    });

    const shifts = await this.shiftRepo.find({
      where: { spaceId, jornada: normalizedJornada },
    });

    return items.map((item) => {
      const shiftInfo = shifts.find((s) => s.itemId === item.id);
      return {
        id: item.id,
        name: item.name,
        codeValue: item.codeValue,
        codeType: item.codeType,
        cantidad: item.cantidad,
        jornada: normalizedJornada,
        estadoFisico: shiftInfo ? shiftInfo.estadoFisico : 'BUENO',
        observacion: shiftInfo ? shiftInfo.observacion : null,
        novedades: shiftInfo ? shiftInfo.novedades : null,
      };
    });
  }
}
