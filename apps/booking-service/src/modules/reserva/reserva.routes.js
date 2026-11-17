const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRole } = require('../../core/middleware/authz.middleware');
const NotificationProducer = require('../../jobs/producers/notification.producer');
const EstadoRepository = require('../estado/estado.repository');
const TipoRepository = require('../tipo/tipo.repository');

const AuditoriaRepository = require('./auditoria.repository');
const ReservaController = require('./reserva.controller');
const ReservaRepository = require('./reserva.repository');
const ReservaService = require('./reserva.service');
const { createSchema, reasonSchema } = require('./reserva.validation');

const router = express.Router();

const reservaRepository = new ReservaRepository();
const auditoriaRepository = new AuditoriaRepository();
const tipoRepository = new TipoRepository();
const estadoRepository = new EstadoRepository();
const notificationProducer = new NotificationProducer();

const reservaService = new ReservaService(
  reservaRepository,
  auditoriaRepository,
  tipoRepository,
  estadoRepository,
  notificationProducer,
);
const reservaController = new ReservaController(reservaService);

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

router.post('/', requireAuth, validate(createSchema), (req, res, next) => reservaController.create(req, res, next));
router.get('/', requireAuth, (req, res, next) => reservaController.findAll(req, res, next));
router.get('/:id', requireAuth, (req, res, next) => reservaController.findById(req, res, next));
router.get('/:id/historial', requireAuth, (req, res, next) => reservaController.findHistory(req, res, next));

// Transiciones de estado: aprobar/rechazar/confirmar/completar son
// administrativas; cancelar puede hacerlo el propio solicitante (verificado
// dentro del servicio) o un administrador.
router.post('/:id/aprobar', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => reservaController.approve(req, res, next));
router.post('/:id/rechazar', requireAuth, requireRole(...ADMIN_ROLES), validate(reasonSchema), (req, res, next) => reservaController.reject(req, res, next));
router.post('/:id/confirmar', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => reservaController.confirm(req, res, next));
router.post('/:id/cancelar', requireAuth, validate(reasonSchema), (req, res, next) => reservaController.cancel(req, res, next));
router.post('/:id/completar', requireAuth, requireRole(...ADMIN_ROLES), (req, res, next) => reservaController.complete(req, res, next));

module.exports = router;
