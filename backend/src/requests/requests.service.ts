import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Request } from './entities/request.entity';
import { RequestItem } from './entities/request-item.entity';
import { HandoverAct } from './entities/handover-act.entity';
import { AcademicPeriod } from '../periods/entities/academic-period.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { PhysicalSpace } from '../spaces/entities/physical-space.entity';
import { InventoryItemShift } from '../spaces/entities/inventory-item-shift.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { CreateRequestDto } from './dto/create-request.dto';
import { ResolveRequestDto } from './dto/resolve-request.dto';
import { PdfGeneratorService } from './pdf-generator.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(RequestItem)
    private readonly requestItemRepo: Repository<RequestItem>,
    @InjectRepository(HandoverAct)
    private readonly actRepo: Repository<HandoverAct>,
    @InjectRepository(AcademicPeriod)
    private readonly periodRepo: Repository<AcademicPeriod>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(PhysicalSpace)
    private readonly spaceRepo: Repository<PhysicalSpace>,
    @InjectRepository(InventoryItemShift)
    private readonly shiftRepo: Repository<InventoryItemShift>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {}

  // CREAR SOLICITUD
  async createRequest(dto: CreateRequestDto, teacherId: string): Promise<Request> {
    // Validar período académico activo
    const activePeriod = await this.periodRepo.findOne({ where: { status: 'ACTIVO' } });
    if (!activePeriod) {
      throw new BadRequestException('No se pueden registrar solicitudes de inventario porque no hay un período académico activo.');
    }

    // Validar que el espacio físico exista y esté bajo la responsabilidad del docente
    const space = await this.spaceRepo.findOne({
      where: { id: dto.spaceId },
      relations: { responsibleTeachers: true },
    });
    if (!space) {
      throw new NotFoundException(`El espacio físico principal no existe.`);
    }

    // Validar docente solicitante
    const teacher = await this.userRepo.findOne({ where: { id: teacherId, rol: UserRole.DOCENTE } });
    if (!teacher) {
      throw new BadRequestException('El usuario solicitante debe ser un docente registrado.');
    }
    if (teacher.estado !== UserStatus.ACTIVO) {
      throw new BadRequestException('El docente solicitante se encuentra inactivo.');
    }

    const type = dto.type || 'NUEVO_INVENTARIO';

    // Validar responsabilidades de espacios según el tipo de solicitud
    if (type === 'SOLICITUD_TRASPASO') {
      if (!dto.destinationSpaceId) {
        throw new BadRequestException('El espacio físico de destino es obligatorio para solicitudes de traspaso.');
      }
      if (dto.destinationSpaceId === dto.spaceId) {
        throw new BadRequestException('El espacio físico de destino no puede ser igual al de origen.');
      }
      const destSpace = await this.spaceRepo.findOne({
        where: { id: dto.destinationSpaceId },
        relations: { responsibleTeachers: true },
      });
      if (!destSpace) {
        throw new NotFoundException('El espacio físico de destino no existe.');
      }

      // El solicitante debe ser responsable del destino (su propia aula)
      const isResponsibleDest = destSpace.responsibleTeachers.some((t) => t.id === teacherId);
      if (!isResponsibleDest) {
        throw new BadRequestException('El espacio físico de destino (tu aula) debe estar bajo tu responsabilidad.');
      }
    } else {
      // Para NUEVO_INVENTARIO, TRANSFERENCIA y TRASPASO_DOCENTE: el solicitante debe ser responsable del origen
      const isResponsible = space.responsibleTeachers.some((t) => t.id === teacherId);
      if (!isResponsible) {
        throw new BadRequestException('El espacio físico de origen (tu aula) debe estar bajo tu responsabilidad.');
      }

      if (type === 'TRANSFERENCIA' || type === 'TRASPASO_DOCENTE') {
        if (!dto.destinationSpaceId) {
          throw new BadRequestException('El espacio físico de destino es obligatorio para solicitudes de transferencia.');
        }
        if (dto.destinationSpaceId === dto.spaceId) {
          throw new BadRequestException('El espacio físico de destino no puede ser igual al de origen.');
        }
        const destSpace = await this.spaceRepo.findOne({ where: { id: dto.destinationSpaceId } });
        if (!destSpace) {
          throw new NotFoundException('El espacio físico de destino no existe.');
        }
      }
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debe incluir al menos un artículo en la solicitud.');
    }

    // Crear cabecera de solicitud
    const request = this.requestRepo.create({
      teacherId,
      spaceId: dto.spaceId,
      academicPeriodId: activePeriod.id,
      status: 'EN_PROCESO',
      motive: dto.motive?.trim() || null,
      type,
      destinationSpaceId: (type === 'TRANSFERENCIA' || type === 'TRASPASO_DOCENTE' || type === 'SOLICITUD_TRASPASO') ? dto.destinationSpaceId : null,
    });

    const savedRequest = await this.requestRepo.save(request);

    // Crear detalles e ítems
    const itemsToSave: RequestItem[] = [];
    for (const itemDto of dto.items) {
      let item: InventoryItem | null = null;

      if (type === 'NUEVO_INVENTARIO') {
        // En nuevo inventario: deben estar en bodega (physicalSpaceId es nulo)
        item = await this.itemRepo.findOne({
          where: { id: itemDto.itemId, physicalSpaceId: IsNull(), status: 'ACTIVO' },
        });
        if (!item) {
          throw new NotFoundException(`El artículo con ID '${itemDto.itemId}' no existe en bodega o no está activo.`);
        }
      } else {
        // En transferencia: deben estar asignados al espacio de origen del docente (spaceId)
        item = await this.itemRepo.findOne({
          where: { id: itemDto.itemId, physicalSpaceId: dto.spaceId, status: 'ACTIVO' },
        });
        if (!item) {
          throw new NotFoundException(`El artículo con ID '${itemDto.itemId}' no está asignado al espacio de origen o no está activo.`);
        }
      }

      if (item.cantidad < itemDto.cantidad) {
        throw new BadRequestException(
          `Cantidad insuficiente para '${item.name}'. Solicitado: ${itemDto.cantidad}, Disponible: ${item.cantidad}.`,
        );
      }

      const requestItem = this.requestItemRepo.create({
        requestId: savedRequest.id,
        itemId: itemDto.itemId,
        cantidad: itemDto.cantidad,
      });
      itemsToSave.push(await this.requestItemRepo.save(requestItem));
    }

    savedRequest.items = itemsToSave;

    // Notificar a los administradores
    await this.notifyAdminsNewRequest(savedRequest, teacher, space);

    return savedRequest;
  }

  // CONSULTAR TODAS LAS SOLICITUDES CON FILTROS 
  async findAllRequests(filters: {
    teacherId?: string;
    status?: string;
    academicPeriodId?: string;
    spaceId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Request[]> {
    const query = this.requestRepo.createQueryBuilder('request')
      .leftJoinAndSelect('request.teacher', 'teacher')
      .leftJoinAndSelect('request.space', 'space')
      .leftJoinAndSelect('request.academicPeriod', 'academicPeriod')
      .leftJoinAndSelect('request.resolvedBy', 'resolvedBy')
      .leftJoinAndSelect('request.items', 'items')
      .leftJoinAndSelect('items.item', 'item')
      .orderBy('request.createdAt', 'DESC');

    if (filters.teacherId) {
      query.andWhere('request.teacherId = :teacherId', { teacherId: filters.teacherId });
    }

    if (filters.status) {
      query.andWhere('request.status = :status', { status: filters.status.toUpperCase() });
    }

    if (filters.academicPeriodId) {
      query.andWhere('request.academicPeriodId = :academicPeriodId', { academicPeriodId: filters.academicPeriodId });
    }

    if (filters.spaceId) {
      query.andWhere('request.spaceId = :spaceId', { spaceId: filters.spaceId });
    }

    if (filters.startDate) {
      query.andWhere('request.createdAt >= :startDate', { startDate: new Date(filters.startDate) });
    }

    if (filters.endDate) {
      query.andWhere('request.createdAt <= :endDate', { endDate: new Date(filters.endDate) });
    }

    return query.getMany();
  }

  // DETALLE COMPLETO DE UNA SOLICITUD 
  async findRequestById(id: string, requesterId?: string, requesterRole?: string): Promise<Request> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: {
        teacher: true,
        space: true,
        destinationSpace: true,
        academicPeriod: true,
        resolvedBy: true,
        handoverAct: true,
        items: {
          item: {
            subcategory: {
              category: {
                inventoryView: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`La solicitud de inventario no existe.`);
    }

    // Si el rol es DOCENTE, verificar que sea el dueño de la solicitud
    if (requesterRole === UserRole.DOCENTE && requesterId && request.teacherId !== requesterId) {
      throw new ForbiddenException('No tienes permisos para acceder a esta solicitud.');
    }

    return request;
  }

  // APROBAR SOLICITUD 
  async approveRequest(id: string, adminId: string): Promise<Request> {
    const activePeriod = await this.periodRepo.findOne({ where: { status: 'ACTIVO' } });
    if (!activePeriod) {
      throw new BadRequestException('No se pueden realizar operaciones de inventario porque no hay un período académico activo.');
    }

    const request = await this.findRequestById(id);
    if (request.status !== 'EN_PROCESO') {
      throw new BadRequestException('Solo se pueden aprobar solicitudes que estén en estado "En proceso".');
    }

    const admin = await this.userRepo.findOne({ where: { id: adminId } });
    if (!admin) {
      throw new BadRequestException('El usuario administrador responsable no es válido.');
    }

    // Validar disponibilidad de stock en el origen correspondiente (bodega o espacio de origen)
    for (const reqItem of request.items) {
      if (request.type === 'TRANSFERENCIA' || request.type === 'TRASPASO_DOCENTE' || request.type === 'SOLICITUD_TRASPASO') {
        const itemInOrigin = await this.itemRepo.findOne({
          where: { id: reqItem.itemId, physicalSpaceId: request.spaceId, status: 'ACTIVO' },
        });
        if (!itemInOrigin) {
          throw new BadRequestException(`El artículo '${reqItem.item?.name || 'N/A'}' ya no se encuentra asignado al espacio de origen.`);
        }
        if (itemInOrigin.cantidad < reqItem.cantidad) {
          throw new BadRequestException(
            `Stock insuficiente para '${itemInOrigin.name}' en el espacio de origen. Disponible: ${itemInOrigin.cantidad}, Solicitado: ${reqItem.cantidad}.`,
          );
        }
      } else {
        const itemInBodega = await this.itemRepo.findOne({
          where: { id: reqItem.itemId, physicalSpaceId: IsNull(), status: 'ACTIVO' },
        });
        if (!itemInBodega) {
          throw new BadRequestException(`El artículo '${reqItem.item?.name || 'N/A'}' ya no se encuentra disponible en bodega.`);
        }
        if (itemInBodega.cantidad < reqItem.cantidad) {
          throw new BadRequestException(
            `Stock insuficiente para '${itemInBodega.name}' en bodega. Disponible: ${itemInBodega.cantidad}, Solicitado: ${reqItem.cantidad}.`,
          );
        }
      }
    }

    // Procesar transferencia / asignación física de ítems al aula destino
    for (const reqItem of request.items) {
      if (request.type === 'TRANSFERENCIA' || request.type === 'TRASPASO_DOCENTE' || request.type === 'SOLICITUD_TRASPASO') {
        const itemInOrigin = await this.itemRepo.findOne({
          where: { id: reqItem.itemId, physicalSpaceId: request.spaceId, status: 'ACTIVO' },
          relations: { subcategory: { category: { inventoryView: true } } },
        });

        const destSpace = await this.spaceRepo.findOne({
          where: { id: request.destinationSpaceId! },
        });

        const isInsumo = itemInOrigin!.subcategory?.category?.inventoryView?.code === 'INSUMOS';

        if (!isInsumo) {
          // BIENES PÚBLICOS / BIBLIOTECA: Transferir completo asignándole el new destinationSpaceId
          itemInOrigin!.physicalSpaceId = request.destinationSpaceId!;
          await this.itemRepo.save(itemInOrigin!);

          // Eliminar históricos previos en jornada para este item en el origen
          await this.shiftRepo.delete({ itemId: itemInOrigin!.id });

          // Inicializar jornadas para el espacio destino
          for (const jornada of destSpace!.jornadas) {
            const shift = this.shiftRepo.create({
              spaceId: request.destinationSpaceId!,
              itemId: itemInOrigin!.id,
              jornada,
              estadoFisico: 'BUENO',
            });
            await this.shiftRepo.save(shift);
          }
        } else {
          // INSUMOS: Restar del origen y clonar/añadir al destino
          itemInOrigin!.cantidad -= reqItem.cantidad;
          if (itemInOrigin!.cantidad <= 0) {
            // Eliminar fila en origen si cantidad llega a 0
            await this.itemRepo.remove(itemInOrigin!);
            await this.shiftRepo.delete({ itemId: itemInOrigin!.id });
          } else {
            await this.itemRepo.save(itemInOrigin!);
          }

          // Buscar si ya existe un clon de este insumo en el destino
          let cloneInDest = await this.itemRepo.findOne({
            where: {
              physicalSpaceId: request.destinationSpaceId!,
              codeValue: itemInOrigin!.codeValue === null ? IsNull() : itemInOrigin!.codeValue,
              status: 'ACTIVO',
            },
          });

          if (cloneInDest) {
            cloneInDest.cantidad += reqItem.cantidad;
            await this.itemRepo.save(cloneInDest);
          } else {
            cloneInDest = this.itemRepo.create({
              ...itemInOrigin,
              id: undefined,
              createdAt: undefined,
              updatedAt: undefined,
              cantidad: reqItem.cantidad,
              physicalSpaceId: request.destinationSpaceId!,
            });
            const savedClone = await this.itemRepo.save(cloneInDest);

            // Inicializar jornadas para el clon nuevo
            for (const jornada of destSpace!.jornadas) {
              const shift = this.shiftRepo.create({
                spaceId: request.destinationSpaceId!,
                itemId: savedClone.id,
                jornada,
                estadoFisico: 'BUENO',
              });
              await this.shiftRepo.save(shift);
            }
          }
        }
      } else {
        // NUEVO_INVENTARIO: Procesar normalmente
        const itemInBodega = await this.itemRepo.findOne({
          where: { id: reqItem.itemId, physicalSpaceId: IsNull(), status: 'ACTIVO' },
          relations: { inventoryView: true },
        });

        const isInsumo = itemInBodega!.inventoryView?.code === 'INSUMOS';

        if (!isInsumo) {
          // BIENES PÚBLICOS / BIBLIOTECA: Transferir completo asignándole el physicalSpaceId
          itemInBodega!.physicalSpaceId = request.spaceId;
          await this.itemRepo.save(itemInBodega!);

          // Eliminar históricos previos en jornada para este item en otras aulas
          await this.shiftRepo.delete({ itemId: itemInBodega!.id });

          // Inicializar jornadas para este aula
          for (const jornada of request.space.jornadas) {
            const shift = this.shiftRepo.create({
              spaceId: request.spaceId,
              itemId: itemInBodega!.id,
              jornada,
              estadoFisico: 'BUENO',
            });
            await this.shiftRepo.save(shift);
          }
        } else {
          // INSUMOS: Restar de bodega y clonar/añadir al laboratorio
          itemInBodega!.cantidad -= reqItem.cantidad;
          await this.itemRepo.save(itemInBodega!);

          // Buscar si ya existe un clon de este insumo en esa aula específica
          let cloneInSpace = await this.itemRepo.findOne({
            where: {
              physicalSpaceId: request.spaceId,
              codeValue: itemInBodega!.codeValue === null ? IsNull() : itemInBodega!.codeValue,
              status: 'ACTIVO',
            },
          });

          if (cloneInSpace) {
            cloneInSpace.cantidad += reqItem.cantidad;
            await this.itemRepo.save(cloneInSpace);
          } else {
            cloneInSpace = this.itemRepo.create({
              ...itemInBodega,
              id: undefined,
              createdAt: undefined,
              updatedAt: undefined,
              cantidad: reqItem.cantidad,
              physicalSpaceId: request.spaceId,
            });
            const savedClone = await this.itemRepo.save(cloneInSpace);

            // Inicializar jornadas para el clon nuevo
            for (const jornada of request.space.jornadas) {
              const shift = this.shiftRepo.create({
                spaceId: request.spaceId,
                itemId: savedClone.id,
                jornada,
                estadoFisico: 'BUENO',
              });
              await this.shiftRepo.save(shift);
            }
          }
        }
      }
    }

    // Cambiar estado de solicitud y registrar fecha/responsable
    request.status = 'APROBADA';
    request.resolvedAt = new Date();
    request.resolvedById = adminId;
    request.resolvedBy = admin;
    const finalRequest = await this.requestRepo.save(request);

    // 4. Generar el Acta de Recepción en PDF 
    const year = new Date().getFullYear();
    const count = await this.actRepo.count();
    const actCode = `ACTA-${year}-${String(count + 1).padStart(4, '0')}`;
    const pdfName = `acta-${finalRequest.id}.pdf`;
    
    const uploadDir = path.join(process.cwd(), 'uploads', 'handover-acts');
    const pdfPath = path.join(uploadDir, pdfName);

    // Generar el archivo físico
    const requestForPdf = await this.findRequestById(finalRequest.id);
    await this.pdfGeneratorService.generateHandoverActPdf(requestForPdf, actCode, pdfPath);

    // Guardar el registro de Acta de Recepción
    const act = this.actRepo.create({
      requestId: finalRequest.id,
      code: actCode,
      pdfPath: path.relative(process.cwd(), pdfPath), // guardar ruta relativa
    });
    await this.actRepo.save(act);

    // Notificar al docente por correo 
    await this.notifyDocenteStatus(finalRequest, true);

    return finalRequest;
  }

  // RECHAZAR SOLICITUD
  async rejectRequest(id: string, adminId: string, dto: ResolveRequestDto): Promise<Request> {
    const activePeriod = await this.periodRepo.findOne({ where: { status: 'ACTIVO' } });
    if (!activePeriod) {
      throw new BadRequestException('No se pueden realizar operaciones de inventario porque no hay un período académico activo.');
    }

    const request = await this.findRequestById(id);
    if (request.status !== 'EN_PROCESO') {
      throw new BadRequestException('Solo se pueden rechazar solicitudes que estén en estado "En proceso".');
    }

    if (!dto.rejectionReason || dto.rejectionReason.trim() === '') {
      throw new BadRequestException('Es obligatorio registrar el motivo del rechazo.');
    }

    const admin = await this.userRepo.findOne({ where: { id: adminId } });
    if (!admin) {
      throw new BadRequestException('El usuario administrador responsable no es válido.');
    }

    // Cambiar estado y archivar motivo de rechazo
    request.status = 'RECHAZADA';
    request.rejectionReason = dto.rejectionReason.trim();
    request.resolvedAt = new Date();
    request.resolvedById = adminId;
    request.resolvedBy = admin;

    const finalRequest = await this.requestRepo.save(request);

    // Notificar al docente de su rechazo 
    await this.notifyDocenteStatus(finalRequest, false);

    return finalRequest;
  }

  // OBTENER EL STREAM DEL PDF PARA DESCARGA
  async getActPdfStream(requestId: string): Promise<{ stream: fs.ReadStream; filename: string }> {
    const act = await this.actRepo.findOne({ where: { requestId } });
    if (!act) {
      throw new NotFoundException('No se ha encontrado un acta de recepción generada para esta solicitud.');
    }

    const absolutePath = path.resolve(process.cwd(), act.pdfPath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('El archivo físico del acta de recepción no existe en el servidor.');
    }

    const stream = fs.createReadStream(absolutePath);
    const filename = `Acta_${act.code}.pdf`;

    return { stream, filename };
  }

  // --- MÉTODOS PRIVADOS DE CORREO ---

  // Notificar administradores sobre nueva solicitud
  private async notifyAdminsNewRequest(request: Request, teacher: User, space: PhysicalSpace) {
    try {
      const admins = await this.userRepo.find({
        where: [
          { rol: UserRole.ADMINISTRADOR, estado: UserStatus.ACTIVO },
          { rol: UserRole.RESPONSABLE_DE_BIENES, estado: UserStatus.ACTIVO },
        ],
      });

      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
      const requestsUrl = `${frontendUrl}/admin/requests`;
      const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:3000');
      const logoUrl = this.configService.get<string>('LOGO_URL') || `${backendUrl}/public/logo.jpg`;
      const anio = new Date().getFullYear();

      for (const admin of admins) {
        const nombres = `${admin.nombres || ''} ${admin.apellidos || ''}`.trim() || 'Administrador';
        
        const html = (this.mailService as any).renderTemplate('new-request-admin', {
          nombres,
          teacherName: `${teacher.nombres || ''} ${teacher.apellidos || ''}`.trim(),
          spaceName: space.name,
          roomNumber: space.roomNumber,
          motive: request.motive || 'No detallado',
          createdAt: request.createdAt?.toLocaleString('es-EC') || new Date().toLocaleString('es-EC'),
          requestsUrl,
          logoUrl,
          anio,
        });

        await (this.mailService as any).transporter.sendMail({
          from: (this.mailService as any).fromAddress,
          to: admin.correoInstitucional,
          subject: `Nueva Solicitud de Inventario — Docente ${teacher.apellidos || ''}`,
          html,
        });
      }
    } catch (err) {
      this.logger.error('Error al notificar nueva solicitud a administradores', err);
    }
  }

  // Notificar al docente sobre la aprobación o rechazo
  private async notifyDocenteStatus(request: Request, esAprobada: boolean) {
    try {
      const docente = request.teacher;
      const nombres = `${docente.nombres || ''} ${docente.apellidos || ''}`.trim() || 'Docente';
      const resolvedBy = request.resolvedBy
        ? `${request.resolvedBy.nombres || ''} ${request.resolvedBy.apellidos || ''}`.trim()
        : 'Administrador';

      const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:3000');
      const logoUrl = this.configService.get<string>('LOGO_URL') || `${backendUrl}/public/logo.jpg`;
      const anio = new Date().getFullYear();

      const html = (this.mailService as any).renderTemplate('request-status-docente', {
        nombres,
        spaceName: request.space?.name || 'Aula',
        resolvedAt: request.resolvedAt?.toLocaleString('es-EC') || new Date().toLocaleString('es-EC'),
        resolvedBy,
        esAprobada,
        rejectionReason: request.rejectionReason,
        logoUrl,
        anio,
      });

      await (this.mailService as any).transporter.sendMail({
        from: (this.mailService as any).fromAddress,
        to: docente.correoInstitucional,
        subject: `Estado de tu Solicitud de Inventario — ${esAprobada ? 'APROBADA' : 'RECHAZADA'}`,
        html,
      });
    } catch (err) {
      this.logger.error(`Error al notificar estado de solicitud al docente ${request.teacherId}`, err);
    }
  }
}
