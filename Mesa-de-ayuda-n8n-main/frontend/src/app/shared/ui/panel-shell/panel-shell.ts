import { Component, computed, inject, input } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ROL_ETIQUETA } from '../../../core/auth/roles';
import { PanelSidebar } from '../panel-sidebar/panel-sidebar';

/**
 * Marco común de todos los módulos del Panel: barra lateral + cabecera.
 * El contenido de cada módulo se proyecta dentro, de modo que Dashboard,
 * Tickets, Alertas y Carga Masiva comparten exactamente la misma estructura.
 */
@Component({
  selector: 'app-panel-shell',
  standalone: true,
  imports: [PanelSidebar],
  templateUrl: './panel-shell.html',
})
export class PanelShell {
  private auth = inject(AuthService);

  /** Ítem del menú que queda resaltado. */
  active = input<string>('');
  titulo = input<string>('');
  subtitulo = input<string>('');
  icono = input<string>('📋');
  /** Nº de avisos del campanario; 0 lo oculta. */
  avisos = input<number>(0);

  nombres = computed(() => this.auth.nombres());
  rolNombre = computed(() => {
    const id = this.auth.rolId();
    return id === null ? '' : (ROL_ETIQUETA[id] ?? this.auth.rol() ?? '');
  });

  /** Iniciales para el avatar (p. ej. "MOYA CARRERA YOLANDA" → "MY"). */
  iniciales = computed(() => {
    const partes = this.nombres().trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '··';
    return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase();
  });
}
