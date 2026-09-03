# 07 — Contratos de API (Webhooks de n8n)

## 7.1 Convenciones
- Base: `https://<n8n-host>/webhook`
- Sobre de respuesta: `{ "ok": boolean, "data"?: any, "error"?: { "code": string, "message": string } }`
- Auth: `Authorization: Bearer <JWT>` (panel) | `X-Chat-Session: <token>` (chatbot).
- Códigos HTTP: 200 ok, 400 validación, 401 no autenticado, 403 sin permiso, 404 no encontrado, 409 conflicto, 429 rate-limit, 500 error interno.

## 7.2 Chatbot

### POST `/chatbot/iniciar`
Req: `{ "cedula": "1756234890" }`
Res acceso permitido: `{ ok:true, data:{ acceso:true, requiere_otp:true } }`
Res no matriculado: `{ ok:true, data:{ acceso:false, mensaje:"Estudiante no matriculado. No es posible acceder al sistema." } }`

### POST `/chatbot/otp/validar`
Req: `{ "cedula":"...", "codigo":"12345" }`
Res: `{ ok:true, data:{ sesion:"<jwt-chat>", estudiante:{ nombres, carrera, nivel, paralelo } } }`
Error: `{ ok:false, error:{ code:"OTP_INVALIDO", message:"Código incorrecto o expirado" } }`

### POST `/chatbot/otp/reenviar`
Req: `{ "cedula":"..." }` → Res: `{ ok:true, data:{ reenviado:true } }`

### POST `/chatbot/certificado`  *(X-Chat-Session)*
Req: `{}` → Res: `{ ok:true, data:{ mensaje:"Su certificado de matrícula ha sido generado correctamente y enviado a su correo institucional." } }`

### POST `/chatbot/ticket`  *(X-Chat-Session)*
Req: `{ "tipo":"RECORD_ACADEMICO" | "CERT_VINCULACION" | "ANULACION_MATRICULA", "descripcion"?:"..." }`
Res: `{ ok:true, data:{ codigo:"TK-000123", estado:"Pendiente" } }`

### GET `/chatbot/tickets`  *(X-Chat-Session)*
Res: `{ ok:true, data:[ { codigo, tipo, fecha_creacion, estado, ultima_actualizacion, respuesta } ] }`

## 7.3 Panel — Auth

### POST `/panel/login`
Req: `{ "cedula":"...", "password":"..." }`
Res: `{ ok:true, data:{ token:"<jwt>", rol:"COORDINADOR", nombres:"..." } }`

### POST `/panel/recuperar/solicitar` → `{ cedula }` → `{ ok:true }`
### POST `/panel/recuperar/confirmar` → `{ cedula, codigo, nueva }` → `{ ok:true }`

## 7.4 Panel — Tickets  *(Bearer)*

### GET `/panel/tickets?estado=&q=&page=`
Res (filtrado por RBAC): `{ ok:true, data:{ items:[ {codigo, solicitante, tipo, fecha, estado, responsable} ], total } }`

### GET `/panel/tickets/:id`
Res: `{ ok:true, data:{ ticket:{...}, estudiante:{...}, historial:[...] } }`

### PATCH `/panel/tickets/:id`
Req: `{ "estado":"En Proceso" | "Resuelto", "respuesta"?:"texto" }`
Res: `{ ok:true, data:{ codigo, estado } }`

### GET `/panel/estadisticas`
Res: `{ ok:true, data:{ pendientes, en_proceso, resueltos, por_carrera:[...], por_tipo:[...], tiempo_promedio_horas, creados_por_mes:[...], resueltos_por_mes:[...] } }`

## 7.5 Panel — Alertas  *(Bearer)*

### POST `/panel/alertas`  *(rol PROFESOR, multipart/form-data)*
Campos: `laboratorio_id, categoria_id, descripcion, foto(file)`
Res: `{ ok:true, data:{ codigo:"AL-000045", estado:"Pendiente" } }`

### GET `/panel/alertas` → lista (PROFESOR: propias; RESP_LABORATORIOS: todas)
### PATCH `/panel/alertas/:id` → `{ estado:"En revisión"|"Resuelta", observacion? }`

## 7.6 Panel — Configuración  *(permiso config.responsables)*

### GET `/panel/config/responsables` → lista de asignaciones vigentes
### PUT `/panel/config/responsables`
Req: `{ tipo:"RECORD_ACADEMICO", carrera_id?:3, nuevo_usuario_id:12, motivo?:"cambio semestral" }`
Res: `{ ok:true }`

## 7.7 Administración / Importación

### POST `/admin/import/estudiantes`  *(multipart .xlsx)*
Res: `{ ok:true, data:{ insertados, actualizados, omitidos } }`
### POST `/admin/import/profesores`  → igual estructura

## 7.8 Público

### GET `/verificar/:identificador`
Res válido: `{ ok:true, data:{ valido:true, estudiante:"A. G.", tipo:"Certificado de Matrícula", fecha:"2026-07-10" } }`
Res inválido: `{ ok:true, data:{ valido:false } }`
> No expone cédula ni correo completos (privacidad).
