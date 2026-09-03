-- =============================================================================
-- INSTALACIÓN COMPLETA DEL MÓDULO DE PARQUEADERO - YAVIBOT
-- =============================================================================
-- Uso:
--   Ejecutar sobre la MISMA base PostgreSQL utilizada por Mesa de Ayuda,
--   Certificado de Matrícula y n8n.
--
-- Incluye:
--   1. Usuarios del parqueadero.
--   2. Vehículos.
--   3. Modalidades y tarifas.
--   4. Solicitudes/pagos.
--   5. Autorizaciones/tickets.
--   6. Configuración de capacidad.
--   7. Tablas técnicas de accesos y vehículos temporales.
--   8. Rol ADMINISTRADOR_PARKING.
--   9. Índices y datos iniciales indispensables.
--
-- No incluye:
--   - usuarios administrativos de prueba;
--   - contraseñas;
--   - datos de solicitudes o tickets;
--   - operaciones destructivas.
--
-- Requisitos previos:
--   public.estudiantes(id bigint)
--   public.docentes(id bigint)
--   public.usuarios_panel(id bigint)
--   public.roles(id bigint, codigo, nombre, descripcion)
--
-- Este archivo puede volver a ejecutarse cuando la instalación ya está
-- completa. No borra datos ni reemplaza tarifas que hayan sido configuradas.
-- =============================================================================

BEGIN;

-- gen_random_uuid() se utiliza para el código interno de las autorizaciones.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Detener la instalación con un mensaje claro si falta el esquema base.
DO $$
DECLARE
    tabla text;
