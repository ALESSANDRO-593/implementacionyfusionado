import { ParkingModality } from '../../payments/models/parking-payment.model';

export type ParkingAuthorizationStatus = 'VIGENTE' | 'VENCIDA' | 'BLOQUEADA' | 'ANULADA';

export interface ParkingAuthorization {
  id: number;
  code: string;
  parkingUserId: number;
  paymentId: number;
  vehicleId: number;
  modality: ParkingModality;
  startDate: string;
  endDate: string;
  status: ParkingAuthorizationStatus;
  createdAt: string;
}
