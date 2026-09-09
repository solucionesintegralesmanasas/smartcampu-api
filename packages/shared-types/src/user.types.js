/**
 * DTOs canónicos del dominio de usuarios.
 *
 * NOTA: Este paquete no incluye dependencias runtime (ni Zod ni Joi).
 * Los DTOs se documentan con JSDoc para proveer autocompletado en editores
 * y validación estática vía TypeScript/JSDoc-checkers. Las validaciones
 * runtime se implementan en cada servicio con los esquemas que consideren.
 *
 * @module user.types
 */

/**
 * @typedef {'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO' | 'PENDIENTE_ACTIVACION'} UserEstado
 */

/**
 * @typedef {Object} UserDTO
 * @property {number}  id          - ID numérico (PK).
 * @property {string}  uuid        - UUID público canónico.
 * @property {string}  correo      - Correo institucional.
 * @property {UserEstado} estado   - Estado actual del usuario.
 * @property {number|null} id_tercero - FK a tercero (persona natural).
 * @property {string[]} roles      - Roles asignados (p.ej. ['ESTUDIANTE','DOCENTE']).
 * @property {string[]} permissions - Permisos consolidados (role + perms directas).
 * @property {string}  createdAt   - ISO8601 de creación.
 */

/**
 * @typedef {Object} CreateUserDTO
 * @property {string}   correo
 * @property {string}   password      - Texto plano (el servicio la hashea).
 * @property {number}   [id_tercero]
 * @property {string[]} [roles]
 */

/**
 * @typedef {Object} UpdateUserDTO
 * @property {string}     [correo]
 * @property {UserEstado} [estado]
 * @property {string}     [password]
 */

/**
 * @typedef {Object} TerceroDTO
 * @property {number} id
 * @property {string} tipo_documento
 * @property {string} numero_documento
 * @property {string} primer_nombre
 * @property {string} [segundo_nombre]
 * @property {string} primer_apellido
 * @property {string} [segundo_apellido]
 * @property {string} [telefono]
 * @property {string} [direccion]
 */

/**
 * @typedef {Object} EstudianteDTO
 * @property {number} id
 * @property {string} codigo_estudiantil
 * @property {string} programa
 * @property {number} semestre
 */

/**
 * @typedef {Object} DocenteDTO
 * @property {number} id
 * @property {string} codigo_docente
 * @property {string} departamento
 * @property {string} [categoria]
 */

/**
 * @typedef {UserDTO & { tercero?: TerceroDTO, estudiante?: EstudianteDTO, docente?: DocenteDTO }} UserProfileDTO
 */

/**
 * @typedef {Object} LoginDTO
 * @property {string} correo
 * @property {string} password
 */

/**
 * @typedef {Object} LoginResponseDTO
 * @property {string}  accessToken
 * @property {string}  refreshToken
 * @property {UserDTO} user
 */

/**
 * @typedef {Object} RefreshTokenDTO
 * @property {string} refreshToken
 */

/**
 * @typedef {Object} ResetPasswordDTO
 * @property {string} correo
 */

/**
 * @typedef {Object} ResetPasswordConfirmDTO
 * @property {string} token
 * @property {string} nuevaContrasena
 */

/**
 * Catálogo de campos de cada DTO.
 * Útil para validaciones ligeras, sanitización o generación de formularios.
 */
const USER_DTO_FIELDS = Object.freeze({
  UserDTO: Object.freeze([
    'id',
    'uuid',
    'correo',
    'estado',
    'id_tercero',
    'roles',
    'permissions',
    'createdAt',
  ]),
  CreateUserDTO: Object.freeze(['correo', 'password', 'id_tercero', 'roles']),
  UpdateUserDTO: Object.freeze(['correo', 'estado', 'password']),
  UserProfileDTO: Object.freeze([
    'id',
    'uuid',
    'correo',
    'estado',
    'id_tercero',
    'roles',
    'permissions',
    'createdAt',
    'tercero',
    'estudiante',
    'docente',
  ]),
  LoginDTO: Object.freeze(['correo', 'password']),
  LoginResponseDTO: Object.freeze(['accessToken', 'refreshToken', 'user']),
  RefreshTokenDTO: Object.freeze(['refreshToken']),
  ResetPasswordDTO: Object.freeze(['correo']),
  ResetPasswordConfirmDTO: Object.freeze(['token', 'nuevaContrasena']),
});

/**
 * Estados válidos de usuario.
 */
const USER_ESTADOS = Object.freeze(['ACTIVO', 'INACTIVO', 'SUSPENDIDO', 'PENDIENTE_ACTIVACION']);

module.exports = {
  USER_DTO_FIELDS,
  USER_ESTADOS,
};
