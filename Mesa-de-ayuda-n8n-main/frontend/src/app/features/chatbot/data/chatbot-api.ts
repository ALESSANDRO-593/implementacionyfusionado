import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { AppConfig } from '../../../core/config/app-config';
import { ApiEnvelope } from '../../../core/models/api';

export interface IniciarResp {
  acceso: boolean;
  requiere_otp?: boolean;
  mensaje?: string;
}
export interface UsuarioChat {
  tipoUsuario: 'ESTUDIANTE' | 'DOCENTE';
  nombres: string;
  correoInstitucional: string;
  carrera: string | null;
  nivel: string | null;
  paralelo: string | null;
  periodoActual: string | null;
  estadoMatricula: string | null;
}
export interface ValidarOtpResp {
  sesion: string;
  tipoUsuario: 'ESTUDIANTE' | 'DOCENTE';
  usuario: UsuarioChat;
  estudiante?: UsuarioChat;
}
export interface TicketResumen {
  codigo: string;
  tipo: string;
  fecha_creacion: string;
  estado: string;
  ultima_actualizacion?: string;
  respuesta?: string;
}

export type ParkingVehicleType = 'AUTO' | 'MOTO';
export type ParkingModality = 'DIARIO' | 'MENSUAL';
export type ParkingTicketState = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO';

export interface ParkingVehicle {
  id: number;
  plate: string;
  type: ParkingVehicleType;
}

export interface ParkingTicket {
  requestId: number;
  code: string;
  plate: string;
  vehicleType: ParkingVehicleType;
  vehicleTypeLabel: string;
  modality: ParkingModality;
  modalityLabel: string;
  amount: number;
  requestedAt: string;
  state: ParkingTicketState;
  validFrom: string | null;
  validUntil: string | null;
  authorizationId: number | null;
  rejectionReason: string | null;
}

export interface ParkingState {
  vehicle: ParkingVehicle | null;
  ticket: ParkingTicket | null;
}

export interface ParkingDownload {
  filename: string;
  contentBase64: string;
}

/** Cliente de los webhooks del chatbot en n8n. Solo I/O (SRP). */
@Injectable({ providedIn: 'root' })
export class ChatbotApi {
  private http = inject(HttpClient);
  private base = AppConfig.n8nBaseUrl;

  iniciar(cedula: string, captchaToken: string): Observable<ApiEnvelope<IniciarResp>> {
    return this.http.post<ApiEnvelope<IniciarResp>>(`${this.base}/chatbot/iniciar`, { cedula, captchaToken });
  }
  validarOtp(cedula: string, codigo: string): Observable<ApiEnvelope<ValidarOtpResp>> {
    return this.http.post<ApiEnvelope<ValidarOtpResp>>(`${this.base}/chatbot/otp/validar`, { cedula, codigo });
  }
  reenviarOtp(cedula: string): Observable<ApiEnvelope<unknown>> {
    return this.http.post<ApiEnvelope<unknown>>(`${this.base}/chatbot/otp/reenviar`, { cedula });
  }
  solicitarCertificado(): Observable<ApiEnvelope<{ mensaje: string }>> {
    return this.http.post<ApiEnvelope<{ mensaje: string }>>(`${this.base}/chatbot/certificado`, {});
  }
  crearTicket(tipo: string, descripcion?: string): Observable<ApiEnvelope<{ codigo: string; estado: string }>> {
    return this.http.post<ApiEnvelope<{ codigo: string; estado: string }>>(`${this.base}/chatbot/ticket`, { tipo, descripcion });
  }
  misTickets(): Observable<ApiEnvelope<TicketResumen[]>> {
    return this.http.get<ApiEnvelope<TicketResumen[]>>(`${this.base}/chatbot/tickets`);
  }
  parkingState(): Observable<ApiEnvelope<ParkingState>> {
    return this.http.post<unknown>(`${this.base}/chatbot/parqueadero`, { action: 'estado' }).pipe(
      map(response => this.normalizeParkingResponse(response))
    );
  }
  createParkingRequest(vehicleType: ParkingVehicleType, plate: string, modality: ParkingModality): Observable<ApiEnvelope<ParkingState>> {
    return this.http.post<unknown>(`${this.base}/chatbot/parqueadero`, {
      action: 'solicitar', vehicleType, plate, modality,
    }).pipe(map(response => this.normalizeParkingResponse(response)));
  }
  private normalizeParkingResponse(response: unknown): ApiEnvelope<ParkingState> {
    const raw = this.asRecord(response);
    if (!raw) return this.invalidParkingResponse();

    if (typeof raw['ok'] === 'boolean') {
      if (!raw['ok']) return response as ApiEnvelope<ParkingState>;
      const data = this.normalizeParkingState(raw['data']);
      return data ? { ok: true, data } : this.invalidParkingResponse();
    }

    if (raw['error']) {
      const error = this.asRecord(raw['error']);
      const message = typeof raw['error'] === 'string'
        ? raw['error']
        : String(error?.['message'] ?? 'No fue posible generar el ticket de parqueadero.');
      return { ok: false, error: { code: String(error?.['code'] ?? 'PARQUEADERO_ERROR'), message } };
    }

    const state = this.normalizeParkingState(raw);
    if (state) return { ok: true, data: state };

    const ticket = this.normalizeParkingTicket(raw);
    return ticket ? { ok: true, data: { vehicle: null, ticket } } : this.invalidParkingResponse();
  }

