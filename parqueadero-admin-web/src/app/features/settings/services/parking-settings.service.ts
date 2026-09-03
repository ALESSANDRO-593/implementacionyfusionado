import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { N8N_WEBHOOKS } from '../../../core/config/n8n.config';
import { N8nApiService } from '../../../core/services/n8n-api.service';
import { ParkingTariff } from '../models/parking-tariff.model';

interface TariffsResponse { data: ParkingTariff[]; }
interface TariffMutationResponse { success: boolean; id: number; amount: number; active: boolean; }
export interface ParkingCapacity { total: number; occupied: number; available: number; }

export interface CreateParkingTariffRequest {
  modality: ParkingTariff['modality'];
  vehicleType: ParkingTariff['vehicleType'];
  amount: number;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class ParkingSettingsService {
  private readonly api = inject(N8nApiService);

  listTariffs(): Observable<ParkingTariff[]> {
    return this.api.get<TariffsResponse>(N8N_WEBHOOKS.parkingTariffsList)
      .pipe(map(response => response.data));
  }

  updateTariff(id: number, amount: number, active: boolean): Observable<void> {
    return this.api.patch<TariffMutationResponse, { id: number; amount: number; active: boolean }>(
      N8N_WEBHOOKS.parkingTariffUpdate,
      { id, amount, active }
    ).pipe(map(() => undefined));
  }

  createTariff(request: CreateParkingTariffRequest): Observable<void> {
    return this.api.post<TariffMutationResponse, CreateParkingTariffRequest>(
      N8N_WEBHOOKS.parkingTariffCreate,
      request
    ).pipe(map(() => undefined));
  }

  getCapacity(): Observable<ParkingCapacity> {
    return this.api.get<ParkingCapacity>(N8N_WEBHOOKS.parkingCapacityGet);
  }

  updateCapacity(total: number): Observable<void> {
    return this.api.patch<{ success: boolean }, { total: number }>(N8N_WEBHOOKS.parkingCapacityUpdate, { total })
      .pipe(map(() => undefined));
  }
}
