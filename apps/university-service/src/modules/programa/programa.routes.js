const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');
const FacultadRepository = require('../facultad/facultad.repository');

const ProgramaController = require('./programa.controller');
const ProgramaRepository = require('./programa.repository');
const ProgramaService = require('./programa.service');
const { createSchema, updateSchema } = require('./programa.validation');

const router = express.Router();

const programaRepository = new ProgramaRepository();
const facultadRepository = new FacultadRepository();

let programaService = null;
let programaController = null;

const getController = (req) => {
  if (!programaService) {
    programaService = new ProgramaService(
      programaRepository,
      facultadRepository,
      req.app.locals.redisClient,
    );
    programaController = new ProgramaController(programaService);
  }
  return programaController;
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

router.post('/', requireAuth, requireRole(...ADMIN_ROLES), validate(createSchema), (req, res, next) => getController(req).create(req, res, next));
router.get('/', requireAuth, (req, res, next) => getController(req).findAll(req, res, next));
router.get('/:id', requireAuth, (req, res, next) => getController(req).findById(req, res, next));
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validate(updateSchema), (req, res, next) => getController(req).update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).delete(req, res, next));

module.exports = router;
