import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { Report, ReportType } from './entities/report.entity';
import { ClosureReport } from './entities/closure-report.entity';
import { FilterReportDto } from './dto/filter-report.dto';
import { AcademicPeriod } from '../periods/entities/academic-period.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { PhysicalSpace } from '../spaces/entities/physical-space.entity';
import { InventoryItemShift } from '../spaces/entities/inventory-item-shift.entity';
import { User } from '../users/entities/user.entity';
import { UserLog } from '../users/entities/user-log.entity';
import { IncidentReport } from '../incidents/entities/incident-report.entity';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(ClosureReport)
    private readonly closureReportRepo: Repository<ClosureReport>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(PhysicalSpace)
    private readonly spaceRepo: Repository<PhysicalSpace>,
    @InjectRepository(InventoryItemShift)
    private readonly shiftRepo: Repository<InventoryItemShift>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserLog)
    private readonly userLogRepo: Repository<UserLog>,
  ) {}

  // RP005, RP006: Consulta e historial con filtros
  async findAll(filters: FilterReportDto): Promise<Report[]> {
    const where: any = {};

    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.academicPeriodId) {
      where.academicPeriodId = filters.academicPeriodId;
    }
    if (filters.jornada) {
      where.jornada = filters.jornada.toUpperCase();
    }

    // Filtros de fecha
    if (filters.startDate && filters.endDate) {
      where.generatedAt = Between(new Date(filters.startDate), new Date(filters.endDate));
    } else if (filters.startDate) {
      where.generatedAt = MoreThanOrEqual(new Date(filters.startDate));
    } else if (filters.endDate) {
      where.generatedAt = LessThanOrEqual(new Date(filters.endDate));
    }

    const reports = await this.reportRepo.find({
      where,
      relations: { academicPeriod: true, generatedBy: true },
      order: { generatedAt: 'DESC' },
    });

    // Filtrar por usuario relacionado en memoria si se provee
    if (filters.userId) {
      return reports.filter((rep) => {
        if (rep.generatedById === filters.userId) return true;
        // Si es de gestión de usuarios, ver si el afectado es el userId
        if (rep.type === ReportType.GESTION_USUARIOS && rep.reportData?.targetUser?.id === filters.userId) {
          return true;
        }
        return false;
      });
    }

    return reports;
  }

  async findOne(id: string): Promise<Report> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: { academicPeriod: true, generatedBy: true },
    });
    if (!report) {
      throw new NotFoundException('El reporte especificado no existe.');
    }
    return report;
  }

  // Obtener el reporte consolidado de cierre de un período académico
  async getClosureReportByPeriod(periodId: string): Promise<Report> {
    const report = await this.reportRepo.findOne({
      where: { academicPeriodId: periodId, type: ReportType.PERIODO_ACADEMICO },
      relations: { academicPeriod: true, generatedBy: true },
    });
    if (!report) {
      throw new NotFoundException('El reporte de cierre para este período académico no existe o no ha sido generado.');
    }
    return report;
  }

  // RP001, RP002: Generación automática de reporte de cierre y reportes por jornada
  async generateClosureAndShiftReports(period: AcademicPeriod, adminId?: string): Promise<void> {
    const admin = adminId ? await this.userRepo.findOne({ where: { id: adminId } }) : null;

    // 1. Recopilar datos de Bodega (items sin espacio asignado en este período)
    const itemsBodega = await this.itemRepo.find({
      where: { physicalSpaceId: IsNull(), status: 'ACTIVO' },
      relations: { codeType: true, subcategory: { category: { inventoryView: true } } },
    });

    // 2. Recopilar datos de Espacios Físicos
    const spaces = await this.spaceRepo.find({
      relations: {
        responsibleTeachers: true,
        items: {
          codeType: true,
          subcategory: { category: { inventoryView: true } },
        },
      },
    });

    // 3. Recopilar históricos de jornadas
    const shifts = await this.shiftRepo.find({
      relations: {
        item: { codeType: true },
        space: true,
      },
    });

    // 4. Armar el JSON consolidado inmutable
    const reportData = {
      periodInfo: {
        id: period.id,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        closedAt: period.closedAt || new Date(),
        typeOfClosure: adminId ? 'MANUAL' : 'AUTOMATICO',
      },
      bodega: itemsBodega.map((i) => ({
        id: i.id,
        name: i.name,
        codeValue: i.codeValue,
        codeType: i.codeType?.name || '',
        codePrefix: i.codeType?.prefix || '',
        view: i.inventoryView?.name || '',
        subcategory: i.subcategory?.name || '',
        category: i.subcategory?.category?.name || '',
        cantidad: i.cantidad,
        dynamicValues: i.dynamicValues,
      })),
      spaces: spaces.map((s) => ({
        id: s.id,
        roomNumber: s.roomNumber,
        name: s.name,
        type: s.type,
        location: s.location,
        capacity: s.capacity,
        jornadas: s.jornadas,
        teachers: s.responsibleTeachers.map((t) => ({
          cedula: t.cedula,
          nombres: t.nombres,
          apellidos: t.apellidos,
          correo: t.correoInstitucional,
        })),
        items: s.items.map((i) => ({
          id: i.id,
          name: i.name,
          codeValue: i.codeValue,
          codeType: i.codeType?.name || '',
          view: i.inventoryView?.name || '',
          subcategory: i.subcategory?.name || '',
          category: i.subcategory?.category?.name || '',
          cantidad: i.cantidad,
          dynamicValues: i.dynamicValues,
        })),
      })),
      shifts: shifts.map((sh) => ({
        id: sh.id,
        spaceName: sh.space?.name || '',
        spaceRoom: sh.space?.roomNumber || '',
        itemName: sh.item?.name || '',
        itemCode: sh.item?.codeValue || '',
        jornada: sh.jornada,
        estadoFisico: sh.estadoFisico,
        observacion: sh.observacion,
        novedades: sh.novedades,
      })),
    };

    const reportCode = `REP-PERIODO-${period.name.replace(/\s+/g, '-').toUpperCase()}`;

    // A. Guardar o actualizar en la tabla closure_reports
    let closureReport = await this.closureReportRepo.findOne({ where: { academicPeriodId: period.id } });
    if (!closureReport) {
      closureReport = this.closureReportRepo.create({
        academicPeriodId: period.id,
        code: reportCode,
        reportData,
        generatedAt: new Date(),
      });
    } else {
      closureReport.reportData = reportData;
      closureReport.generatedAt = new Date();
    }
    await this.closureReportRepo.save(closureReport);

    // B. Registrar el reporte consolidado en la tabla de historial de reportes general
    let reportPeriod = await this.reportRepo.findOne({ where: { code: reportCode } });
    if (!reportPeriod) {
      reportPeriod = this.reportRepo.create({
        code: reportCode,
        type: ReportType.PERIODO_ACADEMICO,
        academicPeriodId: period.id,
        reportData,
        generatedById: adminId || null,
        generatedAt: new Date(),
      });
    } else {
      reportPeriod.reportData = reportData;
      reportPeriod.generatedById = adminId || null;
      reportPeriod.generatedAt = new Date();
    }
    await this.reportRepo.save(reportPeriod);

    // C. RP002: Generar automáticamente reportes independientes por cada jornada (MATUTINA, VESPERTINA, NOCTURNA)
    const jornadas = ['MATUTINA', 'VESPERTINA', 'NOCTURNA'];
    for (const jor of jornadas) {
      const jorShifts = reportData.shifts.filter((sh) => sh.jornada === jor);
      const jorSpaces = reportData.spaces.filter((sp) => sp.jornadas && sp.jornadas.includes(jor));

      const jorReportData = {
        periodInfo: reportData.periodInfo,
        jornada: jor,
        spaces: jorSpaces.map((sp) => ({
          roomNumber: sp.roomNumber,
          name: sp.name,
          teachers: sp.teachers,
          items: sp.items,
        })),
        shifts: jorShifts,
      };

      const jorCode = `REP-JOR-${jor}-${period.name.replace(/\s+/g, '-').toUpperCase()}`;

      let reportJor = await this.reportRepo.findOne({ where: { code: jorCode } });
      if (!reportJor) {
        reportJor = this.reportRepo.create({
          code: jorCode,
          type: ReportType.JORNADA,
          academicPeriodId: period.id,
          jornada: jor,
          reportData: jorReportData,
          generatedById: adminId || null,
          generatedAt: new Date(),
        });
      } else {
        reportJor.reportData = jorReportData;
        reportJor.generatedById = adminId || null;
        reportJor.generatedAt = new Date();
      }
      await this.reportRepo.save(reportJor);
    }
  }

  // RP003: Reportes de gestión de usuarios automático
  async registerUserStatusReport(userLog: UserLog): Promise<void> {
    const log = await this.userLogRepo.findOne({
      where: { id: userLog.id },
      relations: { admin: true, user: true },
    });

    if (!log) return;

    const reportCode = `REP-USR-${log.id.substring(0, 8).toUpperCase()}-${Date.now().toString().substring(6)}`;
    const reportData = {
      logId: log.id,
      tipoCambio: log.tipoCambio,
      valorAnterior: log.valorAnterior || 'N/A',
      valorNuevo: log.valorNuevo || 'N/A',
      observacion: log.observacion || 'Sin observación',
      createdAt: log.createdAt,
      admin: {
        id: log.admin?.id || '',
        nombres: log.admin?.nombres || '',
        apellidos: log.admin?.apellidos || '',
        cedula: log.admin?.cedula || '',
        rol: log.admin?.rol || '',
      },
      targetUser: {
        id: log.user?.id || '',
        nombres: log.user?.nombres || '',
        apellidos: log.user?.apellidos || '',
        cedula: log.user?.cedula || '',
        rol: log.user?.rol || '',
        correo: log.user?.correoInstitucional || '',
      },
    };

    const report = this.reportRepo.create({
      code: reportCode,
      type: ReportType.GESTION_USUARIOS,
      reportData,
      generatedById: log.adminId,
      generatedAt: log.createdAt,
    });

    await this.reportRepo.save(report);
  }

  // RP004: Consulta de reportes de novedades activas en los espacios
  async getActiveNovelties(): Promise<any[]> {
    const shifts = await this.shiftRepo.find({
      relations: { item: { codeType: true }, space: { responsibleTeachers: true } },
    });

    // Filtrar novedades: estado físico no es BUENO o campo novedades no está vacío
    const noveltiesShifts = shifts.filter(
      (sh) => sh.estadoFisico !== 'BUENO' || (sh.novedades && sh.novedades.trim().length > 0),
    );

    return noveltiesShifts.map((sh) => ({
      id: sh.id,
      jornada: sh.jornada,
      estadoFisico: sh.estadoFisico,
      observacion: sh.observacion,
      novedades: sh.novedades,
      reportedAt: sh.updatedAt,
      item: {
        id: sh.item?.id,
        name: sh.item?.name,
        codeValue: sh.item?.codeValue,
        codeType: sh.item?.codeType?.name,
      },
      space: {
        id: sh.space?.id,
        name: sh.space?.name,
        roomNumber: sh.space?.roomNumber,
        teachers: sh.space?.responsibleTeachers?.map((t) => `${t.nombres} ${t.apellidos}`) || [],
      },
    }));
  }

  // Generar un reporte consolidado de novedades histórico
  async generateNoveltyReport(adminId: string, periodId?: string): Promise<Report> {
    const activeNovelties = await this.getActiveNovelties();

    let period: AcademicPeriod | null = null;
    if (periodId) {
      period = await this.userRepo.manager.getRepository(AcademicPeriod).findOne({ where: { id: periodId } });
    }

    // Calcular estadísticas reales de incidentes
    const incidentRepo = this.userRepo.manager.getRepository(IncidentReport);
    const incidentQuery = incidentRepo.createQueryBuilder('report');
    if (periodId) {
      incidentQuery.where('report.academicPeriodId = :periodId', { periodId });
    }
    const allIncidents = await incidentQuery.getMany();
    
    const total = allIncidents.length;
    const resueltas = allIncidents.filter((i) => i.status === 'RESUELTO').length;
    const pendientes = allIncidents.filter((i) => i.status === 'PENDIENTE' || i.status === 'REVISADO').length;

    const reportCode = `REP-NOV-${Date.now().toString().substring(4)}`;
    const reportData = {
      generatedAt: new Date(),
      periodInfo: period ? { id: period.id, name: period.name } : 'GENERAL / TODOS',
      novelties: activeNovelties,
      resumenNovedades: {
        total,
        resueltas,
        pendientes,
      }
    };

    const report = this.reportRepo.create({
      code: reportCode,
      type: ReportType.NOVEDADES,
      academicPeriodId: periodId || null,
      reportData,
      generatedById: adminId,
      generatedAt: new Date(),
    });

    return this.reportRepo.save(report);
  }

  // RP007: Exportar reporte a PDF en formato stream
  async exportToPdfStream(reportId: string): Promise<{ stream: Readable; filename: string }> {
    const report = await this.findOne(reportId);
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // --- ENCABEZADO COMÚN ---
    doc.fillColor('#1a3a5c')
       .fontSize(16)
       .text('INSTITUTO SUPERIOR TECNOLÓGICO YAVIRAC', { align: 'center', underline: true })
       .moveDown(0.2);
       
    doc.fontSize(10)
       .fillColor('#555555')
       .text('Sistema de Gestión de Bienes Públicos y Bodega - Reportes Oficiales', { align: 'center' })
       .moveDown(1.5);

    const generatedAtStr = new Date(report.generatedAt).toLocaleString('es-EC');
    const generatedByStr = report.generatedBy
      ? `${report.generatedBy.nombres} ${report.generatedBy.apellidos}`
      : 'Sistema Automático';

    // DISEÑO SEGÚN TIPO DE REPORTE
    switch (report.type) {
      case ReportType.PERIODO_ACADEMICO: {
        const data = report.reportData;
        doc.fillColor('#2c3e50')
           .fontSize(13)
           .font('Helvetica-Bold')
           .text('REPORTE CONSOLIDADO DE FIN DE PERÍODO ACADÉMICO', { align: 'center' })
           .moveDown(0.2);
        
        doc.fontSize(11)
           .font('Helvetica')
           .text(`Código: ${report.code}`, { align: 'center' })
           .moveDown(1);

        doc.fillColor('#1a3a5c').fontSize(11).text('Resumen del Período', { underline: true }).moveDown(0.3);
        doc.fillColor('#333333').fontSize(9)
           .text(`Nombre del Período: ${data.periodInfo.name}`)
           .text(`Fecha de Inicio: ${new Date(data.periodInfo.startDate).toLocaleDateString('es-EC')}`)
           .text(`Fecha de Fin: ${new Date(data.periodInfo.endDate).toLocaleDateString('es-EC')}`)
           .text(`Cierre Ejecutado el: ${new Date(data.periodInfo.closedAt).toLocaleString('es-EC')} (${data.periodInfo.typeOfClosure})`)
           .text(`Generado por: ${generatedByStr}`)
           .moveDown(1.5);

        // Sección Bodega
        doc.fillColor('#1a3a5c').fontSize(11).text('1. Inventario en Bodega', { underline: true }).moveDown(0.4);
        doc.fillColor('#333333').fontSize(9);
        if (!data.bodega || data.bodega.length === 0) {
          doc.text('No hay artículos registrados en bodega al momento del cierre.').moveDown(1);
        } else {
          let bY = doc.y;
          doc.font('Helvetica-Bold').text('Código', 50, bY).text('Nombre', 180, bY).text('Cantidad', 450, bY, { align: 'right' }).font('Helvetica');
          doc.moveTo(50, bY + 12).lineTo(550, bY + 12).stroke('#1a3a5c');
          bY += 16;
          for (const item of data.bodega) {
            doc.text(`${item.codeValue}`, 50, bY)
               .text(`${item.name}`, 180, bY, { width: 250 })
               .text(`${item.cantidad}`, 450, bY, { align: 'right' });
            bY += 16;
            if (bY > 700) { doc.addPage(); bY = 50; }
          }
          doc.y = bY + 10;
        }

        // Sección Espacios
        doc.moveDown(1.5);
        doc.fillColor('#1a3a5c').fontSize(11).text('2. Distribución en Espacios Físicos', { underline: true }).moveDown(0.4);
        doc.fillColor('#333333').fontSize(9);
        for (const sp of data.spaces) {
          doc.font('Helvetica-Bold').text(`Espacio: ${sp.name} (${sp.roomNumber}) - Tipo: ${sp.type}`).font('Helvetica');
          const teachers = sp.teachers.map(t => `${t.nombres} ${t.apellidos}`).join(', ');
          doc.text(`Docentes Responsables: ${teachers || 'Ninguno'}`);
          doc.text(`Artículos Asignados:`);
          if (!sp.items || sp.items.length === 0) {
            doc.text('Sin artículos asignados.').moveDown(0.5);
          } else {
            let itemY = doc.y + 4;
            for (const item of sp.items) {
              doc.text(`- [${item.codeValue}] ${item.name} (Cant: ${item.cantidad})`, 70, itemY);
              itemY += 12;
              if (itemY > 700) { doc.addPage(); itemY = 50; }
            }
            doc.y = itemY;
            doc.moveDown(0.5);
          }
        }
        break;
      }
      case ReportType.JORNADA: {
        const data = report.reportData;
        doc.fillColor('#2c3e50')
           .fontSize(13)
           .font('Helvetica-Bold')
           .text(`REPORTE HISTÓRICO DE JORNADA - ${report.jornada}`, { align: 'center' })
           .moveDown(0.2);
        
        doc.fontSize(11)
           .font('Helvetica')
           .text(`Código: ${report.code}`, { align: 'center' })
           .moveDown(1);

        doc.fillColor('#1a3a5c').fontSize(11).text('Datos de la Jornada', { underline: true }).moveDown(0.3);
        doc.fillColor('#333333').fontSize(9)
           .text(`Período Académico: ${data.periodInfo.name}`)
           .text(`Jornada Evaluada: ${data.jornada}`)
           .text(`Fecha de Generación: ${generatedAtStr}`)
           .text(`Responsable de Generación: ${generatedByStr}`)
           .moveDown(1.5);

        doc.fillColor('#1a3a5c').fontSize(11).text('Bitácoras, Daños y Novedades de la Jornada', { underline: true }).moveDown(0.5);
        doc.fillColor('#333333').fontSize(9);

        if (!data.shifts || data.shifts.length === 0) {
          doc.text('No se registraron novedades ni incidencias específicas en esta jornada durante el período académico.').moveDown(1);
        } else {
          let shY = doc.y;
          doc.font('Helvetica-Bold')
             .text('Aula', 50, shY, { width: 80 })
             .text('Artículo', 130, shY, { width: 140 })
             .text('Estado', 280, shY, { width: 60 })
             .text('Observación / Novedades', 350, shY, { width: 200 })
             .font('Helvetica');
          doc.moveTo(50, shY + 12).lineTo(550, shY + 12).stroke('#1a3a5c');
          shY += 18;

          for (const sh of data.shifts) {
            doc.text(`${sh.spaceName} (${sh.spaceRoom})`, 50, shY, { width: 80 })
               .text(`${sh.itemName}`, 130, shY, { width: 140 })
               .text(`${sh.estadoFisico}`, 280, shY, { width: 60 })
               .text(`${sh.novedades || sh.observacion || 'Sin observaciones'}`, 350, shY, { width: 200 });
            shY += 25;
            if (shY > 700) { doc.addPage(); shY = 50; }
          }
          doc.y = shY;
        }
        break;
      }
      case ReportType.GESTION_USUARIOS: {
        const data = report.reportData;
        doc.fillColor('#2c3e50')
           .fontSize(13)
           .font('Helvetica-Bold')
           .text('REPORTE DE AUDITORÍA - SEGURIDAD Y GESTIÓN DE USUARIOS', { align: 'center' })
           .moveDown(0.2);
        
        doc.fontSize(11)
           .font('Helvetica')
           .text(`Código: ${report.code}`, { align: 'center' })
           .moveDown(1.5);

        doc.fillColor('#1a3a5c').fontSize(11).text('Detalles del Registro', { underline: true }).moveDown(0.5);
        doc.fillColor('#333333').fontSize(10);

        doc.text(`Fecha del Suceso: ${new Date(data.createdAt).toLocaleString('es-EC')}`)
           .text(`Acción Realizada: ${data.tipoCambio}`)
           .text(`Valor Anterior: ${data.valorAnterior}`)
           .text(`Valor Nuevo: ${data.valorNuevo}`)
           .moveDown(1);

        doc.font('Helvetica-Bold').text('Responsable de la Acción (Administrador):').font('Helvetica');
        doc.text(`Nombre: ${data.admin.nombres} ${data.admin.apellidos}`)
           .text(`Cédula: ${data.admin.cedula}`)
           .text(`Rol: ${data.admin.rol}`)
           .moveDown(1);

        doc.font('Helvetica-Bold').text('Usuario Afectado:').font('Helvetica');
        doc.text(`Nombre: ${data.targetUser.nombres} ${data.targetUser.apellidos}`)
           .text(`Cédula: ${data.targetUser.cedula}`)
           .text(`Correo Institucional: ${data.targetUser.correo}`)
           .text(`Rol: ${data.targetUser.rol}`)
           .moveDown(1.5);

        doc.fillColor('#c0392b').font('Helvetica-Bold').text('Justificación / Observación registrada:').font('Helvetica');
        doc.fillColor('#333333').text(`"${data.observacion}"`, { oblique: true }).moveDown(2);
        break;
      }
      case ReportType.NOVEDADES: {
        const data = report.reportData;
        doc.fillColor('#2c3e50')
           .fontSize(13)
           .font('Helvetica-Bold')
           .text('REPORTE OFICIAL DE DAÑOS E INCIDENCIAS', { align: 'center' })
           .moveDown(0.2);
        
        doc.fontSize(11)
           .font('Helvetica')
           .text(`Código: ${report.code}`, { align: 'center' })
           .moveDown(1.5);

        doc.fillColor('#1a3a5c').fontSize(11).text('Datos de Emisión', { underline: true }).moveDown(0.3);
        doc.fillColor('#333333').fontSize(9)
           .text(`Filtro Período: ${typeof data.periodInfo === 'string' ? data.periodInfo : data.periodInfo.name}`)
           .text(`Fecha de Emisión: ${generatedAtStr}`)
           .text(`Emitido por: ${generatedByStr}`)
           .moveDown(1.5);

        doc.fillColor('#1a3a5c').fontSize(11).text('Detalle de Novedades y Daños', { underline: true }).moveDown(0.5);
        doc.fillColor('#333333').fontSize(9);

        if (!data.novelties || data.novelties.length === 0) {
          doc.text('No hay novedades ni daños reportados en el sistema.').moveDown(1);
        } else {
          let novY = doc.y;
          doc.font('Helvetica-Bold')
             .text('Espacio', 50, novY, { width: 80 })
             .text('Artículo', 130, novY, { width: 130 })
             .text('Jornada', 270, novY, { width: 60 })
             .text('Estado', 340, novY, { width: 50 })
             .text('Detalles Novedad', 400, novY, { width: 150 })
             .font('Helvetica');
          doc.moveTo(50, novY + 12).lineTo(550, novY + 12).stroke('#1a3a5c');
          novY += 18;

          for (const nov of data.novelties) {
            doc.text(`${nov.space.name} (${nov.space.roomNumber})`, 50, novY, { width: 80 })
               .text(`${nov.item.name}`, 130, novY, { width: 130 })
               .text(`${nov.jornada}`, 270, novY, { width: 60 })
               .text(`${nov.estadoFisico}`, 340, novY, { width: 50 })
               .text(`${nov.novedades || nov.observacion || 'Sin detalle de texto'}`, 400, novY, { width: 150 });
            novY += 30;
            if (novY > 700) { doc.addPage(); novY = 50; }
          }
          doc.y = novY;
        }
        break;
      }
      default:
        throw new BadRequestException('Tipo de reporte no soportado para exportación en PDF');
    }

    doc.end();

    return {
      stream: Readable.from(doc),
      filename: `Reporte_${report.code}.pdf`,
    };
  }
}
