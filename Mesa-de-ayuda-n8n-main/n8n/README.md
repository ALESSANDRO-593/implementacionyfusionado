# n8n — Orquestación de YaviBot

n8n es el "backend" del sistema (arquitectura n8n puro). Corre en Docker (`docker compose up -d`) en **http://localhost:5678**.

## Acceso
- Owner: `admin@yavibot.local` / `YaviBot2026` (solo entorno local; cambiar en producción).
- Correo: **SMTP real de Gmail**, configurado por variables de entorno en el archivo `.env` de la raíz (`SMTP_HOST/PORT/SECURE/USER/PASS/FROM`). Los Code nodes lo leen con `$env.SMTP_*`. Ya no se usa Mailpit.

## Credenciales configuradas en n8n
| Nombre | Tipo | Apunta a |
|--------|------|----------|
| YaviBot Postgres | postgres | host `postgres`, db `yavibot` |
| (SMTP) | — | Ya no es credencial de n8n; se toma de `.env` (Gmail) vía `$env.SMTP_*` |

> Al reconstruir n8n desde cero, recrea estas credenciales y reasocia los nodos, o reimporta con los IDs correspondientes.

## Workflows (en `workflows/`)
| Archivo | Webhook | Función |
|---------|---------|---------|
| `chatbot-iniciar.json` | `POST /webhook/chatbot/iniciar` | Valida cédula + estado de matrícula (ACTIVA), genera OTP de 5 dígitos (hash SHA-256 en BD) y lo envía por correo. |
| `chatbot-validar.json` | `POST /webhook/chatbot/otp/validar` | Verifica el OTP (un solo uso, expiración 5 min), lo marca usado y emite un JWT de sesión de chat (HS256). |
| `panel-login.json` | `POST /webhook/panel/login` | Autentica con cédula + contraseña (bcrypt), emite JWT con rol y carreras. |
| `panel-tickets.json` | `GET /webhook/panel/tickets` | Lista tickets del usuario autenticado (RBAC: solo `responsable_id = uid`). |
| `panel-detalle.json` | `GET /webhook/panel/tickets/detalle?id=` | Detalle del ticket + historial (403 si no es suyo). |
| `panel-responder.json` | `PATCH /webhook/panel/tickets/responder` | Cambia estado, registra historial y notifica al estudiante por correo. |

> Los workflows del panel usan Code nodes con `require('pg')`, `require('bcryptjs')` y `require('nodemailer')` (habilitados por `NODE_FUNCTION_ALLOW_EXTERNAL`). Verifican el JWT (HS256) leyendo el header `Authorization: Bearer`.

| `chatbot-certificado.json` | `POST /webhook/chatbot/certificado` | (sesión de chat) Genera un QR único, arma el PDF con plantilla institucional + QR embebido, lo guarda en `storage/certificados/`, registra el certificado y lo envía por correo con el PDF adjunto. Texto y datos (modalidad, periodo lectivo, periodo de ingreso, firmante) ajustados a partir del formato real institucional — ver `database/05-migracion-certificado.sql`. |
| `verificar.json` | `GET /webhook/verificar?id=` | Público. Verifica la autenticidad de un certificado por el identificador del QR e incrementa el contador de verificaciones. |
| `chatbot-ticket-crear.json` | `POST /webhook/chatbot/ticket` | (sesión de chat) Crea un ticket (Récord/Vinculación/Anulación), lo asigna automáticamente al responsable vigente (`asignaciones_responsables`: carrera→Coordinador, vinculación→Resp. Vinculación), registra historial + eventos y notifica al responsable. |
| `chatbot-ticket-consultar.json` | `GET /webhook/chatbot/tickets` | (sesión de chat) Lista los tickets del estudiante con su estado y última respuesta (solo lectura). |
| `panel-catalogos.json` | `GET /webhook/panel/catalogos` | Laboratorios y categorías de alerta para el formulario. |
| `alerta-crear.json` | `POST /webhook/panel/alertas/crear` | (rol PROFESOR) Valida la foto (JPG/PNG ≤5 MB), la guarda en `storage/uploads`, crea la alerta, la asigna al Responsable de Laboratorios vigente, registra historial + evento y notifica. |
| `alerta-listar.json` | `GET /webhook/panel/alertas` | RBAC: PROFESOR ve solo las suyas, RESP_LABORATORIOS ve todas. |
| `alerta-actualizar.json` | `PATCH /webhook/panel/alertas/actualizar` | (rol RESP_LABORATORIOS) Cambia estado (Pendiente/En revisión/Resuelta) + observación + historial. |
| `panel-adjunto.json` | `GET /webhook/panel/adjunto?id=` | Devuelve la foto de una alerta como data URL (autenticado). |

> **Diseño Alertas:** como la tabla `tickets` es exclusiva de solicitudes de estudiantes (requiere `estudiante_id`), la **alerta** es el ítem de trabajo de laboratorios (código `AL-`, estado propio, responsable e historial). Las fotos se guardan en `./storage/uploads`.

### Librerías para PDF/QR
Los Code nodes del certificado usan `qrcode` y `pdfkit`, montados desde `n8n/libs` (via `NODE_PATH=/opt/node_libs/node_modules`). Antes de levantar n8n:
```
cd n8n/libs && npm install
```
Los PDFs generados se guardan en `./storage/certificados` (montado en `/data/storage` dentro del contenedor). El QR embebido apunta a `http://localhost:4200/verificar/<identificador>`.

## Estado del flujo probado (✅ end-to-end)
- Cédula ACTIVA → OTP enviado y visible en Mailpit.
- Cédula RETIRADA/inexistente → acceso bloqueado con el mensaje del prompt.
- OTP correcto → sesión + datos del estudiante. OTP incorrecto/expirado/reutilizado → rechazado.
- Verificado desde `curl` y desde el frontend Angular (`localhost:4200`), CORS incluido.

## Notas de seguridad (pendientes de endurecer)
- El secreto JWT está embebido en el Code node (`yavibot-dev-secret-change-me`) — mover a variable de entorno de n8n.
- Falta `rate-limit` / bloqueo por intentos (tabla `intentos_acceso`) — se añadirá al workflow.
- Pendientes: reenvío de OTP, y los guards `guard-chat-session` para los webhooks de certificado/tickets.
