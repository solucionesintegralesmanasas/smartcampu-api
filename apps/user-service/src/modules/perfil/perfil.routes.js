const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');
const UsuarioRepository = require('../usuario/usuario.repository');

const PerfilController = require('./perfil.controller');
const PerfilService = require('./perfil.service');
const { updateSchema } = require('./perfil.validation');

const router = express.Router();

const usuarioRepository = new UsuarioRepository();
const perfilService = new PerfilService(usuarioRepository);
const perfilController = new PerfilController(perfilService);

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN'];

router.get('/', requireAuth, (req, res, next) => perfilController.getOwn(req, res, next));
router.put('/', requireAuth, validate(updateSchema), (req, res, next) => perfilController.updateOwn(req, res, next));
router.get('/:userId', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => perfilController.getById(req, res, next));

module.exports = router;
