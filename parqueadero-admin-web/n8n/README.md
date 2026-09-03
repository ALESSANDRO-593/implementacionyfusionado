# Backend n8n del panel de parqueadero

Esta carpeta contiene los workflows que utiliza actualmente `parqueadero-admin-web` y SQL complementario. Se conectan al n8n y PostgreSQL centrales de YaviBot. Consulte la [guía principal](../README.md).

## Workflows vigentes

### Sesión

- `panel-login-local.json`: `POST /webhook/panel/parqueadero/login`.

### Usuarios

- `parqueadero-usuarios-listar.json`: `GET /webhook/panel/parqueadero/usuarios`.
- `parqueadero-usuario-crear.json`: `POST /webhook/panel/parqueadero/usuarios/crear`.
- `parqueadero-usuario-estado.json`: `PATCH /webhook/panel/parqueadero/usuarios/estado`.
- `parqueadero-usuario-eliminar.json`: `DELETE /webhook/panel/parqueadero/usuarios/eliminar`.

El alta admite sólo invitados. La búsqueda institucional por cédula fue retirada porque el formulario vigente no la utiliza.

### Vehículos

- `parqueadero-vehiculos-listar.json`: `GET /webhook/panel/parqueadero/vehiculos`.
- `parqueadero-vehiculo-crear.json`: `POST /webhook/panel/parqueadero/vehiculos/crear`.
- `parqueadero-vehiculo-retirar.json`: `PATCH /webhook/panel/parqueadero/vehiculos/retirar`.

El registro recibe solamente usuario, placa y tipo.

### Solicitudes y tickets

- `parqueadero-pagos-catalogos.json`: `GET /webhook/panel/parqueadero/pagos/catalogos`.
- `parqueadero-pagos-listar.json`: `GET /webhook/panel/parqueadero/pagos`.
- `parqueadero-pago-crear.json`: `POST /webhook/panel/parqueadero/pagos/crear`.
- `parqueadero-pago-aprobar.json`: `PATCH /webhook/panel/parqueadero/pagos/aprobar`.
- `parqueadero-ticket-rechazar.json`: `PATCH /webhook/panel/parqueadero/tickets/rechazar`.
- `parqueadero-tickets-listar.json`: `GET /webhook/panel/parqueadero/tickets`.

El último se conserva porque alimenta el dashboard.

### Configuración

- `parqueadero-configuracion-tarifas-listar.json`.
- `parqueadero-configuracion-tarifa-crear.json`.
- `parqueadero-configuracion-tarifa-actualizar.json`.
- `parqueadero-configuracion-capacidad.json`.
- `parqueadero-configuracion-capacidad-actualizar.json`.

No hay workflows activos de entrada, salida, QR, vehículos temporales ni notificaciones.

## SQL

Instalación institucional recomendada:

- sql/000-instalacion-completa-parqueadero.sql: crea en una sola ejecución las ocho tablas, índices, datos iniciales y el rol de Parking. No contiene usuarios de prueba ni operaciones destructivas.

Esquema principal:

```text
../../Mesa-de-ayuda-n8n-main/database/10-parqueadero-yavibot.sql
```

Complementos vigentes:

- `006-rol-administrador-parking.sql`: rol administrativo.
- `007-parqueadero-accesos-base.sql`: dependencias técnicas para capacidad y eliminación; no habilita endpoints de acceso.
- `004-parqueadero-capacidad.sql`: capacidad e índice.
- `seed-local-panel-user.sql`: sólo desarrollo.

Compatibilidad con bases antiguas:

- `001-parqueadero-usuarios-manuales.sql`.
- `003-parqueadero-configuracion-tarifas.sql`.
- `005-parqueadero-solicitudes-tickets.sql`.

El script parcial `002` fue eliminado porque `003` lo reemplaza.

## Importación

1. Importe los JSON en la instancia central.
2. Seleccione `YaviBot Postgres` en todos los nodos PostgreSQL.
3. Verifique `JWT_SECRET` y `NODE_FUNCTION_ALLOW_BUILTIN=crypto,fs`.
4. Guarde y publique.
5. No active dos workflows con la misma ruta.

Todos los endpoints salvo login requieren JWT. Consulte [CONTRATO-API.md](CONTRATO-API.md).
