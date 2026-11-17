const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');
const CategoriaRepository = require('../categoria/categoria.repository');

const TipoController = require('./tipo.controller');
const TipoRepository = require('./tipo.repository');
const TipoService = require('./tipo.service');
const { createSchema, updateSchema } = require('./tipo.validation');

const router = express.Router();

const tipoRepository = new TipoRepository();
const categoriaRepository = new CategoriaRepository();

let tipoService = null;
let tipoController = null;

const getController = (req) => {
  if (!tipoService) {
    tipoService = new TipoService(tipoRepository, categoriaRepository, req.app.locals.redisClient);
    tipoController = new TipoController(tipoService);
  }
  return tipoController;
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
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validate(updateSchema), (req, res, next) => getController(req).update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).delete(req, res, next));

module.exports = router;
