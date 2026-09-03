export type ParkingUserType = 'ESTUDIANTE' | 'DOCENTE' | 'INVITADO';

export type ParkingServiceStatus =
  | 'HABILITADO'
  | 'INHABILITADO'
  | 'SIN_AUTORIZACION';

export interface ParkingUser {
  id: number;
  sourceId: number | null;
  type: ParkingUserType;
  identification: string;
  fullName: string;
  institutionalEmail: string;
  vehicles: string[];
  paymentPlan: 'DIARIO' | 'MENSUAL' | null;
  paymentValidUntil: string | null;
  serviceStatus: ParkingServiceStatus;
  enabled: boolean;
}

export interface InstitutionalPerson {
  sourceId: number | null;
  type: ParkingUserType;
  identification: string;
  fullName: string;
  institutionalEmail: string;
}
