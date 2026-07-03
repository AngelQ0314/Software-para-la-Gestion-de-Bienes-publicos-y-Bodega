import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  isValidatingToken = signal(true);
  isTokenValid = signal(false);
  isLoading = signal(false);
  resetSuccess = signal(false);
  tokenErrorMessage = signal<string>('El enlace no es válido o ha expirado.');
  errorMessage = signal<string | null>(null);

  private token = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly fb: FormBuilder,
    private readonly authService: AuthService
  ) {
    this.resetForm = this.fb.group({
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      ]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';

      if (!this.token) {
        this.isValidatingToken.set(false);
        this.isTokenValid.set(false);
        this.tokenErrorMessage.set('No se proporcionó un token de recuperación.');
        return;
      }

      this.authService.validateResetToken(this.token).subscribe({
        next: (res) => {
          this.isValidatingToken.set(false);
          this.isTokenValid.set(res.valid);
          if (!res.valid) {
            this.tokenErrorMessage.set(res.message || 'El enlace de recuperación no es válido o ya fue utilizado.');
          }
        },
        error: () => {
          this.isValidatingToken.set(false);
          this.isTokenValid.set(false);
          this.tokenErrorMessage.set('Error de conexión al validar el enlace.');
        }
      });
    });
  }

  passwordMatchValidator(g: FormGroup) {
    const newPass = g.get('newPassword')?.value;
    const confirmPass = g.get('confirmPassword')?.value;
    return newPass === confirmPass ? null : { mismatch: true };
  }

  isFieldInvalid(field: string): boolean {
    const control = this.resetForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  hasMinLength(): boolean {
    const val = this.resetForm.get('newPassword')?.value || '';
    return val.length >= 8;
  }

  hasUppercase(): boolean {
    const val = this.resetForm.get('newPassword')?.value || '';
    return /[A-Z]/.test(val);
  }

  hasLowercase(): boolean {
    const val = this.resetForm.get('newPassword')?.value || '';
    return /[a-z]/.test(val);
  }

  hasNumber(): boolean {
    const val = this.resetForm.get('newPassword')?.value || '';
    return /\d/.test(val);
  }

  onSubmit(): void {
    if (this.resetForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { newPassword, confirmPassword } = this.resetForm.value;

    const payload = {
      token: this.token,
      newPassword,
      confirmPassword
    };

    this.authService.resetPassword(payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.resetSuccess.set(true);
      },
      error: (err) => {
        this.isLoading.set(false);
        const backendMsg = err.error?.message || 'Error al restablecer la contraseña. Solicita un nuevo enlace.';
        this.errorMessage.set(backendMsg);
      }
    });
  }
}
