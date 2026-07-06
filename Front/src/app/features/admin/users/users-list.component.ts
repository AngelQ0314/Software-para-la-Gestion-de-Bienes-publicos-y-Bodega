import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { UsersService, UserLog } from './services/users.service';
import { User, AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.css'
})
export class UsersListComponent implements OnInit {
  users = signal<User[]>([]);
  loading = signal(false);
  currentPage = signal(1);
  totalPages = signal(1);

  filterForm: FormGroup;
  createUserForm: FormGroup;

  showCreateModal = signal(false);
  showRoleModal = signal(false);
  showStatusModal = signal(false);
  showLogsModal = signal(false);

  modalLoading = signal(false);
  modalErrorMessage = signal<string | null>(null);

  selectedUser = signal<User | null>(null);
  userLogs = signal<UserLog[]>([]);

  tempRole = 'DOCENTE';
  tempStatus = 'ACTIVO';
  tempObservation = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly usersService: UsersService,
    public readonly authService: AuthService,
  ) {
    this.filterForm = this.fb.group({
      cedula: [''],
      correoInstitucional: [''],
      rol: [''],
      estado: [''],
    });

    this.createUserForm = this.fb.group({
      cedula: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      correoInstitucional: ['', [Validators.required, Validators.email, Validators.pattern(/^[a-zA-Z0-9._%+-]+@yavirac\.edu\.ec$/)]],
      rol: ['DOCENTE', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    const filters = this.filterForm.value;
    
    this.usersService.getUsers(this.currentPage(), 10, filters).subscribe({
      next: (res: any) => {
        let list = res.data || [];
        const currentUserId = this.authService.currentUser()?.id;
        
        if (currentUserId) {
          // Coloca al usuario logueado al inicio de la lista
          list = [...list].sort((a: any, b: any) => {
            if (a.id === currentUserId) return -1;
            if (b.id === currentUserId) return 1;
            return 0;
          });
        }
        
        this.users.set(list);
        this.totalPages.set(res.lastPage || 1);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadUsers();
  }

  resetFilters(): void {
    this.filterForm.reset({
      cedula: '',
      correoInstitucional: '',
      rol: '',
      estado: '',
    });
    this.currentPage.set(1);
    this.loadUsers();
  }

  setPage(page: number): void {
    this.currentPage.set(page);
    this.loadUsers();
  }

  formatRole(role: string): string {
    const roles: any = {
      ADMINISTRADOR: 'Admin',
      DOCENTE: 'Docente',
      RESPONSABLE_DE_BIENES: 'Resp. Bienes',
    };
    return roles[role] || role;
  }

  openCreateModal(): void {
    this.createUserForm.reset({ rol: 'DOCENTE' });
    this.modalErrorMessage.set(null);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  isCreateFieldInvalid(field: string): boolean {
    const ctrl = this.createUserForm.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  onCreateUserSubmit(): void {
    if (this.createUserForm.invalid) return;

    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);

    this.usersService.createUser(this.createUserForm.value).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.closeCreateModal();
        this.loadUsers();
      },
      error: (err) => {
        this.modalLoading.set(false);
        this.modalErrorMessage.set(err.error?.message || 'Error al guardar el usuario.');
      },
    });
  }

  openRoleModal(user: User): void {
    this.selectedUser.set(user);
    this.tempRole = user.rol;
    this.modalErrorMessage.set(null);
    this.showRoleModal.set(true);
  }

  closeRoleModal(): void {
    this.showRoleModal.set(false);
    this.selectedUser.set(null);
  }

  onUpdateRole(): void {
    const user = this.selectedUser();
    if (!user) return;

    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);

    this.usersService.updateRole(user.id, this.tempRole).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.closeRoleModal();
        this.loadUsers();
      },
      error: (err) => {
        this.modalLoading.set(false);
        this.modalErrorMessage.set(err.error?.message || 'Error al actualizar el rol.');
      },
    });
  }

  openStatusModal(user: User): void {
    this.selectedUser.set(user);
    this.tempStatus = user.estado;
    this.tempObservation = '';
    this.modalErrorMessage.set(null);
    this.showStatusModal.set(true);
  }

  closeStatusModal(): void {
    this.showStatusModal.set(false);
    this.selectedUser.set(null);
  }

  onUpdateStatus(): void {
    const user = this.selectedUser();
    if (!user) return;

    if (this.tempStatus !== 'ACTIVO' && !this.tempObservation.trim()) {
      return;
    }

    this.modalLoading.set(true);
    this.modalErrorMessage.set(null);

    this.usersService.updateStatus(user.id, this.tempStatus, this.tempObservation.trim()).subscribe({
      next: () => {
        this.modalLoading.set(false);
        this.closeStatusModal();
        this.loadUsers();
      },
      error: (err) => {
        this.modalLoading.set(false);
        this.modalErrorMessage.set(err.error?.message || 'Error al cambiar el estado.');
      },
    });
  }

  resetPassword(user: User): void {
    if (!confirm(`¿Estás seguro de que deseas restablecer la contraseña del usuario ${user.correoInstitucional}? Se establecerá su cédula como contraseña temporal.`)) {
      return;
    }

    this.usersService.resetPassword(user.id).subscribe({
      next: (res) => {
        alert(res.message || 'Contraseña restablecida con éxito.');
        this.loadUsers();
      },
      error: (err) => {
        alert(err.error?.message || 'Error al restablecer la contraseña.');
      },
    });
  }

  viewLogs(user: User): void {
    this.selectedUser.set(user);
    this.modalLoading.set(true);
    this.userLogs.set([]);
    this.showLogsModal.set(true);

    this.usersService.getUserLogs(user.id).subscribe({
      next: (logs) => {
        this.userLogs.set(logs);
        this.modalLoading.set(false);
      },
      error: () => {
        this.modalLoading.set(false);
      },
    });
  }

  closeLogsModal(): void {
    this.showLogsModal.set(false);
    this.selectedUser.set(null);
    this.userLogs.set([]);
  }
}
