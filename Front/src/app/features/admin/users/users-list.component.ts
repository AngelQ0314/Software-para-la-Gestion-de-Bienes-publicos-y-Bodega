import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { UsersService, UserLog } from './services/users.service';
import { User, AuthService } from '../../../core/auth/auth.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { SearchService } from '../../../core/services/search.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.css'
})
export class UsersListComponent implements OnInit {
  users = signal<User[]>([]);
  filteredUsers = computed(() => {
    const q = this.searchService.searchQuery().toLowerCase().trim();
    const list = this.users();
    if (!q) return list;
    return list.filter(u =>
      `${u.nombres || ''} ${u.apellidos || ''} ${u.correoInstitucional || ''} ${u.cedula || ''}`
        .toLowerCase().includes(q)
    );
  });
  loading = signal(false);
  currentPage = signal(1);
  totalPages = signal(1);

  filterForm: FormGroup;
  createUserForm: FormGroup;

  showCreateModal = signal(false);
  showDetailModal = signal(false);

  modalLoading = signal(false);
  modalErrorMessage = signal<string | null>(null);
  modalSuccessMessage = signal<string | null>(null);

  selectedUser = signal<User | null>(null);
  userLogs = signal<UserLog[]>([]);

  activeDetailTab = signal<'info' | 'actions' | 'logs'>('info');

  hasResponsable = signal(false);

  tempRole = 'DOCENTE';
  tempStatus = 'ACTIVO';
  tempObservation = '';

  checkResponsableExist(): void {
    this.usersService.getUsers(1, 1, { rol: 'RESPONSABLE_DE_BIENES' }).subscribe({
      next: (res: any) => {
        this.hasResponsable.set(res.total > 0);
      }
    });
  }

  // Áreas y jornadas editables para el Admin en el modal de acciones
  readonly availableAreas = [
    { label: 'Desarrollo de Software', value: 'DESARROLLO DE SOFTWARE' },
    { label: 'Diseño de Modas', value: 'DISEÑO DE MODAS' },
    { label: 'Guía Nacional de Turismo', value: 'GUIA NACIONAL DE TURISMO' },
    { label: 'Arte Culinario Ecuatoriano', value: 'ARTE CULINARIO ECUATORIANO' },
    { label: 'Marketing Digital', value: 'MARKETING DIGITAL' },
    { label: 'Inglés', value: 'INGLES' },
  ];

  readonly availableJornadas = [
    { label: 'Matutina', value: 'MATUTINA' },
    { label: 'Vespertina', value: 'VESPERTINA' },
    { label: 'Nocturna', value: 'NOCTURNA' },
  ];

  selectedDetailAreas = signal<string[]>([]);
  selectedDetailJornadas = signal<string[]>([]);
  tempHorarioIngles = signal<string>('');

  constructor(
    private readonly fb: FormBuilder,
    private readonly usersService: UsersService,
    public readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
    private readonly searchService: SearchService,
  ) {
    this.filterForm = this.fb.group({
      cedula: [''],
      correoInstitucional: [''],
      rol: [''],
      estado: [''],
      area: [''],
      jornada: ['']
    });

    // Filtros reactivos instantáneos
    this.filterForm.valueChanges.subscribe(() => {
      this.currentPage.set(1);
      this.loadUsers();
    });
    this.createUserForm = this.fb.group({
      cedula: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      correoInstitucional: ['', [Validators.required, Validators.email, Validators.pattern(/^[a-zA-Z0-9._%+-]+@yavirac\.edu\.ec$/)]],
      rol: ['DOCENTE', [Validators.required]],
    });
  }

  ngOnInit(): void { this.loadUsers(); this.checkResponsableExist(); }

