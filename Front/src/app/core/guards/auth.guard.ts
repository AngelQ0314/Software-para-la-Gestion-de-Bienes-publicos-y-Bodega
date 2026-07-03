import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuthenticated = authService.isAuthenticated();
  const user = authService.currentUser();

  if (isAuthenticated && user) {
    // Si es primer login, forzar cambio de clave
    if (user.isFirstLogin) {
      if (state.url !== '/auth/change-password') {
        router.navigate(['/auth/change-password']);
        return false;
      }
      return true;
    }

    // Si falta completar el perfil (solo docentes)
    if (!user.profileCompleted && user.rol === 'DOCENTE') {
      if (state.url !== '/auth/complete-profile') {
        router.navigate(['/auth/complete-profile']);
        return false;
      }
      return true;
    }

    // Si la sesión está activa y el perfil completo, no permitir ir a ninguna ruta /auth
    if (state.url.startsWith('/auth')) {
      router.navigate([user.rol === 'DOCENTE' ? '/docente' : '/admin']);
      return false;
    }

    return true;
  }

  // Si no está autenticado
  const urlPath = state.url.split('?')[0];
  const publicAuthRoutes = ['/auth/login', '/auth/forgot-password', '/auth/reset-password'];

  if (!publicAuthRoutes.includes(urlPath)) {
    router.navigate(['/auth/login']);
    return false;
  }

  return true;
};
