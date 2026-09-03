-- SOLO DESARROLLO LOCAL. No ejecutar en producción.
-- Credenciales locales:
--   Cédula:     0999999999
--   Contraseña: ParqueaderoLocal2026!

DO $$
DECLARE
    parking_admin_role_id bigint;
BEGIN
    SELECT id INTO parking_admin_role_id
    FROM public.roles
    WHERE codigo = 'ADMINISTRADOR_PARKING'
    LIMIT 1;

    IF parking_admin_role_id IS NULL THEN
        INSERT INTO public.roles (codigo, nombre, descripcion)
        VALUES ('ADMINISTRADOR_PARKING', 'Administrador Parking',
                'Acceso exclusivo al panel administrativo y a la gestión del parqueadero.')
        RETURNING id INTO parking_admin_role_id;
    ELSE
        UPDATE public.roles
        SET nombre = 'Administrador Parking',
            descripcion = 'Acceso exclusivo al panel administrativo y a la gestión del parqueadero.'
        WHERE id = parking_admin_role_id;
    END IF;

    IF parking_admin_role_id IS NULL THEN
        RAISE EXCEPTION 'No fue posible configurar el rol ADMINISTRADOR_PARKING';
    END IF;

    INSERT INTO public.usuarios_panel (
        cedula,
        nombres,
        correo,
        password_hash,
        rol_id,
        activo
    )
    VALUES (
        '0999999999',
        'Administrador Parqueadero Local',
        'parqueadero.local@yavirac.edu.ec',
        public.crypt('ParqueaderoLocal2026!', public.gen_salt('bf', 12)),
        parking_admin_role_id,
        true
    )
    ON CONFLICT (cedula) DO UPDATE
    SET nombres = EXCLUDED.nombres,
        correo = EXCLUDED.correo,
        password_hash = EXCLUDED.password_hash,
        rol_id = EXCLUDED.rol_id,
        activo = true,
        actualizado_en = now();
END
$$;

SELECT
    up.id,
    up.cedula,
    up.nombres,
    up.correo,
    r.codigo AS rol,
    up.activo
FROM public.usuarios_panel up
JOIN public.roles r ON r.id = up.rol_id
WHERE up.cedula = '0999999999';
