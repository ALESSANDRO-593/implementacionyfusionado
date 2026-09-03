import { ParkingModality } from '../../payments/models/parking-payment.model';
import { ParkingVehicleType } from '../../vehicles/models/parking-vehicle.model';

export interface ParkingTariff {
  id: number;
  modality: ParkingModality;
  vehicleType: ParkingVehicleType;
  amount: number;
  active: boolean;
  updatedAt: string;
}
