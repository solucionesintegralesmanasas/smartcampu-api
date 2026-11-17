const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole, requireTrustedService } = require('../../core/middleware/authz.middleware');
const ProgramaRepository = require('../programa/programa.repository');
const TerceroRepository = require('../tercero/tercero.repository');

const EstudianteController = require('./estudiante.controller');
const EstudianteRepository = require('./estudiante.repository');
const EstudianteService = require('./estudiante.service');
const { createSchema, updateSchema } = require('./estudiante.validation');

const router = express.Router();

const estudianteRepository = new EstudianteRepository();
const terceroRepository = new TerceroRepository();
const programaRepository = new ProgramaRepository();

let estudianteService = null;
let estudianteController = null;

const getController = (req) => {
  if (!estudianteService) {
    estudianteService = new EstudianteService(
      estudianteRepository,
      terceroRepository,
      programaRepository,
      req.app.locals.redisClient,
    );
    estudianteController = new EstudianteController(estudianteService);
  }
  return estudianteController;
};

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

// Datos académicos/personales: solo administración académica, salvo la ruta
// interna by-user usada por user-service para el perfil polimórfico.
const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

router.post('/', requireAuth, requireRole(...ADMIN_ROLES), validate(createSchema), (req, res, next) => getController(req).create(req, res, next));
router.get('/', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).findAll(req, res, next));
// Registrada antes de "/:id": de lo contrario "/:id" capturaría
// "by-user/<uuid>" tratando "by-user" como el valor del id.
router.get('/by-user/:userUuid', requireTrustedService, (req, res, next) => getController(req).findByUserUuid(req, res, next));
router.get('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).findById(req, res, next));
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validate(updateSchema), (req, res, next) => getController(req).update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).delete(req, res, next));

module.exports = router;
