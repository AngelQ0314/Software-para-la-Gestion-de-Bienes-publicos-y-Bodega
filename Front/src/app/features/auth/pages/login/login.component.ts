import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  currentYear = new Date().getFullYear();

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.loginForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { identifier, password } = this.loginForm.value;

    this.authService.login(identifier, password).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        
        // Redirección inteligente basada en nextStep del backend
        if (res.nextStep === 'MUST_CHANGE_PASSWORD') {
          this.router.navigate(['/auth/change-password']);
        } else if (res.nextStep === 'MUST_COMPLETE_PROFILE') {
          this.router.navigate(['/auth/complete-profile']);
        } else {
          // Si ya completó todo, va al Dashboard correspondiente
          this.router.navigate([res.user.rol === 'DOCENTE' ? '/docente' : '/admin']);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const backendMsg = err.error?.message || 'Error al iniciar sesión. Verifica tus credenciales.';
        this.errorMessage.set(backendMsg);
      }
    });
  }
}