  loadUsers(): void {
    this.loading.set(true);
    this.usersService.getUsers(this.currentPage(), 10, this.filterForm.value).subscribe({
      next: (res: any) => {
        let list = res.data || [];
        const cid = this.authService.currentUser()?.id;
        if (cid) list = [...list].sort((a: any, b: any) => a.id === cid ? -1 : b.id === cid ? 1 : 0);
        this.users.set(list);
        this.totalPages.set(res.lastPage || 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void { this.currentPage.set(1); this.loadUsers(); }
  resetFilters(): void {
    this.filterForm.reset({
      cedula: '',
      correoInstitucional: '',
      rol: '',
      estado: '',
      area: '',
      jornada: ''
    });
    this.currentPage.set(1);
  }
  setPage(p: number): void { this.currentPage.set(p); this.loadUsers(); }

  formatRole(role: string): string {
    return ({ ADMINISTRADOR: 'Admin', DOCENTE: 'Docente', RESPONSABLE_DE_BIENES: 'Resp. Bienes' } as any)[role] || role;
  }

  // ── Crear usuario ────────────────────────────────────────────────────────────
  openCreateModal(): void {
    this.createUserForm.reset({ rol: 'DOCENTE' });
    this.modalErrorMessage.set(null);
    this.showCreateModal.set(true);
  }
  closeCreateModal(): void { this.showCreateModal.set(false); }
  isCreateFieldInvalid(f: string): boolean {
    const c = this.createUserForm.get(f);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }
  onCreateUserSubmit(): void {
    if (this.createUserForm.invalid) return;
    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);
    this.usersService.createUser(this.createUserForm.value).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.notificationsService.addNotification(`Usuario registrado: ${this.createUserForm.value.correoInstitucional}`, 'SUCCESS', 'person_add');
        this.closeCreateModal();
        this.loadUsers();
        this.checkResponsableExist();
      },
      error: (err) => {
        this.modalLoading.set(false);
        this.modalErrorMessage.set(err.error?.message || 'Error al guardar.');
      },
    });
  }

  // ── Modal detalle consolidado ────────────────────────────────────────────────
  openDetailModal(user: User, tab: 'info' | 'actions' | 'logs' = 'info'): void {
    this.selectedUser.set(user);
    this.tempRole = user.rol;
    this.tempStatus = user.estado;
    this.tempObservation = '';
    this.selectedDetailAreas.set(user.areas || []);
    this.selectedDetailJornadas.set(user.jornadas || []);
    this.tempHorarioIngles.set(user.horarioIngles || '');
    this.activeDetailTab.set(tab);
    this.modalErrorMessage.set(null);
    this.modalSuccessMessage.set(null);
    this.userLogs.set([]);
    this.showDetailModal.set(true);
    this.usersService.getUserLogs(user.id).subscribe({ next: (l) => this.userLogs.set(l), error: () => {} });
  }
  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedUser.set(null);
    this.userLogs.set([]);
    this.modalErrorMessage.set(null);
    this.modalSuccessMessage.set(null);
  }
  setDetailTab(tab: 'info' | 'actions' | 'logs'): void {
    this.activeDetailTab.set(tab);
    this.modalErrorMessage.set(null);
    this.modalSuccessMessage.set(null);
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────
  onUpdateRole(): void {
    const user = this.selectedUser(); if (!user) return;

    // 1. El responsable de bienes no puede cambiar de rol
    if (user.rol === 'RESPONSABLE_DE_BIENES' && this.tempRole !== 'RESPONSABLE_DE_BIENES') {
      Swal.fire({
        title: 'Operación no permitida',
        text: 'El Responsable de Bienes no puede cambiar de rol ni perder sus privilegios. Solo debe haber un Responsable de Bienes en el sistema.',
        icon: 'error',
        confirmButtonColor: '#f97316'
      });
      return;
    }

    // 2. Confirmar cambio de Administrador a Docente
    if (user.rol === 'ADMINISTRADOR' && this.tempRole === 'DOCENTE') {
      Swal.fire({
        title: '¿Cambiar a rol Docente?',
        text: '¿Estás seguro de que quieres cambiar este usuario a Docente? Perderá todos los privilegios de administrador.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f97316',
        cancelButtonColor: '#475569',
        confirmButtonText: 'Sí, cambiar rol',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.executeRoleUpdate(user.id, this.tempRole);
        }
      });
      return;
    }

    // 3. Ejecutar cambio de rol directo en los demás casos
    this.executeRoleUpdate(user.id, this.tempRole);
  }

