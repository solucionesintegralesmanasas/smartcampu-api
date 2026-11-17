const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');

const TerceroController = require('./tercero.controller');
const TerceroRepository = require('./tercero.repository');
const TerceroService = require('./tercero.service');
const { createSchema, updateSchema } = require('./tercero.validation');

const router = express.Router();

const terceroRepository = new TerceroRepository();

let terceroService = null;
let terceroController = null;

const getController = (req) => {
  if (!terceroService) {
    terceroService = new TerceroService(terceroRepository, req.app.locals.redisClient);
    terceroController = new TerceroController(terceroService);
  }
  return terceroController;
};

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

// Datos personales sensibles: solo administración académica.
const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

router.post('/', requireAuth, requireRole(...ADMIN_ROLES), validate(createSchema), (req, res, next) => getController(req).create(req, res, next));
router.get('/', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).findAll(req, res, next));
router.get('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).findById(req, res, next));
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validate(updateSchema), (req, res, next) => getController(req).update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).delete(req, res, next));

module.exports = router;
