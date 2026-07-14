import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { SearchService } from '../../../core/services/search.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-docente-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './docente-layout.component.html',
  styleUrl: './docente-layout.component.css'
})
export class DocenteLayoutComponent {
  isDarkMode = computed(() => this.themeService.isDarkMode());
  currentUser = computed(() => this.authService.currentUser());

  userFullName = computed(() => {
    const u = this.currentUser();
    return u ? `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.cedula : 'Docente';
  });

  userRole = computed(() => {
    return 'Docente';
  });

  userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return 'DC';
    const n = (u.nombres || '').trim();
    const a = (u.apellidos || '').trim();
    if (n && a) {
      return (n[0] + a[0]).toUpperCase();
    }
    return u.cedula.substring(0, 2);
  });

  activeRouteTitle = signal('Dashboard');

  // Perfil Modal
  showProfileModal = signal(false);
  profileForm: FormGroup;
  profileLoading = signal(false);
  profileErrorMessage = signal<string | null>(null);
  profileSuccessMessage = signal<string | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly themeService: ThemeService,
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
    if (url.includes('/docente/spaces')) {
      this.activeRouteTitle.set('Mis Espacios Asignados');
    } else if (url.includes('/docente/requests')) {
      this.activeRouteTitle.set('Mis Solicitudes');
    } else if (url.includes('/docente/incidents')) {
      this.activeRouteTitle.set('Reportar Novedades');
    } else if (url.includes('/docente/inventory')) {
      this.activeRouteTitle.set('Mi Inventario Asignado');
    } else {
      this.activeRouteTitle.set('Dashboard');
    }
  }

  openProfileModal(): void {
    const u = this.currentUser();
    if (u) {
      this.profileForm.patchValue({
        nombres: u.nombres || '',
        apellidos: u.apellidos || '',
        correoSecundario: u.correoSecundario || '',
        telefono: u.telefono || '',
      });
    }
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
}
