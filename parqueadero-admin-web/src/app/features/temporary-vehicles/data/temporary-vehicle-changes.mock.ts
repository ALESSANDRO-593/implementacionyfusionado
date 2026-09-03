import { TemporaryVehicleChange } from '../models/temporary-vehicle-change.model';

export const TEMPORARY_VEHICLE_CHANGES_MOCK: TemporaryVehicleChange[] = [
  {
    id: 1,
    parkingUserId: 1,
    authorizationId: 3,
    primaryVehicleId: 1,
    temporaryPlate: 'PBA-7745',
    vehicleType: 'AUTO',
    startDate: '2026-08-13',
    endDate: '2026-08-13',
    reason: 'Pico y placa',
    registeredByPanelUserId: 1,
    registeredAt: '2026-08-13T08:35:00-05:00'
  }
];
