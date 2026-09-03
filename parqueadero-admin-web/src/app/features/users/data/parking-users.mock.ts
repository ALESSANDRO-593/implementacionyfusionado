import { InstitutionalPerson, ParkingUser } from '../models/parking-user.model';

export const PARKING_USERS_MOCK: ParkingUser[] = [
  {
    id: 1,
    sourceId: 12,
    type: 'ESTUDIANTE',
    identification: '1721456789',
    fullName: 'María Fernanda Loor',
    institutionalEmail: 'mf.loor@yavirac.edu.ec',
    vehicles: ['PCS-4821'],
    paymentPlan: 'MENSUAL',
    paymentValidUntil: '2026-08-30',
    serviceStatus: 'HABILITADO',
    enabled: true
  },
  {
    id: 2,
    sourceId: 8,
    type: 'DOCENTE',
    identification: '1103456721',
    fullName: 'Carlos Andrés Pilataxi',
    institutionalEmail: 'ca.pilataxi@yavirac.edu.ec',
    vehicles: ['IBA-0932'],
    paymentPlan: 'MENSUAL',
    paymentValidUntil: '2026-08-30',
    serviceStatus: 'HABILITADO',
    enabled: true
  },
  {
    id: 3,
    sourceId: 25,
    type: 'ESTUDIANTE',
    identification: '1750984312',
    fullName: 'Doménica Salazar Vera',
    institutionalEmail: 'd.salazar@yavirac.edu.ec',
    vehicles: ['HM-772J'],
    paymentPlan: null,
    paymentValidUntil: null,
    serviceStatus: 'INHABILITADO',
    enabled: false
  },
  {
    id: 4,
    sourceId: 14,
    type: 'DOCENTE',
    identification: '0603127845',
    fullName: 'Jorge Luis Tenesaca',
    institutionalEmail: 'jl.tenesaca@yavirac.edu.ec',
    vehicles: ['PDK-1120'],
    paymentPlan: null,
    paymentValidUntil: null,
    serviceStatus: 'SIN_AUTORIZACION',
    enabled: true
  },
  {
    id: 5,
    sourceId: 33,
    type: 'ESTUDIANTE',
    identification: '1719002344',
    fullName: 'Alisson Cabrera Mena',
    institutionalEmail: 'a.cabrera@yavirac.edu.ec',
    vehicles: ['HB-334K'],
    paymentPlan: 'DIARIO',
    paymentValidUntil: '2026-08-16',
    serviceStatus: 'HABILITADO',
    enabled: true
  }
];

export const AVAILABLE_PEOPLE_MOCK: InstitutionalPerson[] = [
  {
    sourceId: 41,
    type: 'ESTUDIANTE',
    identification: '1712345678',
    fullName: 'Andrea Morales Cárdenas',
    institutionalEmail: 'a.morales@yavirac.edu.ec'
  },
  {
    sourceId: 19,
    type: 'DOCENTE',
    identification: '1711122233',
    fullName: 'Luis Fernando Almeida',
    institutionalEmail: 'lf.almeida@yavirac.edu.ec'
  }
];
