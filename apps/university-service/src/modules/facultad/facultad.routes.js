const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');
const SedeRepository = require('../sede/sede.repository');

const FacultadController = require('./facultad.controller');
const FacultadRepository = require('./facultad.repository');
const FacultadService = require('./facultad.service');
const { createSchema, updateSchema } = require('./facultad.validation');

const router = express.Router();

const facultadRepository = new FacultadRepository();
const sedeRepository = new SedeRepository();

let facultadService = null;
let facultadController = null;

const getController = (req) => {
  if (!facultadService) {
    facultadService = new FacultadService(
      facultadRepository,
      sedeRepository,
      req.app.locals.redisClient,
    );
    facultadController = new FacultadController(facultadService);
  }
  return facultadController;
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

// Listar facultades es información institucional general: cualquier usuario
// autenticado puede consultarla; solo administración puede modificarla.
router.post('/', requireAuth, requireRole(...ADMIN_ROLES), validate(createSchema), (req, res, next) => getController(req).create(req, res, next));
router.get('/', requireAuth, (req, res, next) => getController(req).findAll(req, res, next));
router.get('/:id', requireAuth, (req, res, next) => getController(req).findById(req, res, next));
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validate(updateSchema), (req, res, next) => getController(req).update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).delete(req, res, next));

module.exports = router;
