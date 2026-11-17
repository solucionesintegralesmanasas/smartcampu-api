const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');

const EmpresaController = require('./empresa.controller');
const EmpresaRepository = require('./empresa.repository');
const EmpresaService = require('./empresa.service');
const { createSchema, updateSchema } = require('./empresa.validation');

const router = express.Router();

const empresaRepository = new EmpresaRepository();

let empresaService = null;
let empresaController = null;

const getController = (req) => {
  if (!empresaService) {
    empresaService = new EmpresaService(empresaRepository, req.app.locals.redisClient);
    empresaController = new EmpresaController(empresaService);
  }
  return empresaController;
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

// Listar empresas (convenios/pasantías) es información institucional
// general: cualquier usuario autenticado puede consultarla.
router.post('/', requireAuth, requireRole(...ADMIN_ROLES), validate(createSchema), (req, res, next) => getController(req).create(req, res, next));
router.get('/', requireAuth, (req, res, next) => getController(req).findAll(req, res, next));
router.get('/:id', requireAuth, (req, res, next) => getController(req).findById(req, res, next));
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validate(updateSchema), (req, res, next) => getController(req).update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).delete(req, res, next));

module.exports = router;
