# 04 — Workflows de n8n

Convención de nodos: `Webhook` (entrada) → `guard-*` (sub-workflow de seguridad) → `Function/Code` (validación) → `Postgres` (parametrizado) → `Insert evento` → `Respond to Webhook`. Los side-effects (correo, PDF) se hacen en sub-workflows disparados por eventos.

## WF-00 Sub-workflows reutilizables
- **`guard-jwt`**: valida `Authorization: Bearer`. Verifica firma (Code node + `jsonwebtoken`), expiración, y devuelve `{usuario_id, rol, carreras[]}`. Rechaza con 401 si falla.
- **`guard-rbac`**: recibe `{rol, permiso_requerido}` y verifica contra `roles_permisos`. 403 si no autorizado.
- **`guard-chat-session`**: valida el token de sesión de chat emitido tras OTP.
- **`rate-limit`**: consulta/actualiza `intentos_acceso`; bloquea si `bloqueado_hasta > now()`.
- **`publicar-evento`**: inserta en `eventos` y opcionalmente `Execute Workflow` al consumidor.
- **`registrar-auditoria`**: inserta en `auditoria`.

## WF-01 Autenticación del Chatbot
```
Webhook POST /webhook/chatbot/iniciar {cedula}
 → rate-limit(cedula, 'chatbot')
 → Postgres: SELECT * FROM estudiantes WHERE cedula=$1
 → IF no existe → Respond 404 {error: NO_ENCONTRADO}
 → IF estado_matricula != 'ACTIVA'
      → publicar-evento(EstudianteNoMatriculado) → registrar-auditoria
      → Respond {ok:true, data:{acceso:false, mensaje:"Estudiante no matriculado. No es posible acceder al sistema."}}
 → publicar-evento(EstudianteValidado)
 → Code: generar OTP 5 dígitos aleatorio; hash
 → Postgres: INSERT otp_codigos (codigo_hash, expira_en=now()+config)
 → publicar-evento(OTPGenerado) → Execute Workflow WF-02 (envío)
 → Respond {ok:true, data:{acceso:true, requiere_otp:true}}
```

## WF-02 Envío de OTP (side-effect)
```
Trigger: evento OTPGenerado
 → Postgres: obtener correo del estudiante
 → SMTP node: enviar correo con el OTP (plantilla)
 → publicar-evento(OTPEnviado) → registrar-auditoria
 → marcar evento procesado
```

## WF-03 Validación de OTP
```
Webhook POST /webhook/chatbot/otp/validar {cedula, codigo}
 → rate-limit(cedula,'chatbot')
 → Postgres: SELECT último OTP no usado y no expirado WHERE cedula=$1 AND canal='chatbot'
 → IF no hay / expirado → incrementar intentos → Respond 400 {OTP_INVALIDO}
 → Code: comparar hash(codigo) con codigo_hash
 → IF no coincide → intentos++ → (si >= max) setear bloqueado_hasta → Respond 400
 → Postgres: UPDATE otp_codigos SET usado=true
 → reset intentos_acceso
 → publicar-evento(OTPValidado)
 → Code: emitir token de sesión de chat (JWT corto)
 → Respond {ok:true, data:{sesion:<token>, estudiante:{...datos mínimos}}}
```

## WF-04 Reenvío de OTP
`POST /webhook/chatbot/otp/reenviar {cedula}` → invalida OTP previo si expiró → repite WF-01 desde generación.

## WF-05 Certificado de Matrícula
```
Webhook POST /webhook/chatbot/certificado (guard-chat-session)
 → publicar-evento(CertificadoSolicitado)
 → Postgres: datos del estudiante
 → Code: crear identificador QR (uuid) → Postgres INSERT qr_codigos (payload)
 → publicar-evento(QRGenerado)
 → Generar PDF (ver nota) con plantilla + QR embebido
 → Postgres INSERT certificados (qr_id, pdf_path, fecha, hora)
 → publicar-evento(CertificadoGenerado) + (PDFGenerado)
 → SMTP: enviar PDF al correo institucional
 → publicar-evento(CorreoEnviado) → registrar-auditoria
 → Respond {ok:true, data:{mensaje:"Su certificado de matrícula ha sido generado correctamente y enviado a su correo institucional."}}
```
**Nota PA-2 (PDF/QR):** en n8n puro, generar PDF con: (a) nodo community `n8n-nodes-pdf`/`html-pdf`, o (b) Code node con `pdfkit` + `qrcode`, o (c) microservicio de render invocado por HTTP. Recomendado (b) por control total; el QR apunta a `/verificar/{identificador}`.

## WF-06 Creación de Ticket (Récord / Anulación / Vinculación)
```
Webhook POST /webhook/chatbot/ticket (guard-chat-session) {cedula, tipo}
 → Postgres: datos estudiante + tipo_solicitud
 → Code: generar codigo TK-xxxxxx
 → Postgres INSERT tickets (estado='Pendiente', snapshot carrera/nivel/paralelo)
 → publicar-evento(TicketCreado)
 → Resolver responsable:
     IF ambito='carrera' → SELECT usuario_id FROM asignaciones_responsables
         WHERE tipo_solicitud_id=$1 AND carrera_id=$2 AND vigente
     IF ambito='vinculacion' → misma consulta con carrera_id IS NULL
 → Postgres UPDATE tickets SET responsable_id
 → INSERT ticket_historial (estado_nuevo='Pendiente')
 → publicar-evento(TicketAsignado) → Execute Workflow WF-09 (notificación)
 → registrar-auditoria
 → Respond {ok:true, data:{codigo, estado:'Pendiente'}}
```

