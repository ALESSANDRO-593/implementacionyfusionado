import { ParkingAuthorization } from '../models/parking-authorization.model';

export const PARKING_AUTHORIZATIONS_MOCK: ParkingAuthorization[] = [
  { id: 1, code: 'YV-000103', parkingUserId: 5, paymentId: 1, vehicleId: 5, modality: 'DIARIO', startDate: '2026-08-16', endDate: '2026-08-16', status: 'VIGENTE', createdAt: '2026-08-16T08:10:00-05:00' },
  { id: 2, code: 'YV-000098', parkingUserId: 3, paymentId: 2, vehicleId: 3, modality: 'DIARIO', startDate: '2026-08-04', endDate: '2026-08-04', status: 'VIGENTE', createdAt: '2026-08-04T07:45:00-05:00' },
  { id: 3, code: 'YV-000101', parkingUserId: 1, paymentId: 3, vehicleId: 1, modality: 'MENSUAL', startDate: '2026-08-01', endDate: '2026-08-30', status: 'VIGENTE', createdAt: '2026-08-01T09:20:00-05:00' },
  { id: 4, code: 'YV-000102', parkingUserId: 2, paymentId: 4, vehicleId: 2, modality: 'MENSUAL', startDate: '2026-08-01', endDate: '2026-08-30', status: 'VIGENTE', createdAt: '2026-08-01T10:05:00-05:00' }
];
