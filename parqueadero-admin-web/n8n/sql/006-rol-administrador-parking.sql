-- Rol exclusivo para acceder al panel administrativo del parqueadero.
-- El ID lo genera PostgreSQL; la seguridad se basa en el código estable del rol.
ROLLBACK;
BEGIN;

INSERT INTO public.roles (codigo, nombre, descripcion)
SELECT 'ADMINISTRADOR_PARKING', 'Administrador Parking',
       'Acceso exclusivo al panel administrativo y a la gestión del parqueadero.'
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE codigo = 'ADMINISTRADOR_PARKING');

UPDATE public.roles
SET nombre = 'Administrador Parking',
    descripcion = 'Acceso exclusivo al panel administrativo y a la gestión del parqueadero.'
WHERE codigo = 'ADMINISTRADOR_PARKING';

UPDATE public.usuarios_panel
SET rol_id = (SELECT id FROM public.roles WHERE codigo = 'ADMINISTRADOR_PARKING' LIMIT 1),
    activo = TRUE,
    actualizado_en = now()
WHERE cedula = '0999999999';

COMMIT;

SELECT up.id, up.cedula, up.nombres, up.correo, up.rol_id, r.codigo AS rol, up.activo
FROM public.usuarios_panel up
JOIN public.roles r ON r.id = up.rol_id
WHERE up.cedula = '0999999999';
