import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';
import { Rol, ROLES_VER_TICKETS, ROLES_ALERTAS } from './core/auth/roles';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/chatbot/chatbot').then(m => m.Chatbot),
    title: 'YaviBot — Asistente Virtual',
  },
  {
    path: 'verificar/:id',
    loadComponent: () => import('./features/verificar-qr/verificar').then(m => m.Verificar),
    title: 'Verificación de Certificado',
  },
  {
    path: 'panel/login',
    loadComponent: () => import('./features/auth-panel/login').then(m => m.Login),
    title: 'Panel — Iniciar Sesión',
  },
  {
    // Portada del panel: bienvenida e indicadores.
    path: 'panel/dashboard',
    canActivate: [roleGuard(...ROLES_VER_TICKETS)],
    loadComponent: () => import('./features/tickets/dashboard/dashboard').then(m => m.Dashboard),
    title: 'Panel — Dashboard',
  },
  {
    // Bandeja de tickets: búsqueda, filtros y paginación.
    path: 'panel/tickets',
    canActivate: [roleGuard(...ROLES_VER_TICKETS)],
    loadComponent: () => import('./features/tickets/lista/lista').then(m => m.TicketsLista),
    title: 'Panel — Tickets',
  },
  {
    path: 'panel/tickets/:id',
    canActivate: [roleGuard(...ROLES_VER_TICKETS)],
    loadComponent: () => import('./features/tickets/detalle/detalle').then(m => m.Detalle),
    title: 'Panel — Detalle de Ticket',
  },
  {
    path: 'panel/alertas',
    canActivate: [roleGuard(...ROLES_ALERTAS)],
    loadComponent: () => import('./features/alertas/alertas').then(m => m.Alertas),
    title: 'Panel — Alertas',
  },
  {
    path: 'panel/carga',
    canActivate: [roleGuard(Rol.SUPERADMIN)],
    loadComponent: () => import('./features/carga/carga').then(m => m.Carga),
    title: 'Panel — Carga de Matriculados',
  },
  { path: '**', redirectTo: '' },
];
