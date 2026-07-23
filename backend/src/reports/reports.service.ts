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

  // Consulta e historial con filtros
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

  // Generación automática de reporte de cierre y reportes por jornada
  async generateClosureAndShiftReports(period: AcademicPeriod, adminId?: string): Promise<void> {
    const admin = adminId ? await this.userRepo.findOne({ where: { id: adminId } }) : null;

    // Recopilar datos de Inventario General (todos los items activos de la institución)
    const itemsInventario = await this.itemRepo.find({
      where: { status: 'ACTIVO' },
      relations: { inventoryView: true, subcategory: { category: { inventoryView: true } } },
    });

    // Recopilar datos de Espacios Físicos
    const spaces = await this.spaceRepo.find({
      relations: {
        responsibleTeachers: true,
        items: {
          inventoryView: true,
          subcategory: { category: { inventoryView: true } },
        },
      },
    });

    // Recopilar históricos de jornadas
    const shifts = await this.shiftRepo.find({
      relations: {
        item: true,
        space: true,
      },
    });

    // Armar el JSON consolidado inmutable
    const reportData = {
      periodInfo: {
        id: period.id,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        closedAt: period.closedAt || new Date(),
        typeOfClosure: adminId ? 'MANUAL' : 'AUTOMATICO',
      },
      inventario: itemsInventario.map((i) => ({
        id: i.id,
        name: i.name,
        codeValue: i.codeValue,
        codePrefix: '',
        view: i.inventoryView?.name || i.subcategory?.category?.inventoryView?.name || '',
        subcategory: i.subcategory?.name || '',
        category: i.subcategory?.category?.name || '',
        cantidad: i.cantidad,
        dynamicValues: i.dynamicValues,
      })),
      bodega: itemsInventario.map((i) => ({
        id: i.id,
        name: i.name,
        codeValue: i.codeValue,
        codePrefix: '',
        view: i.inventoryView?.name || i.subcategory?.category?.inventoryView?.name || '',
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
          view: i.inventoryView?.name || i.subcategory?.category?.inventoryView?.name || '',
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

    // Guardar o actualizar en la tabla closure_reports
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

    // Registrar el reporte consolidado en la tabla de historial de reportes general
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

    // Generar automáticamente reportes independientes por cada jornada (MATUTINA, VESPERTINA, NOCTURNA)
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

  // Reportes de gestión de usuarios automático
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

  // Consulta de reportes de novedades activas en los espacios
  async getActiveNovelties(): Promise<any[]> {
    const shifts = await this.shiftRepo.find({
      relations: { item: true, space: { responsibleTeachers: true } },
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
    let period: AcademicPeriod | null = null;
    if (periodId) {
      period = await this.userRepo.manager.getRepository(AcademicPeriod).findOne({ where: { id: periodId } });
    }

    const incidentRepo = this.userRepo.manager.getRepository(IncidentReport);
    
    // Consultar incidentes reales con sus relaciones (incluyendo artículos con soft-delete)
    const allIncidents = await incidentRepo.createQueryBuilder('incident')
      .leftJoinAndSelect('incident.teacher', 'teacher')
      .leftJoinAndSelect('incident.academicPeriod', 'academicPeriod')
      .leftJoinAndSelect('incident.space', 'space')
      .leftJoinAndSelect('space.responsibleTeachers', 'responsibleTeachers')
      .leftJoinAndSelect('incident.items', 'items')
      .leftJoinAndSelect('items.item', 'item')
      .withDeleted()
      .where(periodId ? 'incident.academicPeriodId = :periodId' : '1=1', { periodId })
      .orderBy('incident.created_at', 'DESC')
      .getMany();

    const total = allIncidents.length;
    const resueltas = allIncidents.filter((i) => i.status === 'RESUELTO').length;
    const pendientes = allIncidents.filter((i) => i.status === 'PENDIENTE' || i.status === 'REVISADO').length;

    // Mapear cada incidente con su lista de artículos afectados
    const novelties = allIncidents.map((inc) => {
      const firstItem = inc.items && inc.items.length > 0 ? inc.items[0].item : null;
      const itemsListStr = inc.items?.map((it) => `${it.item?.name || 'Artículo Eliminado'} (Cant: ${it.cantidadAfectada})`).join(', ') || 'Sin artículos';
      return {
        id: inc.id,
        jornada: inc.jornada,
        estadoFisico: inc.estadoFisico,
        novedades: inc.description || 'Sin descripción',
        reportedAt: inc.createdAt,
        teacher: inc.teacher ? `${inc.teacher.nombres} ${inc.teacher.apellidos}` : 'Docente',
        itemsList: itemsListStr,
        item: firstItem ? {
          id: firstItem.id,
          name: firstItem.name,
          codeValue: firstItem.codeValue || 'S/C',
        } : null,
        space: {
          id: inc.space?.id,
          name: inc.space?.name,
          roomNumber: inc.space?.roomNumber,
          teachers: inc.space?.responsibleTeachers?.map((t) => `${t.nombres} ${t.apellidos}`) || [],
        },
      };
    });

    const reportCode = `REP-NOV-${Date.now().toString().substring(4)}`;
    const reportData = {
      generatedAt: new Date(),
      periodInfo: period ? { id: period.id, name: period.name } : 'GENERAL / TODOS',
      novelties,
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

  // Exportar reporte a PDF en formato stream
  async exportToPdfStream(reportId: string): Promise<{ stream: Readable; filename: string }> {
    const report = await this.findOne(reportId);
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // --- ENCABEZADO COMÚN ---
    // Barra superior decorativa
    doc.rect(50, 30, 500, 4).fill('#1e293b'); // Gris oscuro elegante

    doc.fillColor('#0f172a') // Slate 900
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('INSTITUTO SUPERIOR TECNOLÓGICO YAVIRAC', 50, 42, { align: 'center' });
       
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#64748b') // Slate 500
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

        // Título Principal
        doc.fillColor('#1e293b')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('REPORTE CONSOLIDADO DE FIN DE PERÍODO ACADÉMICO', 50, doc.y, { align: 'center', width: 500 })
           .moveDown(0.2);
        
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#64748b')
           .text(`Código: ${report.code}`, 50, doc.y, { align: 'center', width: 500 })
           .moveDown(1.2);

        // Helper para resolver la vista (Bienes Públicos, Insumos y Suministros, Biblioteca)
        const resolveItemView = (item: any): string => {
          const v = String(item.view || item.inventoryView?.name || item.subcategory?.category?.inventoryView?.name || item.category || '').toLowerCase();
          if (v.includes('bienes') || v.includes('públicos') || v.includes('publicos')) return 'Bienes Públicos';
          if (v.includes('insumo') || v.includes('suministro')) return 'Insumos y Suministros';
          if (v.includes('bibliotec') || v.includes('libro')) return 'Biblioteca';
          
          const code = String(item.codeValue || item.code || '').toUpperCase();
          if (code.startsWith('INS-')) return 'Insumos y Suministros';
          if (code.startsWith('BIB-')) return 'Biblioteca';
          if (code.startsWith('YAV-')) return 'Bienes Públicos';
          return 'Bienes Públicos';
        };

        // 1. Resumen del Período
        doc.fillColor('#1e3a8a').fontSize(11).font('Helvetica-Bold').text('Resumen del Período', 50, doc.y, { width: 500, underline: true });
        doc.moveDown(0.4);

        doc.fillColor('#334155').fontSize(9).font('Helvetica');
        let rY = doc.y;
        doc.text(`Nombre del Período: ${data.periodInfo.name}`, 50, rY, { width: 500 }); rY += 14;
        doc.text(`Fecha de Inicio: ${new Date(data.periodInfo.startDate).toLocaleDateString('es-EC')}`, 50, rY, { width: 500 }); rY += 14;
        doc.text(`Fecha de Fin: ${new Date(data.periodInfo.endDate).toLocaleDateString('es-EC')}`, 50, rY, { width: 500 }); rY += 14;
        doc.text(`Cierre Ejecutado el: ${new Date(data.periodInfo.closedAt).toLocaleString('es-EC')}`, 50, rY, { width: 500 }); rY += 22;
        doc.y = rY;

        // 1. Inventario General (Todos los artículos activos de la institución)
        doc.fillColor('#1e3a8a').fontSize(11).font('Helvetica-Bold').text('1. Inventario General', 50, doc.y, { width: 500, underline: true });
        doc.moveDown(0.5);

        let inventarioItems: any[] = [];

        if (data.inventario && Array.isArray(data.inventario) && data.inventario.length > 0) {
          inventarioItems = data.inventario;
        } else {
          // Combinar ítems en Bodega + todos los ítems asignados a Espacios Físicos del reporte guardado
          const itemsBodega = data.bodega || [];
          const itemsEspacios: any[] = [];
          if (data.spaces && Array.isArray(data.spaces)) {
            for (const sp of data.spaces) {
              if (sp.items && Array.isArray(sp.items)) {
                itemsEspacios.push(...sp.items);
              }
            }
          }
          // Eliminar duplicados si los hay por ID
          const mapItems = new Map<string, any>();
          [...itemsBodega, ...itemsEspacios].forEach((item) => {
            if (item && item.id) {
              mapItems.set(item.id, item);
            } else if (item) {
              mapItems.set(`${item.codeValue || item.name}`, item);
            }
          });
          inventarioItems = Array.from(mapItems.values());
        }

        // Si el reporte no tiene recopilado el inventario completo, consultar dinámicamente todos los items activos
        if (!inventarioItems || inventarioItems.length === 0) {
          const currentActive = await this.itemRepo.find({
            where: { status: 'ACTIVO' },
            relations: { inventoryView: true, subcategory: { category: { inventoryView: true } } },
          });
          inventarioItems = currentActive.map((i) => ({
            id: i.id,
            name: i.name,
            codeValue: i.codeValue,
            codePrefix: '',
            view: i.inventoryView?.name || i.subcategory?.category?.inventoryView?.name || '',
            subcategory: i.subcategory?.name || '',
            category: i.subcategory?.category?.name || '',
            cantidad: i.cantidad,
            dynamicValues: i.dynamicValues,
          }));
        }

        const viewsOrder = ['Bienes Públicos', 'Insumos y Suministros', 'Biblioteca'];
        
        for (const viewTitle of viewsOrder) {
          const itemsInView = inventarioItems.filter(i => resolveItemView(i) === viewTitle);

          if (doc.y > 680) { doc.addPage(); doc.y = 50; }

          // Subtítulo de Vista
          doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(`${viewTitle}`, 50, doc.y, { width: 500 });
          doc.moveDown(0.3);

          if (itemsInView.length === 0) {
            doc.fillColor('#64748b').fontSize(8.5).font('Helvetica-Oblique').text('Sin artículos registrados en esta sección.', 50, doc.y).moveDown(0.8);
            continue;
          }

          // Tabla de artículos de esta vista
          let tableY = doc.y;
          doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold');
          doc.text('Código', 50, tableY, { width: 105 });
          doc.text('Nombre del Artículo', 160, tableY, { width: 215 });
          doc.text('Categoría', 380, tableY, { width: 95 });
          doc.text('Cantidad', 480, tableY, { width: 70, align: 'right' });

          doc.moveTo(50, tableY + 12).lineTo(550, tableY + 12).strokeColor('#cbd5e1').stroke();
          tableY += 16;

          doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
          for (const item of itemsInView) {
            const codeStr = `${item.codeValue || item.code || ''}`;
            const nameStr = `${item.name}`;
            const catStr = `${item.category || item.subcategory || 'General'}`;

            const hCode = doc.heightOfString(codeStr, { width: 105, lineGap: 2 });
            const hName = doc.heightOfString(nameStr, { width: 215, lineGap: 2 });
            const hCat = doc.heightOfString(catStr, { width: 95, lineGap: 2 });
            const rowHeight = Math.max(hCode, hName, hCat, 14) + 6;

            if (tableY + rowHeight > 730) {
              doc.addPage();
              tableY = 50;
              doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica-Bold');
              doc.text('Código', 50, tableY, { width: 105 });
              doc.text('Nombre del Artículo', 160, tableY, { width: 215 });
              doc.text('Categoría', 380, tableY, { width: 95 });
              doc.text('Cantidad', 480, tableY, { width: 70, align: 'right' });
              doc.moveTo(50, tableY + 12).lineTo(550, tableY + 12).strokeColor('#cbd5e1').stroke();
              tableY += 16;
              doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
            }

            doc.text(codeStr, 50, tableY, { width: 105, lineGap: 2 });
            doc.text(nameStr, 160, tableY, { width: 215, lineGap: 2 });
            doc.text(catStr, 380, tableY, { width: 95, lineGap: 2 });
            doc.text(`${item.cantidad}`, 480, tableY, { width: 70, align: 'right', lineGap: 2 });

            tableY += rowHeight;
          }

          doc.y = tableY + 10;
        }

        // 2. Distribución en Espacios Físicos
        if (doc.y > 660) { doc.addPage(); doc.y = 50; }
        doc.fillColor('#1e3a8a').fontSize(11).font('Helvetica-Bold').text('2. Distribución en Espacios Físicos', 50, doc.y, { width: 500, underline: true });
        doc.moveDown(0.6);

        const spacesList = data.spaces || [];

        if (spacesList.length === 0) {
          doc.fillColor('#64748b').fontSize(9).font('Helvetica-Oblique').text('No hay espacios físicos registrados.', 50, doc.y).moveDown(1);
        } else {
          for (const sp of spacesList) {
            if (doc.y > 640) { doc.addPage(); doc.y = 50; }

            let sY = doc.y;

            // Franja de encabezado del Espacio Físico
            doc.rect(50, sY, 500, 20).fill('#f1f5f9');
            doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold');
            doc.text(`Espacio: ${sp.name} (${sp.roomNumber})`, 55, sY + 4, { width: 330 });
            doc.text(`Tipo: ${sp.type || 'AULA'}`, 390, sY + 4, { width: 155, align: 'right' });
            sY += 26;

            const teachers = (sp.teachers || []).map((t: any) => `${t.nombres} ${t.apellidos}`).join(', ');
            doc.fillColor('#475569').fontSize(8.5).font('Helvetica');
            doc.text(`Docentes Responsables: ${teachers || 'Ninguno'}`, 55, sY, { width: 490 });
            sY += 14;

            const spaceItems = sp.items || [];
            if (spaceItems.length === 0) {
              doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica-Oblique').text('Sin artículos asignados a este espacio.', 55, sY, { width: 490 });
              sY += 18;
              doc.y = sY;
            } else {
              // Agrupar los artículos asignados al espacio por Vista
              for (const viewTitle of viewsOrder) {
                const itemsInView = spaceItems.filter((i: any) => resolveItemView(i) === viewTitle);
                if (itemsInView.length === 0) continue;

                if (sY > 700) { doc.addPage(); sY = 50; }

                doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Bold');
                doc.text(`${viewTitle}`, 55, sY, { width: 490 });
                sY += 12;

                // Cabecera de la tabla de artículos del aula
                doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');
                doc.text('Código', 65, sY, { width: 100 });
                doc.text('Nombre del Artículo', 170, sY, { width: 205 });
                doc.text('Categoría', 380, sY, { width: 95 });
                doc.text('Cantidad', 480, sY, { width: 70, align: 'right' });
                doc.moveTo(65, sY + 10).lineTo(550, sY + 10).strokeColor('#e2e8f0').stroke();
                sY += 14;

                doc.font('Helvetica').fontSize(8).fillColor('#334155');
                for (const item of itemsInView) {
                  const codeStr = `${item.codeValue || item.code || ''}`;
                  const nameStr = `${item.name}`;
                  const catStr = `${item.category || item.subcategory || 'General'}`;

                  const hCode = doc.heightOfString(codeStr, { width: 100, lineGap: 2 });
                  const hName = doc.heightOfString(nameStr, { width: 205, lineGap: 2 });
                  const hCat = doc.heightOfString(catStr, { width: 95, lineGap: 2 });
                  const rowHeight = Math.max(hCode, hName, hCat, 13) + 5;

                  if (sY + rowHeight > 730) {
                    doc.addPage();
                    sY = 50;
                    doc.fillColor('#1e293b').fontSize(8).font('Helvetica-Bold');
                    doc.text('Código', 65, sY, { width: 100 });
                    doc.text('Nombre del Artículo', 170, sY, { width: 205 });
                    doc.text('Categoría', 380, sY, { width: 95 });
                    doc.text('Cantidad', 480, sY, { width: 70, align: 'right' });
                    doc.moveTo(65, sY + 10).lineTo(550, sY + 10).strokeColor('#e2e8f0').stroke();
                    sY += 14;
                    doc.font('Helvetica').fontSize(8).fillColor('#334155');
                  }

                  doc.text(codeStr, 65, sY, { width: 100, lineGap: 2 });
                  doc.text(nameStr, 170, sY, { width: 205, lineGap: 2 });
                  doc.text(catStr, 380, sY, { width: 95, lineGap: 2 });
                  doc.text(`${item.cantidad}`, 480, sY, { width: 70, align: 'right', lineGap: 2 });

                  sY += rowHeight;
                }
                sY += 4;
              }
              doc.y = sY + 8;
            }
          }
        }
        }
        break;
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

        // Título del Reporte
        doc.fillColor('#e11d48') // Rosa oscuro/rojo coral
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('REPORTE HISTÓRICO CONSOLIDADO DE NOVEDADES Y DAÑOS', { align: 'center' })
           .moveDown(0.2);

        doc.fontSize(8.5)
           .font('Helvetica')
           .fillColor('#64748b')
           .text(`Código de Registro: ${report.code}  |  Emisión: ${generatedAtStr}`, { align: 'center' })
           .moveDown(1.2);

        // Caja de Datos de Emisión (Fondo gris claro, borde sutil)
        const boxY = doc.y;
        doc.rect(50, boxY, 500, 42).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.fillColor('#334155').fontSize(8.5);
        doc.font('Helvetica-Bold').text('Datos del Reporte', 65, boxY + 8).font('Helvetica');
        
        const periodStr = typeof data.periodInfo === 'string' ? data.periodInfo : data.periodInfo.name;
        doc.text(`Período Académico: ${periodStr}`, 65, boxY + 22)
           .text(`Generado Por: ${generatedByStr}`, 300, boxY + 22);
        
        doc.y = boxY + 54;

        // Sección Detalle
        doc.fillColor('#1e293b').fontSize(10.5).font('Helvetica-Bold').text('Detalle de Novedades Registradas').font('Helvetica').moveDown(0.5);

        if (!data.novelties || data.novelties.length === 0) {
          doc.fillColor('#64748b').fontSize(9).text('No se han registrado novedades ni daños en el período seleccionado.').moveDown(1);
        } else {
          // --- TABLA ---
          let curY = doc.y;
          
          // Cabecera de la tabla
          doc.rect(50, curY, 500, 22).fill('#1e293b');
          doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold')
             .text('Espacio / Aula', 55, curY + 6, { width: 95 })
             .text('Artículo Afectado', 155, curY + 6, { width: 125 })
             .text('Jornada', 285, curY + 6, { width: 55 })
             .text('Estado', 345, curY + 6, { width: 45 })
             .text('Detalles / Novedad', 395, curY + 6, { width: 150 })
             .font('Helvetica');
          
          curY += 22;

          let rowIndex = 0;
          for (const nov of data.novelties) {
            // Validar salto de página antes de dibujar
            if (curY > 720) {
              doc.addPage();
              // Volver a dibujar cabecera en la nueva página
              curY = 50;
              doc.rect(50, curY, 500, 22).fill('#1e293b');
              doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold')
                 .text('Espacio / Aula', 55, curY + 6, { width: 95 })
                 .text('Artículo Afectado', 155, curY + 6, { width: 125 })
                 .text('Jornada', 285, curY + 6, { width: 55 })
                 .text('Estado', 345, curY + 6, { width: 45 })
                 .text('Detalles / Novedad', 395, curY + 6, { width: 150 })
                 .font('Helvetica');
              curY += 22;
            }

            // Fondo cebra alterno
            const isAlternate = rowIndex % 2 === 1;
            const rowHeight = 28; // altura fija para evitar desalineaciones
            doc.rect(50, curY, 500, rowHeight).fillAndStroke(isAlternate ? '#f8fafc' : '#ffffff', '#f1f5f9');

            // Textos de las celdas
            doc.fillColor('#334155').fontSize(8)
               .text(`${nov.space?.name || 'S/E'} (${nov.space?.roomNumber || 'S/N'})`, 55, curY + 8, { width: 95 })
               .text(`${nov.itemsList || nov.item?.name || 'S/A'}`, 155, curY + 8, { width: 125 })
               .text(`${nov.jornada || 'N/A'}`, 285, curY + 8, { width: 55 })
               .text(`${nov.estadoFisico || 'N/A'}`, 345, curY + 8, { width: 45 })
               .text(`${nov.novedades || nov.observacion || 'Sin detalle'}`, 395, curY + 8, { width: 150, height: 16, ellipsis: true });

            curY += rowHeight;
            rowIndex++;
          }
          doc.y = curY;
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
