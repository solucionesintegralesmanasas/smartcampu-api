const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');

const SedeController = require('./sede.controller');
const SedeRepository = require('./sede.repository');
const SedeService = require('./sede.service');
const { createSchema, updateSchema } = require('./sede.validation');

const router = express.Router();

const sedeRepository = new SedeRepository();

let sedeService = null;
let sedeController = null;

const getController = (req) => {
  if (!sedeService) {
    sedeService = new SedeService(sedeRepository, req.app.locals.redisClient);
    sedeController = new SedeController(sedeService);
  }
  return sedeController;
};

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN'];

// Listar sedes es información institucional general: cualquier usuario
// autenticado puede consultarla; solo administración puede modificarla.
router.post('/', requireAuth, requireRole(...ADMIN_ROLES), validate(createSchema), (req, res, next) => getController(req).create(req, res, next));
router.get('/', requireAuth, (req, res, next) => getController(req).findAll(req, res, next));
router.get('/:id', requireAuth, (req, res, next) => getController(req).findById(req, res, next));
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validate(updateSchema), (req, res, next) => getController(req).update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).delete(req, res, next));

module.exports = router;
