const express = require('express');

const SolicitudesProducer = require('../../jobs/producers/solicitudes.producer');
const { ValidationError } = require('../../core/exceptions');
const { requireAuth, requireRoles } = require('../../core/middleware/auth.middleware');

const SolicitudesController = require('./solicitudes.controller');
const SolicitudesRepository = require('./solicitudes.repository');
const SolicitudesService = require('./solicitudes.service');
const {
  uuidParamSchema,
  crearSolicitudSchema,
  listarSolicitudesSchema,
  crearComentarioSchema,
  crearAdjuntoSchema,
  cambiarEstadoSchema,
} = require('./solicitudes.validation');

const router = express.Router();

const solicitudesRepository = new SolicitudesRepository();
const solicitudesProducer = new SolicitudesProducer();
const solicitudesService = new SolicitudesService(solicitudesRepository, solicitudesProducer);
const solicitudesController = new SolicitudesController(solicitudesService);

const validate = (schema, property = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[property]);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return next(new ValidationError('Error de validación en los datos suministrados', details));
  }
  req[property] = result.data;
  return next();
};

router.use(requireAuth);

router.post('/', validate(crearSolicitudSchema), (req, res, next) =>
  solicitudesController.crear(req, res, next),
);
router.get('/', validate(listarSolicitudesSchema, 'query'), (req, res, next) =>
  solicitudesController.listar(req, res, next),
);
router.get('/:uuid', validate(uuidParamSchema, 'params'), (req, res, next) =>
  solicitudesController.obtener(req, res, next),
);
router.post(
  '/:uuid/comentarios',
  validate(uuidParamSchema, 'params'),
  validate(crearComentarioSchema),
  (req, res, next) => solicitudesController.agregarComentario(req, res, next),
);
router.post(
  '/:uuid/adjuntos',
  validate(uuidParamSchema, 'params'),
  validate(crearAdjuntoSchema),
  (req, res, next) => solicitudesController.agregarAdjunto(req, res, next),
);
router.patch(
  '/:uuid/estado',
  requireRoles('ADMIN', 'STAFF'),
  validate(uuidParamSchema, 'params'),
  validate(cambiarEstadoSchema),
  (req, res, next) => solicitudesController.cambiarEstado(req, res, next),
);

module.exports = router;
