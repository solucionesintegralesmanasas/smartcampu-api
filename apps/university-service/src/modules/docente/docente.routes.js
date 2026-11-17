const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole, requireTrustedService } = require('../../core/middleware/authz.middleware');
const FacultadRepository = require('../facultad/facultad.repository');
const TerceroRepository = require('../tercero/tercero.repository');

const DocenteController = require('./docente.controller');
const DocenteRepository = require('./docente.repository');
const DocenteService = require('./docente.service');
const { createSchema, updateSchema } = require('./docente.validation');

const router = express.Router();

const docenteRepository = new DocenteRepository();
const terceroRepository = new TerceroRepository();
const facultadRepository = new FacultadRepository();

let docenteService = null;
let docenteController = null;

const getController = (req) => {
  if (!docenteService) {
    docenteService = new DocenteService(
      docenteRepository,
      terceroRepository,
      facultadRepository,
      req.app.locals.redisClient,
    );
    docenteController = new DocenteController(docenteService);
  }
  return docenteController;
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
// Registrada antes de "/:id" por la misma razón que en estudiante.routes.js.
router.get('/by-user/:userUuid', requireTrustedService, (req, res, next) => getController(req).findByUserUuid(req, res, next));
router.get('/:id', requireAuth, (req, res, next) => getController(req).findById(req, res, next));
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validate(updateSchema), (req, res, next) => getController(req).update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).delete(req, res, next));

module.exports = router;
