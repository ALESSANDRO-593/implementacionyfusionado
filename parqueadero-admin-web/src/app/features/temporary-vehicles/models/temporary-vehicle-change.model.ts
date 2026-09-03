import { ParkingVehicleType } from '../../vehicles/models/parking-vehicle.model';

export interface TemporaryVehicleChange {
  id: number;
  parkingUserId: number;
  authorizationId: number;
  primaryVehicleId: number;
  temporaryPlate: string;
  vehicleType: ParkingVehicleType;
  startDate: string;
  endDate: string;
  reason: string;
  registeredByPanelUserId: number;
  registeredAt: string;
}
