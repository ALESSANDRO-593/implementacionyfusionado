import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class N8nApiService {
  private readonly http = inject(HttpClient);

  get<T>(webhookPath: string, params?: Record<string, string | number | boolean>): Observable<T> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      httpParams = httpParams.set(key, String(value));
    }
    return this.http.get<T>(this.buildUrl(webhookPath), { params: httpParams });
  }

  post<TResponse, TBody = unknown>(webhookPath: string, body: TBody): Observable<TResponse> {
    return this.http.post<TResponse>(this.buildUrl(webhookPath), body);
  }

  patch<TResponse, TBody = unknown>(webhookPath: string, body: TBody): Observable<TResponse> {
    return this.http.patch<TResponse>(this.buildUrl(webhookPath), body);
  }

  delete<TResponse, TBody = unknown>(webhookPath: string, body: TBody): Observable<TResponse> {
    return this.http.delete<TResponse>(this.buildUrl(webhookPath), { body });
  }

  private buildUrl(webhookPath: string): string {
    return `${environment.n8nBaseUrl}/${webhookPath.replace(/^\/+/, '')}`;
  }
}
