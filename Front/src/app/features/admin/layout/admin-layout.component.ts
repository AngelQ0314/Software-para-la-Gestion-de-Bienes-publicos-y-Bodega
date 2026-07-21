import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { UsersService } from '../users/services/users.service';
import { ThemeService } from '../../../core/services/theme.service';
import { NotificationsService, SystemNotification } from '../../../core/services/notifications.service';
import { SearchService } from '../../../core/services/search.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css'
})
export class AdminLayoutComponent {
  isDarkMode = computed(() => this.themeService.isDarkMode());
  showNotifications = signal(false);
  notifications = computed(() => this.notificationsService.notifications());
  unreadCount = computed(() => this.notificationsService.unreadCount());
  currentUser = computed(() => this.authService.currentUser());
  isAdmin = computed(() => this.currentUser()?.rol === 'ADMINISTRADOR');

  userFullName = computed(() => {
    const u = this.currentUser();
    return u ? `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.cedula : 'Usuario';
  });

  userRole = computed(() => {
    const r = this.currentUser()?.rol || '';
    if (r === 'ADMINISTRADOR') return 'Administrador';
    if (r === 'RESPONSABLE_DE_BIENES') return 'Responsable de Bienes';
    return r;
  });

  userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return 'US';
    const n = (u.nombres || '').trim();
    const a = (u.apellidos || '').trim();
    if (n && a) {
      return (n[0] + a[0]).toUpperCase();
    }
    return u.cedula.substring(0, 2);
  });

  activeRouteTitle = signal('Dashboard');

  // Perfil de Usuario Modal
  showProfileModal = signal(false);
  profileForm: FormGroup;
  profileLoading = signal(false);
  profileErrorMessage = signal<string | null>(null);
  profileSuccessMessage = signal<string | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly themeService: ThemeService,
    private readonly notificationsService: NotificationsService,
    public readonly searchService: SearchService
  ) {
    this.updateTitle(this.router.url);

    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.updateTitle(event.urlAfterRedirects || event.url);
    });

    this.profileForm = this.fb.group({
      nombres: ['', [Validators.required]],
      apellidos: ['', [Validators.required]],
      correoSecundario: ['', [Validators.email]],
      telefono: [''],
    });
  }

  updateTitle(url: string): void {
    if (url.includes('/admin/users')) {
      this.activeRouteTitle.set('Usuarios');
    } else if (url.includes('/admin/inventory/config')) {
      this.activeRouteTitle.set('Configuración');
    } else if (url.includes('/admin/inventory')) {
      this.activeRouteTitle.set('Bienes e Inventario');
    } else if (url.includes('/admin/spaces')) {
      this.activeRouteTitle.set('Espacios Físicos');
    } else if (url.includes('/admin/periods')) {
      this.activeRouteTitle.set('Períodos Académicos');
    } else if (url.includes('/admin/requests')) {
      this.activeRouteTitle.set('Solicitudes y Actas');
    } else if (url.includes('/admin/reports')) {
      this.activeRouteTitle.set('Reportes e Inventario');
    } else {
      this.activeRouteTitle.set('Dashboard');
    }
  }

  openProfileModal(): void {
    // Refrescar usuario desde el servidor para tener datos actualizados
    this.authService.refreshCurrentUser().subscribe({
      next: () => {
        const u = this.currentUser();
        if (u) {
          this.profileForm.patchValue({
            nombres: u.nombres || '',
            apellidos: u.apellidos || '',
            correoSecundario: u.correoSecundario || '',
            telefono: u.telefono || '',
          });
        }
      },
      error: () => {
        // Si falla el refresh, cargar igual con los datos en caché
        const u = this.currentUser();
        if (u) {
          this.profileForm.patchValue({
            nombres: u.nombres || '',
            apellidos: u.apellidos || '',
            correoSecundario: u.correoSecundario || '',
            telefono: u.telefono || '',
          });
        }
      }
    });
    this.profileErrorMessage.set(null);
    this.profileSuccessMessage.set(null);
    this.showProfileModal.set(true);
  }

  closeProfileModal(): void {
    this.showProfileModal.set(false);
  }

  isProfileFieldInvalid(field: string): boolean {
    const ctrl = this.profileForm.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  onProfileSubmit(): void {
    if (this.profileForm.invalid) return;

    this.profileLoading.set(true);
    this.profileErrorMessage.set(null);
    this.profileSuccessMessage.set(null);

    const u = this.currentUser();
    if (!u) return;

    this.authService.updateProfile(this.profileForm.value).subscribe({
      next: () => {
        this.profileLoading.set(false);
        this.profileSuccessMessage.set('Perfil actualizado con éxito.');
        
        setTimeout(() => {
          this.closeProfileModal();
        }, 1500);
      },
      error: (err) => {
        this.profileLoading.set(false);
        this.profileErrorMessage.set(err.error?.message || 'Error al actualizar el perfil.');
      }
    });
  }

  onLogout(): void {
    this.authService.logout();
    window.location.href = '/auth/login';
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleNotifications(): void {
    const show = !this.showNotifications();
    this.showNotifications.set(show);
    if (show) {
      this.notificationsService.refreshSystemNotifications();
    }
  }

  markAllAsRead(): void {
    this.notificationsService.markAllAsRead();
  }

  onNotificationClick(notif: SystemNotification): void {
    this.notificationsService.markAsRead(notif.id);
    this.showNotifications.set(false);
    if (notif.route) {
      this.router.navigate([notif.route]);
    }
  }
}
