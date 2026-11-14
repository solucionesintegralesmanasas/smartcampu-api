const { USER_ROLES } = require('@uajs/shared-types');

/**
 * Roles con permisos de gestión sobre todas las reservas.
 */
const ROLES_GESTION = Object.freeze([USER_ROLES.ADMIN, USER_ROLES.STAFF]);

const tieneRol = (usuario, roles) =>
  Array.isArray(usuario?.roles) && usuario.roles.some((rol) => roles.includes(rol));

const esAdmin = (usuario) => tieneRol(usuario, [USER_ROLES.ADMIN]);

const esGestor = (usuario) => tieneRol(usuario, ROLES_GESTION);

module.exports = { ROLES_GESTION, tieneRol, esAdmin, esGestor };
