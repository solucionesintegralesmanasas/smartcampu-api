const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');

const CategoriaController = require('./categoria.controller');
const CategoriaRepository = require('./categoria.repository');
const CategoriaService = require('./categoria.service');
const { createSchema, updateSchema } = require('./categoria.validation');

const router = express.Router();

const categoriaRepository = new CategoriaRepository();

let categoriaService = null;
let categoriaController = null;

const getController = (req) => {
  if (!categoriaService) {
    categoriaService = new CategoriaService(categoriaRepository, req.app.locals.redisClient);
    categoriaController = new CategoriaController(categoriaService);
  }
  return categoriaController;
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
