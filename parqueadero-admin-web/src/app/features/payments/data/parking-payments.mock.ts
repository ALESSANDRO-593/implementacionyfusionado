import { ParkingPayment } from '../models/parking-payment.model';

export const PARKING_PAYMENTS_MOCK: ParkingPayment[] = [
  { id: 1, parkingUserId: 5, vehicleId: 5, modality: 'DIARIO', amount: 1.5, startDate: '2026-08-16', endDate: '2026-08-16', status: 'APROBADO', method: 'EFECTIVO', reference: null, authorizationIssued: true },
  { id: 2, parkingUserId: 3, vehicleId: 3, modality: 'DIARIO', amount: 1.5, startDate: '2026-08-04', endDate: '2026-08-04', status: 'APROBADO', method: 'TRANSFERENCIA', reference: 'TRX-804219', authorizationIssued: true },
  { id: 3, parkingUserId: 1, vehicleId: 1, modality: 'MENSUAL', amount: 25, startDate: '2026-08-01', endDate: '2026-08-30', status: 'APROBADO', method: 'TRANSFERENCIA', reference: 'TRX-801437', authorizationIssued: true },
  { id: 4, parkingUserId: 2, vehicleId: 2, modality: 'MENSUAL', amount: 25, startDate: '2026-08-01', endDate: '2026-08-30', status: 'APROBADO', method: 'EFECTIVO', reference: null, authorizationIssued: true },
  { id: 5, parkingUserId: 4, vehicleId: 4, modality: 'MENSUAL', amount: 25, startDate: '2026-08-01', endDate: '2026-08-30', status: 'PENDIENTE', method: 'TRANSFERENCIA', reference: 'TRX-801992', authorizationIssued: false }
];
