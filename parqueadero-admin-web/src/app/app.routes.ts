import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login').then(component => component.Login)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard').then(component => component.Dashboard)
  },
  {
    path: 'usuarios',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/users/users').then(component => component.Users)
  },
  {
    path: 'vehiculos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/vehicles/vehicles').then(component => component.Vehicles)
  },
  {
    path: 'tickets',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/payments/payments').then(component => component.Payments)
  },
  {
    path: 'configuracion',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/settings').then(component => component.Settings)
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' }
];
