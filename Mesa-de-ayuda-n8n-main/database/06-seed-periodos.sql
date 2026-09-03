-- =====================================================================
-- YaviBot — Periodos académicos de prueba y actualización de estudiantes
-- =====================================================================

INSERT INTO periodos_academicos (codigo, nombre, fecha_inicio, fecha_fin, vigente) VALUES
  ('2025-II', 'agosto 2025-febrero 2026', '2025-08-01', '2026-02-28', FALSE),
  ('2026-I',  'mayo-septiembre 2026',     '2026-05-01', '2026-09-30', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- Estudiantes de prueba: ingresaron en 2025-II (Primer nivel), modalidad Dual
-- (replica el caso real del certificado analizado)
UPDATE estudiantes e
SET modalidad = 'Dual',
    periodo_ingreso_id = (SELECT id FROM periodos_academicos WHERE codigo = '2025-II'),
    nivel_ingreso = 'Primer nivel'
WHERE e.cedula IN ('1756234890', '1726618539', '1750374371');

-- Los demás estudiantes de prueba quedan en modalidad Presencial (valor por defecto)
