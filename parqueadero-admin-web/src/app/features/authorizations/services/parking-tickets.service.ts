import { inject, Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { N8N_WEBHOOKS } from '../../../core/config/n8n.config';
import { N8nApiService } from '../../../core/services/n8n-api.service';
import { environment } from '../../../../environments/environment';
import { PARKING_AUTHORIZATIONS_MOCK } from '../data/parking-authorizations.mock';
import { ParkingAuthorization } from '../models/parking-authorization.model';

interface TicketsResponse { data: ParkingAuthorization[]; }

@Injectable({ providedIn: 'root' })
export class ParkingTicketsService {
  private readonly api = inject(N8nApiService);
  list(): Observable<ParkingAuthorization[]> {
    if (environment.useMocks) return of(structuredClone(PARKING_AUTHORIZATIONS_MOCK));
    return this.api.get<TicketsResponse>(N8N_WEBHOOKS.parkingTicketsList).pipe(map(response => response.data));
  }
}
