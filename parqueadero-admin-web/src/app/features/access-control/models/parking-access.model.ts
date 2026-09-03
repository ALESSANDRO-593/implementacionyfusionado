export type AccessMovement = 'ENTRADA' | 'SALIDA';
export interface ParkingAccessRecord {
  id: number; parkingUserId: number; authorizationId: number; ticketCode: string;
  plate: string; movement: AccessMovement; validationStatus: 'AUTORIZADO' | 'RECHAZADO';
  isTemporary: boolean; rejectionReason: string | null; occurredAt: string;
}
export interface ParkingAccessResponse { total: number; occupied: number; available: number; data: ParkingAccessRecord[]; }

export interface ParkingEntryRequest {
  authorizationId: number;
  useTemporary: boolean;
  temporaryPlate?: string;
  temporaryVehicleType?: 'AUTO' | 'MOTO';
}
