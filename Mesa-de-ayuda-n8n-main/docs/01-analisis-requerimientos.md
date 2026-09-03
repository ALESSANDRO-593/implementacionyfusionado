# 01 — Análisis de Requerimientos

## 1.1 Actores del sistema

| Actor | Tipo | Descripción | Acceso |
|-------|------|-------------|--------|
| **Estudiante** | Humano | Usuario del Chatbot. Se autentica con cédula + OTP. Solicita certificados y tickets. | Chatbot |
| **Coordinador de Carrera** | Humano | Atiende tickets de Récord Académico y Anulación de Matrícula de sus carreras. | Panel Web |
| **Responsable de Vinculación** | Humano | Atiende tickets de Certificado de Vinculación. | Panel Web |
| **Responsable de Laboratorios** | Humano | Gestiona alertas/incidencias de laboratorio. | Panel Web |
| **Profesor** | Humano | Reporta incidencias de laboratorio (alertas). | Panel Web (módulo Alertas) |
| **n8n (Orquestador)** | Sistema | Motor de automatización que reacciona a eventos y ejecuta workflows. | Interno |
| **PostgreSQL** | Sistema | Persistencia. | Interno |
| **Servicio SMTP** | Sistema externo | Envío de correos (OTP, certificados, notificaciones). | Externo |

> Nota (PA-1): las funciones "importar Excel" y "configurar responsables" no tienen un rol dedicado en el prompt. Se tratan como workflow manual + pantalla de configuración de la autoridad designada.

## 1.2 Casos de uso

### Módulo 1 — Chatbot (Estudiante)
- **CU-01** Iniciar conversación e identificarse con cédula.
- **CU-02** Validar estado de matrícula (bloquear si ≠ ACTIVA).
- **CU-03** Autenticarse con OTP (segundo factor).
- **CU-04** Reenviar OTP / manejar intentos fallidos y bloqueo temporal.
- **CU-05** Solicitar Certificado de Matrícula (genera PDF+QR, NO genera ticket).
- **CU-06** Solicitar Récord Académico (genera ticket → Coordinador).
- **CU-07** Solicitar Certificado de Vinculación (genera ticket → Resp. Vinculación).
- **CU-08** Solicitar Anulación de Matrícula (genera ticket → Coordinador).
- **CU-09** Consultar estado de mis tickets.
- **CU-10** Finalizar conversación.
- **CU-11** Verificar autenticidad de un certificado vía QR (público, sin login).

### Módulo 2 — Panel Web
- **CU-20** Iniciar sesión (cédula + contraseña → JWT).
- **CU-21** Recuperar contraseña vía OTP al correo institucional.
- **CU-22** (Coordinador/Vinculación) Ver bandeja de tickets asignados (filtrada por RBAC).
- **CU-23** Buscar y filtrar tickets.
- **CU-24** Ver detalle de ticket.
- **CU-25** Responder ticket (texto) y cambiar estado.
- **CU-26** Consultar historial de un ticket.
- **CU-27** Ver dashboard de estadísticas.
- **CU-28** (Profesor) Crear alerta de laboratorio con foto.
- **CU-29** (Profesor) Consultar solo sus alertas.
- **CU-30** (Resp. Laboratorios) Ver todas las alertas, cambiar estado, agregar observaciones, resolver.
- **CU-31** Configurar responsables (Coordinador de carrera, Resp. Vinculación, Resp. Laboratorios).
- **CU-32** Importar Excel de estudiantes/profesores.
- **CU-33** Actualización mensual de matrículas.

## 1.3 Requisitos funcionales (RF)

**Autenticación y acceso**
- **RF-01** El chatbot identifica al estudiante por cédula consultando PostgreSQL (nombres, cédula, carrera, nivel, paralelo, estado de matrícula, correo institucional).
- **RF-02** Solo estudiantes con `estado_matricula = ACTIVA` continúan; otros reciben *"Estudiante no matriculado. No es posible acceder al sistema."* y la conversación finaliza sin enviar OTP.
- **RF-03** El sistema genera OTP de 5 dígitos numéricos, aleatorio, de un solo uso, con expiración configurable, y lo envía al correo institucional.
- **RF-04** El OTP se invalida tras su uso; su historial se almacena en BD.
- **RF-05** Tras N intentos fallidos (configurable, def. 5) se bloquea el acceso temporalmente (tiempo configurable).
- **RF-06** El estudiante puede solicitar un nuevo OTP cuando el anterior expira.
- **RF-07** El Panel autentica por cédula + contraseña (bcrypt) y emite JWT con rol; duración configurable.
- **RF-08** Recuperación de contraseña por OTP al correo institucional.

**Certificados y tickets**
- **RF-10** Certificado de Matrícula: genera QR único nuevo por solicitud, PDF con plantilla institucional + QR embebido, registra (fecha, hora, estudiante, id QR), envía por correo. No crea ticket.
- **RF-11** Nunca se reutiliza un QR; cada generación queda en historial; el estudiante puede generarlo N veces.
- **RF-12** Récord Académico, Cert. Vinculación y Anulación de Matrícula generan ticket con: número, código único, fecha, hora, tipo, estado, estudiante, carrera, nivel, paralelo, descripción.
- **RF-13** Estados de ticket: `Pendiente`, `En Proceso`, `Resuelto`. Todo cambio de estado se registra en historial (usuario, fecha, hora, estado anterior, estado nuevo).
- **RF-14** Asignación automática por configuración (entidad `asignaciones_responsables`): Récord/Anulación → Coordinador de la carrera; Vinculación → Responsable de Vinculación vigente.
- **RF-15** El estudiante consulta sus tickets (número, tipo, fecha creación, estado actual, última actualización, respuesta si existe). Solo lectura.
- **RF-16** Responder ticket = solo texto (sin adjuntos); actualiza estado, registra historial, dispara `TicketRespondido` y correo al estudiante.

