import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfig } from '../../../core/config/app-config';
import { ApiEnvelope } from '../../../core/models/api';

export interface TicketListItem {
  id: number; codigo: string; solicitante: string; tipo: string;
  fecha: string; estado: string; responsable: string;
}
export interface TicketDetalle {
  id: number; codigo: string; tipo: string; estado: string; fecha: string;
  descripcion: string | null; nombres: string; cedula: string; correo: string;
  nivel: string; paralelo: string; carrera: string;
}
export interface HistorialItem {
  estado_anterior: string | null; estado_nuevo: string; respuesta: string | null; fecha: string;
}

@Injectable({ providedIn: 'root' })
export class TicketsApi {
  private http = inject(HttpClient);
  private base = AppConfig.n8nBaseUrl;

  lista(): Observable<ApiEnvelope<{ items: TicketListItem[]; total: number }>> {
    return this.http.get<ApiEnvelope<{ items: TicketListItem[]; total: number }>>(`${this.base}/panel/tickets`);
  }
  detalle(id: number): Observable<ApiEnvelope<{ ticket: TicketDetalle; historial: HistorialItem[] }>> {
    return this.http.get<ApiEnvelope<{ ticket: TicketDetalle; historial: HistorialItem[] }>>(
      `${this.base}/panel/tickets/detalle`, { params: { id } });
  }
  responder(id: number, estado: string, respuesta?: string): Observable<ApiEnvelope<{ codigo: string; estado: string }>> {
    return this.http.patch<ApiEnvelope<{ codigo: string; estado: string }>>(
      `${this.base}/panel/tickets/responder`, { id, estado, respuesta });
  }
}
