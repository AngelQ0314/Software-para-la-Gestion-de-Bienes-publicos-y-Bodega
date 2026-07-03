import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css'
})
export class ChangePasswordComponent {
  passwordForm: FormGroup;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    const newPass = g.get('newPassword')?.value;
    const confirmPass = g.get('confirmPassword')?.value;
    return newPass === confirmPass ? null : { mismatch: true };
  }

  isFieldInvalid(field: string): boolean {
    const control = this.passwordForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  hasMinLength(): boolean {
    const val = this.passwordForm.get('newPassword')?.value || '';
    return val.length >= 8;
  }

  hasUppercase(): boolean {
    const val = this.passwordForm.get('newPassword')?.value || '';
    return /[A-Z]/.test(val);
  }

  hasLowercase(): boolean {
    const val = this.passwordForm.get('newPassword')?.value || '';
    return /[a-z]/.test(val);
  }

  hasNumber(): boolean {
    const val = this.passwordForm.get('newPassword')?.value || '';
    return /\d/.test(val);
  }

  onSubmit(): void {
    if (this.passwordForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;

    this.authService.changeInitialPassword(currentPassword, newPassword, confirmPassword).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.successMessage.set(res.message);
        
        setTimeout(() => {
          this.authService.logout();
          this.router.navigate(['/auth/login']);
        }, 1800);
      },
      error: (err) => {
        const backendMsg = err.error?.message || 'Error al cambiar la contraseña. Verifica tu contraseña temporal.';
        
        // Si el backend dice que ya no es el primer inicio de sesión, significa que la contraseña ya fue cambiada
        if (backendMsg.includes('solo aplica') || backendMsg.includes('primer inicio')) {
          this.isLoading.set(true);
          this.errorMessage.set(null);
          this.successMessage.set('La contraseña ya fue cambiada anteriormente. Redirigiendo...');
          setTimeout(() => {
            this.authService.logout();
            this.router.navigate(['/auth/login']);
          }, 1800);
        } else {
          this.isLoading.set(false);
          this.errorMessage.set(backendMsg);
        }
      }
    });
  }

  onCancel(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
