import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfig } from '../../../core/config/app-config';
import { ApiEnvelope } from '../../../core/models/api';

export interface Catalogo { id: number; nombre: string; cantidad_equipos?: number; }
export interface AlertaItem {
  id: number; codigo: string; laboratorio: string;
  descripcion: string; estado: string; adjunto_id: number | null; profesor: string; fecha: string;
}
export interface NuevaAlerta { laboratorio_id: number; descripcion: string; foto: string; }

@Injectable({ providedIn: 'root' })
export class AlertasApi {
  private http = inject(HttpClient);
  private base = AppConfig.n8nBaseUrl;

  catalogos(): Observable<ApiEnvelope<{ laboratorios: Catalogo[] }>> {
    return this.http.get<ApiEnvelope<{ laboratorios: Catalogo[] }>>(`${this.base}/panel/catalogos`);
  }
  crear(a: NuevaAlerta): Observable<ApiEnvelope<{ codigo: string; estado: string }>> {
    return this.http.post<ApiEnvelope<{ codigo: string; estado: string }>>(`${this.base}/panel/alertas/crear`, a);
  }
  /** `gestiona` indica si el rol resuelve todas las alertas o solo reporta las suyas. */
  listar(): Observable<ApiEnvelope<{ items: AlertaItem[]; gestiona: boolean }>> {
    return this.http.get<ApiEnvelope<{ items: AlertaItem[]; gestiona: boolean }>>(`${this.base}/panel/alertas`);
  }
  actualizar(id: number, estado: string, observacion?: string): Observable<ApiEnvelope<{ id: number; estado: string }>> {
    return this.http.patch<ApiEnvelope<{ id: number; estado: string }>>(`${this.base}/panel/alertas/actualizar`, { id, estado, observacion });
  }
  adjunto(id: number): Observable<ApiEnvelope<{ dataUrl: string }>> {
    return this.http.get<ApiEnvelope<{ dataUrl: string }>>(`${this.base}/panel/adjunto`, { params: { id } });
  }
}
