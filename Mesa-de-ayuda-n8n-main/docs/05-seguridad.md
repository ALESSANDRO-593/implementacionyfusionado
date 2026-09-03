# 05 — Seguridad

## 5.1 Autenticación

### Panel Web (JWT)
- Login: cédula + contraseña. Contraseñas con **bcrypt** (cost ≥ 10).
- Emisión de **JWT** firmado (HS256, secreto en variable de entorno de n8n) con claims `{ sub, rol, carreras, iat, exp }`. Duración configurable (`jwt.duracion_min`).
- Cada webhook protegido invoca `guard-jwt` (verifica firma + expiración) y `guard-rbac` (verifica permiso).
- Refresh token: opcional; si se implementa, token de refresco de vida más larga en cookie `HttpOnly` + endpoint `/panel/refresh`.
- Cierre por inactividad (opcional): el frontend descarta el token tras X minutos sin actividad.

### Chatbot (OTP)
- Factor 1: cédula + estado de matrícula ACTIVA.
- Factor 2: **OTP de 5 dígitos**, aleatorio, **hash almacenado** (no en claro), un solo uso, expiración configurable.
- Tras validar OTP se emite un **token de sesión de chat** (JWT corto) que autoriza las acciones del chatbot durante la sesión.
- Límite de intentos (`otp.max_intentos`) → **bloqueo temporal** (`otp.bloqueo_min`) por cédula/canal (`intentos_acceso`).

## 5.2 Autorización (RBAC)

Permisos asociados a **roles**, no a usuarios (RNF-02). Matriz:

| Permiso | PROFESOR | COORDINADOR | RESP_VINCULACION | RESP_LABORATORIOS |
|---------|:--:|:--:|:--:|:--:|
| `alerta.crear` | ✅ | | | |
| `alerta.ver_propias` | ✅ | | | |
| `alerta.ver_todas` | | | | ✅ |
| `alerta.gestionar` | | | | ✅ |
| `ticket.ver` (carreras propias) | | ✅ | | |
| `ticket.ver` (vinculación) | | | ✅ | |
| `ticket.responder` | | ✅ | ✅ | |
| `ticket.cambiar_estado` | | ✅ | ✅ | |
| `estadisticas.ver` | | ✅ | ✅ | ✅ |
| `config.responsables` | (autoridad designada — PA-1) | | | |

Reglas de alcance adicionales (se validan en workflow, no solo por permiso):
- Coordinador: solo tickets cuya `carrera_id ∈ carreras del usuario`.
- Resp. Vinculación: solo tickets `ambito='vinculacion'`.
- Profesor: solo alertas con `profesor_id = usuario`.

## 5.3 Protección de la aplicación

- **SQL Injection:** exclusivamente consultas parametrizadas (`$1,$2,...`) en nodos Postgres; prohibido concatenar SQL con input.
- **XSS:** Angular escapa por defecto; nunca usar `[innerHTML]` con datos de usuario sin `DomSanitizer`. Sanitizar descripciones de ticket/alerta al mostrar.
- **CSRF:** al usar `Authorization: Bearer` (no cookies para el API), el riesgo CSRF es bajo. Si se usa cookie de refresh, aplicar `SameSite=Strict` + token anti-CSRF.
- **CORS:** n8n restringe `Access-Control-Allow-Origin` al origen del SPA. HTTPS obligatorio extremo a extremo.
- **Validación de entradas:** cédula `^[0-9]{10}$`, correo, longitudes, enums de estado; validación en frontend (UX) **y** en n8n (autoridad).
- **Archivos (fotos de alerta):** validar `mime ∈ {jpg,png}`, tamaño ≤ `imagen.max_mb`, renombrar con hash/uuid, almacenar fuera del webroot, nunca ejecutar.
- **Rate limiting:** `intentos_acceso` para OTP/login; considerar límite por IP en el webhook de "solicitar OTP" para mitigar enumeración de cédulas y bombardeo de correo.
- **Secretos:** JWT secret, credenciales SMTP y DB en variables de entorno/credenciales de n8n; nunca en el repositorio ni en el frontend.
- **Almacenamiento de token en el cliente:** en `sessionStorage`/memoria (no `localStorage`) para reducir persistencia ante XSS; el token del panel es de vida corta.

## 5.4 Auditoría

Se registran en `auditoria` (usuario, acción, entidad, resultado, IP si disponible, fecha/hora, detalle):
inicio/cierre de sesión, generación de certificados, creación/cambio/respuesta de tickets, creación de alertas, cambio de responsables, importación de Excel, actualización de matrícula, recuperación de contraseña.

## 5.5 Amenazas y mitigaciones (resumen)

| Amenaza | Mitigación |
|---------|-----------|
| Enumeración de cédulas vía OTP | Rate-limit por IP + respuesta genérica + bloqueo |
| Reutilización de OTP | `usado=true` + expiración + hash |
| Fuerza bruta de login | bcrypt + `intentos_acceso` + bloqueo |
| Webhook público sin auth | `guard-jwt`/`guard-chat-session` obligatorio salvo `/verificar` |
| Falsificación de certificado | QR único verificable contra BD (WF-16) |
| Escalada de privilegios | RBAC + validación de alcance por carrera/tipo |
| Inyección SQL | Consultas parametrizadas |
