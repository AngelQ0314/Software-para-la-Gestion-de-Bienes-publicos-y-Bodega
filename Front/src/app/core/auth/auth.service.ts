import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, switchMap, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  cedula: string;
  nombres: string | null;
  apellidos: string | null;
  correoInstitucional: string;
  correoSecundario?: string | null;
  telefono?: string | null;
  rol: 'ADMINISTRADOR' | 'DOCENTE' | 'RESPONSABLE_DE_BIENES';
  estado: 'PENDIENTE' | 'ACTIVO' | 'INACTIVO' | 'DADO_DE_BAJA';
  isFirstLogin: boolean;
  profileCompleted: boolean;
  areas?: string[];
  jornadas?: string[];
  horarioIngles?: string;
}

export interface LoginResponse {
  access_token: string;
  nextStep: 'MUST_CHANGE_PASSWORD' | 'MUST_COMPLETE_PROFILE' | null;
  user: User;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  // Signals para el estado global del usuario
  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly userRole = computed(() => this.currentUser()?.rol || null);

  constructor(private readonly http: HttpClient) {
    this.loadSession();
  }

  // Cargar sesión almacenada
  private loadSession(): void {
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      try {
        this.currentUser.set(JSON.parse(userData));
      } catch {
        this.clearSession();
      }
    }
  }

  // Iniciar Sesión
  login(identifier: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { identifier, password }).pipe(
      tap((res) => {
        localStorage.setItem('access_token', res.access_token);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.currentUser.set(res.user);
      })
    );
  }

  // Actualizar sesión del usuario actual localmente
  updateCurrentUserLocal(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUser.set(user);
  }

  // Cambio obligatorio de contraseña inicial
  changeInitialPassword(currentPassword: string, newPassword: string, confirmPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/change-initial-password`, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
  }

  // Completar Información Personal
  completeProfile(data: {
    nombres: string;
    apellidos: string;
    correoSecundario?: string;
    telefono?: string;
    areas?: string[];
    jornadas?: string[];
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/complete-profile`, data).pipe(
      switchMap((res: any) => {
        return this.refreshCurrentUser().pipe(
          map(() => res)
        );
      })
    );
  }

  // Actualizar Perfil Voluntariamente
  updateProfile(data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/profile`, data).pipe(
      tap(() => {
        this.refreshCurrentUser().subscribe();
      })
    );
  }

  // Obtener datos del usuario autenticado (/me)
  refreshCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      tap((user) => {
        localStorage.setItem('user', JSON.stringify(user));
        this.currentUser.set(user);
      }),
      catchError((err) => {
        this.clearSession();
        return throwError(() => err);
      })
    );
  }

  // Enviar correo de recuperación
  forgotPassword(correo: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { correo });
  }

  // Validar token de recuperación
  validateResetToken(token: string): Observable<{ valid: boolean; message?: string }> {
    return this.http.get<{ valid: boolean; message?: string }>(`${this.apiUrl}/validate-token/${token}`);
  }

  // Restablecer contraseña con token
  resetPassword(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, data);
  }

  // Actualizar contraseña voluntariamente
  updatePassword(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-password`, data);
  }

  // Cerrar Sesión
  logout(): void {
    this.clearSession();
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      next: () => {},
      error: () => {},
    });
  }

  // Limpiar sesión local
  clearSession(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
  }
}
