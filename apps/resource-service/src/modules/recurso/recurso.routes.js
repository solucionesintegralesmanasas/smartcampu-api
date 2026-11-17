const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const {
  requireAuth, requireRole, requireTrustedService, requireAuthOrTrustedService,
} = require('../../core/middleware/authz.middleware');
const BloqueoController = require('../bloqueo/bloqueo.controller');
const BloqueoRepository = require('../bloqueo/bloqueo.repository');
const BloqueoService = require('../bloqueo/bloqueo.service');
const { createSchema: createBloqueoSchema } = require('../bloqueo/bloqueo.validation');
const CategoriaRepository = require('../categoria/categoria.repository');
const EstadoRepository = require('../estado/estado.repository');
const HorarioController = require('../horario/horario.controller');
const HorarioRepository = require('../horario/horario.repository');
const HorarioService = require('../horario/horario.service');
const { createSchema: createHorarioSchema, updateSchema: updateHorarioSchema } = require('../horario/horario.validation');

const RecursoController = require('./recurso.controller');
const RecursoRepository = require('./recurso.repository');
const RecursoService = require('./recurso.service');
const { createSchema, updateSchema, availabilityQuerySchema } = require('./recurso.validation');

const router = express.Router();

const recursoRepository = new RecursoRepository();
const categoriaRepository = new CategoriaRepository();
const estadoRepository = new EstadoRepository();
const horarioRepository = new HorarioRepository();
const bloqueoRepository = new BloqueoRepository();

const horarioService = new HorarioService(horarioRepository, recursoRepository);
const horarioController = new HorarioController(horarioService);
const bloqueoService = new BloqueoService(bloqueoRepository, recursoRepository);
const bloqueoController = new BloqueoController(bloqueoService);

let recursoService = null;
let recursoController = null;

const getController = (req) => {
  if (!recursoService) {
    recursoService = new RecursoService(
      recursoRepository,
      categoriaRepository,
      estadoRepository,
      horarioRepository,
      bloqueoRepository,
      req.app.locals.redisClient,
    );
    recursoController = new RecursoController(recursoService);
  }
  return recursoController;
};

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.query = result.data;
  next();
};

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

// --- recurso ---
router.post('/', requireAuth, requireRole(...ADMIN_ROLES), validateBody(createSchema), (req, res, next) => getController(req).create(req, res, next));
router.get('/', requireAuth, (req, res, next) => getController(req).findAll(req, res, next));
router.get('/:id', requireAuthOrTrustedService, (req, res, next) => getController(req).findById(req, res, next));
router.put('/:id', requireAuth, requireRole(...ADMIN_ROLES), validateBody(updateSchema), (req, res, next) => getController(req).update(req, res, next));
router.delete('/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => getController(req).delete(req, res, next));

// Alcanzable por cualquier request que pase por el gateway (usuario final) o
// por booking-service llamando directo con su propio X-Service-Token, sin
// necesitar reenviar la identidad del usuario final.
router.get('/:id/disponibilidad', requireTrustedService, validateQuery(availabilityQuerySchema), (req, res, next) => getController(req).checkAvailability(req, res, next));

// --- horarios anidados bajo /recursos/:resourceId/horarios ---
router.post('/:resourceId/horarios', requireAuth, requireRole(...ADMIN_ROLES), validateBody(createHorarioSchema), (req, res, next) => horarioController.create(req, res, next));
router.get('/:resourceId/horarios', requireAuth, (req, res, next) => horarioController.findByResourceId(req, res, next));
router.put('/:resourceId/horarios/:id', requireAuth, requireRole(...ADMIN_ROLES), validateBody(updateHorarioSchema), (req, res, next) => horarioController.update(req, res, next));
router.delete('/:resourceId/horarios/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => horarioController.delete(req, res, next));

// --- bloqueos anidados bajo /recursos/:resourceId/bloqueos ---
router.post('/:resourceId/bloqueos', requireAuth, requireRole(...ADMIN_ROLES), validateBody(createBloqueoSchema), (req, res, next) => bloqueoController.create(req, res, next));
router.get('/:resourceId/bloqueos', requireAuth, (req, res, next) => bloqueoController.findByResourceId(req, res, next));
router.delete('/:resourceId/bloqueos/:id', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => bloqueoController.delete(req, res, next));

module.exports = router;
