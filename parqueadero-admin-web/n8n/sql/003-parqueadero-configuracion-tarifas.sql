-- Catálogo administrable de tarifas del parqueadero.
-- Es seguro ejecutarlo más de una vez.
BEGIN;

CREATE TABLE IF NOT EXISTS public.parqueadero_modalidades (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modalidad character varying(20) NOT NULL,
    tipo_vehiculo character varying(10) NOT NULL,
    precio numeric(10,2),
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parqueadero_modalidades_modalidad_check
        CHECK (modalidad IN ('DIARIO', 'MENSUAL')),
    CONSTRAINT parqueadero_modalidades_tipo_vehiculo_check
        CHECK (tipo_vehiculo IN ('AUTO', 'MOTO')),
    CONSTRAINT parqueadero_modalidades_precio_check
        CHECK (precio IS NULL OR precio >= 0),
    CONSTRAINT parqueadero_modalidades_modalidad_tipo_key
        UNIQUE (modalidad, tipo_vehiculo)
);

INSERT INTO public.parqueadero_modalidades (modalidad, tipo_vehiculo, precio, activo)
VALUES
    ('DIARIO',  'AUTO', 1.50, true),
    ('DIARIO',  'MOTO', 1.50, true),
    ('MENSUAL', 'AUTO', 25.00, true),
    ('MENSUAL', 'MOTO', 25.00, true)
ON CONFLICT (modalidad, tipo_vehiculo) DO UPDATE
SET precio = COALESCE(public.parqueadero_modalidades.precio, EXCLUDED.precio),
    activo = true,
    actualizado_en = now();

COMMIT;

-- Verificación esperada: cuatro combinaciones con precio y estado activo.
SELECT modalidad, tipo_vehiculo, precio, activo
FROM public.parqueadero_modalidades
ORDER BY modalidad, tipo_vehiculo;
