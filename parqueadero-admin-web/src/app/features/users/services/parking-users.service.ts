import { inject, Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';

import { N8N_WEBHOOKS } from '../../../core/config/n8n.config';
import { N8nApiService } from '../../../core/services/n8n-api.service';
import { environment } from '../../../../environments/environment';
import { PARKING_USERS_MOCK } from '../data/parking-users.mock';
import { InstitutionalPerson, ParkingUser } from '../models/parking-user.model';

interface ParkingUsersListResponse {
  data: ParkingUser[];
}

interface ParkingUserMutationResponse {
  success: boolean;
  id: number;
}

@Injectable({ providedIn: 'root' })
export class ParkingUsersService {
  private readonly api = inject(N8nApiService);
  private readonly mockUsers = structuredClone(PARKING_USERS_MOCK);

  list(): Observable<ParkingUser[]> {
    if (environment.useMocks) {
      return of(structuredClone(this.mockUsers));
    }

    return this.api
      .get<ParkingUsersListResponse>(N8N_WEBHOOKS.parkingUsersList)
      .pipe(map(response => response.data));
  }

  create(person: InstitutionalPerson): Observable<void> {
    if (environment.useMocks) {
      const nextId = Math.max(0, ...this.mockUsers.map(user => user.id)) + 1;
      this.mockUsers.push({
        id: nextId,
        sourceId: person.sourceId,
        type: person.type,
        identification: person.identification,
        fullName: person.fullName,
        institutionalEmail: person.institutionalEmail,
        vehicles: [],
        paymentPlan: null,
        paymentValidUntil: null,
        serviceStatus: 'SIN_AUTORIZACION',
        enabled: true
      });
      return of(undefined);
    }

    return this.api.post<ParkingUserMutationResponse, InstitutionalPerson>(
      N8N_WEBHOOKS.parkingUserCreate,
      person
    ).pipe(map(() => undefined));
  }

  setEnabled(userId: number, enabled: boolean): Observable<void> {
    if (environment.useMocks) {
      const user = this.mockUsers.find(item => item.id === userId);
      if (user) user.enabled = enabled;
      return of(undefined);
    }

    return this.api.patch<ParkingUserMutationResponse, { id: number; enabled: boolean }>(
      N8N_WEBHOOKS.parkingUserStatus,
      { id: userId, enabled }
    ).pipe(map(() => undefined));
  }

  delete(userId: number): Observable<void> {
    if (environment.useMocks) {
      const index = this.mockUsers.findIndex(item => item.id === userId);
      if (index >= 0) this.mockUsers.splice(index, 1);
      return of(undefined);
    }

    return this.api.delete<ParkingUserMutationResponse, { id: number }>(
      N8N_WEBHOOKS.parkingUserDelete,
      { id: userId }
    ).pipe(map(() => undefined));
  }
}
