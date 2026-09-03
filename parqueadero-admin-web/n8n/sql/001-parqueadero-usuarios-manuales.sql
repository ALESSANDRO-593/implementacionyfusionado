-- Permite registrar invitados que no existen como estudiantes o docentes.
BEGIN;

ALTER TABLE public.parqueadero_usuarios
    ADD COLUMN IF NOT EXISTS cedula_manual character varying(10),
    ADD COLUMN IF NOT EXISTS nombres_manual character varying(150),
    ADD COLUMN IF NOT EXISTS correo_manual character varying(150);

ALTER TABLE public.parqueadero_usuarios
    DROP CONSTRAINT IF EXISTS parqueadero_usuarios_origen_check;

ALTER TABLE public.parqueadero_usuarios
    DROP CONSTRAINT IF EXISTS parqueadero_usuarios_tipo_check;

UPDATE public.parqueadero_usuarios
SET tipo_usuario = 'INVITADO', actualizado_en = now()
WHERE estudiante_id IS NULL
  AND docente_id IS NULL
  AND cedula_manual IS NOT NULL;

ALTER TABLE public.parqueadero_usuarios
    ADD CONSTRAINT parqueadero_usuarios_tipo_check CHECK (
        tipo_usuario IN ('ESTUDIANTE', 'DOCENTE', 'INVITADO')
    );

ALTER TABLE public.parqueadero_usuarios
    ADD CONSTRAINT parqueadero_usuarios_origen_check CHECK (
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
            AND
            estudiante_id IS NULL
            AND docente_id IS NULL
            AND cedula_manual IS NOT NULL
            AND nombres_manual IS NOT NULL
            AND correo_manual IS NOT NULL
        )
    );

ALTER TABLE public.parqueadero_usuarios
    DROP CONSTRAINT IF EXISTS parqueadero_usuarios_cedula_manual_check;

ALTER TABLE public.parqueadero_usuarios
    ADD CONSTRAINT parqueadero_usuarios_cedula_manual_check
    CHECK (cedula_manual IS NULL OR cedula_manual ~ '^[0-9]{10}$');

CREATE UNIQUE INDEX IF NOT EXISTS parqueadero_usuarios_cedula_manual_uidx
    ON public.parqueadero_usuarios(cedula_manual)
    WHERE cedula_manual IS NOT NULL;

COMMIT;
