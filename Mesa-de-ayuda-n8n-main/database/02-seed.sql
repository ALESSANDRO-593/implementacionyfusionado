-- =====================================================================
-- YaviBot — Datos semilla (demo). Password de todos los usuarios: Yavirac2026*
-- =====================================================================

-- Roles -----------------------------------------------------------------
INSERT INTO roles (codigo, nombre, descripcion) VALUES
  ('PROFESOR',          'Profesor',                 'Reporta incidencias de laboratorio'),
  ('COORDINADOR',       'Coordinador de Carrera',   'Atiende tickets académicos de sus carreras'),
  ('RESP_VINCULACION',  'Responsable de Vinculación','Atiende certificados de vinculación'),
  ('RESP_LABORATORIOS', 'Responsable de Laboratorios','Gestiona alertas de laboratorio'),
  ('SECRETARIA',        'Secretaria',               'Atiende las anulaciones de matrícula');

-- Permisos --------------------------------------------------------------
INSERT INTO permisos (codigo, descripcion) VALUES
  ('alerta.crear',        'Crear alertas de laboratorio'),
  ('alerta.ver_propias',  'Ver sus propias alertas'),
  ('alerta.ver_todas',    'Ver todas las alertas'),
  ('alerta.gestionar',    'Cambiar estado / resolver alertas'),
  ('ticket.ver',          'Ver tickets asignados'),
  ('ticket.responder',    'Responder tickets'),
  ('ticket.cambiar_estado','Cambiar estado de tickets'),
  ('estadisticas.ver',    'Ver dashboard de estadísticas'),
  ('config.responsables', 'Configurar responsables');

-- Roles ↔ Permisos ------------------------------------------------------
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p WHERE r.codigo='PROFESOR'
  AND p.codigo IN ('alerta.crear','alerta.ver_propias');
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p WHERE r.codigo='COORDINADOR'
  AND p.codigo IN ('ticket.ver','ticket.responder','ticket.cambiar_estado','estadisticas.ver');
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p WHERE r.codigo='RESP_VINCULACION'
  AND p.codigo IN ('ticket.ver','ticket.responder','ticket.cambiar_estado','estadisticas.ver');
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p WHERE r.codigo='RESP_LABORATORIOS'
  AND p.codigo IN ('alerta.ver_todas','alerta.gestionar','estadisticas.ver');
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p WHERE r.codigo='SECRETARIA'
  AND p.codigo IN ('ticket.ver','ticket.responder','ticket.cambiar_estado','estadisticas.ver');

-- Carreras (oferta académica real del instituto; el orden fija los carrera_id 1..5)
INSERT INTO carreras (codigo, nombre) VALUES
  ('ACE', 'Arte Culinario Ecuatoriano'),
  ('DSW', 'Desarrollo de Software'),
  ('DMO', 'Diseño de Modas'),
  ('GNT', 'Guía Nacional de Turismo'),
  ('MKD', 'Marketing Digital');

-- Periodos académicos -----------------------------------------------------
INSERT INTO periodos_academicos (codigo, nombre, fecha_inicio, fecha_fin, vigente) VALUES
  ('2025-II', 'agosto 2025-febrero 2026', '2025-08-01', '2026-02-28', FALSE),
  ('2026-I',  'mayo-septiembre 2026',     '2026-05-01', '2026-09-30', TRUE);

-- Tipos de solicitud ----------------------------------------------------
INSERT INTO tipos_solicitud (codigo, nombre, genera_ticket, ambito) VALUES
  ('CERT_MATRICULA',     'Certificado de Matrícula',   FALSE, 'ninguno'),
  ('RECORD_ACADEMICO',   'Récord Académico',           TRUE,  'carrera'),
  ('CERT_VINCULACION',   'Certificado de Vinculación',  TRUE,  'vinculacion'),
  ('ANULACION_MATRICULA','Anulación de Matrícula',      TRUE,  'carrera'),
  ('ALERTA_LAB',         'Alerta de Laboratorio',       TRUE,  'laboratorio');

-- Usuarios del panel (password: Yavirac2026*) ---------------------------
INSERT INTO usuarios_panel (cedula, nombres, correo, password_hash, rol_id)
SELECT '1710000001','Juan Pérez',   'juan.perez@yavirac.edu.ec',   '$2b$10$0QtCdZxm3aIiCJaDJjQmbeF1PofnoarFzwmhE8JMR4gBEiCvEwvW.', id FROM roles WHERE codigo='COORDINADOR';
INSERT INTO usuarios_panel (cedula, nombres, correo, password_hash, rol_id)
SELECT '1710000002','María López',  'maria.lopez@yavirac.edu.ec',  '$2b$10$0QtCdZxm3aIiCJaDJjQmbeF1PofnoarFzwmhE8JMR4gBEiCvEwvW.', id FROM roles WHERE codigo='RESP_VINCULACION';
INSERT INTO usuarios_panel (cedula, nombres, correo, password_hash, rol_id)
SELECT '1710000003','Carlos Ruiz',  'carlos.ruiz@yavirac.edu.ec',  '$2b$10$0QtCdZxm3aIiCJaDJjQmbeF1PofnoarFzwmhE8JMR4gBEiCvEwvW.', id FROM roles WHERE codigo='RESP_LABORATORIOS';
INSERT INTO usuarios_panel (cedula, nombres, correo, password_hash, rol_id)
SELECT '1710000004','Ana Gómez',    'ana.gomez@yavirac.edu.ec',    '$2b$10$0QtCdZxm3aIiCJaDJjQmbeF1PofnoarFzwmhE8JMR4gBEiCvEwvW.', id FROM roles WHERE codigo='PROFESOR';

