-- =====================================================================
-- YaviBot — Migración: campos reales del Certificado de Matrícula
-- Basado en el análisis del formato oficial (Certificado Tamayo Manya Genesis-DS.pdf)
-- Aditiva: no borra ni modifica datos existentes. Segura de re-ejecutar.
-- =====================================================================

-- ------------------------------------------------------------------ --
--  Periodos académicos (ciclos lectivos institucionales)
-- ------------------------------------------------------------------ --
CREATE TABLE IF NOT EXISTS periodos_academicos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo       VARCHAR(10) NOT NULL UNIQUE,   -- '2026-I', '2025-II'
  nombre       VARCHAR(60) NOT NULL,          -- 'mayo-septiembre 2026'
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  vigente      BOOLEAN NOT NULL DEFAULT FALSE
);
-- Solo un periodo vigente a la vez
CREATE UNIQUE INDEX IF NOT EXISTS ux_periodo_vigente ON periodos_academicos (vigente) WHERE vigente;

-- ------------------------------------------------------------------ --
--  Estudiantes: modalidad y datos de ingreso
-- ------------------------------------------------------------------ --
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS modalidad VARCHAR(20) NOT NULL DEFAULT 'Presencial'
  CHECK (modalidad IN ('Presencial','Dual','En línea','Semipresencial'));
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS periodo_ingreso_id BIGINT REFERENCES periodos_academicos(id);
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS nivel_ingreso VARCHAR(30) NOT NULL DEFAULT 'Primer nivel';

-- ------------------------------------------------------------------ --
--  Certificados: snapshot de los datos que aparecen impresos
--  (igual patrón que carrera/nivel/paralelo en tickets: si cambia la
--  configuración después, el certificado ya emitido no se altera)
-- ------------------------------------------------------------------ --
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS periodo_lectivo_codigo VARCHAR(10);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS periodo_lectivo_nombre VARCHAR(60);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS modalidad VARCHAR(20);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS periodo_ingreso_codigo VARCHAR(10);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS periodo_ingreso_nombre VARCHAR(60);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS nivel_ingreso VARCHAR(30);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS firmante_nombre VARCHAR(150);
ALTER TABLE certificados ADD COLUMN IF NOT EXISTS firmante_cargo VARCHAR(100);

-- ------------------------------------------------------------------ --
--  Configuración institucional (para el membrete y la firma del PDF)
-- ------------------------------------------------------------------ --
INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
  ('institucion.nombre_oficial', 'Instituto Superior Tecnológico de Turismo y Patrimonio "YAVIRAC"', 'Razón social completa para documentos oficiales'),
  ('institucion.direccion',      'García Moreno S4-35 y Ambato, Centro Histórico. Quito-Ecuador', 'Dirección física institucional'),
  ('institucion.sitio_web',      'www.yavirac.edu.ec', 'Sitio web institucional'),
  ('institucion.eslogan',        '¡Fortaleciendo Capacidades!', 'Eslogan institucional'),
  ('institucion.ciudad_emision', 'Quito', 'Ciudad que aparece en la frase de emisión del certificado'),
  ('firma.nombre', 'Mtr. Alexandra Gordon M.', 'Nombre de quien firma los certificados generados'),
  ('firma.cargo',  'Secretaria General (s)', 'Cargo de quien firma los certificados generados')
ON CONFLICT (clave) DO NOTHING;
