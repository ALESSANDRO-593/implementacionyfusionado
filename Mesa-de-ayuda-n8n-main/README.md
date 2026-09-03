# YaviBot — Mesa de Ayuda Inteligente (Instituto Yavirac)

Sistema con arquitectura **n8n puro**: `Angular (frontend) → Webhooks n8n (backend/orquestador) → PostgreSQL`, orientado a eventos.

## Qué incluye (piezas del sistema)

| Pieza | Tecnología | Cómo corre |
|-------|-----------|-----------|
| **Base de datos** | PostgreSQL 16 | Docker (contenedor `yavibot-postgres`) |
| **Backend / orquestador** | n8n (workflows) | Docker (contenedor `yavibot-n8n`) |
| **Correo** | SMTP real de Gmail | configurado en `.env` (ver abajo) |
| **Admin de BD** | pgAdmin | Docker (`yavibot-pgadmin`), http://localhost:5050 |
| **Frontend** | Angular 20 | `npm start` (dev server) |

La BD, n8n y pgAdmin se levantan con **un solo comando** (`docker compose up -d`). El frontend se arranca aparte con `npm start`.

## Requisitos
- Docker Desktop
- Node.js 20.19+ o 22.12+ (probado con 22.20)

## Cómo arrancar todo (desde cero)

```bash
# 1) Librerías extra para los Code nodes de n8n (QR + PDF) — solo la 1ª vez
cd n8n/libs && npm install && cd ../..

# 2) Correo: copia .env.example a .env y pon tu Gmail + App Password
cp .env.example .env   # luego edita SMTP_USER y SMTP_PASS

# 3) Levantar Base de datos + n8n + pgAdmin
docker compose up -d

# 3) Dependencias del frontend — solo la 1ª vez
cd frontend && npm install

# 4) Arrancar el frontend (déjalo corriendo)
npm start
```

Cuando `npm start` diga `Local: http://localhost:4200/`, ya está todo listo.

## Cómo abrir cada parte

| Qué | URL | Acceso |
|-----|-----|--------|
| **Chatbot** (estudiantes) | http://localhost:4200 | Cédula de prueba: `1756234890` (el OTP llega al correo real) |
| **Panel Web** (personal) | http://localhost:4200/panel/login | Ver credenciales abajo |
| **Verificar certificado** | http://localhost:4200/verificar/&lt;id&gt; | Público (lo abre el QR del PDF) |
| **Admin de la BD** (pgAdmin) | http://localhost:5050 | `admin@yavibot.com` / `YaviBot2026` (contraseña BD: `yavibot_dev_2026`) |
| **Editor de n8n** (ver los workflows) | http://localhost:5678 | `admin@yavibot.local` / `YaviBot2026` |

### Usuarios del Panel

Los accesos se resuelven **por `rol_id`**, nunca por nombre ni por listas fijas: a un
docente le basta con tener el `rol_id` correspondiente en `usuarios_panel` para heredar
la vista y los permisos de ese cargo. Cada rol ve **solo** los trámites que audita, según
la tabla `rol_tipos_solicitud`.

| `rol_id` | Rol | Qué ve | Cédula (usuario) | Contraseña |
|---|-----|--------|------------------|-----------|
| `-1` | **Super Administrador** | Carga masiva (CSV/Excel) + todos los tickets | `0000000001` | `SuperAdmin2026*` |
| `2` | Coordinador de Carrera (Software) | Tickets de **Récord Académico** | `1711178119` | su cédula |
| `5` | Secretaría | Tickets de **Anulación de Matrícula** | `1711077410` | su cédula |
| `3` | Responsable de Vinculación | Tickets de **Certificado de Vinculación** | `1722146907` | su cédula |
| `4` | Responsable de Laboratorios | Módulo de Alertas (todas) + aviso por correo | `1721907655` | su cédula |
| `1` | Profesor | Módulo de Alertas (reportar / ver las suyas) | cédula de cualquier docente | su cédula |

> Los usuarios de demostración del seed (`1710000001`–`1710000003`) quedaron **desactivados**
> por la migración `09`, para que no compitan con los docentes reales.
> Reactivarlos: `UPDATE usuarios_panel SET activo = true WHERE cedula IN ('1710000001','1710000002','1710000003');`

### Flujo de prueba rápido (estudiante)
1. Abre http://localhost:4200 e ingresa la cédula `1756234890`.
2. El OTP de 5 dígitos llega al **correo institucional** del estudiante (requiere `.env` con Gmail configurado).
3. En el menú, pide "Certificado de Matrícula" → llega el PDF con su QR al correo.

## Parar / reiniciar

```bash
docker compose stop      # pausa los contenedores (conserva datos)
docker compose start     # los vuelve a arrancar
docker compose down      # los elimina (conserva datos en volúmenes)
docker compose down -v   # ⚠️ ELIMINA TODO incluida la BD y la config de n8n
```
El frontend se para con `Ctrl+C` en la terminal de `npm start`.

> Los datos (BD y configuración de n8n) viven en **volúmenes de Docker** y persisten entre reinicios. Solo se pierden con `down -v`.

## Estructura del proyecto
```
docker-compose.yml      # Postgres + n8n + pgAdmin
.env / .env.example     # credenciales SMTP de Gmail (el .env no se sube a Git)
database/               # 01-schema.sql, 02-seed.sql, 03-seed-tickets.sql (se cargan solos)
n8n/
  workflows/            # los 15 workflows (importables a n8n)
  libs/                 # qrcode + pdfkit para los Code nodes
  README.md             # detalle de cada workflow y credenciales
frontend/               # aplicación Angular (chatbot + panel + verificación)
storage/                # PDFs de certificados y fotos de alertas (generados)
docs/                   # diseño completo (Fase 1): análisis, arquitectura, modelo de datos…
```

## Nota sobre n8n en una PC nueva
Los workflows están en `n8n/workflows/` pero **las credenciales de n8n no** (son secretos). En una instalación desde cero hay que, dentro de n8n (http://localhost:5678):
1. Crear la cuenta owner.
2. Crear la credencial **Postgres** (host `postgres`, db/usuario `yavibot`, pass `yavibot_dev_2026`). El correo ya no usa credencial de n8n: se configura por variables de entorno en `.env` (Gmail).
3. Importar los workflows de `n8n/workflows/` y activarlos.

En **esta** máquina eso ya está hecho y persistido; no necesitas repetirlo.
