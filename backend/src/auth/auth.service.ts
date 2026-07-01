import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { UserStatus } from '../users/entities/user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  //Validar credenciales
  async validateUser(identifier: string, password: string) {
    const user = await this.usersService.findByCredential(identifier);

    if (!user)
      throw new UnauthorizedException('Credenciales incorrectas');

    if (user.estado === UserStatus.INACTIVO)
      throw new UnauthorizedException(
        'Tu cuenta está inactiva. Contacta al administrador',
      );

    if (user.estado === UserStatus.DADO_DE_BAJA)
      throw new UnauthorizedException('Tu cuenta ha sido dada de baja');

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
      throw new UnauthorizedException('Credenciales incorrectas');

    return user;
  }

  //Login y emisión de JWT
  async login(identifier: string, password: string) {
    const user = await this.validateUser(identifier, password);

    const payload = {
      sub: user.id,
      cedula: user.cedula,
      rol: user.rol,
      estado: user.estado,
      isFirstLogin: user.isFirstLogin,
      profileCompleted: user.profileCompleted,
    };

    const token = this.jwtService.sign(payload);

    //Determinar el siguiente paso del usuario
    let nextStep: string | null = null;
    if (user.estado === UserStatus.PENDIENTE) {
      nextStep = user.isFirstLogin
        ? 'MUST_CHANGE_PASSWORD'
        : 'MUST_COMPLETE_PROFILE';
    }

    return {
      access_token: token,
      nextStep,
      user: {
        id: user.id,
        cedula: user.cedula,
        nombres: user.nombres,
        apellidos: user.apellidos,
        rol: user.rol,
        estado: user.estado,
        isFirstLogin: user.isFirstLogin,
        profileCompleted: user.profileCompleted,
      },
    };
  }

  //Cambio obligatorio de contraseña inicial
  async changeInitialPassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findOne(userId);

    if (!user.isFirstLogin)
      throw new BadRequestException(
        'Esta acción solo aplica para el primer inicio de sesión',
      );

    const match = await bcrypt.compare(dto.currentPassword, user.password);
    if (!match)
      throw new BadRequestException('La contraseña actual no es correcta');

    if (dto.newPassword !== dto.confirmPassword)
      throw new BadRequestException('Las contraseñas nuevas no coinciden');

    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException(
        'La nueva contraseña no puede ser igual a la temporal',
      );

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updateUser(userId, {
      password: hashed,
      isFirstLogin: false,
    });

    return {
      message:
        'Contraseña actualizada. Por favor completa tu información personal.',
      nextStep: 'MUST_COMPLETE_PROFILE',
    };
  }

  //Completar información personal
  async completeProfile(userId: string, dto: CompleteProfileDto) {
    const user = await this.usersService.findOne(userId);

    if (user.isFirstLogin)
      throw new BadRequestException('Debes cambiar tu contraseña primero');

    if (user.profileCompleted)
      throw new BadRequestException('El perfil ya fue completado');

    // Evitar que el correo secundario sea igual al institucional propio
    if (dto.correoSecundario && dto.correoSecundario.toLowerCase() === user.correoInstitucional.toLowerCase()) {
      throw new BadRequestException(
        'El correo secundario no puede ser igual al correo institucional.',
      );
    }

    // Evitar que el correo secundario ya esté registrado en otra cuenta del sistema
    if (dto.correoSecundario) {
      const existeCorreoSec = await this.usersService.findByEmailAnywhere(dto.correoSecundario);
      if (existeCorreoSec && existeCorreoSec.id !== userId) {
        throw new BadRequestException(
          'El correo secundario ya está registrado en el sistema por otro usuario.',
        );
      }
    }

    await this.usersService.updateUser(userId, {
      nombres: dto.nombres.toUpperCase(),
      apellidos: dto.apellidos.toUpperCase(),
      correoSecundario: dto.correoSecundario,
      telefono: dto.telefono,
      profileCompleted: true,
      estado: UserStatus.ACTIVO, // La cuenta se activa al completar el perfil
    });

    return {
      message: 'Perfil completado. Bienvenido al sistema.',
      redirectTo: user.rol, // el frontend redirige según el rol
    };
  }

  // Solicitar recuperación de contraseña 
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByCredential(dto.correo);

    // Por seguridad, si no existe o está inhabilitado, respondemos lo mismo
    if (!user || user.estado === UserStatus.INACTIVO || user.estado === UserStatus.DADO_DE_BAJA) {
      return {
        message:
          'Si el correo está registrado, recibirás un enlace en breve.',
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 30);

    await this.usersService.updateUser(user.id, {
      resetToken: token,
      resetTokenExpires: expires,
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/reset-password?token=${token}`;

    await this.mailService.sendPasswordReset({
      to: user.correoInstitucional,
      nombres: user.nombres || user.cedula,
      resetUrl,
    });

    const response: any = {
      message: 'Si el correo está registrado, recibirás un enlace en breve.',
    };

    if (process.env.NODE_ENV === 'development') {
      response.dev_token = token;
    }

    return response;
  }

  //Validar token y establecer nueva contraseña 
  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword)
      throw new BadRequestException('Las contraseñas no coinciden');

    //buscar usuario con ese token
    const user = await this.usersService.findByResetToken(dto.token);

    if (!user)
      throw new BadRequestException(
        'El enlace de recuperación no es válido o ya fue utilizado.',
      );

    // Bloquear si el usuario fue desactivado/dado de baja
    if (user.estado === UserStatus.INACTIVO || user.estado === UserStatus.DADO_DE_BAJA) {
      throw new BadRequestException(
        'No se puede restablecer la contraseña. La cuenta está inactiva o dada de baja.',
      );
    }

    //validar expiración del token
    if (!user.resetTokenExpires || user.resetTokenExpires < new Date())
      throw new BadRequestException(
        'El enlace de recuperación ha expirado. Solicita uno nuevo.',
      );

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updateUser(user.id, {
      password: hashed,
      resetToken: null,
      resetTokenExpires: null,
      isFirstLogin: false,
    });

    return {
      message:
        'Contraseña actualizada correctamente. Ya puedes iniciar sesión.',
    };
  }

  //Validar si el token de restablecimiento es apto para uso
  async validateResetToken(token: string) {
    const user = await this.usersService.findByResetToken(token);

    if (!user) {
      return { valid: false, message: 'El enlace de recuperación no es válido o ya fue utilizado.' };
    }

    if (user.estado === UserStatus.INACTIVO || user.estado === UserStatus.DADO_DE_BAJA) {
      return { valid: false, message: 'La cuenta asociada a este enlace se encuentra inhabilitada.' };
    }

    if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return { valid: false, message: 'El enlace de recuperación ha expirado. Solicita uno nuevo.' };
    }

    return { valid: true };
  }

  //Cierre de sesión
  logout() {
    return { message: 'Sesión cerrada correctamente' };
  }

  //Cambio voluntario de contraseña
  async updatePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findOne(userId);

    const match = await bcrypt.compare(dto.currentPassword, user.password);
    if (!match)
      throw new BadRequestException('La contraseña actual no es correcta');

    if (dto.newPassword !== dto.confirmPassword)
      throw new BadRequestException('Las contraseñas nuevas no coinciden');

    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException(
        'La nueva contraseña no puede ser igual a la actual',
      );

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updateUser(userId, {
      password: hashed,
    });

    return { message: 'Contraseña actualizada correctamente' };
  }
}
