import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfig } from '../../../core/config/app-config';
import { ApiEnvelope } from '../../../core/models/api';

export interface ResumenCarga {
  insertados: number;
  actualizados: number;
  omitidos: number;
  errores: number;
  total: number;
  detalleErrores: { fila: number; motivo: string; valor: unknown }[];
}

@Injectable({ providedIn: 'root' })
export class CargaApi {
  private http = inject(HttpClient);
  private base = AppConfig.n8nBaseUrl;

  estudiantes(registros: unknown[], archivo: string): Observable<ApiEnvelope<ResumenCarga>> {
    return this.http.post<ApiEnvelope<ResumenCarga>>(`${this.base}/admin/import/estudiantes`, { registros, archivo });
  }
  docentes(registros: unknown[], archivo: string): Observable<ApiEnvelope<ResumenCarga>> {
    return this.http.post<ApiEnvelope<ResumenCarga>>(`${this.base}/admin/import/docentes`, { registros, archivo });
  }
}
