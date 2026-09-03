export type ParkingModality = 'DIARIO' | 'MENSUAL';
export type ParkingPaymentStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO';
export type ParkingPaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA';

export interface ParkingPayment {
  id: number;
  parkingUserId: number;
  /** Vehículo usado para calcular la tarifa y mostrar el ticket asociado. */
  vehicleId: number;
  modality: ParkingModality;
  amount: number;
  startDate: string;
  endDate: string;
  status: ParkingPaymentStatus;
  method: ParkingPaymentMethod;
  reference: string | null;
  authorizationIssued: boolean;
  rejectionReason?: string | null;
}

export interface ParkingModalityOption {
  id: number;
  modality: ParkingModality;
  vehicleType: 'AUTO' | 'MOTO';
  amount: number;
}
