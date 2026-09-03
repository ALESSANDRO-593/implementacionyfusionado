/**
 * Roles del panel, por `rol_id`.
 *
 * La autorización (guards, menús, vistas) se resuelve SIEMPRE por este id,
 * que es el mismo `usuarios_panel.rol_id` de la base de datos. Así, si a un
 * docente se le cambia el rol en la BD, hereda los accesos sin tocar código.
 */
export const Rol = {
  SUPERADMIN: -1,
  PROFESOR: 1,
  COORDINADOR: 2,
  RESP_VINCULACION: 3,
  RESP_LABORATORIOS: 4,
  SECRETARIA: 5,
} as const;

/** Roles que auditan tickets y por tanto entran al panel de seguimiento. */
export const ROLES_TICKETS: number[] = [Rol.COORDINADOR, Rol.RESP_VINCULACION, Rol.SECRETARIA];

/**
 * Quién puede abrir el Dashboard y el listado de tickets. El superadministrador
 * entra además de los roles que auditan, porque el backend ya le devuelve todos
 * los tickets (`panel-tickets` trata el rol -1 como "ve todo").
 */
export const ROLES_VER_TICKETS: number[] = [Rol.SUPERADMIN, ...ROLES_TICKETS];

/**
 * Quién entra al módulo de alertas de laboratorio: todo el personal docente y
 * administrativo. Dentro del módulo el backend distingue dos papeles:
 *   · gestiona → el rol tiene ALERTA_LAB en `rol_tipos_solicitud`; ve y
 *     resuelve todas las incidencias.
 *   · reporta  → los demás; registran incidencias y ven solo las suyas.
 * Esa distinción NO se repite aquí: llega en la respuesta de `alerta-listar`.
 */
export const ROLES_ALERTAS: number[] = [Rol.PROFESOR, Rol.RESP_LABORATORIOS, ...ROLES_TICKETS];

/** Nombre legible del rol, para mostrarlo en la cabecera del panel. */
export const ROL_ETIQUETA: Record<number, string> = {
  [Rol.SUPERADMIN]: 'Super Administrador',
  [Rol.PROFESOR]: 'Profesor',
  [Rol.COORDINADOR]: 'Coordinador de Carrera',
  [Rol.RESP_VINCULACION]: 'Responsable de Vinculación',
  [Rol.RESP_LABORATORIOS]: 'Responsable de Laboratorios',
  [Rol.SECRETARIA]: 'Secretaría',
};
