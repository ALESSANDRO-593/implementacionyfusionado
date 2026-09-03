# 09 — Plan de Pruebas

## 9.1 Niveles

| Nivel | Alcance | Herramientas |
|-------|---------|--------------|
| Unitarias | Servicios/piezas de lógica Angular; funciones Code de n8n | Jasmine/Karma o Jest (Angular); Jest para funciones JS de n8n |
| Integración | Angular ↔ webhook n8n ↔ PostgreSQL (entorno de prueba) | n8n en test + Postgres de prueba + Postman/newman |
| Aceptación (E2E) | Flujos completos de usuario | Cypress/Playwright |

## 9.2 Casos de prueba clave

### Autenticación chatbot
- CP-01 Cédula ACTIVA → recibe OTP.
- CP-02 Cédula INACTIVA/RETIRADA/SUSPENDIDA → mensaje "Estudiante no matriculado…", sin OTP.
- CP-03 Cédula inexistente → NO_ENCONTRADO.
- CP-04 OTP correcto dentro de tiempo → sesión emitida.
- CP-05 OTP incorrecto → error y permite reintento.
- CP-06 OTP expirado → inválido; permite reenvío.
- CP-07 OTP ya usado → inválido.
- CP-08 5 intentos fallidos → bloqueo temporal (429).

### Certificado
- CP-10 Solicitud genera QR **nuevo** cada vez (dos solicitudes → dos identificadores distintos).
- CP-11 PDF contiene QR y se envía al correo.
- CP-12 Verificación pública de QR válido → `valido:true`; QR inexistente → `valido:false`.

### Tickets
- CP-20 Récord Académico → ticket asignado al Coordinador de la carrera correcta.
- CP-21 Anulación → mismo flujo, tipo distinto.
- CP-22 Vinculación → asignado al Responsable de Vinculación, **no** al Coordinador.
- CP-23 Cambio de estado registra historial (usuario, fecha, estados).
- CP-24 Responder ticket → correo al estudiante + estado actualizado.
- CP-25 Estudiante consulta y ve respuesta; no puede modificar.

### RBAC
- CP-30 Coordinador no ve tickets de otra carrera (403/filtrado).
- CP-31 Resp. Vinculación no ve tickets académicos.
- CP-32 Profesor no accede al panel de seguimiento.
- CP-33 Profesor solo ve sus alertas.

### Alertas
- CP-40 Crear alerta con foto válida → ticket para Resp. Laboratorios.
- CP-41 Foto con mime/tamaño inválido → ARCHIVO_INVALIDO.
- CP-42 Cambios de estado de alerta registran historial.

### Configuración / Importación
- CP-50 Cambiar responsable → nuevos tickets van al nuevo; tickets previos no se reasignan.
- CP-51 Importar Excel: inserta nuevos, actualiza por cédula, no duplica; resumen correcto.
- CP-52 Actualización mensual cambia solo estado/nivel/paralelo manteniendo el estudiante.

### Seguridad
- CP-60 Webhook protegido sin token → 401.
- CP-61 Inyección SQL en parámetros → neutralizada (parametrizado).
- CP-62 XSS en descripción → escapado al renderizar.

## 9.3 Criterios de aceptación
- 100% de RF con al menos un caso de prueba asociado.
- Flujos críticos (auth chatbot, certificado, ticket, alerta) con E2E verde.
- Cobertura unitaria objetivo ≥ 70% en servicios de `core` y casos de uso.
- Auditoría verificada para todas las acciones del RF-41.

## 9.4 Datos de prueba
- Estudiantes semilla con cada estado de matrícula.
- Usuarios panel: uno por rol; coordinador con 2 carreras.
- Asignaciones vigentes para cada tipo de solicitud.
- Cédula de ejemplo del Figma: `1756234890`.
