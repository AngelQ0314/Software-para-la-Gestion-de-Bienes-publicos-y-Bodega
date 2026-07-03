import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

import { AdminLayoutComponent } from './features/admin/layout/admin-layout.component';

export const routes: Routes = [
  // Rutas Públicas / Autenticación (protegidas para redirigir si ya está logueado)
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then(
        (m) => m.LoginComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'auth/change-password',
    loadComponent: () =>
      import('./features/auth/pages/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'auth/complete-profile',
    loadComponent: () =>
      import('./features/auth/pages/complete-profile/complete-profile.component').then(
        (m) => m.CompleteProfileComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./features/auth/pages/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
  },

  // Rutas Protegidas de Administración (Panel principal + Gestión de Usuarios + Inventario)
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMINISTRADOR', 'RESPONSABLE_DE_BIENES'] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/users/users-list.component').then(
            (m) => m.UsersListComponent
          ),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/admin/inventory/items-list/items-list.component').then(
            (m) => m.ItemsListComponent
          ),
      },
      {
        path: 'inventory/config',
        loadComponent: () =>
          import('./features/admin/inventory/inventory-config/inventory-config.component').then(
            (m) => m.InventoryConfigComponent
          ),
      },
    ],
  },

  // Rutas Protegidas de Docente
  {
    path: 'docente',
    loadComponent: () =>
      import('./features/docente/dashboard/docente-dashboard.component').then(
        (m) => m.DocenteDashboardComponent
      ),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['DOCENTE'] },
  },

  // Redirecciones por defecto
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
