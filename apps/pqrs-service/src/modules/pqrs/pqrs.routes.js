const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');
const NotificationProducer = require('../../jobs/producers/notification.producer');
const AdjuntoController = require('../adjunto/adjunto.controller');
const AdjuntoRepository = require('../adjunto/adjunto.repository');
const AdjuntoService = require('../adjunto/adjunto.service');
const { createSchema: createAdjuntoSchema } = require('../adjunto/adjunto.validation');
const EstadoRepository = require('../estado/estado.repository');
const TipoRepository = require('../tipo/tipo.repository');

const AuditoriaRepository = require('./auditoria.repository');
const PqrsController = require('./pqrs.controller');
const PqrsRepository = require('./pqrs.repository');
const PqrsService = require('./pqrs.service');
const { createSchema, respondSchema } = require('./pqrs.validation');
const RespuestaRepository = require('./respuesta.repository');

const router = express.Router();

const pqrsRepository = new PqrsRepository();
const auditoriaRepository = new AuditoriaRepository();
const respuestaRepository = new RespuestaRepository();
const tipoRepository = new TipoRepository();
const estadoRepository = new EstadoRepository();
const notificationProducer = new NotificationProducer();

const pqrsService = new PqrsService(
  pqrsRepository,
  auditoriaRepository,
  respuestaRepository,
  tipoRepository,
  estadoRepository,
  notificationProducer,
);
const pqrsController = new PqrsController(pqrsService);

const adjuntoRepository = new AdjuntoRepository();
const adjuntoService = new AdjuntoService(adjuntoRepository, pqrsService);
const adjuntoController = new AdjuntoController(adjuntoService);

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

// --- pqrs ---
router.post('/', requireAuth, validate(createSchema), (req, res, next) => pqrsController.create(req, res, next));
router.get('/', requireAuth, (req, res, next) => pqrsController.findAll(req, res, next));
router.get('/rastrear/:ticketNumber', requireAuth, (req, res, next) => pqrsController.findByTicketNumber(req, res, next));
router.get('/:id', requireAuth, (req, res, next) => pqrsController.findById(req, res, next));
router.get('/:id/historial', requireAuth, (req, res, next) => pqrsController.findHistory(req, res, next));
router.get('/:id/respuestas', requireAuth, (req, res, next) => pqrsController.findResponses(req, res, next));

// Transiciones: solo personal administrativo puede mover el flujo.
router.post('/:id/en-revision', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => pqrsController.startReview(req, res, next));
router.post('/:id/responder', requireAuth, requireRole(...ADMIN_ROLES), validate(respondSchema), (req, res, next) => pqrsController.respond(req, res, next));
router.post('/:id/cerrar', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => pqrsController.close(req, res, next));

// --- adjuntos anidados bajo /pqrs/:pqrsId/adjuntos ---
router.post('/:pqrsId/adjuntos', requireAuth, validate(createAdjuntoSchema), (req, res, next) => adjuntoController.create(req, res, next));
router.get('/:pqrsId/adjuntos', requireAuth, (req, res, next) => adjuntoController.findByPqrsId(req, res, next));
router.delete('/:pqrsId/adjuntos/:id', requireAuth, (req, res, next) => adjuntoController.delete(req, res, next));

module.exports = router;