## WF-07 Consulta de Tickets del estudiante
`GET /webhook/chatbot/tickets?cedula=` (guard-chat-session) → SELECT tickets + última respuesta del historial → Respond lista. Solo lectura (RN-09).

## WF-08 Login del Panel
```
Webhook POST /webhook/panel/login {cedula, password}
 → rate-limit(cedula,'panel')
 → Postgres: SELECT usuario_panel + rol WHERE cedula=$1 AND activo
 → Code: bcrypt.compare(password, password_hash)
 → IF falla → intentos++ → Respond 401
 → Code: firmar JWT {sub, rol, carreras} exp=config
 → publicar-evento(UsuarioAutenticado) → registrar-auditoria
 → Respond {ok:true, data:{token, rol}}
```

## WF-09 Notificación (side-effect)
Trigger `TicketAsignado`/`AlertaAsignada` → SMTP al responsable → `CorreoEnviado` → auditoría.

## WF-10 Respuesta / cambio de estado de Ticket
```
Webhook PATCH /webhook/panel/tickets/:id (guard-jwt + guard-rbac:ticket.responder)
 → Verificar que el ticket pertenece al alcance del usuario (carrera/tipo)
 → Postgres UPDATE tickets SET estado, actualizado_en
 → INSERT ticket_historial (estado_anterior, estado_nuevo, respuesta, usuario_id)
 → publicar-evento(TicketActualizado)+(TicketRespondido / TicketResuelto)
 → Execute Workflow: SMTP al estudiante con la respuesta
 → registrar-auditoria
 → Respond {ok:true}
```

## WF-11 Recuperación de contraseña
```
POST /panel/recuperar/solicitar {cedula} → verifica usuario → genera OTP canal='panel_recovery' → SMTP
POST /panel/recuperar/confirmar {cedula, codigo, nueva} → valida OTP → bcrypt.hash(nueva) → UPDATE usuarios_panel
 → publicar-evento(ContraseñaRecuperada) → auditoría
```

## WF-12 Alertas de Laboratorio
```
Webhook POST /webhook/panel/alertas (guard-jwt + rol PROFESOR) multipart {laboratorio,categoria,descripcion,foto}
 → Validar imagen (mime jpg/png, tamaño <= config) → guardar archivo → INSERT adjuntos
 → INSERT alertas (profesor_id, estado='Pendiente', adjunto_id)
 → publicar-evento(AlertaCreada)
 → Crear ticket asociado + resolver Responsable de Laboratorios (asignaciones_responsables, tipo ALERTA_LAB)
 → UPDATE alertas SET responsable_id, ticket_id
 → INSERT alerta_historial
 → publicar-evento(AlertaAsignada) → notificación
 → auditoría → Respond {ok:true}
```
`GET /panel/alertas` filtra: PROFESOR → solo `profesor_id = usuario`; RESP_LABORATORIOS → todas.
`PATCH /panel/alertas/:id` → cambia estado (Pendiente/En revisión/Resuelta) + observación + historial.

## WF-13 Configuración de responsables
```
GET /panel/config/responsables (guard-jwt + permiso config.responsables) → lista vigentes
PUT /panel/config/responsables {tipo, carrera?, nuevo_usuario_id, motivo?}
 → UPDATE asignaciones vigentes SET vigente=false (la anterior)
 → INSERT nueva asignación vigente
 → publicar-evento(ResponsableActualizado) → auditoría (anterior/nuevo)
```

## WF-14 Importación de Excel
```
Webhook/Manual POST /webhook/admin/import/{estudiantes|profesores} (archivo .xlsx)
 → Spreadsheet File node: leer filas
 → Validar columnas requeridas
 → Por fila: UPSERT por cédula (INSERT ... ON CONFLICT (cedula) DO UPDATE)
 → Contabilizar insertados/actualizados/omitidos
 → INSERT importaciones (resumen) → auditoría
 → Respond {ok:true, data:{insertados, actualizados, omitidos}}
```

## WF-15 Actualización mensual de matrículas
```
Trigger: manual o Schedule
 → Leer nuevo archivo
 → Por fila (match por cédula): UPDATE estudiantes SET estado_matricula, nivel, paralelo (solo campos cambiados)
 → publicar-evento(EstadoMatriculaActualizado) por cambios
 → INSERT importaciones + auditoría
 → Notificación de finalización
```

## WF-16 Verificación pública de QR
```
Webhook GET /webhook/verificar/:identificador  (público, sin auth)
 → SELECT qr_codigos JOIN certificados JOIN estudiantes WHERE identificador=$1
 → UPDATE verificaciones = verificaciones + 1
 → Respond {ok:true, data:{valido:true, estudiante, tipo, fecha}}  // sin datos sensibles
```

## WF-17 Estadísticas del Dashboard
`GET /webhook/panel/estadisticas` (guard-jwt) → consultas agregadas (COUNT por estado/carrera/tipo, AVG tiempo resolución, series por mes) filtradas por RBAC → Respond métricas.
