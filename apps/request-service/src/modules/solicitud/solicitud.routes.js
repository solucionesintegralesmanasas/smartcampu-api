const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');
const NotificationProducer = require('../../jobs/producers/notification.producer');
const AdjuntoController = require('../adjunto/adjunto.controller');
const AdjuntoRepository = require('../adjunto/adjunto.repository');
const AdjuntoService = require('../adjunto/adjunto.service');
const { createSchema: createAdjuntoSchema } = require('../adjunto/adjunto.validation');
const ComentarioController = require('../comentario/comentario.controller');
const ComentarioRepository = require('../comentario/comentario.repository');
const ComentarioService = require('../comentario/comentario.service');
const { createSchema: createComentarioSchema } = require('../comentario/comentario.validation');
const EstadoRepository = require('../estado/estado.repository');
const TipoRepository = require('../tipo/tipo.repository');

const AuditoriaRepository = require('./auditoria.repository');
const SolicitudController = require('./solicitud.controller');
const SolicitudRepository = require('./solicitud.repository');
const SolicitudService = require('./solicitud.service');
const { createSchema, resolutionSchema } = require('./solicitud.validation');

const router = express.Router();

const solicitudRepository = new SolicitudRepository();
const auditoriaRepository = new AuditoriaRepository();
const tipoRepository = new TipoRepository();
const estadoRepository = new EstadoRepository();
const notificationProducer = new NotificationProducer();

const solicitudService = new SolicitudService(
  solicitudRepository,
  auditoriaRepository,
  tipoRepository,
  estadoRepository,
  notificationProducer,
);
const solicitudController = new SolicitudController(solicitudService);

const comentarioRepository = new ComentarioRepository();
const comentarioService = new ComentarioService(comentarioRepository, solicitudService);
const comentarioController = new ComentarioController(comentarioService);

const adjuntoRepository = new AdjuntoRepository();
const adjuntoService = new AdjuntoService(adjuntoRepository, solicitudService);
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

// --- solicitud ---
router.post('/', requireAuth, validate(createSchema), (req, res, next) => solicitudController.create(req, res, next));
router.get('/', requireAuth, (req, res, next) => solicitudController.findAll(req, res, next));
router.get('/:id', requireAuth, (req, res, next) => solicitudController.findById(req, res, next));
router.get('/:id/historial', requireAuth, (req, res, next) => solicitudController.findHistory(req, res, next));

// Transiciones: solo personal administrativo puede mover el flujo.
router.post('/:id/en-revision', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => solicitudController.startReview(req, res, next));
router.post('/:id/aprobar', requireAuth, requireRole(...ADMIN_ROLES), validate(resolutionSchema), (req, res, next) => solicitudController.approve(req, res, next));
router.post('/:id/rechazar', requireAuth, requireRole(...ADMIN_ROLES), validate(resolutionSchema), (req, res, next) => solicitudController.reject(req, res, next));
router.post('/:id/cerrar', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => solicitudController.close(req, res, next));

// --- comentarios anidados bajo /solicitudes/:requestId/comentarios ---
router.post('/:requestId/comentarios', requireAuth, validate(createComentarioSchema), (req, res, next) => comentarioController.create(req, res, next));
router.get('/:requestId/comentarios', requireAuth, (req, res, next) => comentarioController.findByRequestId(req, res, next));
router.delete('/:requestId/comentarios/:id', requireAuth, (req, res, next) => comentarioController.delete(req, res, next));

// --- adjuntos anidados bajo /solicitudes/:requestId/adjuntos ---
router.post('/:requestId/adjuntos', requireAuth, validate(createAdjuntoSchema), (req, res, next) => adjuntoController.create(req, res, next));
router.get('/:requestId/adjuntos', requireAuth, (req, res, next) => adjuntoController.findByRequestId(req, res, next));
router.delete('/:requestId/adjuntos/:id', requireAuth, (req, res, next) => adjuntoController.delete(req, res, next));

module.exports = router;
