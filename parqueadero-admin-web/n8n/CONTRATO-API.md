# Contrato API — Parqueadero administrativo

Base URL utilizada por Angular: `/webhook`. En producción nginx debe servir la
web y enviar `/webhook/*` al contenedor n8n en `127.0.0.1:5678`.

Todas las rutas administrativas usan el JWT emitido por `panel/login`:

```http
Authorization: Bearer <token>
```

Una respuesta `401` indica token inexistente, inválido o vencido. Una respuesta
`403` indica una sesión válida sin permisos para administrar parqueadero.

## Iniciar sesión en el panel

```http
POST /webhook/panel/parqueadero/login
Content-Type: application/json
```

Petición:

```json
{
  "cedula": "0000000001",
  "password": "contraseña-del-panel"
}
```

Respuesta `200`:

```json
{
  "token": "eyJ...",
  "expiresIn": 3600,
  "user": {
    "id": 5,
    "identification": "0000000001",
    "fullName": "Super Administrador",
    "email": "superadmin@yavirac.edu.ec",
    "role": "SUPERADMIN",
    "permissions": ["parqueadero.ver", "parqueadero.gestionar"]
  }
}
```

El token expira después de una hora. Las credenciales incorrectas responden
`401`; un cuerpo inválido responde `400`.

## Listar usuarios del parqueadero

```http
GET /webhook/panel/parqueadero/usuarios
```

Respuesta `200`:

```json
{
  "data": [
    {
      "id": 1,
      "sourceId": 12,
      "type": "ESTUDIANTE",
      "identification": "1721456789",
      "fullName": "María Fernanda Loor",
      "institutionalEmail": "mf.loor@yavirac.edu.ec",
      "vehicles": ["PCS-4821"],
      "paymentPlan": "MENSUAL",
      "paymentValidUntil": "2026-08-30",
      "serviceStatus": "HABILITADO",
      "enabled": true
    }
  ]
}
```

`paymentPlan` y `paymentValidUntil` son `null` cuando no existe un pago aprobado
vigente. `serviceStatus` puede ser `HABILITADO`, `INHABILITADO` o
`SIN_AUTORIZACION`.

Desde el panel se crean únicamente invitados; no se realiza búsqueda institucional por cédula. El cambio de estado se conserva para habilitar o inhabilitar usuarios.

## Eliminar usuario del parqueadero

```http
DELETE /webhook/panel/parqueadero/usuarios/eliminar
Content-Type: application/json
```

```json
{ "id": 1 }
```

La eliminación es irreversible. En una sola operación se borran los accesos,
vehículos temporales, autorizaciones (tickets), pagos y vehículos relacionados;
finalmente se elimina el registro de `parqueadero_usuarios`. Responde `200` si
se completó o `404` si el usuario no existe.

Si la cédula no existe en estudiantes ni docentes, la creación utiliza
`type: "INVITADO"` y `sourceId: null`. Antes de habilitar esta opción se debe
ejecutar nuevamente `sql/001-parqueadero-usuarios-manuales.sql`; el script
también convierte a `INVITADO` los usuarios manuales registrados anteriormente.

## Listar vehículos activos

```http
GET /webhook/panel/parqueadero/vehiculos
```

Respuesta `200`:

```json
{
  "data": [
    {
      "id": 1,
      "parkingUserId": 1,
      "plate": "PCS-4821",
      "type": "AUTO",
      "brand": "Chevrolet",
      "model": "Sail",
      "color": "Gris",
      "isPrimary": true,
      "active": true
    }
  ]
}
```

## Registrar vehículo

```http
POST /webhook/panel/parqueadero/vehiculos/crear
Content-Type: application/json
```

```json
{
  "parkingUserId": 1,
  "plate": "PCS-4821",
  "type": "AUTO"
}
```

Sólo admite invitados activos. `type` puede ser `AUTO` o `MOTO`. Marca, modelo, color e indicador principal no forman parte de la petición; el servidor establece los campos opcionales en nulo y el vehículo nuevo como principal.

## Retirar vehículo

```http
PATCH /webhook/panel/parqueadero/vehiculos/retirar
Content-Type: application/json
```

```json
{ "id": 1 }
```

El retiro es lógico: conserva el registro y establece `activo = false`. Cuando
se retira el vehículo habitual y existe otro activo, el sistema promueve uno de
los secundarios como nuevo habitual.