BEGIN
    FOREACH tabla IN ARRAY ARRAY[
        'estudiantes',
        'docentes',
        'usuarios_panel',
        'roles'
    ]
    LOOP
        IF to_regclass('public.' || tabla) IS NULL THEN
            RAISE EXCEPTION
                'Falta la tabla base public.%. Ejecute primero el esquema principal de YaviBot.',
                tabla;
        END IF;
    END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- 1. Usuarios habilitados para utilizar el servicio de parqueadero
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parqueadero_usuarios (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_usuario varchar(20) NOT NULL,
    estudiante_id bigint
        REFERENCES public.estudiantes(id) ON DELETE CASCADE,
    docente_id bigint
        REFERENCES public.docentes(id) ON DELETE CASCADE,
    cedula_manual varchar(10),
    nombres_manual varchar(150),
    correo_manual varchar(150),
    estado varchar(15) NOT NULL DEFAULT 'ACTIVO',
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT parqueadero_usuarios_tipo_check
        CHECK (tipo_usuario IN ('ESTUDIANTE', 'DOCENTE', 'INVITADO')),

    CONSTRAINT parqueadero_usuarios_estado_check
        CHECK (estado IN ('ACTIVO', 'INACTIVO')),

    CONSTRAINT parqueadero_usuarios_cedula_manual_check
        CHECK (cedula_manual IS NULL OR cedula_manual ~ '^[0-9]{10}$'),

    CONSTRAINT parqueadero_usuarios_origen_check CHECK (
        (
            tipo_usuario = 'ESTUDIANTE'
            AND estudiante_id IS NOT NULL
            AND docente_id IS NULL
            AND cedula_manual IS NULL
            AND nombres_manual IS NULL
            AND correo_manual IS NULL
        )
        OR
        (
            tipo_usuario = 'DOCENTE'
            AND docente_id IS NOT NULL
            AND estudiante_id IS NULL
            AND cedula_manual IS NULL
            AND nombres_manual IS NULL
            AND correo_manual IS NULL
        )
        OR
        (
            tipo_usuario = 'INVITADO'
            AND estudiante_id IS NULL
            AND docente_id IS NULL
            AND cedula_manual IS NOT NULL
            AND nombres_manual IS NOT NULL
            AND correo_manual IS NOT NULL
        )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS parqueadero_usuarios_estudiante_uidx
    ON public.parqueadero_usuarios(estudiante_id)
    WHERE estudiante_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS parqueadero_usuarios_docente_uidx
    ON public.parqueadero_usuarios(docente_id)
    WHERE docente_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS parqueadero_usuarios_cedula_manual_uidx
    ON public.parqueadero_usuarios(cedula_manual)
    WHERE cedula_manual IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Vehículos registrados
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parqueadero_vehiculos (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parqueadero_usuario_id bigint NOT NULL
        REFERENCES public.parqueadero_usuarios(id) ON DELETE CASCADE,
    placa varchar(12) NOT NULL,
    tipo_vehiculo varchar(10) NOT NULL,
    marca varchar(80),
    modelo varchar(80),
    color varchar(50),
    es_principal boolean NOT NULL DEFAULT false,
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT parqueadero_vehiculos_tipo_check
        CHECK (tipo_vehiculo IN ('AUTO', 'MOTO'))
);

CREATE UNIQUE INDEX IF NOT EXISTS parqueadero_vehiculos_placa_uidx
    ON public.parqueadero_vehiculos(upper(placa));

CREATE UNIQUE INDEX IF NOT EXISTS parqueadero_vehiculos_principal_uidx
    ON public.parqueadero_vehiculos(parqueadero_usuario_id)
    WHERE es_principal = true AND activo = true;

CREATE INDEX IF NOT EXISTS parqueadero_vehiculos_usuario_activo_idx
    ON public.parqueadero_vehiculos(parqueadero_usuario_id, activo, id);

-- -----------------------------------------------------------------------------
-- 3. Modalidades y tarifas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parqueadero_modalidades (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modalidad varchar(20) NOT NULL,
    tipo_vehiculo varchar(10) NOT NULL,
    precio numeric(10,2),
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT parqueadero_modalidades_modalidad_check
        CHECK (modalidad IN ('DIARIO', 'MENSUAL')),

    CONSTRAINT parqueadero_modalidades_tipo_vehiculo_check
        CHECK (tipo_vehiculo IN ('AUTO', 'MOTO')),

    CONSTRAINT parqueadero_modalidades_precio_check
        CHECK (precio IS NULL OR precio >= 0),

    CONSTRAINT parqueadero_modalidades_modalidad_tipo_key
        UNIQUE (modalidad, tipo_vehiculo)
);

-- Los valores son iniciales. Si una tarifa ya fue configurada, se conserva.
INSERT INTO public.parqueadero_modalidades (
    modalidad,
    tipo_vehiculo,
    precio,
    activo
)
VALUES
    ('DIARIO',  'AUTO', 1.50, true),
    ('DIARIO',  'MOTO', 1.50, true),
    ('MENSUAL', 'AUTO', 25.00, true),
    ('MENSUAL', 'MOTO', 25.00, true)
ON CONFLICT (modalidad, tipo_vehiculo) DO UPDATE
SET precio = COALESCE(public.parqueadero_modalidades.precio, EXCLUDED.precio),
    actualizado_en = now();

-- -----------------------------------------------------------------------------
-- 4. Solicitudes y pagos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parqueadero_pagos (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parqueadero_usuario_id bigint NOT NULL
        REFERENCES public.parqueadero_usuarios(id) ON DELETE CASCADE,
    vehiculo_id bigint
        REFERENCES public.parqueadero_vehiculos(id) ON DELETE SET NULL,
    modalidad_id bigint NOT NULL
        REFERENCES public.parqueadero_modalidades(id),
    monto numeric(10,2) NOT NULL,
    metodo_pago varchar(20) NOT NULL DEFAULT 'EFECTIVO',
    referencia varchar(120),
    fecha_pago timestamptz NOT NULL DEFAULT now(),
    fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin date NOT NULL DEFAULT CURRENT_DATE,
    estado varchar(15) NOT NULL DEFAULT 'PENDIENTE',
    registrado_por bigint
        REFERENCES public.usuarios_panel(id) ON DELETE SET NULL,
    origen_solicitud varchar(20) NOT NULL DEFAULT 'PANEL',
    motivo_rechazo varchar(300),
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT parqueadero_pagos_monto_check
        CHECK (monto >= 0),

    CONSTRAINT parqueadero_pagos_fechas_check
        CHECK (fecha_fin >= fecha_inicio),

    CONSTRAINT parqueadero_pagos_metodo_check
        CHECK (metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA')),

    CONSTRAINT parqueadero_pagos_estado_check
        CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO')),

    CONSTRAINT parqueadero_pagos_origen_solicitud_check
        CHECK (origen_solicitud IN ('PANEL', 'YAVIBOT'))
);

CREATE INDEX IF NOT EXISTS parqueadero_pagos_usuario_estado_idx
    ON public.parqueadero_pagos(parqueadero_usuario_id, estado, id DESC);

CREATE INDEX IF NOT EXISTS parqueadero_pagos_estado_fecha_idx
    ON public.parqueadero_pagos(estado, fecha_pago DESC, id DESC);

CREATE INDEX IF NOT EXISTS parqueadero_pagos_vehiculo_idx
    ON public.parqueadero_pagos(vehiculo_id)
    WHERE vehiculo_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. Autorizaciones y tickets aprobados
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parqueadero_autorizaciones (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo uuid NOT NULL DEFAULT gen_random_uuid(),
    parqueadero_usuario_id bigint NOT NULL
        REFERENCES public.parqueadero_usuarios(id) ON DELETE CASCADE,
    pago_id bigint NOT NULL
        REFERENCES public.parqueadero_pagos(id) ON DELETE CASCADE,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    estado varchar(15) NOT NULL DEFAULT 'VIGENTE',
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT parqueadero_autorizaciones_codigo_key
        UNIQUE (codigo),

    CONSTRAINT parqueadero_autorizaciones_pago_key
        UNIQUE (pago_id),

    CONSTRAINT parqueadero_autorizaciones_fechas_check
        CHECK (fecha_fin >= fecha_inicio),

    CONSTRAINT parqueadero_autorizaciones_estado_check
        CHECK (estado IN ('VIGENTE', 'VENCIDA', 'BLOQUEADA', 'ANULADA'))
);

CREATE INDEX IF NOT EXISTS parqueadero_autorizaciones_usuario_estado_idx
    ON public.parqueadero_autorizaciones(
        parqueadero_usuario_id,
        estado,
        fecha_inicio,
        fecha_fin
    );

-- -----------------------------------------------------------------------------
-- 6. Capacidad general del parqueadero
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parqueadero_configuracion (
    id smallint PRIMARY KEY DEFAULT 1,
    capacidad_total integer NOT NULL DEFAULT 100,
    actualizado_por bigint
        REFERENCES public.usuarios_panel(id) ON DELETE SET NULL,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT parqueadero_configuracion_unica_check
        CHECK (id = 1),

    CONSTRAINT parqueadero_configuracion_capacidad_check
        CHECK (capacidad_total > 0)
);

INSERT INTO public.parqueadero_configuracion (id, capacidad_total)
VALUES (1, 100)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. Estructuras técnicas de accesos
-- -----------------------------------------------------------------------------
-- No habilitan por sí mismas el control de entrada/salida en el panel.
-- Actualmente sirven como soporte del cálculo de ocupación y de la integridad
-- referencial al eliminar usuarios.

CREATE TABLE IF NOT EXISTS public.parqueadero_vehiculos_temporales (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parqueadero_usuario_id bigint NOT NULL
        REFERENCES public.parqueadero_usuarios(id) ON DELETE CASCADE,
    autorizacion_id bigint
        REFERENCES public.parqueadero_autorizaciones(id) ON DELETE CASCADE,
    placa varchar(10) NOT NULL,
    tipo_vehiculo varchar(10) NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT parqueadero_vehiculos_temporales_tipo_check
        CHECK (tipo_vehiculo IN ('AUTO', 'MOTO'))
);

CREATE INDEX IF NOT EXISTS parqueadero_vehiculos_temporales_usuario_idx
    ON public.parqueadero_vehiculos_temporales(
        parqueadero_usuario_id,
        activo,
        id DESC
    );

CREATE TABLE IF NOT EXISTS public.parqueadero_accesos (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parqueadero_usuario_id bigint NOT NULL
        REFERENCES public.parqueadero_usuarios(id) ON DELETE CASCADE,
    autorizacion_id bigint
        REFERENCES public.parqueadero_autorizaciones(id) ON DELETE CASCADE,
    vehiculo_id bigint
        REFERENCES public.parqueadero_vehiculos(id) ON DELETE SET NULL,
    vehiculo_temporal_id bigint
        REFERENCES public.parqueadero_vehiculos_temporales(id) ON DELETE SET NULL,
    tipo_movimiento varchar(10) NOT NULL,
    estado_validacion varchar(15) NOT NULL,
    motivo_rechazo varchar(300),
    registrado_por bigint
        REFERENCES public.usuarios_panel(id) ON DELETE SET NULL,
    fecha_hora timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT parqueadero_accesos_movimiento_check
        CHECK (tipo_movimiento IN ('ENTRADA', 'SALIDA')),

    CONSTRAINT parqueadero_accesos_estado_check
        CHECK (estado_validacion IN ('AUTORIZADO', 'RECHAZADO'))
);

CREATE INDEX IF NOT EXISTS parqueadero_accesos_usuario_fecha_idx
    ON public.parqueadero_accesos(
        parqueadero_usuario_id,
        fecha_hora DESC,
        id DESC
    )
    WHERE estado_validacion = 'AUTORIZADO';

CREATE INDEX IF NOT EXISTS parqueadero_accesos_autorizacion_fecha_idx
    ON public.parqueadero_accesos(
        autorizacion_id,
        fecha_hora DESC,
        id DESC
    );

-- -----------------------------------------------------------------------------
-- 8. Rol administrativo
-- -----------------------------------------------------------------------------
INSERT INTO public.roles (codigo, nombre, descripcion)
SELECT
    'ADMINISTRADOR_PARKING',
    'Administrador Parking',
    'Acceso exclusivo al panel administrativo y a la gestión del parqueadero.'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.roles
    WHERE codigo = 'ADMINISTRADOR_PARKING'
);

UPDATE public.roles
SET nombre = 'Administrador Parking',
    descripcion = 'Acceso exclusivo al panel administrativo y a la gestión del parqueadero.'
WHERE codigo = 'ADMINISTRADOR_PARKING';

COMMIT;

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- Deben aparecer ocho tablas.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
      'parqueadero_usuarios',
      'parqueadero_vehiculos',
      'parqueadero_modalidades',
      'parqueadero_pagos',
      'parqueadero_autorizaciones',
      'parqueadero_configuracion',
      'parqueadero_vehiculos_temporales',
      'parqueadero_accesos'
  )
ORDER BY table_name;

-- Deben aparecer cuatro combinaciones.
SELECT modalidad, tipo_vehiculo, precio, activo
FROM public.parqueadero_modalidades
ORDER BY modalidad, tipo_vehiculo;

-- Debe aparecer ADMINISTRADOR_PARKING.
SELECT id, codigo, nombre
FROM public.roles
WHERE codigo = 'ADMINISTRADOR_PARKING';

-- =============================================================================
-- ASIGNACIÓN DE UN ADMINISTRADOR (EJECUTAR APARTE)
-- =============================================================================
-- Sustituya CEDULA_REAL y quite los comentarios. No use cuentas de prueba.
--
-- UPDATE public.usuarios_panel
-- SET rol_id = (
--         SELECT id
--         FROM public.roles
--         WHERE codigo = 'ADMINISTRADOR_PARKING'
--         LIMIT 1
--     ),
--     activo = true,
--     actualizado_en = now()
-- WHERE cedula = 'CEDULA_REAL';
