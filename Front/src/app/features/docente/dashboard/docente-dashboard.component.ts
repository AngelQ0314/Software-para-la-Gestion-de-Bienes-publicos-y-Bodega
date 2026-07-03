import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-docente-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './docente-dashboard.component.html',
  styleUrl: './docente-dashboard.component.css'
})
export class DocenteDashboardComponent {
  currentUser = computed(() => this.authService.currentUser());

  userFullName = computed(() => {
    const u = this.currentUser();
    return u ? `${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.cedula : '';
  });

  // Modal de perfil
  showProfileModal = signal(false);
  profileForm: FormGroup;
  profileLoading = signal(false);
  profileErrorMessage = signal<string | null>(null);
  profileSuccessMessage = signal<string | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly fb: FormBuilder
  ) {
    this.profileForm = this.fb.group({
      nombres: ['', [Validators.required]],
      apellidos: ['', [Validators.required]],
      correoSecundario: ['', [Validators.email]],
      telefono: [''],
    });
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
    this.router.navigate(['/auth/login']);
  }
}
