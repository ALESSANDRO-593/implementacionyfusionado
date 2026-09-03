import { ParkingVehicle } from '../models/parking-vehicle.model';

export const PARKING_VEHICLES_MOCK: ParkingVehicle[] = [
  { id: 1, parkingUserId: 1, plate: 'PCS-4821', type: 'AUTO', brand: 'Chevrolet', model: 'Sail', color: 'Gris', isPrimary: true, active: true },
  { id: 2, parkingUserId: 2, plate: 'IBA-0932', type: 'AUTO', brand: 'Kia', model: 'Rio', color: 'Blanco', isPrimary: true, active: true },
  { id: 3, parkingUserId: 3, plate: 'HM-772J', type: 'MOTO', brand: 'Suzuki', model: 'GN125', color: 'Negro', isPrimary: true, active: true },
  { id: 4, parkingUserId: 4, plate: 'PDK-1120', type: 'AUTO', brand: 'Hyundai', model: 'Tucson', color: 'Azul', isPrimary: true, active: true },
  { id: 5, parkingUserId: 5, plate: 'HB-334K', type: 'MOTO', brand: 'Yamaha', model: 'FZ', color: 'Rojo', isPrimary: true, active: true }
];
