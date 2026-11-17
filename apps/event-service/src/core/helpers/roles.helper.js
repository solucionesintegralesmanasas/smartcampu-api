const { USER_ROLES } = require('@uajs/shared-types');

/** Roles con permisos de gestión sobre eventos e inscripciones. */
const ROLES_GESTION = Object.freeze([USER_ROLES.ADMIN, USER_ROLES.STAFF]);

/**
 * Indica si el usuario autenticado posee alguno de los roles indicados.
 * @param {{roles: string[]}|null} usuario - Usuario de req.user (null si es anónimo).
 * @param {string[]} roles - Roles aceptados.
 * @returns {boolean}
 */
const tieneRol = (usuario, roles) =>
  Boolean(usuario) && Array.isArray(usuario.roles) && usuario.roles.some((r) => roles.includes(r));

module.exports = { ROLES_GESTION, tieneRol };
