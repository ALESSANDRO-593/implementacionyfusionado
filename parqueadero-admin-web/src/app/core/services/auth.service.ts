import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { N8N_WEBHOOKS, SESSION_TOKEN_KEY, SESSION_USER_KEY } from '../config/n8n.config';
import { LoginRequest, LoginResponse, SessionUser } from '../models/auth.model';
import { N8nApiService } from './n8n-api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(N8nApiService);
  private readonly sessionUser = signal<SessionUser | null>(this.restoreUser());

  readonly user = this.sessionUser.asReadonly();
  readonly authenticated = computed(() => this.hasValidToken() && this.hasParkingAdminRole(this.sessionUser()));

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.api.post<LoginResponse, LoginRequest>(N8N_WEBHOOKS.panelLogin, request).pipe(
      tap(response => {
        sessionStorage.setItem(SESSION_TOKEN_KEY, response.token);
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(response.user));
        this.sessionUser.set(response.user);
      })
    );
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    this.sessionUser.set(null);
  }

  isAuthenticated(): boolean {
    const authenticated = this.hasValidToken() && this.hasParkingAdminRole(this.sessionUser());
    if (!authenticated) this.logout();
    return authenticated;
  }

  private restoreUser(): SessionUser | null {
    const value = sessionStorage.getItem(SESSION_USER_KEY);
    if (!value) return null;

    try {
      return JSON.parse(value) as SessionUser;
    } catch {
      sessionStorage.removeItem(SESSION_USER_KEY);
      return null;
    }
  }

  private hasParkingAdminRole(user: SessionUser | null): boolean {
    return user?.role?.toUpperCase() === 'ADMINISTRADOR_PARKING';
  }

  private hasValidToken(): boolean {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return false;

    try {
      const payload = JSON.parse(this.decodeBase64Url(token.split('.')[1])) as { exp?: number };
      return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
    } catch {
      return false;
    }
  }

  private decodeBase64Url(value: string): string {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return decodeURIComponent(Array.from(atob(padded))
      .map(character => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''));
  }
}
