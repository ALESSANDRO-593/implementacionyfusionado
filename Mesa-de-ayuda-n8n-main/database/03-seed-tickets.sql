-- =====================================================================
-- YaviBot — Tickets de demostración (para el Panel Web)
-- =====================================================================

INSERT INTO tickets (codigo, tipo_solicitud_id, estudiante_id, carrera_id, nivel, paralelo, estado, responsable_id, descripcion, creado_en)
SELECT 'TK-000001', ts.id, e.id, e.carrera_id, e.nivel, e.paralelo, 'Pendiente', u.id, 'Solicito mi récord académico completo.', now() - interval '4 days'
FROM tipos_solicitud ts, estudiantes e, usuarios_panel u
WHERE ts.codigo='RECORD_ACADEMICO' AND e.cedula='1756234890' AND u.cedula='1710000001';

INSERT INTO tickets (codigo, tipo_solicitud_id, estudiante_id, carrera_id, nivel, paralelo, estado, responsable_id, descripcion, creado_en)
SELECT 'TK-000002', ts.id, e.id, e.carrera_id, e.nivel, e.paralelo, 'En Proceso', u.id, 'Requiero certificado de vinculación.', now() - interval '3 days'
FROM tipos_solicitud ts, estudiantes e, usuarios_panel u
WHERE ts.codigo='CERT_VINCULACION' AND e.cedula='1712345678' AND u.cedula='1710000002';

INSERT INTO tickets (codigo, tipo_solicitud_id, estudiante_id, carrera_id, nivel, paralelo, estado, responsable_id, descripcion, creado_en)
SELECT 'TK-000003', ts.id, e.id, e.carrera_id, e.nivel, e.paralelo, 'Resuelto', u.id, 'Solicito anulación de matrícula.', now() - interval '6 days'
FROM tipos_solicitud ts, estudiantes e, usuarios_panel u
WHERE ts.codigo='ANULACION_MATRICULA' AND e.cedula='1756234890' AND u.cedula='1710000001';

-- Historial del ticket resuelto
INSERT INTO ticket_historial (ticket_id, estado_anterior, estado_nuevo, respuesta, usuario_id, creado_en)
SELECT t.id, 'En Proceso', 'Resuelto', 'Su anulación fue procesada correctamente. Puede acercarse a secretaría.', u.id, now() - interval '1 day'
FROM tickets t, usuarios_panel u
WHERE t.codigo='TK-000003' AND u.cedula='1710000001';