## Catálogo de modalidades

```http
GET /webhook/panel/parqueadero/pagos/catalogos
```

Devuelve las tarifas activas para las combinaciones `DIARIO`/`MENSUAL` y
`AUTO`/`MOTO`. Angular muestra estos valores, pero el servidor vuelve a consultar
la tarifa al registrar para impedir que el monto sea alterado desde el cliente.

## Listar pagos

```http
GET /webhook/panel/parqueadero/pagos
```

La respuesta contiene `id`, `parkingUserId`, `modality`, `amount`, `startDate`,
`endDate`, `status`, `method`, `reference` y `authorizationIssued`.

## Registrar pago

```http
POST /webhook/panel/parqueadero/pagos/crear
Content-Type: application/json
```

```json
{
  "parkingUserId": 1,
  "vehicleId": 2,
  "modality": "MENSUAL",
  "startDate": "2026-08-16",
  "method": "TRANSFERENCIA",
  "reference": "TRX-123456",
  "status": "APROBADO",
  "issueAuthorization": true
}
```

El vehículo se valida para determinar su tipo y tarifa, pero el pago queda
asociado al usuario según el esquema de la base. La vigencia diaria empieza y termina en la fecha indicada, hasta las 23:59. La mensual iniciada el día 1 termina el último día del mismo mes; si empieza otro día, termina en la misma fecha del mes siguiente. Si el pago está aprobado y `issueAuthorization` es `true`, el ticket se crea en la misma operación. Una transferencia puede registrarse como pendiente sin integración bancaria.

## Aprobar un pago pendiente y generar ticket

```http
PATCH /webhook/panel/parqueadero/pagos/aprobar
Content-Type: application/json
```

```json
{ "id": 15, "startDate": "2026-08-17" }
```

Aprueba el pago pendiente, actualiza su periodo de vigencia desde la fecha
indicada y genera el ticket en una sola operación. Responde `409` cuando el pago
ya fue procesado, ya tiene ticket o el usuario está inhabilitado.

## Rechazar una solicitud pendiente

```http
PATCH /webhook/panel/parqueadero/tickets/rechazar
Content-Type: application/json
```

```json
{ "id": 15, "reason": "No se pudo validar la información." }
```

El motivo es obligatorio, admite hasta 300 caracteres y la solicitud debe seguir en `PENDIENTE`. No se envía ninguna notificación.

## Configuración de tarifas

```http
GET /webhook/panel/parqueadero/configuracion/tarifas
POST /webhook/panel/parqueadero/configuracion/tarifas/crear
PATCH /webhook/panel/parqueadero/configuracion/tarifas/actualizar
```

La consulta devuelve todas las combinaciones, incluidas las inactivas. Para
actualizar una tarifa se envía, por ejemplo:

```json
{ "id": 1, "amount": 1.75, "active": true }
```

Una tarifa activa debe tener un precio mayor a cero. Los cambios solo afectan
pagos nuevos; `parqueadero_pagos.monto` conserva el valor histórico.

Solo puede existir una fila por combinación de modalidad y tipo de vehículo.
El intento de crear una combinación existente responde `409`; en ese caso se
debe actualizar la tarifa existente.

## Historial de tickets

```http
GET /webhook/panel/parqueadero/tickets
```

Devuelve en `data` los tickets creados desde pagos aprobados, ordenados desde el
más reciente. Esta ruta es de solo lectura; la pantalla no emite tickets. La
generación continúa formando parte del registro de pagos.

El código visible usa el formato corto `YV-000015`. La columna UUID original se
mantiene internamente y no es necesario modificar la tabla existente.

## Capacidad del parqueadero

```http
GET /webhook/panel/parqueadero/configuracion/capacidad
PATCH /webhook/panel/parqueadero/configuracion/capacidad/actualizar
```

Respuesta de consulta:

```json
{ "total": 100, "occupied": 7, "available": 93 }
```

Para actualizarla se envía `{ "total": 120 }`. El servidor no permite reducir
el total por debajo de la ocupación actual. Requiere ejecutar previamente
`sql/004-parqueadero-capacidad.sql`.

## Funciones no expuestas

Este contrato no incluye endpoints de entrada, salida, QR, vehículos temporales ni notificaciones. Estas funciones están fuera del alcance actual.
