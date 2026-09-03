# Administración del Parqueadero — YaviBot

Panel Angular para administrar el parqueadero integrado en YaviBot. Incluye el frontend administrativo, los workflows de n8n consumidos por él y scripts SQL complementarios.

## Arquitectura vigente

Los proyectos comparten una sola instancia de n8n y una sola base PostgreSQL:

```text
YaviBot web/móvil ─┐
Panel parqueadero ─┼──> n8n central :5678 ──> PostgreSQL central :5432
Mesa de ayuda ─────┘
```

No se debe levantar otro n8n ni otro PostgreSQL. En local se usan los contenedores de `../Mesa-de-ayuda-n8n-main/docker-compose.yml`.

- YaviBot autentica al estudiante/docente, solicita vehículo y modalidad, crea la solicitud y permite descargar el PDF aprobado.
- El panel revisa, aprueba o rechaza solicitudes; administra invitados y vehículos; configura tarifas y capacidad.
- n8n implementa endpoints y reglas.
- PostgreSQL conserva los datos compartidos.

## Alcance funcional

### Autenticación

- Login con cédula y contraseña.
- Sólo usuarios activos con rol `ADMINISTRADOR_PARKING`.
- JWT de una hora.
- Las rutas administrativas requieren `Authorization: Bearer <token>`.

### Dashboard

Muestra solicitudes pendientes, invitados, vehículos y capacidad. Utiliza el workflow de listar tickets aunque no exista una pantalla separada de historial.

### Usuarios

- Listar y filtrar.
- Registrar únicamente `INVITADO` con cédula de 10 dígitos, nombre y correo.
- Habilitar/inhabilitar.
- Eliminar junto con sus relaciones de parqueadero.

El panel no busca ni crea estudiantes/docentes; ellos ingresan mediante la autenticación existente de YaviBot.

### Vehículos

- Listar.
- Registrar sólo para invitados activos.
- Pedir únicamente usuario, placa y tipo (`AUTO` o `MOTO`).
- Normalizar placa y evitar duplicados.
- Dejar el nuevo vehículo como principal.
- Retirar lógicamente, sin borrar el historial.

Marca, modelo, color y uso no forman parte del formulario actual.

### Solicitudes y tickets

- Listar solicitudes de YaviBot y del panel.
- Registrar una solicitud/pago para un invitado con vehículo activo.
- Modalidades `DIARIO` y `MENSUAL`.
- Métodos `EFECTIVO` y `TRANSFERENCIA`.
- Aprobar una pendiente y generar autorización.
- Rechazar una pendiente con motivo obligatorio.

Vigencias:

- Diaria: misma fecha de inicio y fin, hasta 23:59.
- Mensual desde el día 1: último día del mismo mes.
- Mensual desde otro día: misma fecha del mes siguiente.

No se envían correos, mensajes ni notificaciones al aprobar o rechazar. El usuario debe acercarse o contactar a Administración y luego consultar de nuevo en YaviBot.

El PDF pertenece al workflow central del chatbot. Usa `dd/mm/aaaa – dd/mm/aaaa · 23:59`.

### Configuración

- Cuatro tarifas: diaria/mensual para automóvil/motocicleta.
- Crear, actualizar, activar o desactivar tarifas.
- Configurar capacidad total.

## Fuera de alcance

- Notificaciones automáticas.
- Verificación bancaria.
- QR.
- Operación de entradas/salidas.
- Vehículos temporales.
- Otro n8n/PostgreSQL.
- Administración de estudiantes/docentes desde el panel.

`parqueadero_accesos` y `parqueadero_vehiculos_temporales` se conservan sólo como dependencias técnicas del cálculo de capacidad y la eliminación íntegra. No hay endpoints activos de entrada/salida.

## Requisitos

- Docker Desktop.
- Node.js 22 y npm 10.
- Ambos proyectos en el mismo directorio padre.
- Puertos 5432, 5678 y 4201; pgAdmin usa 5050.

## Arranque local

### 1. Servicios compartidos

Desde `Mesa-de-ayuda-n8n-main`:

```powershell
docker compose up -d
docker compose ps
```

- n8n: http://localhost:5678
- pgAdmin: http://localhost:5050
- PostgreSQL: `localhost:5432`

No ejecute un segundo Compose desde parqueadero.

### 2. PostgreSQL

