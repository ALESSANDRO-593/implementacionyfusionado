import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Rol, ROLES_ALERTAS, ROLES_TICKETS } from '../../../core/auth/roles';

interface NavItem { id: string; label: string; icon: string; route: string; }

const CEDULA_ADMIN_PARKING = '1709918914';

/**
 * Navegación del Panel. Los ítems salen del `rol_id`, igual que los guards,
 * de modo que un docente ve exactamente los apartados a los que su rol da acceso.
 */
@Component({
  selector: 'app-panel-sidebar',
  standalone: true,
  templateUrl: './panel-sidebar.html',
  styleUrl: './panel-sidebar.scss',
})
export class PanelSidebar {
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Ítem activo: 'dashboard' | 'tickets' | 'alertas' | 'carga'. */
  active = input<string>('');

  get items(): NavItem[] {
    const rolId = this.auth.rolId();
    const items: NavItem[] = [];
    if (rolId === null) return items;

    if (rolId === Rol.SUPERADMIN || ROLES_TICKETS.includes(rolId)) {
      items.push({ id: 'dashboard', label: 'Dashboard', icon: '🏠', route: '/panel/dashboard' });
      items.push({ id: 'tickets', label: 'Tickets', icon: '🎫', route: '/panel/tickets' });
    }
    if (ROLES_ALERTAS.includes(rolId)) {
      items.push({ id: 'alertas', label: 'Alertas', icon: '🔔', route: '/panel/alertas' });
    }
    if (rolId === Rol.SUPERADMIN) {
      items.push({ id: 'carga', label: 'Carga Masiva', icon: '📤', route: '/panel/carga' });
    }
    return items;
  }

  get mostrarAccesoParqueadero(): boolean {
    return this.auth.cedula() === CEDULA_ADMIN_PARKING;
  }

  ir(route: string) { this.router.navigateByUrl(route); }
  salir() { this.auth.logout(); this.router.navigateByUrl('/panel/login'); }
}
