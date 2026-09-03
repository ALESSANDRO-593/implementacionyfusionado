import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ROLES_VER_TICKETS } from '../auth/roles';

/**
 * Home por defecto según el rol_id: quien audita tramites aterriza en el
 * Dashboard de tickets; el resto (docentes y laboratorios) va a Alertas.
 * Se decide por los roles de tickets —no por los de alertas— porque a estas
 * ultimas entra todo el personal, y aun asi coordinación, vinculación y
 * secretaría deben seguir empezando en su bandeja de tickets.
 */
export function homeForRol(rolId: number | null): string {
  if (rolId !== null && ROLES_VER_TICKETS.includes(rolId)) return '/panel/dashboard';
  return '/panel/alertas';
}

/**
 * Guard que exige sesión válida y uno de los `rol_id` indicados.
 * Se autoriza por id de rol, nunca por nombre ni por datos fijos: cualquier
 * docente que tenga ese rol_id en la base hereda el mismo acceso.
 */
export function roleGuard(...rolesId: number[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) return router.parseUrl('/panel/login');
    const rolId = auth.rolId();
    if (rolId !== null && rolesId.includes(rolId)) return true;
    return router.parseUrl(homeForRol(rolId));
  };
}
