import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AppConfig } from '../../core/config/app-config';
import { ApiEnvelope } from '../../core/models/api';

interface VerificacionResp {
  valido: boolean;
  estudiante?: string;
  tipo?: string;
  fecha?: string;
}

/**
 * Página pública (sin login) para verificar la autenticidad de un certificado
 * a partir del identificador embebido en su código QR.
 */
@Component({
  selector: 'app-verificar',
  standalone: true,
  templateUrl: './verificar.html',
  styleUrl: './verificar.scss',
})
export class Verificar {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  cargando = signal(true);
  resultado = signal<VerificacionResp | null>(null);
  error = signal(false);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.http
      .get<ApiEnvelope<VerificacionResp>>(`${AppConfig.n8nBaseUrl}/verificar`, { params: { id } })
      .subscribe({
        next: (r) => { this.resultado.set(r.data ?? { valido: false }); this.cargando.set(false); },
        error: () => { this.error.set(true); this.cargando.set(false); },
      });
  }
}
