export type ParkingVehicleType = 'AUTO' | 'MOTO';

export interface ParkingVehicle {
  id: number;
  parkingUserId: number;
  plate: string;
  type: ParkingVehicleType;
  brand: string;
  model: string;
  color: string;
  isPrimary: boolean;
  active: boolean;
}
