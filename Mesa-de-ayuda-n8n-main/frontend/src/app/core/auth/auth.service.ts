import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AppConfig } from '../config/app-config';
import { ApiEnvelope } from '../models/api';

export interface LoginResp { token: string; rol: string; nombres: string; }
/** `rol_id` es lo que manda para autorizar; `rol` (código) solo se usa para mostrar. */
export interface Claims { sub: string; ced: string; rol: string; rol_id: number; carreras: number[]; exp: number; }

/** Autenticación del Panel Web (JWT). Almacena el token en sessionStorage. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private base = AppConfig.n8nBaseUrl;

  private _claims = signal<Claims | null>(this.decode(this.token()));
  readonly rol = computed(() => this._claims()?.rol ?? null);
  /** Id del rol: única base para decidir accesos. */
  readonly rolId = computed(() => this._claims()?.rol_id ?? null);
  readonly isAuthenticated = computed(() => {
    const c = this._claims();
    return !!c && c.exp * 1000 > Date.now();
  });

  login(cedula: string, password: string): Observable<ApiEnvelope<LoginResp>> {
    return this.http.post<ApiEnvelope<LoginResp>>(`${this.base}/panel/login`, { cedula, password }).pipe(
      tap((r) => {
        if (r.ok && r.data?.token) {
          sessionStorage.setItem(AppConfig.storageTokenKey, r.data.token);
          sessionStorage.setItem('yavibot.panel.nombres', r.data.nombres);
          this._claims.set(this.decode(r.data.token));
        }
      })
    );
  }

  logout(): void {
    sessionStorage.removeItem(AppConfig.storageTokenKey);
    sessionStorage.removeItem('yavibot.panel.nombres');
    this._claims.set(null);
  }

  token(): string | null { return sessionStorage.getItem(AppConfig.storageTokenKey); }
  nombres(): string { return sessionStorage.getItem('yavibot.panel.nombres') ?? ''; }

  private decode(token: string | null): Claims | null {
    if (!token) return null;
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload)) as Claims;
    } catch { return null; }
  }
}
