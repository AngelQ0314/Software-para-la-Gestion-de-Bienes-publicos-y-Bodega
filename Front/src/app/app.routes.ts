import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

import { AdminLayoutComponent } from './features/admin/layout/admin-layout.component';
import { DocenteLayoutComponent } from './features/docente/layout/docente-layout.component';

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
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR'] },
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
        path: 'spaces',
        loadComponent: () =>
          import('./features/admin/spaces/spaces-list.component').then(
            (m) => m.SpacesListComponent
          ),
      },
      {
        path: 'periods',
        loadComponent: () =>
          import('./features/admin/periods/periods-list.component').then(
            (m) => m.PeriodsListComponent
          ),
      },
      {
        path: 'requests',
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR'] },
        loadComponent: () =>
          import('./features/admin/requests/requests-list.component').then(
            (m) => m.RequestsListComponent
          ),
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./features/admin/incidents/incidents-list.component').then(
            (m) => m.IncidentsListComponent
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/admin/reports/reports-list.component').then(
            (m) => m.ReportsListComponent
          ),
      },
    ],
  },

  // Rutas Protegidas de Docente
  {
    path: 'docente',
    component: DocenteLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['DOCENTE'] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/docente/dashboard/docente-dashboard.component').then(
            (m) => m.DocenteDashboardComponent
          ),
      },
      {
        path: 'spaces',
        loadComponent: () =>
          import('./features/docente/spaces/spaces-list.component').then(
            (m) => m.DocenteSpacesListComponent
          ),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('./features/docente/requests/requests-list.component').then(
            (m) => m.DocenteRequestsComponent
          ),
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./features/docente/incidents/incidents-list.component').then(
            (m) => m.DocenteIncidentsComponent
          ),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/docente/inventory/inventory-list.component').then(
            (m) => m.DocenteInventoryComponent
          ),
      },
    ],
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
