import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
    });

    const savedReport = await this.reportRepo.save(report);

    // Asociar artículos y actualizar estado en jornada (shift)
    const reportItems = dto.itemIds.map((itemId) =>
      this.reportItemRepo.create({
        incidentReportId: savedReport.id,
        itemId,
      }),
    );
    await this.reportItemRepo.save(reportItems);

    for (const itemId of dto.itemIds) {
      let shiftRecord = await this.shiftRepo.findOne({
        where: { itemId, spaceId: dto.spaceId, jornada: dto.jornada }
      });

      if (!shiftRecord) {
        shiftRecord = this.shiftRepo.create({
          itemId,
          spaceId: dto.spaceId,
          jornada: dto.jornada,
        });
      }

      shiftRecord.estadoFisico = dto.estadoFisico || 'REGULAR'; // Marcar con el estado físico seleccionado por el docente
      shiftRecord.novedades = dto.description.trim();
      await this.shiftRepo.save(shiftRecord);
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

    // Si se resuelve el incidente, restauramos el estado físico de los bienes a 'BUENO'
    if (dto.status === 'RESUELTO') {
      for (const reportItem of report.items) {
        const shiftRecord = await this.shiftRepo.findOne({
          where: { itemId: reportItem.itemId, spaceId: report.spaceId, jornada: report.jornada }
        });

        if (shiftRecord) {
          shiftRecord.estadoFisico = 'BUENO';
          shiftRecord.novedades = null;
          await this.shiftRepo.save(shiftRecord);
        }
      }
    }

    return this.findOneIncident(report.id, '', UserRole.ADMINISTRADOR);
  }
}
