-- Esquema base compartido para el panel de Parking y los clientes YaviBot.
-- Es idempotente: puede ejecutarse en desarrollo y producción sin borrar datos.
BEGIN;

CREATE TABLE IF NOT EXISTS public.parqueadero_usuarios (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_usuario varchar(20) NOT NULL,
    estudiante_id bigint REFERENCES public.estudiantes(id) ON DELETE CASCADE,
    docente_id bigint REFERENCES public.docentes(id) ON DELETE CASCADE,
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
    CONSTRAINT parqueadero_usuarios_origen_check CHECK (
        (tipo_usuario = 'ESTUDIANTE' AND estudiante_id IS NOT NULL AND docente_id IS NULL)
        OR (tipo_usuario = 'DOCENTE' AND docente_id IS NOT NULL AND estudiante_id IS NULL)
        OR (tipo_usuario = 'INVITADO' AND estudiante_id IS NULL AND docente_id IS NULL
            AND cedula_manual IS NOT NULL AND nombres_manual IS NOT NULL AND correo_manual IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS parqueadero_usuarios_estudiante_uidx
    ON public.parqueadero_usuarios(estudiante_id) WHERE estudiante_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS parqueadero_usuarios_docente_uidx
    ON public.parqueadero_usuarios(docente_id) WHERE docente_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS parqueadero_usuarios_cedula_manual_uidx
    ON public.parqueadero_usuarios(cedula_manual) WHERE cedula_manual IS NOT NULL;

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
    CONSTRAINT parqueadero_vehiculos_tipo_check CHECK (tipo_vehiculo IN ('AUTO', 'MOTO'))
);

CREATE UNIQUE INDEX IF NOT EXISTS parqueadero_vehiculos_placa_uidx
    ON public.parqueadero_vehiculos(upper(placa));
CREATE UNIQUE INDEX IF NOT EXISTS parqueadero_vehiculos_principal_uidx
    ON public.parqueadero_vehiculos(parqueadero_usuario_id)
    WHERE es_principal = true AND activo = true;

CREATE TABLE IF NOT EXISTS public.parqueadero_modalidades (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modalidad varchar(20) NOT NULL,
    tipo_vehiculo varchar(10) NOT NULL,
    precio numeric(10,2),
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT parqueadero_modalidades_modalidad_check CHECK (modalidad IN ('DIARIO', 'MENSUAL')),
    CONSTRAINT parqueadero_modalidades_tipo_vehiculo_check CHECK (tipo_vehiculo IN ('AUTO', 'MOTO')),
    CONSTRAINT parqueadero_modalidades_precio_check CHECK (precio IS NULL OR precio >= 0),
    CONSTRAINT parqueadero_modalidades_modalidad_tipo_key UNIQUE (modalidad, tipo_vehiculo)
);

INSERT INTO public.parqueadero_modalidades (modalidad, tipo_vehiculo, precio, activo)
VALUES
    ('DIARIO', 'AUTO', 1.50, true),
    ('DIARIO', 'MOTO', 1.50, true),
    ('MENSUAL', 'AUTO', 25.00, true),
    ('MENSUAL', 'MOTO', 25.00, true)
ON CONFLICT (modalidad, tipo_vehiculo) DO UPDATE
SET precio = COALESCE(public.parqueadero_modalidades.precio, EXCLUDED.precio),
    actualizado_en = now();

CREATE TABLE IF NOT EXISTS public.parqueadero_pagos (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parqueadero_usuario_id bigint NOT NULL
        REFERENCES public.parqueadero_usuarios(id) ON DELETE CASCADE,
    vehiculo_id bigint REFERENCES public.parqueadero_vehiculos(id) ON DELETE SET NULL,
    modalidad_id bigint NOT NULL REFERENCES public.parqueadero_modalidades(id),
    monto numeric(10,2) NOT NULL,
    metodo_pago varchar(20) NOT NULL DEFAULT 'EFECTIVO',
    referencia varchar(120),
    fecha_pago timestamptz NOT NULL DEFAULT now(),
    fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin date NOT NULL DEFAULT CURRENT_DATE,
    estado varchar(15) NOT NULL DEFAULT 'PENDIENTE',
    registrado_por bigint REFERENCES public.usuarios_panel(id) ON DELETE SET NULL,
    origen_solicitud varchar(20) NOT NULL DEFAULT 'PANEL',
    motivo_rechazo varchar(300),
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT parqueadero_pagos_monto_check CHECK (monto >= 0),
    CONSTRAINT parqueadero_pagos_metodo_check CHECK (metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA')),
    CONSTRAINT parqueadero_pagos_estado_check CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO')),
    CONSTRAINT parqueadero_pagos_origen_solicitud_check CHECK (origen_solicitud IN ('PANEL', 'YAVIBOT'))
);

-- Compatibilidad con bases de Parking creadas antes de esta integración.
ALTER TABLE public.parqueadero_pagos
    ADD COLUMN IF NOT EXISTS vehiculo_id bigint REFERENCES public.parqueadero_vehiculos(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS origen_solicitud varchar(20) NOT NULL DEFAULT 'PANEL',
    ADD COLUMN IF NOT EXISTS motivo_rechazo varchar(300),
    ADD COLUMN IF NOT EXISTS creado_en timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS parqueadero_pagos_usuario_estado_idx
    ON public.parqueadero_pagos(parqueadero_usuario_id, estado, id DESC);

CREATE TABLE IF NOT EXISTS public.parqueadero_autorizaciones (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo uuid NOT NULL DEFAULT gen_random_uuid(),
    parqueadero_usuario_id bigint NOT NULL
        REFERENCES public.parqueadero_usuarios(id) ON DELETE CASCADE,
    pago_id bigint NOT NULL UNIQUE REFERENCES public.parqueadero_pagos(id) ON DELETE CASCADE,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    estado varchar(15) NOT NULL DEFAULT 'VIGENTE',
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT parqueadero_autorizaciones_codigo_key UNIQUE (codigo),
    CONSTRAINT parqueadero_autorizaciones_estado_check
        CHECK (estado IN ('VIGENTE', 'VENCIDA', 'BLOQUEADA', 'ANULADA'))
);

CREATE TABLE IF NOT EXISTS public.parqueadero_configuracion (
    id smallint PRIMARY KEY DEFAULT 1,
    capacidad_total integer NOT NULL DEFAULT 100,
    actualizado_por bigint REFERENCES public.usuarios_panel(id) ON DELETE SET NULL,
    creado_en timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT parqueadero_configuracion_unica_check CHECK (id = 1),
    CONSTRAINT parqueadero_configuracion_capacidad_check CHECK (capacidad_total > 0)
);

INSERT INTO public.parqueadero_configuracion (id, capacidad_total)
VALUES (1, 100)
ON CONFLICT (id) DO NOTHING;

COMMIT;
