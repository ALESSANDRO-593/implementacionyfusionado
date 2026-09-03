import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TicketsApi, TicketListItem } from '../data/tickets-api';
import { AuthService } from '../../../core/auth/auth.service';
import { ROL_ETIQUETA } from '../../../core/auth/roles';
import { PanelShell } from '../../../shared/ui/panel-shell/panel-shell';

/** Portada del panel: bienvenida y resumen de los tickets que le competen al rol. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [PanelShell],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private api = inject(TicketsApi);
  private auth = inject(AuthService);
  private router = inject(Router);

  tickets = signal<TicketListItem[]>([]);
  cargando = signal(true);
  nombres = this.auth.nombres();
  rolNombre = (() => {
    const id = this.auth.rolId();
    return id === null ? '' : (ROL_ETIQUETA[id] ?? '');
  })();

  total = computed(() => this.tickets().length);
  pendientes = computed(() => this.tickets().filter(t => t.estado === 'Pendiente').length);
  enProceso = computed(() => this.tickets().filter(t => t.estado === 'En Proceso').length);
  resueltos = computed(() => this.tickets().filter(t => t.estado === 'Resuelto').length);

  /** Los tres más recientes, como adelanto de la bandeja. */
  recientes = computed(() => this.tickets().slice(0, 3));

  constructor() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.api.lista().subscribe({
      next: (r) => { this.tickets.set(r.data?.items ?? []); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  verTickets() { this.router.navigateByUrl('/panel/tickets'); }
  verDetalle(id: number) { this.router.navigate(['/panel/tickets', id]); }

  estadoClase(estado: string): string {
    return { 'Pendiente': 'pill--pending', 'En Proceso': 'pill--info', 'Resuelto': 'pill--success' }[estado] ?? 'pill--muted';
  }
}
