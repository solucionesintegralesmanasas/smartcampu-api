const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');
const PermisoRepository = require('../permiso/permiso.repository');

const RolController = require('./rol.controller');
const RolRepository = require('./rol.repository');
const RolService = require('./rol.service');
const { createSchema, updateSchema, assignPermissionSchema } = require('./rol.validation');

const router = express.Router();

const rolRepository = new RolRepository();
const permisoRepository = new PermisoRepository();
const rolService = new RolService(rolRepository, permisoRepository);
const rolController = new RolController(rolService);

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN'];

router.post('/', requireAuth, requireRole(...ADMIN_ROLES), validate(createSchema), (req, res, next) => rolController.create(req, res, next));
router.get('/', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => rolController.findAll(req, res, next));
router.get('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => rolController.findById(req, res, next));
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validate(updateSchema), (req, res, next) => rolController.update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => rolController.delete(req, res, next));

router.get('/:id/permissions', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => rolController.listPermissions(req, res, next));
router.post('/:id/permissions', requireAuth, requireRole(...ADMIN_ROLES), validate(assignPermissionSchema), (req, res, next) => rolController.assignPermission(req, res, next));
router.delete('/:id/permissions/:permissionId', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => rolController.revokePermission(req, res, next));

module.exports = router;
