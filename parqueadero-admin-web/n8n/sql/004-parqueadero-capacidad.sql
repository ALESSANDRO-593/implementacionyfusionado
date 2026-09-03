-- Capacidad administrable del parqueadero. Los espacios ocupados se calculan
-- desde el último acceso AUTORIZADO de cada usuario.
BEGIN;

CREATE TABLE IF NOT EXISTS public.parqueadero_configuracion (
    id smallint PRIMARY KEY DEFAULT 1,
    capacidad_total integer NOT NULL DEFAULT 100,
    actualizado_por bigint,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parqueadero_configuracion_unica_check CHECK (id = 1),
    CONSTRAINT parqueadero_configuracion_capacidad_check CHECK (capacidad_total > 0),
    CONSTRAINT parqueadero_configuracion_usuario_fkey
        FOREIGN KEY (actualizado_por) REFERENCES public.usuarios_panel(id) ON DELETE SET NULL
);

INSERT INTO public.parqueadero_configuracion (id, capacidad_total)
VALUES (1, 100)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS parqueadero_accesos_usuario_fecha_idx
    ON public.parqueadero_accesos(parqueadero_usuario_id, fecha_hora DESC, id DESC)
    WHERE estado_validacion = 'AUTORIZADO';

COMMIT;

SELECT capacidad_total FROM public.parqueadero_configuracion WHERE id = 1;
