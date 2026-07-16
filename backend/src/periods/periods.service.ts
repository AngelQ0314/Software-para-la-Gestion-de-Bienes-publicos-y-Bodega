import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AcademicPeriod } from './entities/academic-period.entity';
import { CreatePeriodDto } from './dto/create-period.dto';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { PhysicalSpace } from '../spaces/entities/physical-space.entity';
import { InventoryItemShift } from '../spaces/entities/inventory-item-shift.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class PeriodsService {
  private readonly logger = new Logger(PeriodsService.name);

  constructor(
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
    private readonly reportsService: ReportsService,
  ) {}

  // CREAR PERÍODO ACADÉMICO 
  async createPeriod(dto: CreatePeriodDto): Promise<AcademicPeriod> {
    const nameUpper = dto.name.toUpperCase().trim();
    const existe = await this.periodRepo.findOne({ where: { name: nameUpper } });
    if (existe) {
      throw new ConflictException(`El período académico '${dto.name}' ya existe.`);
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Las fechas proporcionadas no son válidas.');
    }

    if (end <= start) {
      throw new BadRequestException('La fecha de finalización debe ser posterior a la fecha de inicio.');
    }

    const nuevo = this.periodRepo.create({
      name: nameUpper,
      startDate: start,
      endDate: end,
      status: 'CONFIGURADO',
    });

    return this.periodRepo.save(nuevo);
  }

  // OBTENER TODOS LOS PERÍODOS ACADÉMICOS
  async findAllPeriods(): Promise<AcademicPeriod[]> {
    return this.periodRepo.find({
      order: { startDate: 'DESC' },
    });
  }

  // OBTENER UN PERÍODO POR ID
  async findPeriodById(id: string): Promise<AcademicPeriod> {
    const period = await this.periodRepo.findOne({ where: { id } });
    if (!period) {
      throw new NotFoundException('El período académico no existe.');
    }
    return period;
  }

  // ACTIVAR PERÍODO ACADÉMICO 
  async activatePeriod(id: string): Promise<AcademicPeriod> {
    const period = await this.findPeriodById(id);

    if (period.status === 'ACTIVO') {
      throw new BadRequestException('El período académico ya se encuentra activo.');
    }

    if (period.status === 'CERRADO') {
      throw new BadRequestException('Un período cerrado no puede ser reactivado.');
    }

    // Verificar si ya existe otro período activo
    const activoExistente = await this.periodRepo.findOne({ where: { status: 'ACTIVO' } });
    if (activoExistente) {
      throw new BadRequestException(
        `Ya existe un período académico activo ('${activoExistente.name}'). Por favor ciérrelo primero.`,
      );
    }

    period.status = 'ACTIVO';
    const savedPeriod = await this.periodRepo.save(period);

    // INCORPORACIÓN AUTOMÁTICA 
    // Incorporar los items pendientes (creados fuera de período)
    await this.itemRepo.update(
      { isPending: true },
      { isPending: false, academicPeriodId: savedPeriod.id },
    );

    // Asociar los demás items que no tienen período al nuevo período activo
    await this.itemRepo.update(
      { academicPeriodId: IsNull() },
      { academicPeriodId: savedPeriod.id },
    );

    this.logger.log(`Período académico '${savedPeriod.name}' activado. Registros incorporados.`);
    return savedPeriod;
  }

  // CIERRE MANUAL DEL PERÍODO ACADÉMICO
  async closePeriod(id: string): Promise<AcademicPeriod> {
    const period = await this.findPeriodById(id);

    if (period.status !== 'ACTIVO') {
      throw new BadRequestException('Solo se puede cerrar un período que se encuentre actualmente activo.');
    }

    return this.executePeriodClosure(period, 'MANUAL');
  }

  // MÉTODO COMPARTIDO PARA EJECUTAR EL CIERRE Y GENERAR EL REPORTE
  async executePeriodClosure(period: AcademicPeriod, type: 'MANUAL' | 'AUTOMATICO'): Promise<AcademicPeriod> {
    period.status = 'CERRADO';
    period.closedAt = new Date();
    const savedPeriod = await this.periodRepo.save(period);

    // GENERACIÓN DEL REPORTE CONSOLIDADO Y REPORTES POR JORNADA EN EL MÓDULO GENERAL
    const reportCode = `REP-PERIODO-${savedPeriod.name.replace(/\s+/g, '-').toUpperCase()}`;
    await this.reportsService.generateClosureAndShiftReports(savedPeriod);

    // NOTIFICAR POR CORREO ELECTRÓNICO
    await this.sendPeriodClosedEmails(savedPeriod, reportCode, type);

    this.logger.log(`Período académico '${savedPeriod.name}' cerrado (${type}). Reportes centralizados generados.`);
    return savedPeriod;
  }

  // ENVÍO DE CORREOS DE CIERRE EXITOSO
  private async sendPeriodClosedEmails(period: AcademicPeriod, reportCode: string, type: 'MANUAL' | 'AUTOMATICO') {
    try {
      const staff = await this.userRepo.find({
        where: [
          { rol: UserRole.ADMINISTRADOR, estado: UserStatus.ACTIVO },
          { rol: UserRole.RESPONSABLE_DE_BIENES, estado: UserStatus.ACTIVO },
        ],
      });

      const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:3000');
      const logoUrl = this.configService.get<string>('LOGO_URL') || `${backendUrl}/public/logo.jpg`;
      const anio = new Date().getFullYear();

      for (const user of staff) {
        const nombres = `${user.nombres || ''} ${user.apellidos || ''}`.trim() || 'Usuario';
        
        // El mailService compila y renderiza period-closed
        const html = (this.mailService as any).renderTemplate('period-closed', {
          nombres,
          periodName: period.name,
          closedAt: period.closedAt?.toLocaleString('es-EC') || new Date().toLocaleString('es-EC'),
          reportCode,
          closureType: type === 'MANUAL' ? 'MANUAL (POR ADMINISTRADOR)' : 'AUTOMÁTICO (POR SISTEMA)',
          logoUrl,
          anio,
        });

        await (this.mailService as any).transporter.sendMail({
          from: (this.mailService as any).fromAddress,
          to: user.correoInstitucional,
          subject: `Período Académico Cerrado — ${period.name}`,
          html,
        });
      }
    } catch (err) {
      this.logger.error('Error al enviar correos de cierre de período', err);
    }
  }
}
