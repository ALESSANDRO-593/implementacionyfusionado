-- =============================================================================
-- MIGRACIÓN DE PARKING PARA LA BASE DE PRODUCCIÓN
-- Fecha: 2026-09-02
-- =============================================================================
-- Comparación realizada entre:
--   - parking_sql_prod.txt
--   - 000-instalacion-completa-parqueadero.sql
--   - workflows actuales de YaviBot y del panel administrativo
--
-- Esta migración:
--   * NO elimina tablas ni datos.
--   * NO reemplaza la estructura existente de accesos o vehículos temporales.
--   * Agrega la relación vehículo-pago requerida por YaviBot.
--   * Amplía estados permitidos sin invalidar estados existentes.
--   * Completa índices, tarifas, capacidad y rol de forma idempotente.
--
-- Recomendación: ejecutar primero en una copia/restauración de producción.
-- =============================================================================

BEGIN;

-- Evita dejar producción bloqueada indefinidamente si hay otra operación activa.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

-- -----------------------------------------------------------------------------
-- 0. Validación: las ocho tablas ya deben existir en producción.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    tabla text;
BEGIN
    FOREACH tabla IN ARRAY ARRAY[
        'parqueadero_usuarios',
        'parqueadero_vehiculos',
        'parqueadero_modalidades',
        'parqueadero_pagos',
        'parqueadero_autorizaciones',
        'parqueadero_configuracion',
        'parqueadero_vehiculos_temporales',
        'parqueadero_accesos'
    ]
    LOOP
        IF to_regclass('public.' || tabla) IS NULL THEN
            RAISE EXCEPTION
                'Falta public.%. Esta migración es para el esquema de producción existente; no es un instalador desde cero.',
                tabla;
        END IF;
    END LOOP;

    IF to_regclass('public.usuarios_panel') IS NULL THEN
        RAISE EXCEPTION 'Falta la tabla base public.usuarios_panel.';
    END IF;

    IF to_regclass('public.roles') IS NULL THEN
        RAISE EXCEPTION 'Falta la tabla base public.roles.';
    END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 1. Relación entre la solicitud/pago y el vehículo elegido.
-- -----------------------------------------------------------------------------
-- Es indispensable para el flujo YaviBot:
--   - consultar la placa/tipo usados en la solicitud;
--   - descargar el PDF del ticket aprobado.
--
-- Los registros históricos quedan en NULL porque no es seguro adivinar qué
-- vehículo utilizaron. Las solicitudes nuevas de YaviBot sí guardarán este ID.
ALTER TABLE public.parqueadero_pagos
    ADD COLUMN IF NOT EXISTS vehiculo_id bigint;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.parqueadero_pagos'::regclass
          AND conname = 'parqueadero_pagos_vehiculo_fkey'
    ) THEN
        ALTER TABLE public.parqueadero_pagos
            ADD CONSTRAINT parqueadero_pagos_vehiculo_fkey
            FOREIGN KEY (vehiculo_id)
            REFERENCES public.parqueadero_vehiculos(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS parqueadero_pagos_vehiculo_idx
    ON public.parqueadero_pagos(vehiculo_id)
    WHERE vehiculo_id IS NOT NULL;

-- Índice utilizado al consultar autorización/pago vigente de un usuario.
CREATE INDEX IF NOT EXISTS parqueadero_pagos_usuario_estado_idx
    ON public.parqueadero_pagos(parqueadero_usuario_id, estado, id DESC);

-- -----------------------------------------------------------------------------
-- 2. Estados admitidos por el modelo integrado.
-- -----------------------------------------------------------------------------
-- Producción ya admite PENDIENTE/APROBADO/RECHAZADO.
-- Se añade ANULADO para poder cerrar pagos sin eliminarlos.
ALTER TABLE public.parqueadero_pagos
    DROP CONSTRAINT IF EXISTS parqueadero_pagos_estado_check;

ALTER TABLE public.parqueadero_pagos
    ADD CONSTRAINT parqueadero_pagos_estado_check
    CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO'));

-- Producción ya admite VIGENTE/VENCIDA/ANULADA.
-- Se añade BLOQUEADA para suspender una autorización sin borrarla.
ALTER TABLE public.parqueadero_autorizaciones
    DROP CONSTRAINT IF EXISTS parqueadero_autorizaciones_estado_check;

ALTER TABLE public.parqueadero_autorizaciones
    ADD CONSTRAINT parqueadero_autorizaciones_estado_check
    CHECK (estado IN ('VIGENTE', 'VENCIDA', 'BLOQUEADA', 'ANULADA'));

-- -----------------------------------------------------------------------------
-- 3. Datos mínimos configurables.
-- -----------------------------------------------------------------------------
-- No sobrescribe un precio que ya haya sido configurado en producción.
INSERT INTO public.parqueadero_modalidades (
    modalidad,
    tipo_vehiculo,
    precio,
    activo
)
VALUES
    ('DIARIO',  'AUTO', 1.50, true),
    ('DIARIO',  'MOTO', 1.50, true),
    ('MENSUAL', 'AUTO', 10.00, true),
    ('MENSUAL', 'MOTO', 5.00, true)
ON CONFLICT (modalidad, tipo_vehiculo) DO UPDATE
SET precio = COALESCE(public.parqueadero_modalidades.precio, EXCLUDED.precio),
    actualizado_en = now();

-- Crea la única fila de configuración si todavía no existe.
INSERT INTO public.parqueadero_configuracion (id, capacidad_total)
VALUES (1, 100)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Rol del panel administrativo.
-- -----------------------------------------------------------------------------
-- No crea usuarios ni asigna el rol automáticamente.
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
-- VERIFICACIÓN POSTERIOR
-- =============================================================================

-- 1. Debe mostrar vehiculo_id y su FK.
SELECT
    c.column_name,
    c.data_type,
    c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'parqueadero_pagos'
  AND c.column_name = 'vehiculo_id';

SELECT
    conname,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.parqueadero_pagos'::regclass
  AND conname = 'parqueadero_pagos_vehiculo_fkey';

-- 2. Deben aparecer los estados ampliados.
SELECT
    conrelid::regclass AS tabla,
    conname,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
        'public.parqueadero_pagos'::regclass,
        'public.parqueadero_autorizaciones'::regclass
    )
  AND conname IN (
        'parqueadero_pagos_estado_check',
        'parqueadero_autorizaciones_estado_check'
    )
ORDER BY conrelid::regclass::text, conname;

-- 3. Deben aparecer cuatro combinaciones de tarifas.
SELECT modalidad, tipo_vehiculo, precio, activo
FROM public.parqueadero_modalidades
ORDER BY modalidad, tipo_vehiculo;

-- 4. Debe existir la configuración única.
SELECT id, capacidad_total, actualizado_por, actualizado_en
FROM public.parqueadero_configuracion
WHERE id = 1;

-- 5. Debe existir el rol.
SELECT id, codigo, nombre
FROM public.roles
WHERE codigo = 'ADMINISTRADOR_PARKING';

-- 6. Revisión manual de pagos históricos sin vehículo.
-- No se actualizan automáticamente para evitar asociar una placa incorrecta.
SELECT count(*) AS pagos_historicos_sin_vehiculo
FROM public.parqueadero_pagos
WHERE vehiculo_id IS NULL;

-- =============================================================================
-- ASIGNACIÓN OPCIONAL DE ADMINISTRADOR (EJECUTAR APARTE)
-- =============================================================================
-- Sustituir CEDULA_REAL y quitar los comentarios:
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
