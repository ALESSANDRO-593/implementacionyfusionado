-- =====================================================================
-- YaviBot — Estudiantes adicionales (idempotente)
-- =====================================================================

INSERT INTO estudiantes (cedula, nombres, carrera_id, nivel, paralelo, estado_matricula, correo)
SELECT '1750374371', 'Anderson Narváez', id, 'Quinto', 'A', 'ACTIVA', 'asl.narvaez@yavirac.edu.ec'
FROM carreras WHERE codigo = 'DSW'
ON CONFLICT (cedula) DO UPDATE
  SET nombres = EXCLUDED.nombres, nivel = EXCLUDED.nivel, paralelo = EXCLUDED.paralelo,
      estado_matricula = EXCLUDED.estado_matricula, correo = EXCLUDED.correo;
