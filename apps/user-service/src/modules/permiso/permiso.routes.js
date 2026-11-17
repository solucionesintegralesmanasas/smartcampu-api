const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');

const PermisoController = require('./permiso.controller');
const PermisoRepository = require('./permiso.repository');
const PermisoService = require('./permiso.service');
const { createSchema, updateSchema } = require('./permiso.validation');

const router = express.Router();

const permisoRepository = new PermisoRepository();
const permisoService = new PermisoService(permisoRepository);
const permisoController = new PermisoController(permisoService);

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN'];

router.post('/', requireAuth, requireRole(...ADMIN_ROLES), validate(createSchema), (req, res, next) => permisoController.create(req, res, next));
router.get('/', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => permisoController.findAll(req, res, next));
router.get('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => permisoController.findById(req, res, next));
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validate(updateSchema), (req, res, next) => permisoController.update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => permisoController.delete(req, res, next));

module.exports = router;
