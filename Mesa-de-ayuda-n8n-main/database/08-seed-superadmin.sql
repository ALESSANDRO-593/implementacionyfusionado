-- =====================================================================
-- YaviBot — Usuario Super Administrador (único con acceso a la carga masiva)
-- Usuario: 0000000001   ·   Contraseña: SuperAdmin2026*
-- (El rol SUPERADMIN con id -1 lo crea la migración 07.)
-- =====================================================================
INSERT INTO usuarios_panel (cedula, nombres, correo, password_hash, rol_id, activo)
VALUES ('0000000001', 'Super Administrador', 'superadmin@yavirac.edu.ec',
        '$2b$10$PSNYLdtV0WBmqml3Vv0u1eqhCVopnbiF5be4SuH799AMCiO8df2/G', -1, true)
ON CONFLICT (cedula) DO UPDATE
  SET rol_id = EXCLUDED.rol_id, password_hash = EXCLUDED.password_hash, activo = true;
