import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './complete-profile.component.html',
  styleUrl: './complete-profile.component.css'
})
export class CompleteProfileComponent implements OnInit {
  profileForm: FormGroup;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  isDocente = computed(() => this.authService.currentUser()?.rol === 'DOCENTE');

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

  selectedAreas: string[] = [];
  selectedJornadas: string[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.profileForm = this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      correoSecundario: ['', [Validators.email]],
      telefono: ['', [Validators.pattern(/^\+?[0-9]{7,15}$/)]],
      horarioIngles: [''],
    });

    this.profileForm.get('horarioIngles')?.disable();
  }

  ngOnInit(): void {
    this.authService.refreshCurrentUser().subscribe({
      next: (user) => {
        if (user && user.profileCompleted) {
          this.router.navigate([user.rol === 'DOCENTE' ? '/docente' : '/admin']);
        }
      }
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.profileForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  isAreaChecked(area: string): boolean {
    return this.selectedAreas.includes(area);
  }

  onAreaChange(event: any, area: string): void {
    if (event.target.checked) {
      this.selectedAreas.push(area);
    } else {
      this.selectedAreas = this.selectedAreas.filter((a) => a !== area);
    }

    const inglesCtrl = this.profileForm.get('horarioIngles');
    if (this.selectedAreas.includes('INGLES')) {
      inglesCtrl?.enable();
      inglesCtrl?.setValidators([Validators.required, Validators.minLength(5)]);
    } else {
      inglesCtrl?.setValue('');
      inglesCtrl?.disable();
      inglesCtrl?.clearValidators();
    }
    inglesCtrl?.updateValueAndValidity();
  }

  isJornadaChecked(jornada: string): boolean {
    return this.selectedJornadas.includes(jornada);
  }

  onJornadaChange(event: any, jornada: string): void {
    if (event.target.checked) {
      this.selectedJornadas.push(jornada);
    } else {
      this.selectedJornadas = this.selectedJornadas.filter((j) => j !== jornada);
    }
  }

  showEnglishSchedule(): boolean {
    return this.selectedAreas.includes('INGLES');
  }

  showJornadas(): boolean {
    return this.selectedAreas.some((a) => a !== 'INGLES');
  }

  areasError(): boolean {
    return this.isDocente() && this.selectedAreas.length === 0;
  }

  jornadasError(): boolean {
    return this.isDocente() && this.showJornadas() && this.selectedJornadas.length === 0;
  }

  hasDocenteErrors(): boolean {
    return this.areasError() || this.jornadasError();
  }

  onSubmit(): void {
    if (this.profileForm.invalid || this.hasDocenteErrors()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const formValues = this.profileForm.getRawValue();
    const payload: any = {
      nombres: formValues.nombres.trim(),
      apellidos: formValues.apellidos.trim(),
      correoSecundario: formValues.correoSecundario?.trim() || null,
      telefono: formValues.telefono?.trim() || null,
    };

    if (this.isDocente()) {
      payload.areas = this.selectedAreas;
      if (this.showJornadas()) {
        payload.jornadas = this.selectedJornadas;
      }
      if (this.showEnglishSchedule()) {
        payload.horarioIngles = formValues.horarioIngles.trim();
      }
    }

    this.authService.completeProfile(payload).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.successMessage.set(res.message);
        
        setTimeout(() => {
          const user = this.authService.currentUser();
          const targetRol = res?.redirectTo || user?.rol || 'DOCENTE';
          this.router.navigate([targetRol === 'DOCENTE' ? '/docente' : '/admin']);
        }, 1500);
      },
      error: (err) => {
        const backendMsg = err.error?.message || 'Error al completar el perfil. Revisa los datos.';
        
        if (backendMsg.includes('ya fue completado')) {
          this.isLoading.set(true);
          this.errorMessage.set(null);
          this.successMessage.set('El perfil ya se encuentra completado. Redirigiendo al panel...');
          this.authService.refreshCurrentUser().subscribe({
            next: (user) => {
              setTimeout(() => {
                this.router.navigate([user.rol === 'DOCENTE' ? '/docente' : '/admin']);
              }, 1500);
            }
          });
        } else {
          this.isLoading.set(false);
          this.errorMessage.set(backendMsg);
        }
      }
    });
  }
}
