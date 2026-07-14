import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { SpacesService } from '../../../core/services/spaces.service';
import { IncidentsService } from '../../../core/services/incidents.service';
import { RequestsService } from '../../../core/services/requests.service';

@Component({
  selector: 'app-docente-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './docente-dashboard.component.html',
  styleUrl: './docente-dashboard.component.css'
})
export class DocenteDashboardComponent implements OnInit {
  currentUser = computed(() => this.authService.currentUser());

  userFullName = computed(() => {
    const u = this.currentUser();
    return u ? `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.cedula : '';
  });

  userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return 'U';
    const n = (u.nombres || '').trim();
    const a = (u.apellidos || '').trim();
    if (n && a) return (n[0] + a[0]).toUpperCase();
    return u.cedula?.substring(0, 2) || 'U';
  });

  userEmail = computed(() => {
    const u = this.currentUser();
    return u?.correoInstitucional || 'Sin correo registrado';
  });

  // Estadísticas dinámicas
  spacesCount = signal(0);
  pendingRequestsCount = signal(0);
  openIncidentsCount = signal(0);
  statsLoading = signal(true);

  // Modal de perfil
  showProfileModal = signal(false);
  profileForm: FormGroup;
  profileLoading = signal(false);
  profileErrorMessage = signal<string | null>(null);
  profileSuccessMessage = signal<string | null>(null);

  // Fecha actual
  today = new Date();

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly spacesService: SpacesService,
    private readonly incidentsService: IncidentsService,
    private readonly requestsService: RequestsService,
  ) {
    this.profileForm = this.fb.group({
      nombres: ['', [Validators.required]],
      apellidos: ['', [Validators.required]],
      correoSecundario: ['', [Validators.email]],
      telefono: [''],
    });
  }

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.statsLoading.set(true);

    // Cargar espacios asignados
    this.spacesService.getAllSpaces().subscribe({
      next: (spaces: any[]) => this.spacesCount.set(spaces.length),
      error: () => this.spacesCount.set(0),
    });

    // Cargar solicitudes pendientes (mis solicitudes)
    this.requestsService.getAllRequests().subscribe({
      next: (res: any) => {
        const list = res.data || res || [];
        const pending = list.filter((r: any) => r.status === 'EN_PROCESO').length;
        this.pendingRequestsCount.set(pending);
        this.statsLoading.set(false);
      },
      error: () => { this.pendingRequestsCount.set(0); this.statsLoading.set(false); },
    });

    // Cargar incidencias abiertas
    this.incidentsService.getAllIncidents().subscribe({
      next: (res: any) => {
        const list = res.data || res || [];
        const open = list.filter((i: any) => i.status === 'PENDIENTE' || i.status === 'REVISADO').length;
        this.openIncidentsCount.set(open);
      },
      error: () => this.openIncidentsCount.set(0),
    });
  }

  openProfileModal(): void {
    this.authService.refreshCurrentUser().subscribe({
      next: () => this.patchProfileForm(),
      error: () => this.patchProfileForm(),
    });
    this.profileErrorMessage.set(null);
    this.profileSuccessMessage.set(null);
    this.showProfileModal.set(true);
  }

  private patchProfileForm(): void {
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
        setTimeout(() => this.closeProfileModal(), 1500);
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
}
