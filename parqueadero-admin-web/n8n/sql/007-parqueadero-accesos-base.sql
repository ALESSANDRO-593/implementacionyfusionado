-- Estructuras compartidas requeridas por capacidad y eliminación de usuarios.
-- Los webhooks operativos de entrada/salida se integrarán sobre estas tablas.
BEGIN;

CREATE TABLE IF NOT EXISTS public.parqueadero_vehiculos_temporales (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parqueadero_usuario_id bigint NOT NULL
        REFERENCES public.parqueadero_usuarios(id) ON DELETE CASCADE,
    autorizacion_id bigint
        REFERENCES public.parqueadero_autorizaciones(id) ON DELETE CASCADE,
    placa character varying(10) NOT NULL,
    tipo_vehiculo character varying(10) NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamp with time zone NOT NULL DEFAULT now(),
    actualizado_en timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT parqueadero_vehiculos_temporales_tipo_check
        CHECK (tipo_vehiculo IN ('AUTO', 'MOTO'))
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
    tipo_movimiento character varying(10) NOT NULL,
    estado_validacion character varying(15) NOT NULL,
    motivo_rechazo character varying(300),
    registrado_por bigint
        REFERENCES public.usuarios_panel(id) ON DELETE SET NULL,
    fecha_hora timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT parqueadero_accesos_movimiento_check
        CHECK (tipo_movimiento IN ('ENTRADA', 'SALIDA')),
    CONSTRAINT parqueadero_accesos_estado_check
        CHECK (estado_validacion IN ('AUTORIZADO', 'RECHAZADO'))
);

CREATE INDEX IF NOT EXISTS parqueadero_accesos_usuario_fecha_idx
    ON public.parqueadero_accesos(parqueadero_usuario_id, fecha_hora DESC, id DESC)
    WHERE estado_validacion = 'AUTORIZADO';

CREATE INDEX IF NOT EXISTS parqueadero_accesos_autorizacion_fecha_idx
    ON public.parqueadero_accesos(autorizacion_id, fecha_hora DESC, id DESC);

COMMIT;
