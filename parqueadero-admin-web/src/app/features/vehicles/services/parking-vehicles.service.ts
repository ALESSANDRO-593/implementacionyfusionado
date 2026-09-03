import { inject, Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';

import { N8N_WEBHOOKS } from '../../../core/config/n8n.config';
import { N8nApiService } from '../../../core/services/n8n-api.service';
import { environment } from '../../../../environments/environment';
import { PARKING_VEHICLES_MOCK } from '../data/parking-vehicles.mock';
import { ParkingVehicle, ParkingVehicleType } from '../models/parking-vehicle.model';

interface ParkingVehiclesListResponse { data: ParkingVehicle[]; }
interface ParkingVehicleMutationResponse { success: boolean; id: number; }

export interface CreateParkingVehicleRequest {
  parkingUserId: number;
  plate: string;
  type: ParkingVehicleType;
}

@Injectable({ providedIn: 'root' })
export class ParkingVehiclesService {
  private readonly api = inject(N8nApiService);
  private readonly mockVehicles = structuredClone(PARKING_VEHICLES_MOCK);

  list(): Observable<ParkingVehicle[]> {
    if (environment.useMocks) return of(structuredClone(this.mockVehicles));
    return this.api.get<ParkingVehiclesListResponse>(N8N_WEBHOOKS.parkingVehiclesList)
      .pipe(map(response => response.data));
  }

  create(request: CreateParkingVehicleRequest): Observable<void> {
    if (environment.useMocks) {
      const nextId = Math.max(0, ...this.mockVehicles.map(vehicle => vehicle.id)) + 1;
      for (const vehicle of this.mockVehicles) {
        if (vehicle.parkingUserId === request.parkingUserId) vehicle.isPrimary = false;
      }
      this.mockVehicles.push({
        id: nextId,
        ...request,
        brand: '',
        model: '',
        color: '',
        isPrimary: true,
        active: true
      });
      return of(undefined);
    }
    return this.api.post<ParkingVehicleMutationResponse, CreateParkingVehicleRequest>(
      N8N_WEBHOOKS.parkingVehicleCreate,
      request
    ).pipe(map(() => undefined));
  }

  retire(vehicleId: number): Observable<void> {
    if (environment.useMocks) {
      const vehicle = this.mockVehicles.find(item => item.id === vehicleId);
      if (vehicle) {
        vehicle.active = false;
        vehicle.isPrimary = false;
      }
      return of(undefined);
    }
    return this.api.patch<ParkingVehicleMutationResponse, { id: number }>(
      N8N_WEBHOOKS.parkingVehicleRetire,
      { id: vehicleId }
    ).pipe(map(() => undefined));
  }
}