  private normalizeParkingState(value: unknown): ParkingState | null {
    const raw = this.asRecord(value);
    if (!raw) return null;
    const hasStateShape = 'vehicle' in raw || 'vehiculo' in raw || 'ticket' in raw;
    if (!hasStateShape) return null;

    const vehicleRaw = this.asRecord(raw['vehicle'] ?? raw['vehiculo']);
    const type = vehicleRaw?.['type'] ?? vehicleRaw?.['tipo'];
    const vehicle: ParkingVehicle | null = vehicleRaw
      ? {
          id: Number(vehicleRaw['id']),
          plate: String(vehicleRaw['plate'] ?? vehicleRaw['placa'] ?? ''),
          type: type === 'MOTO' ? 'MOTO' : 'AUTO',
        }
      : null;

    return { vehicle, ticket: this.normalizeParkingTicket(raw['ticket']) };
  }

  private normalizeParkingTicket(value: unknown): ParkingTicket | null {
    const raw = this.asRecord(value);
    if (!raw) return null;
    const requestId = Number(raw['requestId'] ?? raw['id']);
    if (!Number.isFinite(requestId) || requestId <= 0) return null;

    const vehicleType: ParkingVehicleType = raw['vehicleType'] === 'MOTO' || raw['tipoVehiculo'] === 'MOTO' ? 'MOTO' : 'AUTO';
    const modality: ParkingModality = raw['modality'] === 'MENSUAL' || raw['modalidad'] === 'MENSUAL' ? 'MENSUAL' : 'DIARIO';
    const state = String(raw['state'] ?? raw['estado'] ?? 'PENDIENTE') as ParkingTicketState;
    return {
      requestId,
      code: String(raw['code'] ?? raw['codigo'] ?? `TK-${String(requestId).padStart(6, '0')}`),
      plate: String(raw['plate'] ?? raw['placa'] ?? ''),
      vehicleType,
      vehicleTypeLabel: String(raw['vehicleTypeLabel'] ?? (vehicleType === 'MOTO' ? 'Motocicleta' : 'Automóvil')),
      modality,
      modalityLabel: String(raw['modalityLabel'] ?? (modality === 'MENSUAL' ? 'Mensual' : 'Diaria')),
      amount: Number(raw['amount'] ?? raw['monto'] ?? 0),
      requestedAt: String(raw['requestedAt'] ?? raw['fechaSolicitud'] ?? ''),
      state,
      validFrom: this.nullableString(raw['validFrom'] ?? raw['vigenciaDesde']),
      validUntil: this.nullableString(raw['validUntil'] ?? raw['vigenciaHasta']),
      authorizationId: raw['authorizationId'] == null && raw['autorizacionId'] == null
        ? null : Number(raw['authorizationId'] ?? raw['autorizacionId']),
      rejectionReason: this.nullableString(raw['rejectionReason'] ?? raw['motivoRechazo']),
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
  }

  private nullableString(value: unknown): string | null {
    return value == null || value === '' ? null : String(value);
  }

  private invalidParkingResponse(): ApiEnvelope<ParkingState> {
    return {
      ok: false,
      error: {
        code: 'RESPUESTA_INVALIDA',
        message: 'El servidor no devolvió el detalle del ticket de parqueadero.',
      },
    };
  }
  downloadParkingTicket(requestId: number): Observable<ApiEnvelope<ParkingDownload>> {
    return this.http.post<ApiEnvelope<ParkingDownload>>(`${this.base}/chatbot/parqueadero`, {
      action: 'descargar', requestId,
    });
  }
}
