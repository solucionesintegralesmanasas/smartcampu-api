const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');
const NotificationProducer = require('../../jobs/producers/notification.producer');
const CategoriaRepository = require('../categoria/categoria.repository');
const EstadoRepository = require('../estado/estado.repository');
const InscripcionController = require('../inscripcion/inscripcion.controller');
const InscripcionRepository = require('../inscripcion/inscripcion.repository');
const InscripcionService = require('../inscripcion/inscripcion.service');

const EventoController = require('./evento.controller');
const EventoRepository = require('./evento.repository');
const EventoService = require('./evento.service');
const { createSchema, updateSchema } = require('./evento.validation');

const router = express.Router();

const eventoRepository = new EventoRepository();
const categoriaRepository = new CategoriaRepository();
const estadoRepository = new EstadoRepository();
const inscripcionRepository = new InscripcionRepository();
const notificationProducer = new NotificationProducer();

const inscripcionService = new InscripcionService(
  inscripcionRepository,
  eventoRepository,
  estadoRepository,
  notificationProducer,
);
const inscripcionController = new InscripcionController(inscripcionService);

let eventoService = null;
let eventoController = null;

const getController = (req) => {
  if (!eventoService) {
    eventoService = new EventoService(
      eventoRepository,
      categoriaRepository,
      estadoRepository,
      req.app.locals.redisClient,
      notificationProducer,
    );
    eventoController = new EventoController(eventoService);
  }
  return eventoController;
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

// --- evento --- (cualquier usuario autenticado puede crear/organizar y ver;
// modificar/transicionar requiere ser el organizador o admin/staff, ver
// EventoService#assertCanManage)
router.post('/', requireAuth, validate(createSchema), (req, res, next) => getController(req).create(req, res, next));
router.get('/', requireAuth, (req, res, next) => getController(req).findAll(req, res, next));
router.get('/:id', requireAuth, (req, res, next) => getController(req).findById(req, res, next));
router.put('/:id', requireAuth, validate(updateSchema), (req, res, next) => getController(req).update(req, res, next));
router.delete('/:id', requireAuth, (req, res, next) => getController(req).delete(req, res, next));

router.post('/:id/publicar', requireAuth, (req, res, next) => getController(req).publish(req, res, next));
router.post('/:id/iniciar', requireAuth, (req, res, next) => getController(req).start(req, res, next));
router.post('/:id/completar', requireAuth, (req, res, next) => getController(req).complete(req, res, next));
router.post('/:id/cancelar', requireAuth, (req, res, next) => getController(req).cancel(req, res, next));

// --- inscripciones anidadas bajo /eventos/:eventId/inscripciones ---
router.post('/:eventId/inscripciones', requireAuth, (req, res, next) => inscripcionController.register(req, res, next));
router.get('/:eventId/inscripciones/mia', requireAuth, (req, res, next) => inscripcionController.findMine(req, res, next));
router.get('/:eventId/inscripciones', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => inscripcionController.findByEventId(req, res, next));
router.post('/:eventId/inscripciones/cancelar', requireAuth, (req, res, next) => inscripcionController.cancel(req, res, next));
router.post('/:eventId/inscripciones/:id/check-in', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => inscripcionController.checkIn(req, res, next));

module.exports = router;