  private executeRoleUpdate(userId: string, role: any): void {
    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);
    this.usersService.updateRole(userId, role).subscribe({
      next: () => {
        this.modalLoading.set(false);
        Swal.fire({
          title: 'Rol actualizado',
          text: 'El rol del usuario ha sido actualizado correctamente.',
          icon: 'success',
          confirmButtonColor: '#f97316'
        });
        this.modalSuccessMessage.set('Rol actualizado correctamente.');
        this.loadUsers();
        this.checkResponsableExist();
        setTimeout(() => this.modalSuccessMessage.set(null), 3000);
      },
      error: (err) => {
        this.modalLoading.set(false);
        const errMsg = err.error?.message || 'Error al actualizar rol.';
        this.modalErrorMessage.set(errMsg);
        Swal.fire({
          title: 'Error',
          text: errMsg,
          icon: 'error',
          confirmButtonColor: '#f97316'
        });
      },
    });
  }

  onUpdateStatus(): void {
    const user = this.selectedUser(); if (!user) return;
    if (this.tempStatus !== 'ACTIVO' && !this.tempObservation.trim()) return;
    this.modalLoading.set(true); this.modalErrorMessage.set(null);
    this.usersService.updateStatus(user.id, this.tempStatus, this.tempObservation.trim()).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.notificationsService.addNotification(`Estado de ${user.nombres} → ${this.tempStatus}`, 'SUCCESS', 'manage_accounts');
        this.modalSuccessMessage.set('Estado actualizado correctamente.');
        this.loadUsers();
        setTimeout(() => this.modalSuccessMessage.set(null), 3000);
      },
      error: (err) => { this.modalLoading.set(false); this.modalErrorMessage.set(err.error?.message || 'Error al cambiar estado.'); },
    });
  }

  onResetPassword(): void {
    const user = this.selectedUser(); if (!user) return;
    if (!confirm(`¿Restablecer contraseña de ${user.correoInstitucional}? La nueva clave será su cédula.`)) return;
    this.usersService.resetPassword(user.id).subscribe({
      next: (res) => {
        this.modalSuccessMessage.set(res.message || 'Contraseña restablecida. Nueva clave: cédula del usuario.');
        setTimeout(() => this.modalSuccessMessage.set(null), 4000);
      },
      error: (err) => this.modalErrorMessage.set(err.error?.message || 'Error al restablecer.'),
    });
  }

  // ── Editar Datos Docente (Carreras, Jornadas y Horario Inglés) ────────────────
  isAreaSelected(area: string): boolean {
    return this.selectedDetailAreas().includes(area);
  }

  isJornadaSelected(jornada: string): boolean {
    return this.selectedDetailJornadas().includes(jornada);
  }

  onDetailAreaChange(event: any, area: string): void {
    let current = [...this.selectedDetailAreas()];
    if (event.target.checked) {
      if (!current.includes(area)) current.push(area);
    } else {
      current = current.filter(a => a !== area);
    }
    this.selectedDetailAreas.set(current);
  }

  onDetailJornadaChange(event: any, jornada: string): void {
    let current = [...this.selectedDetailJornadas()];
    if (event.target.checked) {
      if (!current.includes(jornada)) current.push(jornada);
    } else {
      current = current.filter(j => j !== jornada);
    }
    this.selectedDetailJornadas.set(current);
  }

  onUpdateTeacherData(): void {
    const user = this.selectedUser();
    if (!user) return;
    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);
    this.modalSuccessMessage.set(null);

    const areasList = this.selectedDetailAreas();
    const jornadasList = this.selectedDetailJornadas();

    if (areasList.length === 0) {
      this.modalLoading.set(false);
      this.modalErrorMessage.set('Un docente debe tener al menos un área asignada.');
      return;
    }

    const tieneOtrasAreas = areasList.some(a => a !== 'INGLES');
    if (tieneOtrasAreas && jornadasList.length === 0) {
      this.modalLoading.set(false);
      this.modalErrorMessage.set('Debe seleccionar al menos una jornada para las áreas que no sean inglés.');
      return;
    }

    if (areasList.includes('INGLES') && !this.tempHorarioIngles().trim()) {
      this.modalLoading.set(false);
      this.modalErrorMessage.set('El horario es obligatorio cuando el área asignada incluye Inglés.');
      return;
    }

    const payload = {
      areas: areasList,
      jornadas: jornadasList,
      horarioIngles: areasList.includes('INGLES') ? this.tempHorarioIngles().trim() : null
    };

    this.usersService.updateUser(user.id, payload).subscribe({
      next: (res: any) => {
        this.modalLoading.set(false);
        this.modalSuccessMessage.set('Carreras y jornadas del docente actualizadas.');
        // Actualizar datos localmente en selectedUser
        const updatedUser: User = {
          ...user,
          areas: payload.areas,
          jornadas: payload.jornadas,
          horarioIngles: payload.horarioIngles || undefined
        };
        this.selectedUser.set(updatedUser);
        this.loadUsers();
        setTimeout(() => this.modalSuccessMessage.set(null), 3000);
      },
      error: (err) => {
        this.modalLoading.set(false);
        this.modalErrorMessage.set(err.error?.message || 'Error al actualizar carreras/jornadas.');
      }
    });
  }
}
