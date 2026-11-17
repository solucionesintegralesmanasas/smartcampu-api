const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');

const UsuarioController = require('./usuario.controller');
const UsuarioRepository = require('./usuario.repository');
const UsuarioService = require('./usuario.service');
const { updateSchema, updateRolesSchema, listQuerySchema } = require('./usuario.validation');

const router = express.Router();

const usuarioRepository = new UsuarioRepository();

let usuarioService = null;
let usuarioController = null;

const getController = (req) => {
  if (!usuarioService) {
    usuarioService = new UsuarioService(usuarioRepository, req.app.locals.redisClient);
    usuarioController = new UsuarioController(usuarioService);
  }
  return usuarioController;
};

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.query = result.data;
  next();
};

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN'];

router.get(
  '/',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  validateQuery(listQuerySchema),
  (req, res, next) => getController(req).findAll(req, res, next),
);
router.get('/search', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).search(req, res, next));
router.get('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).findById(req, res, next));
router.put(
  '/:id',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  validateBody(updateSchema),
  (req, res, next) => getController(req).update(req, res, next),
);
router.put(
  '/:id/roles',
  requireAuth,
  requireRole(...ADMIN_ROLES),
  validateBody(updateRolesSchema),
  (req, res, next) => getController(req).updateRoles(req, res, next),
);
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).deactivate(req, res, next));

module.exports = router;
