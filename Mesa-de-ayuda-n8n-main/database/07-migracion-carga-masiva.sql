-- =====================================================================
-- YaviBot — Migración: carga masiva, docentes, laboratorios reales,
--   rol superadmin y adaptación a los valores reales de matrícula.
-- Segura de re-ejecutar (idempotente donde es posible).
-- =====================================================================

-- ------------------------------------------------------------------ --
--  1) Rol SUPERADMIN con id = -1 (único que carga datos masivos)
-- ------------------------------------------------------------------ --
INSERT INTO roles (id, codigo, nombre, descripcion)
OVERRIDING SYSTEM VALUE
VALUES (-1, 'SUPERADMIN', 'Super Administrador', 'Acceso total; único que realiza la carga masiva de estudiantes y docentes')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------ --
--  2) estudiantes: valores reales de matrícula, modalidad y paralelo largo
-- ------------------------------------------------------------------ --
-- Ampliar paralelo (A_INTENSIVA, B_MATUTINA, ...) en estudiantes y en su copia en tickets
ALTER TABLE estudiantes ALTER COLUMN paralelo TYPE VARCHAR(20);
ALTER TABLE tickets      ALTER COLUMN paralelo TYPE VARCHAR(20);

-- Migrar los estados existentes a los valores reales del instituto
ALTER TABLE estudiantes DROP CONSTRAINT IF EXISTS estudiantes_estado_matricula_check;
UPDATE estudiantes SET estado_matricula = CASE upper(estado_matricula)
    WHEN 'ACTIVA'     THEN 'MATRICULADO'
    WHEN 'RETIRADA'   THEN 'RETIRADO'
    WHEN 'SUSPENDIDA' THEN 'RETIRADO'
    WHEN 'INACTIVA'   THEN 'RETIRADO'
    ELSE upper(estado_matricula) END;
ALTER TABLE estudiantes ADD CONSTRAINT estudiantes_estado_matricula_check
    CHECK (estado_matricula IN ('MATRICULADO','RETIRADO','REPROBADO','APROBADO'));

-- Modalidad: valores reales en mayúsculas (DUAL, PRESENCIAL, ...)
ALTER TABLE estudiantes DROP CONSTRAINT IF EXISTS estudiantes_modalidad_check;
UPDATE estudiantes SET modalidad = upper(modalidad);
ALTER TABLE estudiantes ALTER COLUMN modalidad SET DEFAULT 'PRESENCIAL';
ALTER TABLE estudiantes ADD CONSTRAINT estudiantes_modalidad_check
    CHECK (modalidad IN ('PRESENCIAL','DUAL','EN LINEA','SEMIPRESENCIAL'));

-- ------------------------------------------------------------------ --
--  3) Carreras reales (id 1..5). En instalaciones ya existentes con los
--     nombres provisionales, esto los corrige por código.
-- ------------------------------------------------------------------ --
-- (En instalaciones nuevas las 5 carreras reales ya vienen de 02-seed.sql.)
INSERT INTO carreras (codigo, nombre) VALUES ('MKD', 'Marketing Digital')
ON CONFLICT (codigo) DO NOTHING;

-- ------------------------------------------------------------------ --
--  4) Tabla docentes (fuente oficial para el panel)
-- ------------------------------------------------------------------ --
CREATE TABLE IF NOT EXISTS docentes (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cedula         VARCHAR(10)  NOT NULL UNIQUE CHECK (cedula ~ '^[0-9]{10}$'),
  nombre_docente VARCHAR(150) NOT NULL,
  correo         VARCHAR(150) NOT NULL UNIQUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ --
--  5) laboratorios: reemplazar 'ubicacion' por 'cantidad_equipos'
-- ------------------------------------------------------------------ --
ALTER TABLE laboratorios ADD COLUMN IF NOT EXISTS cantidad_equipos INT NOT NULL DEFAULT 0;
ALTER TABLE laboratorios DROP COLUMN IF EXISTS ubicacion;

-- Datos reales de los laboratorios (upsert por código; conserva los id)
INSERT INTO laboratorios (codigo, nombre, cantidad_equipos) VALUES
  ('LAB-01','Laboratorio de Tolouse',20),
  ('LAB-02','Laboratorio de Xian',25),
  ('LAB-03','Laboratorio de Yasuni',15),
  ('LAB-04','Laboratorio de Ninive',18),
  ('LAB-05','Laboratorio de Sarasota',20)
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre, cantidad_equipos = EXCLUDED.cantidad_equipos;

-- ------------------------------------------------------------------ --
--  6) Eliminar categorias_alerta (la incidencia va en alertas.descripcion)
-- ------------------------------------------------------------------ --
ALTER TABLE alertas DROP COLUMN IF EXISTS categoria_id;
DROP TABLE IF EXISTS categorias_alerta;

-- ------------------------------------------------------------------ --
--  7) Historial de importaciones: admitir tipo 'docentes'
-- ------------------------------------------------------------------ --
ALTER TABLE importaciones DROP CONSTRAINT IF EXISTS importaciones_tipo_check;
ALTER TABLE importaciones ADD CONSTRAINT importaciones_tipo_check
    CHECK (tipo IN ('estudiantes','profesores','docentes'));
