const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth } = require('../../core/middleware/authz.middleware');

const SuscripcionController = require('./suscripcion.controller');
const SuscripcionRepository = require('./suscripcion.repository');
const SuscripcionService = require('./suscripcion.service');
const { createSchema } = require('./suscripcion.validation');

const router = express.Router();

const suscripcionRepository = new SuscripcionRepository();
const suscripcionService = new SuscripcionService(suscripcionRepository);
const suscripcionController = new SuscripcionController(suscripcionService);

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

router.post('/', requireAuth, validate(createSchema), (req, res, next) => suscripcionController.create(req, res, next));
router.get('/', requireAuth, (req, res, next) => suscripcionController.findMine(req, res, next));
router.delete('/:id', requireAuth, (req, res, next) => suscripcionController.delete(req, res, next));

module.exports = router;