Para instalar todo el módulo en la base institucional que ya contiene el esquema base de YaviBot, ejecute el instalador consolidado 
8n/sql/000-instalacion-completa-parqueadero.sql. No ejecute además los scripts incrementales sobre una instalación nueva.

El esquema principal es:

```text
../Mesa-de-ayuda-n8n-main/database/10-parqueadero-yavibot.sql
```

En una instalación nueva ejecútelo primero en `yavibot`. Luego:

1. `n8n/sql/006-rol-administrador-parking.sql`
2. `n8n/sql/007-parqueadero-accesos-base.sql`
3. `n8n/sql/004-parqueadero-capacidad.sql`
4. Sólo desarrollo: `n8n/sql/seed-local-panel-user.sql`

Migraciones para bases antiguas que no ejecutaron el esquema compartido actual:

- `001-parqueadero-usuarios-manuales.sql`
- `003-parqueadero-configuracion-tarifas.sql`
- `005-parqueadero-solicitudes-tickets.sql`

Ejemplo:

```powershell
Get-Content .\n8n\sql\006-rol-administrador-parking.sql -Raw |
  docker exec -i yavibot-postgres psql -U yavibot -d yavibot
```

El seed local es sólo de desarrollo. Consulte sus datos de prueba en la pantalla de login o en el propio archivo; no lo ejecute en producción.

### 3. n8n

1. Abra http://localhost:5678.
2. Importe todos los JSON de `n8n/workflows/`.
3. Seleccione `YaviBot Postgres` en cada nodo PostgreSQL.
4. Verifique `JWT_SECRET` y `NODE_FUNCTION_ALLOW_BUILTIN=crypto,fs`.
5. Guarde y publique cada workflow.

Dentro de Docker, la credencial usa host `postgres` y puerto 5432; no `localhost`.

Vea [inventario de workflows](n8n/README.md) y [contrato HTTP](n8n/CONTRATO-API.md).

### 4. Angular

```powershell
npm install
npm start -- --port 4201
```

Abra http://localhost:4201. El proxy envía `/webhook` a n8n:5678.

## Prueba funcional

1. Inicie sesión.
2. Registre un invitado.
3. Registre placa y tipo.
4. Verifique tarifas.
5. Solicite un ticket desde YaviBot.
6. Confirme estado `PENDIENTE`.
7. Pruebe rechazo con motivo.
8. Cree otra solicitud y apruébela eligiendo fecha.
9. Verifique su vigencia.
10. Consulte YaviBot y descargue el PDF.

## Estados válidos

- `parqueadero_pagos.estado`: `PENDIENTE`, `APROBADO`, `RECHAZADO`, `ANULADO`.
- `parqueadero_autorizaciones.estado`: `VIGENTE`, `VENCIDA`, `BLOQUEADA`, `ANULADA`.

Para una autorización se usa `ANULADA`, no `ANULADO`. Para repetir una prueba:

```sql
UPDATE public.parqueadero_autorizaciones
SET estado = 'ANULADA', actualizado_en = now()
WHERE id = ID_DE_LA_AUTORIZACION;
```

## Producción

1. Cambie `useMocks` a `false` en `src/environments/environment.prod.ts`.
2. Use secretos/cuentas reales y no ejecute el seed local.
3. Ejecute `npm run build`.
4. Publique `dist/parqueadero-admin-web/`.
5. Sirva Angular con Nginx y reenvíe `/webhook/*` al n8n central.
6. No exponga PostgreSQL, pgAdmin ni el editor n8n directamente.

## Solución de problemas

### Login incorrecto

- Reejecute el seed local.
- Verifique usuario activo y rol `ADMINISTRADOR_PARKING`.
- Confirme el workflow de login publicado.
- Revise `YaviBot Postgres`.

### Credencial no guardada

Seleccione la credencial en cada nodo, guarde y después publique. Revise:

```powershell
docker logs --tail 200 yavibot-n8n
```

### Webhook 404

Confirme que esté publicado, que no haya otra copia activa con la misma ruta y que n8n responda en 5678.

### Datos simulados

Cambie `useMocks` a `false` en el environment compilado.

### Faltan tablas de capacidad/eliminación

Ejecute `007-parqueadero-accesos-base.sql` y luego `004-parqueadero-capacidad.sql`.

## Verificación

```powershell
npm run build
```

Antes de desplegar, todos los JSON deben importar correctamente y usar la credencial compartida.
