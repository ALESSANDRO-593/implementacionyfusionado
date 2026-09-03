import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { N8N_WEBHOOKS } from '../../../core/config/n8n.config';
import { N8nApiService } from '../../../core/services/n8n-api.service';
import { ParkingAccessResponse, ParkingEntryRequest } from '../models/parking-access.model';

@Injectable({providedIn:'root'})
export class ParkingAccessService {
  private readonly api=inject(N8nApiService);
  list():Observable<ParkingAccessResponse>{return this.api.get<ParkingAccessResponse>(N8N_WEBHOOKS.parkingAccessList);}
  entry(request:ParkingEntryRequest):Observable<{success:boolean}>{return this.api.post<{success:boolean},ParkingEntryRequest>(N8N_WEBHOOKS.parkingAccessEntry,request);}
  exit(authorizationId:number):Observable<{success:boolean}>{return this.api.post<{success:boolean},{authorizationId:number}>(N8N_WEBHOOKS.parkingAccessExit,{authorizationId});}
}
