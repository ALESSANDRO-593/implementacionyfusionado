export const N8N_WEBHOOKS = {
  panelLogin: 'panel/parqueadero/login',
  parkingUsersList: 'panel/parqueadero/usuarios',
  parkingUserCreate: 'panel/parqueadero/usuarios/crear',
  parkingUserStatus: 'panel/parqueadero/usuarios/estado',
  parkingUserDelete: 'panel/parqueadero/usuarios/eliminar',
  parkingVehiclesList: 'panel/parqueadero/vehiculos',
  parkingVehicleCreate: 'panel/parqueadero/vehiculos/crear',
  parkingVehicleRetire: 'panel/parqueadero/vehiculos/retirar',
  parkingPaymentsCatalogs: 'panel/parqueadero/pagos/catalogos',
  parkingPaymentsList: 'panel/parqueadero/pagos',
  parkingPaymentCreate: 'panel/parqueadero/pagos/crear',
  parkingPaymentApprove: 'panel/parqueadero/pagos/aprobar',
  parkingTicketReject: 'panel/parqueadero/tickets/rechazar',
  parkingTariffsList: 'panel/parqueadero/configuracion/tarifas',
  parkingTariffCreate: 'panel/parqueadero/configuracion/tarifas/crear',
  parkingTariffUpdate: 'panel/parqueadero/configuracion/tarifas/actualizar',
  parkingTicketsList: 'panel/parqueadero/tickets',
  parkingCapacityGet: 'panel/parqueadero/configuracion/capacidad',
  parkingCapacityUpdate: 'panel/parqueadero/configuracion/capacidad/actualizar',
  parkingAccessList: 'panel/parqueadero/accesos',
  parkingAccessEntry: 'panel/parqueadero/accesos/entrada',
  parkingAccessExit: 'panel/parqueadero/accesos/salida'
} as const;

export const SESSION_TOKEN_KEY = 'parqueadero_admin_session';
export const SESSION_USER_KEY = 'parqueadero_admin_user';
