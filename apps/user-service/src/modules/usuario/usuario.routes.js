const { USER_ROLES } = require('@uajs/shared-types');
const express = require('express');

// eslint-disable-next-line import/no-extraneous-dependencies

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middlewares/auth.middleware');

const UsuarioController = require('./usuario.controller');
const UsuarioRepository = require('./usuario.repository');
const UsuarioService = require('./usuario.service');
const {
  updatePerfilSchema,
  updatePreferenciasSchema,
  listUsuariosQuerySchema,
  userIdParamSchema,
} = require('./usuario.validation');

const router = express.Router();

const usuarioRepository = new UsuarioRepository();
const usuarioService = new UsuarioService(usuarioRepository);
const usuarioController = new UsuarioController(usuarioService);

const validate = (schema, property = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[property]);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return next(new ValidationError('Error de validación en los datos suministrados', details));
  }
  req[property] = result.data;
  return next();
};

const soloPersonal = requireRole(USER_ROLES.ADMIN, USER_ROLES.STAFF);
const soloAdmin = requireRole(USER_ROLES.ADMIN);

router.use(requireAuth);

router.get('/me', (req, res, next) => usuarioController.getMiPerfil(req, res, next));
router.put('/me', validate(updatePerfilSchema), (req, res, next) => usuarioController.upsertMiPerfil(req, res, next));
router.get('/me/preferencias', (req, res, next) => usuarioController.getMisPreferencias(req, res, next));
router.put('/me/preferencias', validate(updatePreferenciasSchema), (req, res, next) => usuarioController.upsertMisPreferencias(req, res, next));

router.get('/', soloPersonal, validate(listUsuariosQuerySchema, 'query'), (req, res, next) => usuarioController.listarPerfiles(req, res, next));
router.get('/:userId', soloPersonal, validate(userIdParamSchema, 'params'), (req, res, next) => usuarioController.getPerfilPorUsuario(req, res, next));
router.delete('/:userId', soloAdmin, validate(userIdParamSchema, 'params'), (req, res, next) => usuarioController.eliminarPerfil(req, res, next));

module.exports = router;