-- Coordinador cubre 2 carreras (DSW y ADM) ------------------------------
INSERT INTO usuarios_carreras (usuario_id, carrera_id)
SELECT u.id, c.id FROM usuarios_panel u, carreras c
WHERE u.cedula='1710000001' AND c.codigo IN ('DSW','ADM');

-- Qué rol audita qué trámite ---------------------------------------------
-- Un usuario ve (y es notificado de) los trámites que su rol tiene asignados.
INSERT INTO rol_tipos_solicitud (rol_id, tipo_solicitud_id)
SELECT r.id, t.id
FROM roles r, tipos_solicitud t
WHERE (r.codigo, t.codigo) IN (
    ('COORDINADOR',       'RECORD_ACADEMICO'),     -- Coordinador de Carrera
    ('SECRETARIA',        'ANULACION_MATRICULA'),  -- Secretaría
    ('RESP_VINCULACION',  'CERT_VINCULACION'),     -- Vinculación
    ('RESP_LABORATORIOS', 'ALERTA_LAB')            -- Laboratorios
  )
ON CONFLICT DO NOTHING;

-- Estudiantes (incluye cédulas del Figma) -------------------------------
-- Anthony y Ajh se matriculan en modalidad Dual, ingresaron en 2025-II
-- (replica el caso real usado para validar el formato del Certificado de Matrícula).
INSERT INTO estudiantes (cedula, nombres, carrera_id, nivel, paralelo, estado_matricula, correo, modalidad, periodo_ingreso_id, nivel_ingreso)
SELECT '1756234890','Anthony Guaman', c.id,'Quinto','A','ACTIVA','anthony@yavirac.edu.ec','Dual',
  (SELECT id FROM periodos_academicos WHERE codigo='2025-II'),'Primer nivel'
FROM carreras c WHERE c.codigo='DSW';
INSERT INTO estudiantes (cedula, nombres, carrera_id, nivel, paralelo, estado_matricula, correo, modalidad, periodo_ingreso_id, nivel_ingreso)
SELECT '1726618539','Anthony Guaman', c.id,'Quinto','A','ACTIVA','ajh.guaman@yavirac.edu.ec','Dual',
  (SELECT id FROM periodos_academicos WHERE codigo='2025-II'),'Primer nivel'
FROM carreras c WHERE c.codigo='DSW';
INSERT INTO estudiantes (cedula, nombres, carrera_id, nivel, paralelo, estado_matricula, correo)
SELECT '1712345678','Lucía Andrade', id,'Tercero','B','ACTIVA','lucia.andrade@yavirac.edu.ec' FROM carreras WHERE codigo='ADM';
INSERT INTO estudiantes (cedula, nombres, carrera_id, nivel, paralelo, estado_matricula, correo)
SELECT '1798765432','Pedro Suárez', id,'Segundo','A','RETIRADA','pedro.suarez@yavirac.edu.ec' FROM carreras WHERE codigo='GAS';
INSERT INTO estudiantes (cedula, nombres, carrera_id, nivel, paralelo, estado_matricula, correo)
SELECT '1723456789','Diana Torres', id,'Cuarto','A','SUSPENDIDA','diana.torres@yavirac.edu.ec' FROM carreras WHERE codigo='DIS';

-- Laboratorios y categorías de alerta -----------------------------------
INSERT INTO laboratorios (codigo, nombre, ubicacion) VALUES
  ('LAB-01','Laboratorio de Redes','Bloque A - Piso 2'),
  ('LAB-02','Laboratorio de Software','Bloque B - Piso 1'),
  ('LAB-03','Laboratorio de Diseño','Bloque C - Piso 3');

INSERT INTO categorias_alerta (nombre) VALUES
  ('Mouse perdido'),('Monitor dañado'),('Cargador desconectado'),
  ('Computador sin funcionar'),('Proyector averiado'),
  ('Teclado dañado'),('Daños en infraestructura');

-- Configuración del sistema ---------------------------------------------
INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
  ('otp.longitud',       '5',  'Dígitos del OTP'),
  ('otp.expiracion_min', '5',  'Minutos de validez del OTP'),
  ('otp.max_intentos',   '5',  'Intentos antes de bloqueo'),
  ('otp.bloqueo_min',    '15', 'Minutos de bloqueo temporal'),
  ('jwt.duracion_min',   '60', 'Vida del token del panel'),
  ('imagen.max_mb',      '5',  'Tamaño máximo de foto de alerta'),
  -- Datos institucionales y de firma, usados en el membrete y pie del Certificado de Matrícula
  ('institucion.nombre_oficial', 'Instituto Superior Tecnológico de Turismo y Patrimonio "YAVIRAC"', 'Razón social completa para documentos oficiales'),
  ('institucion.direccion',      'García Moreno S4-35 y Ambato, Centro Histórico. Quito-Ecuador', 'Dirección física institucional'),
  ('institucion.sitio_web',      'www.yavirac.edu.ec', 'Sitio web institucional'),
  ('institucion.eslogan',        '¡Fortaleciendo Capacidades!', 'Eslogan institucional'),
  ('institucion.ciudad_emision', 'Quito', 'Ciudad que aparece en la frase de emisión del certificado'),
  ('firma.nombre', 'Mtr. Alexandra Gordon M.', 'Nombre de quien firma los certificados generados'),
  ('firma.cargo',  'Secretaria General (s)', 'Cargo de quien firma los certificados generados');
