import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicPeriod } from './entities/academic-period.entity';
import { PeriodsService } from './periods.service';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PeriodsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PeriodsSchedulerService.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(AcademicPeriod)
    private readonly periodRepo: Repository<AcademicPeriod>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly periodsService: PeriodsService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.logger.log('Iniciando planificador de períodos académicos...');
    // Ejecutar inmediatamente al iniciar el servidor
    this.checkPeriods().catch((err) => this.logger.error('Error inicial en checkPeriods', err));
    // Ejecutar cada hora (3600000 ms)
    this.intervalId = setInterval(() => {
      this.checkPeriods().catch((err) => this.logger.error('Error en checkPeriods programado', err));
    }, 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async checkPeriods() {
    const activePeriod = await this.periodRepo.findOne({ where: { status: 'ACTIVO' } });
    if (!activePeriod) {
      return;
    }

    const now = new Date();
    const end = new Date(activePeriod.endDate);
    const msRemaining = end.getTime() - now.getTime();

    // CIERRE AUTOMÁTICO
    if (msRemaining <= 0) {
      this.logger.log(`El período '${activePeriod.name}' ha alcanzado su fecha de finalización. Iniciando cierre automático...`);
      await this.periodsService.executePeriodClosure(activePeriod, 'AUTOMATICO');
      return;
    }

    // NOTIFICACIÓN PREVIA AL CIERRE (48 HORAS ANTES)
    const hoursRemaining = msRemaining / (1000 * 60 * 60);
    if (hoursRemaining <= 48 && !activePeriod.notified48h) {
      this.logger.log(`Faltan ${hoursRemaining.toFixed(1)} horas para el cierre de '${activePeriod.name}'. Enviando notificaciones preventivas...`);
      
      await this.sendClosureWarningEmails(activePeriod);
      
      activePeriod.notified48h = true;
      await this.periodRepo.save(activePeriod);
    }
  }

  private async sendClosureWarningEmails(period: AcademicPeriod) {
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
        
        // Renderizar usando la plantilla period-closure-warning
        const html = (this.mailService as any).renderTemplate('period-closure-warning', {
          nombres,
          periodName: period.name,
          endDate: period.endDate.toLocaleString('es-EC'),
          logoUrl,
          anio,
        });

        await (this.mailService as any).transporter.sendMail({
          from: (this.mailService as any).fromAddress,
          to: user.correoInstitucional,
          subject: `Aviso Importante: Cierre de Período Académico en 48 horas — ${period.name}`,
          html,
        });
      }
      this.logger.log('Notificaciones preventivas de 48h enviadas exitosamente.');
    } catch (err) {
      this.logger.error('Error al enviar notificaciones preventivas de 48h', err);
    }
  }
}
