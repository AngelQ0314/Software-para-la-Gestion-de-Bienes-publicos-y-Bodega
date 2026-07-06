import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, Not } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { UserLog, LogType } from './entities/user-log.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserLog)
    private readonly logRepo: Repository<UserLog>,
    private readonly mailService: MailService,
  ) { }

  async create(dto: CreateUserDto): Promise<{ message: string; user: Partial<User> }> {
    // Verificar duplicados de cédula
    const existeCedula = await this.userRepo.findOne({
      where: { cedula: dto.cedula },
    });
    if (existeCedula) {
      throw new ConflictException('Ya existe un usuario con esa cédula');
    }

    // Verificar duplicados de correo en todo el sistema (institucional o secundario)
    const existeCorreo = await this.findByEmailAnywhere(dto.correoInstitucional);
    if (existeCorreo) {
      throw new ConflictException(
        'El correo institucional ya está registrado en el sistema (como correo principal o secundario).',
      );
    }

    if (dto.rol === UserRole.RESPONSABLE_DE_BIENES) {
      const existeResponsable = await this.userRepo.findOne({
        where: { rol: UserRole.RESPONSABLE_DE_BIENES },
      });
      if (existeResponsable) {
        throw new BadRequestException(
          'Solo puede haber un Responsable de Bienes registrado en el sistema.',
        );
      }
    }

    let areasUpper: string[] | undefined = undefined;
    let jornadasUpper: string[] | undefined = undefined;
    let horarioIngles: string | undefined = undefined;

    // Solo si es DOCENTE validamos áreas, jornadas y horarios
    if (dto.rol === UserRole.DOCENTE && dto.areas && dto.areas.length > 0) {

      // Validar áreas permitidas
      const areasPermitidas = [
        'DESARROLLO DE SOFTWARE',
        'DISEÑO DE MODAS',
        'GUIA NACIONAL DE TURISMO',
        'ARTE CULINARIO ECUATORIANO',
        'MARKETING DIGITAL',
        'INGLES',
      ];

      const areasInvalidas = dto.areas.filter(
        (area) => !areasPermitidas.includes(area.toUpperCase()),
      );
      if (areasInvalidas.length > 0) {
        throw new BadRequestException(
          `Las siguientes áreas no son válidas: ${areasInvalidas.join(', ')}. Las áreas válidas son: ${areasPermitidas.join(', ')}`,
        );
      }

      areasUpper = dto.areas.map((a) => a.toUpperCase());

      // Si tiene INGLÉS, el horario es obligatorio
      if (areasUpper.includes('INGLES') && !dto.horarioIngles?.trim()) {
        throw new BadRequestException(
          'El horario es obligatorio cuando el área asignada incluye INGLES.',
        );
      }

      // Si tiene áreas diferentes de INGLÉS, las jornadas son obligatorias
      const tieneOtrasAreas = areasUpper.some((a) => a !== 'INGLES');
      if (tieneOtrasAreas && (!dto.jornadas || dto.jornadas.length === 0)) {
        throw new BadRequestException(
          'Debe seleccionar al menos una jornada académica para las áreas que no sean Ingles.',
        );
      }

      // Validar que las jornadas sean correctas (Matutina, Vespertina, Nocturna)
      if (dto.jornadas && dto.jornadas.length > 0) {
        const jornadasPermitidas = ['MATUTINA', 'VESPERTINA', 'NOCTURNA'];
        jornadasUpper = dto.jornadas.map((j) => j.toUpperCase());
        const jornadasInvalidas = jornadasUpper.filter(
          (j) => !jornadasPermitidas.includes(j),
        );
        if (jornadasInvalidas.length > 0) {
          throw new BadRequestException(
            `Las jornadas ingresadas no son válidas. Deben ser: ${jornadasPermitidas.join(', ')}`,
          );
        }
      }

      horarioIngles = areasUpper.includes('INGLES') ? dto.horarioIngles : undefined;
    }

    const nombresUpper = dto.nombres ? dto.nombres.toUpperCase() : undefined;
    const apellidosUpper = dto.apellidos ? dto.apellidos.toUpperCase() : undefined;

    // Si es ADMIN o RESPONSABLE, el perfil se marca completo de fábrica.
    // Si es docente y le ingresaron nombres/apellidos al registrarlo, también se marca como completo.
    const esAdminRol = dto.rol === UserRole.ADMINISTRADOR || dto.rol === UserRole.RESPONSABLE_DE_BIENES;
    const profileCompleted = esAdminRol || (!!nombresUpper && !!apellidosUpper);

    //La contraseña temporal es la cédula hasheada
    const passwordTemporal = dto.cedula;
    const hashedPassword = await bcrypt.hash(passwordTemporal, 10);

    const user = this.userRepo.create({
      cedula: dto.cedula,
      correoInstitucional: dto.correoInstitucional,
      nombres: nombresUpper,
      apellidos: apellidosUpper,
      rol: dto.rol,
      password: hashedPassword,
      estado: UserStatus.PENDIENTE,
      isFirstLogin: true,
      profileCompleted: profileCompleted,
      areas: areasUpper,
      jornadas: jornadasUpper,
      horarioIngles: horarioIngles,
    });

    const saved = await this.userRepo.save(user);

    //Enviar correo con credenciales
    await this.mailService.sendWelcomeCredentials({
      to: dto.correoInstitucional,
      nombres: nombresUpper ? `${nombresUpper} ${apellidosUpper || ''}`.trim() : dto.cedula,
      cedula: dto.cedula,
      correoInstitucional: dto.correoInstitucional,
      passwordTemporal,
      esDocente: dto.rol === UserRole.DOCENTE,
    });

    const { password, resetToken, resetTokenExpires, ...result } = saved;
    return {
      message: 'Usuario registrado correctamente. Se enviaron las credenciales al correo.',
      user: result,
    };
  }

  //Listar y filtrar usuarios
  async findAll(filters: FilterUsersDto) {
    const page = parseInt(filters.page || '1', 10);
    const limit = parseInt(filters.limit || '10', 10);
    const skip = (page - 1) * limit;

    const baseConditions: any = {};
    if (filters.cedula) baseConditions.cedula = ILike(`%${filters.cedula}%`);
    
    // Soporta tanto 'correo' (DTO) como 'correoInstitucional' (Enviado por Angular)
    const emailFilter = filters.correo || (filters as any).correoInstitucional;
    if (emailFilter) baseConditions.correoInstitucional = ILike(`%${emailFilter}%`);
    
    if (filters.estado) baseConditions.estado = filters.estado;
    if (filters.rol) baseConditions.rol = filters.rol;

    let where: any[];
    if (filters.nombre) {
      where = [
        { ...baseConditions, nombres: ILike(`%${filters.nombre}%`) },
        { ...baseConditions, apellidos: ILike(`%${filters.nombre}%`) }
      ];
    } else {
      where = [baseConditions];
    }

    const [users, total] = await this.userRepo.findAndCount({
      where,
      select: {
        id: true,
        cedula: true,
        correoInstitucional: true,
        nombres: true,
        apellidos: true,
        rol: true,
        estado: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: users,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  //Buscar por ID
  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  //Buscar por cédula o correo
  async findByCredential(identifier: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: [
        { cedula: identifier },
        { correoInstitucional: identifier },
      ],
    });
  }

  //Cambiar rol
  async changeRol(
    userId: string,
    newRol: UserRole,
    adminId: string,
  ): Promise<{ message: string }> {
    const user = await this.findOne(userId);

    if (newRol === UserRole.RESPONSABLE_DE_BIENES && user.rol !== UserRole.RESPONSABLE_DE_BIENES) {
      const existeResponsable = await this.userRepo.findOne({
        where: { rol: UserRole.RESPONSABLE_DE_BIENES },
      });
      if (existeResponsable) {
        throw new BadRequestException(
          'Solo puede haber un Responsable de Bienes registrado en el sistema.',
        );
      }
    }

    const valorAnterior = user.rol;

    user.rol = newRol;

    // Si el nuevo rol no es DOCENTE, limpiamos sus campos de docencia
    if (newRol !== UserRole.DOCENTE) {
      user.areas = null;
      user.jornadas = null;
      user.horarioIngles = null;
    }

    await this.userRepo.save(user);

    await this.registrarLog({
      userId,
      adminId,
      tipoCambio: LogType.CAMBIO_ROL,
      valorAnterior,
      valorNuevo: newRol,
    });

    return { message: `Rol actualizado a ${newRol}` };
  }

  //Cambiar estado
  async changeEstado(
    userId: string,
    dto: ChangeStatusDto,
    adminId: string,
  ): Promise<{ message: string }> {
    //observación obligatoria para INACTIVO o DADO_DE_BAJA
    if (
      (dto.estado === UserStatus.INACTIVO || dto.estado === UserStatus.DADO_DE_BAJA) &&
      !dto.observacion?.trim()
    ) {
      throw new BadRequestException(
        'La observación es obligatoria para cambiar el estado a Inactivo o Dado de Baja',
      );
    }

    const user = await this.findOne(userId);
    const valorAnterior = user.estado;

    user.estado = dto.estado;
    await this.userRepo.save(user);

    await this.registrarLog({
      userId,
      adminId,
      tipoCambio: LogType.CAMBIO_ESTADO,
      valorAnterior,
      valorNuevo: dto.estado,
      observacion: dto.observacion,
    });

    return { message: `Estado actualizado a ${dto.estado}` };
  }

  //Reset administrativo de contraseña
  async adminResetPassword(
    userId: string,
    adminId: string,
    resetUrl: string,
  ): Promise<{ message: string }> {
    const user = await this.findOne(userId);

    // Evitar restablecer si está inactivo o de baja
    if (user.estado === UserStatus.INACTIVO || user.estado === UserStatus.DADO_DE_BAJA) {
      throw new BadRequestException(
        'No se puede restablecer la contraseña de un usuario inactivo o dado de baja.',
      );
    }

    const token = require('crypto').randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5); // 5 min de vigencia

    user.resetToken = token;
    user.resetTokenExpires = expires;
    await this.userRepo.save(user);

    const fullResetUrl = `${resetUrl}?token=${token}`;

    await this.mailService.sendPasswordReset({
      to: user.correoInstitucional,
      nombres: user.nombres || user.cedula,
      resetUrl: fullResetUrl,
    });

    await this.registrarLog({
      userId,
      adminId,
      tipoCambio: LogType.RESET_PASSWORD,
      observacion: 'Restablecimiento iniciado por administrador',
    });

    return { message: 'Enlace de restablecimiento enviado al correo del usuario' };
  }

  //Historial de cambios
  async getLogs(userId: string) {
    await this.findOne(userId); // Verifica que el usuario exista
    return this.logRepo.find({
      where: { userId },
      relations: { admin: true },
      order: { createdAt: 'DESC' },
      select: {
        id: true,
        tipoCambio: true,
        valorAnterior: true,
        valorNuevo: true,
        observacion: true,
        createdAt: true,
        admin: { id: true, nombres: true, apellidos: true, cedula: true },
      },
    });
  }

  //Helpers internos
  private async registrarLog(data: {
    userId: string;
    adminId: string;
    tipoCambio: LogType;
    valorAnterior?: string;
    valorNuevo?: string;
    observacion?: string;
  }): Promise<void> {
    const log = this.logRepo.create(data);
    await this.logRepo.save(log);
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { resetToken: token } });
  }

  async findByEmailAnywhere(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: [
        { correoInstitucional: email },
        { correoSecundario: email },
      ],
    });
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    await this.userRepo.update(id, data);
    return this.findOne(id);
  }

  // Modificación de datos por parte del administrador
  async updateAdminUser(
    userId: string,
    dto: any,
    adminId: string,
  ): Promise<{ message: string; user: User }> {
    const user = await this.findOne(userId);

    // Si no es docente, rechazamos cualquier intento de meter campos de clase
    if (user.rol !== UserRole.DOCENTE && (dto.areas || dto.jornadas || dto.horarioIngles)) {
      throw new BadRequestException(
        'Los usuarios con roles administrativos (ADMINISTRADOR o RESPONSABLE_DE_BIENES) no pueden tener asignadas áreas, jornadas o horarios de clases.',
      );
    }

    // Si es docente y le están actualizando áreas, validamos
    if (user.rol === UserRole.DOCENTE && dto.areas) {
      if (dto.areas.length === 0) {
        throw new BadRequestException('Un docente debe tener al menos un área de clases asignada.');
      }

      const areasPermitidas = [
        'DESARROLLO DE SOFTWARE',
        'DISEÑO DE MODAS',
        'GUIA NACIONAL DE TURISMO',
        'ARTE CULINARIO ECUATORIANO',
        'MARKETING DIGITAL',
        'INGLES',
      ];

      const areasInvalidas = dto.areas.filter(
        (area) => !areasPermitidas.includes(area.toUpperCase()),
      );
      if (areasInvalidas.length > 0) {
        throw new BadRequestException(
          `Las siguientes áreas no son válidas: ${areasInvalidas.join(', ')}`,
        );
      }

      dto.areas = dto.areas.map((a) => a.toUpperCase());

      if (dto.areas.includes('INGLES') && !dto.horarioIngles?.trim() && !user.horarioIngles) {
        throw new BadRequestException(
          'El horario es obligatorio cuando el área asignada incluye INGLES.',
        );
      }

      const tieneOtrasAreas = dto.areas.some((a) => a !== 'INGLES');
      if (tieneOtrasAreas && (!dto.jornadas || dto.jornadas.length === 0) && (!user.jornadas || user.jornadas.length === 0)) {
        throw new BadRequestException(
          'Debe seleccionar al menos una jornada académica para las áreas que no sean Ingles.',
        );
      }

      if (dto.jornadas && dto.jornadas.length > 0) {
        const jornadasPermitidas = ['MATUTINA', 'VESPERTINA', 'NOCTURNA'];
        dto.jornadas = dto.jornadas.map((j) => j.toUpperCase());
        const jornadasInvalidas = dto.jornadas.filter(
          (j) => !jornadasPermitidas.includes(j),
        );
        if (jornadasInvalidas.length > 0) {
          throw new BadRequestException(
            `Las jornadas ingresadas no son válidas.`,
          );
        }
      }
    }

    // Validación de unicidad de correo secundario si se está actualizando
    if (dto.correoSecundario) {
      if (dto.correoSecundario.toLowerCase() === user.correoInstitucional.toLowerCase()) {
        throw new BadRequestException(
          'El correo secundario no puede ser igual al correo institucional.',
        );
      }
      const existeCorreo = await this.findByEmailAnywhere(dto.correoSecundario);
      if (existeCorreo && existeCorreo.id !== userId) {
        throw new BadRequestException(
          'El correo secundario ya está registrado en el sistema por otro usuario.',
        );
      }
    }

    // Si envía nombres/apellidos, formatear a mayúsculas
    if (dto.nombres) dto.nombres = dto.nombres.toUpperCase();
    if (dto.apellidos) dto.apellidos = dto.apellidos.toUpperCase();

    // Actualizar usuario
    Object.assign(user, dto);
    const updated = await this.userRepo.save(user);

    // Registro de logs de auditoría
    await this.registrarLog({
      userId,
      adminId,
      tipoCambio: LogType.CAMBIO_ESTADO, // Usamos LogType genérico para registrar ediciones
      observacion: 'Datos de perfil modificados por el administrador',
    });

    return {
      message: 'Usuario actualizado correctamente',
      user: updated,
    };
  }
}
