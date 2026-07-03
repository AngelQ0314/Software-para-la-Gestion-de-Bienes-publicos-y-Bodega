import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  const expectedRoles: string[] = route.data?.['roles'] || [];

  if (user && expectedRoles.includes(user.rol)) {
    return true;
  }

  console.warn(`[RoleGuard] Acceso denegado a la ruta: ${state.url}`);
  
  if (user) {
    router.navigate([user.rol === 'DOCENTE' ? '/docente' : '/admin']);
  } else {
    router.navigate(['/auth/login']);
  }
  return false;
};
