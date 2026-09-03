import { Component, inject, signal } from '@angular/core';
import * as XLSX from 'xlsx';
import { CargaApi, ResumenCarga } from './data/carga-api';
import { PanelShell } from '../../shared/ui/panel-shell/panel-shell';

type Tipo = 'estudiantes' | 'docentes';

interface EstadoCarga {
  archivo: string;
  registros: unknown[];
  cargando: boolean;
  resumen: ResumenCarga | null;
  error: string;
}

const nuevo = (): EstadoCarga => ({ archivo: '', registros: [], cargando: false, resumen: null, error: '' });

@Component({
  selector: 'app-carga',
  standalone: true,
  imports: [PanelShell],
  templateUrl: './carga.html',
  styleUrl: './carga.scss',
})
export class Carga {
  private api = inject(CargaApi);

  estudiantes = signal<EstadoCarga>(nuevo());
  docentes = signal<EstadoCarga>(nuevo());

  /** Columnas mínimas esperadas por tipo, para avisar si el archivo no corresponde. */
  private columnas: Record<Tipo, string[]> = {
    estudiantes: ['cedula', 'nombres', 'carrera_id', 'nivel', 'paralelo', 'modalidad', 'estado_matricula', 'correo'],
    docentes: ['cedula', 'correo'],
  };

  seleccionar(tipo: Tipo, ev: Event) {
    const sig = tipo === 'estudiantes' ? this.estudiantes : this.docentes;
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    sig.set({ ...nuevo(), cargando: true });
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: 'array' });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { raw: false, defval: '' });
        if (!filas.length) { sig.set({ ...nuevo(), error: 'El archivo está vacío.' }); return; }
        const faltan = this.columnas[tipo].filter((c) => !(c in filas[0]));
        if (faltan.length) {
          sig.set({ ...nuevo(), error: `Al archivo le faltan columnas: ${faltan.join(', ')}` });
          return;
        }
        sig.set({ ...nuevo(), archivo: file.name, registros: filas });
      } catch {
        sig.set({ ...nuevo(), error: 'No se pudo leer el archivo. Debe ser CSV o Excel válido.' });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  procesar(tipo: Tipo) {
    const sig = tipo === 'estudiantes' ? this.estudiantes : this.docentes;
    const st = sig();
    if (!st.registros.length || st.cargando) return;
    sig.set({ ...st, cargando: true, error: '', resumen: null });
    const req = tipo === 'estudiantes'
      ? this.api.estudiantes(st.registros, st.archivo)
      : this.api.docentes(st.registros, st.archivo);
    req.subscribe({
      next: (r) => {
        if (r.ok && r.data) sig.set({ ...sig(), cargando: false, resumen: r.data });
        else sig.set({ ...sig(), cargando: false, error: r.error?.message ?? 'No se pudo procesar la carga.' });
      },
      error: (e) => sig.set({ ...sig(), cargando: false, error: e.message ?? 'Error al procesar la carga.' }),
    });
  }
}
