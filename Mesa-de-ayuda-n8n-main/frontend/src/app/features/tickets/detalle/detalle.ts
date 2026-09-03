import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TicketsApi, TicketDetalle, HistorialItem } from '../data/tickets-api';
import { PanelShell } from '../../../shared/ui/panel-shell/panel-shell';

/** Pasos por los que avanza un ticket, para el indicador de progreso. */
const PASOS = ['Pendiente', 'En Proceso', 'Resuelto'] as const;

@Component({
  selector: 'app-detalle',
  standalone: true,
  imports: [FormsModule, PanelShell],
  templateUrl: './detalle.html',
  styleUrl: './detalle.scss',
})
export class Detalle {
  private api = inject(TicketsApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  id = Number(this.route.snapshot.paramMap.get('id'));
  ticket = signal<TicketDetalle | null>(null);
  historial = signal<HistorialItem[]>([]);
  estado = signal('Pendiente');
  respuesta = signal('');
  cargando = signal(true);
  guardando = signal(false);
  mensaje = signal('');
  error = signal('');

  pasos = PASOS;
  /** Índice del paso actual; marca los anteriores como completados. */
  pasoActual = computed(() => {
    const i = PASOS.indexOf((this.ticket()?.estado ?? '') as typeof PASOS[number]);
    return i < 0 ? 0 : i;
  });

  constructor() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.api.detalle(this.id).subscribe({
      next: (r) => {
        this.cargando.set(false);
        if (r.ok && r.data) {
          this.ticket.set(r.data.ticket);
          this.historial.set(r.data.historial);
          this.estado.set(r.data.ticket.estado);
        } else { this.error.set(r.error?.message ?? 'No se pudo cargar el ticket.'); }
      },
      error: (e) => { this.cargando.set(false); this.error.set(e.message ?? 'Error al cargar.'); },
    });
  }

  guardar(resolver = false) {
    if (this.guardando()) return;
    const estado = resolver ? 'Resuelto' : this.estado();
    this.guardando.set(true);
    this.mensaje.set(''); this.error.set('');
    this.api.responder(this.id, estado, this.respuesta().trim() || undefined).subscribe({
      next: (r) => {
        this.guardando.set(false);
        if (r.ok) { this.mensaje.set('Cambios guardados y notificados al estudiante.'); this.cargar(); this.respuesta.set(''); }
        else this.error.set(r.error?.message ?? 'No se pudo guardar.');
      },
      error: (e) => { this.guardando.set(false); this.error.set(e.message ?? 'Error al guardar.'); },
    });
  }

  regresar() { this.router.navigateByUrl('/panel/tickets'); }

  estadoClase(estado: string): string {
    return { 'Pendiente': 'pill--pending', 'En Proceso': 'pill--info', 'Resuelto': 'pill--success' }[estado] ?? 'pill--muted';
  }
}
