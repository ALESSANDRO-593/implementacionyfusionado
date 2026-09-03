import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TicketsApi, TicketListItem } from '../data/tickets-api';
import { PanelShell } from '../../../shared/ui/panel-shell/panel-shell';
import { Paginator } from '../../../shared/ui/paginator/paginator';

/** Bandeja de tickets: búsqueda, filtro por estado y paginación. */
@Component({
  selector: 'app-tickets-lista',
  standalone: true,
  imports: [FormsModule, PanelShell, Paginator],
  templateUrl: './lista.html',
  styleUrl: './lista.scss',
})
export class TicketsLista {
  private api = inject(TicketsApi);
  private router = inject(Router);

  tickets = signal<TicketListItem[]>([]);
  cargando = signal(true);
  buscar = signal('');
  filtroEstado = signal('Todos');
  pagina = signal(1);
  porPagina = signal(10);

  filtrados = computed(() => {
    const q = this.buscar().toLowerCase().trim();
    const e = this.filtroEstado();
    return this.tickets().filter(t =>
      (e === 'Todos' || t.estado === e) &&
      (!q ||
        t.codigo.toLowerCase().includes(q) ||
        t.solicitante.toLowerCase().includes(q) ||
        (t.responsable ?? '').toLowerCase().includes(q) ||
        t.tipo.toLowerCase().includes(q))
    );
  });

  /** Sólo la porción visible de la página actual. */
  visibles = computed(() => {
    const desde = (this.pagina() - 1) * this.porPagina();
    return this.filtrados().slice(desde, desde + this.porPagina());
  });

  pendientes = computed(() => this.tickets().filter(t => t.estado === 'Pendiente').length);

  constructor() {
    this.cargar();
    // Al cambiar la búsqueda o el filtro, volver a la primera página.
    effect(() => { this.buscar(); this.filtroEstado(); this.porPagina(); this.pagina.set(1); });
  }

  cargar() {
    this.cargando.set(true);
    this.api.lista().subscribe({
      next: (r) => { this.tickets.set(r.data?.items ?? []); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  verDetalle(id: number) { this.router.navigate(['/panel/tickets', id]); }

  estadoClase(estado: string): string {
    return { 'Pendiente': 'pill--pending', 'En Proceso': 'pill--info', 'Resuelto': 'pill--success' }[estado] ?? 'pill--muted';
  }
}
