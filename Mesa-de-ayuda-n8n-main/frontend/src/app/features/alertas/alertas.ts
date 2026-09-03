import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertasApi, AlertaItem, Catalogo } from './data/alertas-api';
import { AuthService } from '../../core/auth/auth.service';
import { PanelShell } from '../../shared/ui/panel-shell/panel-shell';
import { Paginator } from '../../shared/ui/paginator/paginator';

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [FormsModule, PanelShell, Paginator],
  templateUrl: './alertas.html',
  styleUrl: './alertas.scss',
})
export class Alertas {
  private api = inject(AlertasApi);
  private auth = inject(AuthService);

  rol = this.auth.rol();

  laboratorios = signal<Catalogo[]>([]);
  alertas = signal<AlertaItem[]>([]);
  cargando = signal(true);

  /**
   * Lo decide el backend a partir de `rol_tipos_solicitud`, no el rol_id:
   * true  → resuelve todas las incidencias (Responsable de Laboratorios);
   * false → reporta y ve solo las suyas (docentes, coordinación, vinculación,
   *         secretaría). Así el frontend no repite la regla de negocio.
   */
  gestiona = signal(false);
  /** Quien no gestiona, reporta. */
  puedeReportar = computed(() => !this.gestiona());

  /** El formulario de reporte vive detrás del botón "Reportar Incidencia". */
  mostrarForm = signal(false);

  // Búsqueda y paginación
  buscar = signal('');
  filtroEstado = signal('Todos');
  pagina = signal(1);
  porPagina = signal(10);

  // Formulario (profesor)
  labId = signal<number | null>(null);
  descripcion = signal('');
  foto = signal<string>('');
  fotoNombre = signal('');
  enviando = signal(false);
  mensaje = signal('');
  error = signal('');

  // Gestión (laboratorios)
  fotoModal = signal<string | null>(null);

  filtradas = computed(() => {
    const q = this.buscar().toLowerCase().trim();
    const e = this.filtroEstado();
    return this.alertas().filter(a =>
      (e === 'Todos' || a.estado === e) &&
      (!q ||
        a.codigo.toLowerCase().includes(q) ||
        a.laboratorio.toLowerCase().includes(q) ||
        a.descripcion.toLowerCase().includes(q) ||
        (a.profesor ?? '').toLowerCase().includes(q))
    );
  });

  visibles = computed(() => {
    const desde = (this.pagina() - 1) * this.porPagina();
    return this.filtradas().slice(desde, desde + this.porPagina());
  });

  pendientes = computed(() => this.alertas().filter(a => a.estado === 'Pendiente').length);

  constructor() {
    this.api.catalogos().subscribe((r) => {
      // Postgres devuelve los BIGINT como texto; sin convertirlos, el valor
      // del <option> ("1") no coincide con el del modelo (1) y el select
      // se queda en blanco tras elegir un laboratorio.
      this.laboratorios.set((r.data?.laboratorios ?? []).map((l) => ({ ...l, id: Number(l.id) })));
    });
    this.cargar();
    effect(() => { this.buscar(); this.filtroEstado(); this.porPagina(); this.pagina.set(1); });
  }

  cargar() {
    this.cargando.set(true);
    this.api.listar().subscribe({
      next: (r) => {
        this.alertas.set(r.data?.items ?? []);
        this.gestiona.set(r.data?.gestiona ?? false);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  abrirForm() { this.mensaje.set(''); this.error.set(''); this.mostrarForm.set(true); }
  cerrarForm() { this.mostrarForm.set(false); }

  onFoto(ev: Event) {
    this.error.set('');
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) { this.error.set('La foto debe ser JPG o PNG.'); return; }
    if (file.size > 5 * 1024 * 1024) { this.error.set('La foto supera 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { this.foto.set(reader.result as string); this.fotoNombre.set(file.name); };
    reader.readAsDataURL(file);
  }

  reportar() {
    this.error.set(''); this.mensaje.set('');
    if (!this.labId() || !this.descripcion().trim()) { this.error.set('Complete el laboratorio y la descripción de la incidencia.'); return; }
    if (!this.foto()) { this.error.set('Adjunte una fotografía de la incidencia.'); return; }
    this.enviando.set(true);
    this.api.crear({ laboratorio_id: this.labId()!, descripcion: this.descripcion().trim(), foto: this.foto() }).subscribe({
      next: (r) => {
        this.enviando.set(false);
        if (r.ok) {
          this.mensaje.set(`Alerta ${r.data?.codigo} reportada correctamente.`);
          this.descripcion.set(''); this.foto.set(''); this.fotoNombre.set(''); this.labId.set(null);
          this.mostrarForm.set(false);
          this.cargar();
        } else this.error.set(r.error?.message ?? 'No se pudo reportar.');
      },
      error: (e) => { this.enviando.set(false); this.error.set(e.message ?? 'Error al reportar.'); },
    });
  }

  cambiarEstado(a: AlertaItem, estado: string) {
    this.api.actualizar(a.id, estado).subscribe(() => this.cargar());
  }

  verFoto(a: AlertaItem) {
    if (a.adjunto_id == null) return;
    this.api.adjunto(a.adjunto_id).subscribe((r) => this.fotoModal.set(r.data?.dataUrl ?? null));
  }
  cerrarFoto() { this.fotoModal.set(null); }

  estadoClase(estado: string): string {
    return { 'Pendiente': 'pill--pending', 'En revisión': 'pill--info', 'Resuelta': 'pill--success' }[estado] ?? 'pill--muted';
  }
}
