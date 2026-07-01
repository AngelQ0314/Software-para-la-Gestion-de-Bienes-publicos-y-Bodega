import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //Inicio de sesión con cédula o correo + contraseña
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  //Cambio obligatorio de contraseña inicial (requiere estar autenticado)
  @Post('change-initial-password')
  @UseGuards(JwtAuthGuard)
  changeInitialPassword(@Body() dto: ChangePasswordDto, @Request() req) {
    return this.authService.changeInitialPassword(req.user.id, dto);
  }

  //Completar información personal (requiere estar autenticado)
  @Post('complete-profile')
  @UseGuards(JwtAuthGuard)
  completeProfile(@Body() dto: CompleteProfileDto, @Request() req) {
    return this.authService.completeProfile(req.user.id, dto);
  }

  //Obtener perfil y rol del usuario autenticado (para que el frontend redirija)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Request() req) {
    return req.user;
  }

  //Solicitar recuperación de contraseña por correo
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  //Validar token y establecer nueva contraseña
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  //Cerrar sesión
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout() {
    return this.authService.logout();
  }

  //Cambio voluntario de contraseña desde la sesión del usuario
  @Post('update-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  updatePassword(@Body() dto: ChangePasswordDto, @Request() req) {
    return this.authService.updatePassword(req.user.id, dto);
  }

  //Validar validez de un token de recuperación (sin autenticación)
  @Get('validate-token/:token')
  @HttpCode(HttpStatus.OK)
  validateToken(@Param('token') token: string) {
    return this.authService.validateResetToken(token);
  }
}