**Alertas de laboratorio**
- **RF-20** Profesor crea alerta con laboratorio, categoría, descripción y una (1) foto.
- **RF-21** La alerta crea automáticamente un ticket asignado al Responsable de Laboratorios.
- **RF-22** Estados de alerta: `Pendiente`, `En revisión`, `Resuelta`; cada cambio se registra.
- **RF-23** El profesor solo ve sus propias alertas; el Responsable de Laboratorios ve todas.

**Configuración e importación**
- **RF-30** Configuración de responsables editable sin tocar código; los cambios aplican a nuevos tickets. Cada cambio se audita (usuario, responsable anterior, nuevo, fecha, hora, motivo opcional).
- **RF-31** Importación de Excel (estudiantes y profesores): inserta nuevos, actualiza existentes (clave = cédula), evita duplicados, registra historial de importación (insertados/actualizados/omitidos).
- **RF-32** Actualización mensual: actualiza solo `estado_matricula` y datos cambiados (nivel, paralelo) manteniendo el estudiante por cédula.

**Estadísticas y auditoría**
- **RF-40** Dashboard con: tickets pendientes/en proceso/resueltos, por carrera, por tipo, tiempo promedio de resolución, creados por mes, resueltos por mes. Actualización automática.
- **RF-41** Auditoría de acciones importantes (login, logout, generación de certificados, creación/cambio/respuesta de tickets, creación de alertas, cambio de responsables, importación, actualización de matrícula, recuperación de contraseña) con usuario, acción, fecha, hora, IP (si es posible), resultado.

## 1.4 Requisitos no funcionales (RNF)

- **RNF-01 Seguridad:** contraseñas con bcrypt; OTP de un solo uso; JWT firmado; validación de entradas; protección SQLi (consultas parametrizadas), XSS, CSRF donde aplique; manejo seguro de archivos (tipo/tamaño de imagen).
- **RNF-02 RBAC:** permisos asociados a roles, no a usuarios; agregar usuarios no requiere cambiar lógica.
- **RNF-03 Desacoplamiento:** comunicación por eventos vía n8n; Angular no accede a PostgreSQL directamente; nada de lógica de negocio acoplada en el frontend.
- **RNF-04 Escalabilidad y mantenibilidad:** diseño modular; configuración de responsables por datos, no hardcodeada.
- **RNF-05 Usabilidad:** el chatbot mantiene flujo claro, sencillo y amigable; no pide datos innecesarios.
- **RNF-06 Fidelidad de diseño:** el frontend respeta el Figma (colores, distribución, tipografía, componentes, espaciados) — ver doc 06 para tokens.
- **RNF-07 Trazabilidad:** toda solicitud es rastreable de extremo a extremo (eventos + auditoría + historiales).
- **RNF-08 Disponibilidad:** el sistema es una app web independiente (no embebida en el sitio institucional), enlazable posteriormente.
- **RNF-09 Rendimiento:** consultas frecuentes indexadas; normalización hasta 3FN.
- **RNF-10 Calidad de código (frontend):** Clean Architecture, SOLID, DRY, KISS, componentes reutilizables, documentado, buenas prácticas Angular.

## 1.5 Reglas de negocio (RN)

- **RN-01** Acceso al chatbot **solo** si `estado_matricula = ACTIVA` (case-insensitive, valor canónico `ACTIVA`).
- **RN-02** El OTP expira (def. 5 min), es de un solo uso y numérico de 5 dígitos.
- **RN-03** Máx. N intentos de OTP (def. 5) → bloqueo temporal (def. 15 min) por cédula.
- **RN-04** Cada Certificado de Matrícula genera un QR nuevo e irrepetible; el anterior nunca se reutiliza.
- **RN-05** Récord Académico y Anulación de Matrícula → Coordinador de la carrera del estudiante.
- **RN-06** Certificado de Vinculación → Responsable de Vinculación vigente (no al Coordinador).
- **RN-07** Alerta de laboratorio → Responsable de Laboratorios vigente.
- **RN-08** La asignación de responsables se resuelve **en tiempo de creación del ticket** consultando `asignaciones_responsables` vigente; cambios posteriores no reasignan tickets existentes.
- **RN-09** El estudiante nunca modifica ni responde tickets; solo consulta.
- **RN-10** La respuesta de un ticket es solo texto; no se permiten adjuntos.
- **RN-11** Una alerta permite exactamente una foto; validar tipo (jpg/png) y tamaño máximo.
- **RN-12** La importación usa la cédula como clave natural para evitar duplicados.
- **RN-13** Todo cambio de estado (ticket o alerta) y de responsable se registra con usuario, fecha y hora.
- **RN-14** Si un estudiante deja de estar ACTIVA, pierde acceso al chatbot, certificados y creación de tickets inmediatamente.
