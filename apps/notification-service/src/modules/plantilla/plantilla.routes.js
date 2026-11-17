const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');

const PlantillaController = require('./plantilla.controller');
const PlantillaRepository = require('./plantilla.repository');
const PlantillaService = require('./plantilla.service');
const { createSchema, updateSchema } = require('./plantilla.validation');

const router = express.Router();

const plantillaRepository = new PlantillaRepository();

let plantillaService = null;
let plantillaController = null;

const getController = (req) => {
  if (!plantillaService) {
    plantillaService = new PlantillaService(plantillaRepository, req.app.locals.redisClient);
    plantillaController = new PlantillaController(plantillaService);
  }
  return plantillaController;
};

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

router.post('/', requireAuth, requireRole(...ADMIN_ROLES), validate(createSchema), (req, res, next) => getController(req).create(req, res, next));
router.get('/', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).findAll(req, res, next));
router.get('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).findById(req, res, next));
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validate(updateSchema), (req, res, next) => getController(req).update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).delete(req, res, next));

module.exports = router;
