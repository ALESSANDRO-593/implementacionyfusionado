-- =====================================================================
-- YaviBot — Migración: los permisos y la visibilidad pasan a depender
--   ÚNICAMENTE del rol_id del usuario, no de asignaciones nominales.
-- Segura de re-ejecutar (idempotente).
-- =====================================================================

-- ------------------------------------------------------------------ --
--  0) Rol Secretaría (atiende las anulaciones de matrícula)
-- ------------------------------------------------------------------ --
INSERT INTO roles (codigo, nombre, descripcion)
VALUES ('SECRETARIA', 'Secretaria', 'Atiende las anulaciones de matrícula')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.codigo = 'SECRETARIA'
  AND p.codigo IN ('ticket.ver','ticket.responder','ticket.cambiar_estado','estadisticas.ver')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------ --
--  1) Qué rol audita qué trámite (única fuente de verdad)
-- ------------------------------------------------------------------ --
CREATE TABLE IF NOT EXISTS rol_tipos_solicitud (
  rol_id            BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tipo_solicitud_id BIGINT NOT NULL REFERENCES tipos_solicitud(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, tipo_solicitud_id)
);

COMMENT ON TABLE rol_tipos_solicitud IS
  'Qué rol audita qué trámite. La usan el panel (qué tickets ve cada quien) y '
  'la notificación por correo (a quién se avisa). Para cambiar responsabilidades '
  'se edita esta tabla; no se toca código.';

INSERT INTO rol_tipos_solicitud (rol_id, tipo_solicitud_id)
SELECT r.id, t.id
FROM roles r, tipos_solicitud t
WHERE (r.codigo, t.codigo) IN (
    ('COORDINADOR',       'RECORD_ACADEMICO'),     -- Coordinador de Carrera (rol 2)
    ('SECRETARIA',        'ANULACION_MATRICULA'),  -- Secretaría          (rol 5)
    ('RESP_VINCULACION',  'CERT_VINCULACION'),     -- Vinculación         (rol 3)
    ('RESP_LABORATORIOS', 'ALERTA_LAB')            -- Laboratorios        (rol 4)
  )
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------ --
--  2) Las asignaciones nominales quedan sin efecto: ahora manda el rol
-- ------------------------------------------------------------------ --
DROP TABLE IF EXISTS asignaciones_responsables;

-- ------------------------------------------------------------------ --
--  3) Un solo Coordinador de Carrera (Desarrollo de Software).
--     Los usuarios de demostración del seed se desactivan para que no
--     compitan con los docentes reales que ya tienen su rol asignado.
--     Para reactivarlos: UPDATE usuarios_panel SET activo = true WHERE cedula IN (...);
-- ------------------------------------------------------------------ --
UPDATE usuarios_panel SET activo = false, actualizado_en = now()
WHERE cedula IN ('1710000001','1710000002','1710000003');

-- Los tickets que apuntaban a esos usuarios quedan sin responsable:
-- lo toma quien los atienda desde el panel.
UPDATE tickets SET responsable_id = NULL
WHERE responsable_id IN (SELECT id FROM usuarios_panel WHERE activo = false);
UPDATE alertas SET responsable_id = NULL
WHERE responsable_id IN (SELECT id FROM usuarios_panel WHERE activo = false);
