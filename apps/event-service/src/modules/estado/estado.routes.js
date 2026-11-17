const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');

const EstadoController = require('./estado.controller');
const EstadoRepository = require('./estado.repository');
const EstadoService = require('./estado.service');
const { createSchema } = require('./estado.validation');

const router = express.Router();

const estadoRepository = new EstadoRepository();

let estadoService = null;
let estadoController = null;

const getController = (req) => {
  if (!estadoService) {
    estadoService = new EstadoService(estadoRepository, req.app.locals.redisClient);
    estadoController = new EstadoController(estadoService);
  }
  return estadoController;
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
router.get('/', requireAuth, (req, res, next) => getController(req).findAll(req, res, next));
router.get('/:id', requireAuth, (req, res, next) => getController(req).findById(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).delete(req, res, next));

module.exports = router;
