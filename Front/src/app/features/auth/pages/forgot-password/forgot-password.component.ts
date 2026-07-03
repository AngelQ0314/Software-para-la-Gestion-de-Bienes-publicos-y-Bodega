import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  forgotForm: FormGroup;
  isLoading = signal(false);
  submitted = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  devToken = signal<string | null>(null);

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.forgotForm = this.fb.group({
      correo: ['', [Validators.required, Validators.email]]
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.forgotForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit(): void {
    if (this.forgotForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { correo } = this.forgotForm.value;

    this.authService.forgotPassword(correo).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.submitted.set(true);
        this.successMessage.set(res.message);
        if (res.dev_token) {
          this.devToken.set(res.dev_token);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const backendMsg = err.error?.message || 'Error al enviar el enlace. Verifica tus datos.';
        this.errorMessage.set(backendMsg);
      }
    });
  }

  goToResetWithToken(): void {
    const token = this.devToken();
    if (token) {
      this.router.navigate(['/auth/reset-password'], { queryParams: { token } });
    }
  }
}
