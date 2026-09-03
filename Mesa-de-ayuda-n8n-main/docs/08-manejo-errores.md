# 08 — Manejo de Errores y Excepciones

## 8.1 Catálogo de códigos de error

| code | HTTP | Significado |
|------|------|-------------|
| `VALIDACION` | 400 | Payload inválido (cédula, correo, longitudes) |
| `NO_AUTENTICADO` | 401 | JWT/sesión ausente o inválido |
| `SIN_PERMISO` | 403 | RBAC/alcance denegado |
| `NO_ENCONTRADO` | 404 | Recurso inexistente |
| `NO_MATRICULADO` | 200* | Estudiante no ACTIVA (respuesta de negocio, no error HTTP) |
| `OTP_INVALIDO` | 400 | OTP incorrecto o expirado |
| `BLOQUEADO` | 429 | Demasiados intentos, bloqueo temporal |
| `CONFLICTO` | 409 | Duplicado / estado inconsistente |
| `ARCHIVO_INVALIDO` | 400 | Imagen de tipo/tamaño no permitido |
| `ERROR_INTERNO` | 500 | Fallo no controlado |

## 8.2 Estrategia por capa

**n8n (workflows)**
- Cada webhook envuelve la lógica; ante fallo devuelve el sobre `{ ok:false, error:{...} }` con el `code` adecuado, nunca stack traces al cliente.
- Nodo **Error Trigger** por workflow para capturar excepciones no controladas → registrar en `auditoria` (resultado=error) → responder `ERROR_INTERNO`.
- Consistencia: operaciones multi-paso (crear ticket + historial + asignación) se agrupan en una transacción (`BEGIN/COMMIT/ROLLBACK`) dentro de un Postgres node o Code node con cliente `pg`. Si falla un paso → `ROLLBACK` y error controlado. *(Nota: es una de las debilidades de n8n puro; se documenta y se maneja explícitamente.)*
- Idempotencia: reintentos de webhook no deben duplicar; usar claves naturales/`ON CONFLICT`.

**Angular (frontend)**
- `errorInterceptor` centraliza: mapea `code`→mensaje amigable, 401→redirige a login/expira sesión, 429→muestra tiempo de bloqueo, 500→mensaje genérico + opción de reintento.
- Validación reactiva de formularios (Angular Reactive Forms) antes de enviar.
- Estados de UI: loading / vacío / error por cada vista (evita pantallas en blanco).
- Los errores de negocio (p.ej. `NO_MATRICULADO`) se muestran como mensaje del chatbot, no como error técnico.

## 8.3 Registro y observabilidad
- Todo error de servidor se audita con contexto (workflow, entidad, payload sin datos sensibles).
- Correos fallidos (SMTP) se reintentan (política de reintento del nodo) y, si persiste, se marca el evento como no procesado para reproceso.
- El outbox `eventos` permite reprocesar side-effects fallidos sin perder trazabilidad.
