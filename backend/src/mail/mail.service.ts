import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT', 587),
      secure: this.configService.get<string>('MAIL_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });
  }

  private get fromAddress(): string {
    const name = this.configService.get<string>('MAIL_FROM_NAME', 'Sistema Yavirac');
    const user = this.configService.get<string>('MAIL_USER', '');
    return `"${name}" <${user}>`;
  }

  private renderTemplate(templateName: string, context: any): string {
    const templatesDir = path.join(__dirname, 'templates');
    const templatePath = path.join(templatesDir, `${templateName}.hbs`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`La plantilla de correo no existe en la ruta: ${templatePath}`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = Handlebars.compile(templateSource);
    return compiledTemplate(context);
  }

  // Envío de credenciales al registrar un nuevo usuario
  async sendWelcomeCredentials(params: {
    to: string;
    nombres: string;
    cedula: string;
    correoInstitucional: string;
    passwordTemporal: string;
    esDocente: boolean;
  }): Promise<void> {
    const loginUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:3000');
    const logoUrl = this.configService.get<string>('LOGO_URL') || `${backendUrl}/public/logo.jpg`;
    const anio = new Date().getFullYear();

    try {
      const html = this.renderTemplate('welcome', {
        nombres: params.nombres || params.cedula,
        cedula: params.cedula,
        correoInstitucional: params.correoInstitucional,
        passwordTemporal: params.passwordTemporal,
        esDocente: params.esDocente,
        loginUrl,
        logoUrl,
        anio,
      });

      await this.transporter.sendMail({
        from: this.fromAddress,
        to: params.to,
        subject: 'Bienvenido — Sistema de Gestión de Bienes Públicos y Bodega',
        html,
      });
      this.logger.log(`Credenciales enviadas a: ${params.to}`);
    } catch (error) {
      this.logger.error(`Error al enviar credenciales a ${params.to}`, error);
    }
  }

  // Envío de enlace de recuperación de contraseña
  async sendPasswordReset(params: {
    to: string;
    nombres: string;
    resetUrl: string;
  }): Promise<void> {
    const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:3000');
    const logoUrl = this.configService.get<string>('LOGO_URL') || `${backendUrl}/public/logo.jpg`;
    const anio = new Date().getFullYear();

    try {
      const html = this.renderTemplate('reset-password', {
        nombres: params.nombres || 'Usuario',
        resetUrl: params.resetUrl,
        expiraEn: '5 minutos',
        logoUrl,
        anio,
      });

      await this.transporter.sendMail({
        from: this.fromAddress,
        to: params.to,
        subject: 'Restablecimiento de Contraseña — Sistema Yavirac',
        html,
      });
      this.logger.log(`Enlace de recuperación enviado a: ${params.to}`);
    } catch (error) {
      this.logger.error(`Error al enviar enlace de recuperación a ${params.to}`, error);
    }
  }
}
