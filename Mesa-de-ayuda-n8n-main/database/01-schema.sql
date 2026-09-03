-- =====================================================================
-- YaviBot — Esquema PostgreSQL (3FN)
-- Se ejecuta automáticamente al inicializar el contenedor de Postgres.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ------------------------------------------------------------------ --
--  Catálogos base
-- ------------------------------------------------------------------ --
CREATE TABLE carreras (
  id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo VARCHAR(20)  NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL
);

CREATE TABLE roles (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      VARCHAR(40)  NOT NULL UNIQUE,   -- PROFESOR, COORDINADOR, RESP_VINCULACION, RESP_LABORATORIOS
  nombre      VARCHAR(80)  NOT NULL,
  descripcion VARCHAR(200)
);

CREATE TABLE permisos (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo      VARCHAR(60)  NOT NULL UNIQUE,
  descripcion VARCHAR(200)
);

CREATE TABLE roles_permisos (
  rol_id     BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id BIGINT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE usuarios_panel (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cedula         VARCHAR(10)  NOT NULL UNIQUE CHECK (cedula ~ '^[0-9]{10}$'),
  nombres        VARCHAR(150) NOT NULL,
  correo         VARCHAR(150) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,       -- bcrypt
  rol_id         BIGINT NOT NULL REFERENCES roles(id),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuarios_carreras (
  usuario_id BIGINT NOT NULL REFERENCES usuarios_panel(id) ON DELETE CASCADE,
  carrera_id BIGINT NOT NULL REFERENCES carreras(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, carrera_id)
);

-- Periodos académicos (ciclos lectivos institucionales). Se referencia desde
-- estudiantes (periodo de ingreso) y se consulta el "vigente" para certificados.
CREATE TABLE periodos_academicos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo       VARCHAR(10) NOT NULL UNIQUE,   -- '2026-I', '2025-II'
  nombre       VARCHAR(60) NOT NULL,          -- 'mayo-septiembre 2026'
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  vigente      BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX ux_periodo_vigente ON periodos_academicos (vigente) WHERE vigente;

CREATE TABLE estudiantes (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cedula             VARCHAR(10)  NOT NULL UNIQUE CHECK (cedula ~ '^[0-9]{10}$'),
  nombres            VARCHAR(150) NOT NULL,
  carrera_id         BIGINT NOT NULL REFERENCES carreras(id),
  nivel              VARCHAR(30)  NOT NULL,
  paralelo           VARCHAR(5)   NOT NULL,
  estado_matricula   VARCHAR(20)  NOT NULL
      CHECK (estado_matricula IN ('ACTIVA','INACTIVA','RETIRADA','SUSPENDIDA')),
  correo             VARCHAR(150) NOT NULL UNIQUE,
  modalidad          VARCHAR(20)  NOT NULL DEFAULT 'Presencial'
      CHECK (modalidad IN ('Presencial','Dual','En línea','Semipresencial')),
  periodo_ingreso_id BIGINT REFERENCES periodos_academicos(id),  -- cuándo inició sus estudios
  nivel_ingreso      VARCHAR(30)  NOT NULL DEFAULT 'Primer nivel',
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_estudiantes_estado ON estudiantes(estado_matricula);

CREATE TABLE tipos_solicitud (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo        VARCHAR(40)  NOT NULL UNIQUE,
  nombre        VARCHAR(100) NOT NULL,
  genera_ticket BOOLEAN NOT NULL,
  ambito        VARCHAR(20) NOT NULL CHECK (ambito IN ('carrera','vinculacion','laboratorio','ninguno'))
);

-- Qué rol audita qué trámite. Es la única fuente de verdad: de aquí salen
-- tanto los tickets que ve cada usuario en el panel como el destinatario de
-- la notificación por correo. Cambiar responsabilidades = editar esta tabla.
CREATE TABLE rol_tipos_solicitud (
  rol_id            BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tipo_solicitud_id BIGINT NOT NULL REFERENCES tipos_solicitud(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, tipo_solicitud_id)
);

-- ------------------------------------------------------------------ --
--  Tickets
-- ------------------------------------------------------------------ --
CREATE TABLE tickets (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo            VARCHAR(15) NOT NULL UNIQUE,
  tipo_solicitud_id BIGINT NOT NULL REFERENCES tipos_solicitud(id),
  estudiante_id     BIGINT NOT NULL REFERENCES estudiantes(id),
  carrera_id        BIGINT NOT NULL REFERENCES carreras(id),
  nivel             VARCHAR(30) NOT NULL,
  paralelo          VARCHAR(20) NOT NULL,
  descripcion       TEXT,
  estado            VARCHAR(15) NOT NULL DEFAULT 'Pendiente'
      CHECK (estado IN ('Pendiente','En Proceso','Resuelto')),
  responsable_id    BIGINT REFERENCES usuarios_panel(id),
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_tickets_estado      ON tickets(estado);
CREATE INDEX ix_tickets_responsable ON tickets(responsable_id);
CREATE INDEX ix_tickets_estudiante  ON tickets(estudiante_id);

CREATE TABLE ticket_historial (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id       BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  estado_anterior VARCHAR(15),
  estado_nuevo    VARCHAR(15) NOT NULL,
  respuesta       TEXT,
  usuario_id      BIGINT REFERENCES usuarios_panel(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ --
--  Certificados y QR
-- ------------------------------------------------------------------ --
CREATE TABLE qr_codigos (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identificador  UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  estudiante_id  BIGINT NOT NULL REFERENCES estudiantes(id),
  certificado_id BIGINT,   -- FK diferida abajo
  payload        JSONB NOT NULL DEFAULT '{}',
  verificaciones INT NOT NULL DEFAULT 0,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE certificados (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  estudiante_id          BIGINT NOT NULL REFERENCES estudiantes(id),
  tipo                   VARCHAR(40) NOT NULL DEFAULT 'CERT_MATRICULA',
  qr_id                  BIGINT NOT NULL UNIQUE REFERENCES qr_codigos(id),
  pdf_path               VARCHAR(300),
  fecha                  DATE NOT NULL DEFAULT current_date,
  hora                   TIME NOT NULL DEFAULT current_time,
  -- Snapshot de los datos impresos en el PDF (igual patrón que carrera/nivel/paralelo
  -- en tickets): si luego cambia la configuración, el certificado ya emitido no se altera.
  periodo_lectivo_codigo VARCHAR(10),
  periodo_lectivo_nombre VARCHAR(60),
  modalidad              VARCHAR(20),
  periodo_ingreso_codigo VARCHAR(10),
  periodo_ingreso_nombre VARCHAR(60),
  nivel_ingreso          VARCHAR(30),
  firmante_nombre        VARCHAR(150),
  firmante_cargo         VARCHAR(100),
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE qr_codigos
  ADD CONSTRAINT fk_qr_certificado FOREIGN KEY (certificado_id) REFERENCES certificados(id);

-- ------------------------------------------------------------------ --
--  OTP y control de intentos
-- ------------------------------------------------------------------ --
CREATE TABLE otp_codigos (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cedula      VARCHAR(10) NOT NULL,
  correo      VARCHAR(150),
  codigo_hash VARCHAR(255) NOT NULL,
  canal       VARCHAR(20) NOT NULL CHECK (canal IN ('chatbot','panel_recovery')),
  expira_en   TIMESTAMPTZ NOT NULL,
  usado       BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_otp_cedula ON otp_codigos(cedula, canal);

CREATE TABLE intentos_acceso (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cedula            VARCHAR(10) NOT NULL,
  canal             VARCHAR(20) NOT NULL,
  intentos_fallidos INT NOT NULL DEFAULT 0,
  bloqueado_hasta   TIMESTAMPTZ,
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cedula, canal)
);

-- ------------------------------------------------------------------ --
--  Alertas de laboratorio
-- ------------------------------------------------------------------ --
CREATE TABLE laboratorios (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo    VARCHAR(20) NOT NULL UNIQUE,
  nombre    VARCHAR(100) NOT NULL,
  ubicacion VARCHAR(150)
);

CREATE TABLE categorias_alerta (
  id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE adjuntos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo         VARCHAR(30) NOT NULL,
  ruta         VARCHAR(300) NOT NULL,
  mime         VARCHAR(60) NOT NULL CHECK (mime IN ('image/jpeg','image/png')),
  tamano_bytes INT NOT NULL CHECK (tamano_bytes <= 5242880),
  hash         VARCHAR(64),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alertas (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo         VARCHAR(15) NOT NULL UNIQUE,
  laboratorio_id BIGINT NOT NULL REFERENCES laboratorios(id),
  categoria_id   BIGINT NOT NULL REFERENCES categorias_alerta(id),
  descripcion    TEXT NOT NULL,
  adjunto_id     BIGINT REFERENCES adjuntos(id),
  profesor_id    BIGINT NOT NULL REFERENCES usuarios_panel(id),
  estado         VARCHAR(15) NOT NULL DEFAULT 'Pendiente'
      CHECK (estado IN ('Pendiente','En revisión','Resuelta')),
  responsable_id BIGINT REFERENCES usuarios_panel(id),
  ticket_id      BIGINT REFERENCES tickets(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alerta_historial (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alerta_id       BIGINT NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
  estado_anterior VARCHAR(15),
  estado_nuevo    VARCHAR(15) NOT NULL,
  observacion     TEXT,
  usuario_id      BIGINT REFERENCES usuarios_panel(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ --
--  Eventos (outbox EDA), auditoría, importaciones, configuración
-- ------------------------------------------------------------------ --
CREATE TABLE eventos (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo      VARCHAR(50) NOT NULL,
  payload   JSONB NOT NULL DEFAULT '{}',
  origen    VARCHAR(50),
  procesado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_eventos_pendientes ON eventos(procesado) WHERE NOT procesado;

CREATE TABLE auditoria (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_tipo VARCHAR(20),
  usuario_ref  VARCHAR(50),
  accion       VARCHAR(80) NOT NULL,
  entidad      VARCHAR(50),
  entidad_id   VARCHAR(50),
  resultado    VARCHAR(20) NOT NULL,
  ip           VARCHAR(45),
  detalle      JSONB,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_auditoria_fecha ON auditoria(creado_en);

CREATE TABLE importaciones (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo         VARCHAR(20) NOT NULL CHECK (tipo IN ('estudiantes','profesores')),
  archivo      VARCHAR(200),
  insertados   INT NOT NULL DEFAULT 0,
  actualizados INT NOT NULL DEFAULT 0,
  omitidos     INT NOT NULL DEFAULT 0,
  errores      JSONB,
  usuario_ref  VARCHAR(50),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE configuracion_sistema (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave           VARCHAR(60) NOT NULL UNIQUE,
  valor           VARCHAR(200) NOT NULL,
  descripcion     VARCHAR(200),
  actualizado_por VARCHAR(50),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
