import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { IncidentReport } from './entities/incident-report.entity';
import { IncidentReportItem } from './entities/incident-report-item.entity';
import { AcademicPeriod } from '../periods/entities/academic-period.entity';
import { PhysicalSpace } from '../spaces/entities/physical-space.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { CreateIncidentReportDto } from './dto/create-incident-report.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
import { InventoryItemShift } from '../spaces/entities/inventory-item-shift.entity';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(IncidentReport)
    private readonly reportRepo: Repository<IncidentReport>,
    @InjectRepository(IncidentReportItem)
    private readonly reportItemRepo: Repository<IncidentReportItem>,
    @InjectRepository(AcademicPeriod)
    private readonly periodRepo: Repository<AcademicPeriod>,
    @InjectRepository(PhysicalSpace)
    private readonly spaceRepo: Repository<PhysicalSpace>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(InventoryItemShift)
    private readonly shiftRepo: Repository<InventoryItemShift>,
  ) {}

  // Registrar reporte de novedades
  async createIncidentReport(dto: CreateIncidentReportDto, teacherId: string): Promise<IncidentReport> {
    // Validar período académico activo
    const activePeriod = await this.periodRepo.findOne({ where: { status: 'ACTIVO' } });
    if (!activePeriod) {
      throw new BadRequestException('No se pueden registrar reportes de novedades porque no hay un período académico activo.');
    }

    // 2. Validar que el espacio físico exista y esté asignado al docente
    const space = await this.spaceRepo.findOne({
      where: { id: dto.spaceId },
      relations: { responsibleTeachers: true },
    });
    if (!space) {
      throw new NotFoundException(`El espacio físico principal no existe.`);
    }

    const isResponsible = space.responsibleTeachers.some((t) => t.id === teacherId);
    if (!isResponsible) {
      throw new BadRequestException('El espacio físico asociado al reporte debe estar bajo tu responsabilidad.');
    }

    // Validar la jornada en el espacio físico
    const hasJornada = space.jornadas.includes(dto.jornada);
    if (!hasJornada) {
      throw new BadRequestException(`La jornada académica ${dto.jornada} no está configurada para este espacio físico.`);
    }

    // Validar que los artículos existan y pertenezcan a ese espacio físico
    const items = await this.itemRepo.find({
      where: {
        id: In(dto.itemIds),
        physicalSpaceId: dto.spaceId,
        status: 'ACTIVO',
      },
    });

    if (items.length !== dto.itemIds.length) {
      throw new BadRequestException(
        'Uno o más artículos seleccionados no existen, están inactivos o no pertenecen a este espacio físico.',
      );
    }

    // Mapa de cantidad afectada si viene en dto.itemsPayload
    const payloadMap = new Map<string, number>();
    if (dto.itemsPayload && dto.itemsPayload.length > 0) {
      for (const p of dto.itemsPayload) {
        payloadMap.set(p.itemId, p.cantidadAfectada || 1);
      }
    }

    // Validar reportes activos por tipo de artículo
    for (const item of items) {
      const itemObj = await this.itemRepo.findOne({
        where: { id: item.id },
        relations: { inventoryView: true, subcategory: { category: { inventoryView: true } } },
      });

      const viewCode = itemObj?.inventoryView?.code || itemObj?.subcategory?.category?.inventoryView?.code;
      const isInsumo = viewCode === 'INSUMOS';

      const activeReportItems = await this.reportItemRepo
        .createQueryBuilder('reportItem')
        .innerJoin('reportItem.incidentReport', 'report')
        .where('reportItem.itemId = :itemId', { itemId: item.id })
        .andWhere('report.spaceId = :spaceId', { spaceId: dto.spaceId })
        .andWhere('report.status IN (:...statuses)', { statuses: ['PENDIENTE', 'REVISADO'] })
        .select('SUM(reportItem.cantidadAfectada)', 'totalNovedad')
        .getRawOne();

      const totalNovedadActiva = Number(activeReportItems?.totalNovedad || 0);

      if (!isInsumo) {
        if (totalNovedadActiva > 0 || (item.estadoFisico && item.estadoFisico !== 'BUENO')) {
          throw new BadRequestException(
            `El artículo '${item.name || item.codeValue}' ya se encuentra con un reporte de novedad activo.`
          );
        }
      } else {
        const cantAfectadaSolicitada = payloadMap.get(item.id) || 1;
        const cantidadBuenEstado = Math.max(0, Number(item.cantidad || 0) - totalNovedadActiva);

        if (cantAfectadaSolicitada > cantidadBuenEstado) {
          throw new BadRequestException(
            `El artículo '${item.name || item.codeValue}' solo tiene ${cantidadBuenEstado} unidades en buen estado disponibles para reportar.`
          );
        }
      }
    }


    // Generar código único auto-incremental
    const year = new Date().getFullYear();
    const count = await this.reportRepo.count();
    const code = `INC-${year}-${String(count + 1).padStart(4, '0')}`;

    // Crear reporte
    const report = this.reportRepo.create({
      code,
      teacherId,
      spaceId: dto.spaceId,
      academicPeriodId: activePeriod.id,
      jornada: dto.jornada,
      description: dto.description.trim(),
      status: 'PENDIENTE',
      estadoFisico: dto.estadoFisico || 'REGULAR',
    });

    const savedReport = await this.reportRepo.save(report);

    // Asociar artículos guardando cantidadAfectada
    const reportItems = dto.itemIds.map((itemId) => {

      const cantAfectada = payloadMap.get(itemId) || 1;
      return this.reportItemRepo.create({
        incidentReportId: savedReport.id,
        itemId,
        cantidadAfectada: cantAfectada,
      });
    });
    await this.reportItemRepo.save(reportItems);

    for (const itemId of dto.itemIds) {
      // 1. Obtener objeto ítem
      const itemObj = await this.itemRepo.findOne({
        where: { id: itemId },
        relations: { inventoryView: true }
      });

      if (itemObj) {
        const isInsumo = itemObj.inventoryView?.code === 'INSUMOS';
        // Para bienes únicos (Bienes Públicos / Biblioteca), actualizamos el estado físico global.
        // Para INSUMOS, NO cambiamos el estadoFisico global del lote.
        if (!isInsumo) {
          itemObj.estadoFisico = dto.estadoFisico || 'REGULAR';
          await this.itemRepo.save(itemObj);
        }
      }

      // 2. Actualizar estado en jornadas (shifts) del espacio físico
      for (const jornada of space.jornadas) {
        let shiftRecord = await this.shiftRepo.findOne({
          where: { itemId, spaceId: dto.spaceId, jornada }
        });

        if (!shiftRecord) {
          shiftRecord = this.shiftRepo.create({
            itemId,
            spaceId: dto.spaceId,
            jornada,
          });
        }

        if (itemObj?.inventoryView?.code !== 'INSUMOS') {
          shiftRecord.estadoFisico = dto.estadoFisico || 'REGULAR';
        }
        shiftRecord.novedades = dto.description.trim();
        await this.shiftRepo.save(shiftRecord);
      }
    }

    return this.findOneIncident(savedReport.id, teacherId, UserRole.DOCENTE);
  }

  // Listar reportes con historial y filtros
  async findIncidents(filters: any, userId: string, userRol: string): Promise<IncidentReport[]> {
    const query = this.reportRepo.createQueryBuilder('report')
      .leftJoinAndSelect('report.teacher', 'teacher')
      .leftJoinAndSelect('report.space', 'space')
      .leftJoinAndSelect('report.academicPeriod', 'academicPeriod')
      .leftJoinAndSelect('report.items', 'reportItems')
      .leftJoinAndSelect('reportItems.item', 'item');

    if (userRol === UserRole.DOCENTE) {
      query.andWhere('report.teacherId = :userId', { userId });
    } else {
      if (filters.teacherId) {
        query.andWhere('report.teacherId = :teacherId', { teacherId: filters.teacherId });
      }
      if (filters.spaceId) {
        query.andWhere('report.spaceId = :spaceId', { spaceId: filters.spaceId });
      }
      if (filters.jornada) {
        query.andWhere('report.jornada = :jornada', { jornada: filters.jornada });
      }
      if (filters.status) {
        query.andWhere('report.status = :status', { status: filters.status });
      }
      if (filters.academicPeriodId) {
        query.andWhere('report.academicPeriodId = :academicPeriodId', { academicPeriodId: filters.academicPeriodId });
      }
    }

    query.orderBy('report.createdAt', 'DESC');
    return query.getMany();
  }

  // Obtener detalle de un reporte individual
  async findOneIncident(id: string, userId: string, userRol: string): Promise<IncidentReport> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: {
        teacher: true,
        space: true,
        academicPeriod: true,
        items: {
          item: {
            subcategory: {
              category: {
                inventoryView: true
              }
            }
          }
        },
      },
    });

    if (!report) {
      throw new NotFoundException(`El reporte de novedad con ID ${id} no existe.`);
    }

    if (userRol === UserRole.DOCENTE && report.teacherId !== userId) {
      throw new ForbiddenException('No tienes permiso para ver este reporte de novedad.');
    }

    return report;
  }

  // Actualizar estado del reporte (Seguimiento Admin)
  async updateIncidentStatus(id: string, dto: UpdateIncidentStatusDto): Promise<IncidentReport> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!report) {
      throw new NotFoundException(`El reporte de novedad con ID ${id} no existe.`);
    }

    report.status = dto.status;
    await this.reportRepo.save(report);

    // Si se resuelve el incidente, restauramos el estado físico de los bienes a 'BUENO' en entidad Item y en todas las jornadas del espacio
    if (dto.status === 'RESUELTO') {
      for (const reportItem of report.items) {
        const itemObj = await this.itemRepo.findOne({
          where: { id: reportItem.itemId },
          relations: { inventoryView: true }
        });
        if (itemObj) {
          itemObj.estadoFisico = 'BUENO';
          await this.itemRepo.save(itemObj);

          // Si es un insumo clonado en un aula, también restaurar el insumo padre en bodega a BUENO
          if (itemObj.physicalSpaceId && itemObj.inventoryView?.code === 'INSUMOS') {
            const parentItem = await this.itemRepo.findOne({
              where: {
                name: itemObj.name,
                codeValue: itemObj.codeValue === null ? IsNull() : itemObj.codeValue,
                physicalSpaceId: IsNull(),
                status: 'ACTIVO',
              }
            });
            if (parentItem) {
              parentItem.estadoFisico = 'BUENO';
              await this.itemRepo.save(parentItem);
            }
          }
        }

        const shifts = await this.shiftRepo.find({
          where: { itemId: reportItem.itemId, spaceId: report.spaceId }
        });

        for (const shiftRecord of shifts) {
          shiftRecord.estadoFisico = 'BUENO';
          shiftRecord.novedades = null;
          await this.shiftRepo.save(shiftRecord);
        }
      }
    }

    return this.findOneIncident(report.id, '', UserRole.ADMINISTRADOR);
  }
}
