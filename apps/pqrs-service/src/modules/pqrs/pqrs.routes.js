const express = require('express');

const PqrsProducer = require('../../jobs/producers/pqrs.producer');
const { ValidationError } = require('../../core/exceptions');
const { optionalAuth, requireAuth, requireRoles } = require('../../core/middleware/auth.middleware');

const PqrsController = require('./pqrs.controller');
const PqrsRepository = require('./pqrs.repository');
const PqrsService = require('./pqrs.service');
const {
  uuidParamSchema,
  ticketParamSchema,
  crearPqrsSchema,
  consultaSchema,
  listarPqrsSchema,
  asignacionSchema,
  respuestaSchema,
  cambiarEstadoSchema,
  calificacionSchema,
} = require('./pqrs.validation');

const router = express.Router();

const pqrsRepository = new PqrsRepository();
const pqrsProducer = new PqrsProducer();
const pqrsService = new PqrsService(pqrsRepository, pqrsProducer);
const pqrsController = new PqrsController(pqrsService);

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

// Rutas públicas
router.post('/', optionalAuth, validate(crearPqrsSchema), (req, res, next) =>
  pqrsController.crear(req, res, next),
);
router.get('/consulta/:ticket', validate(ticketParamSchema, 'params'), validate(consultaSchema, 'query'), (
  req,
  res,
  next,
) => pqrsController.consultar(req, res, next));

// Rutas autenticadas
router.get('/mias', requireAuth, validate(listarPqrsSchema, 'query'), (req, res, next) =>
  pqrsController.listarMias(req, res, next),
);
router.get(
  '/',
  requireAuth,
  requireRoles('ADMIN', 'STAFF'),
  validate(listarPqrsSchema, 'query'),
  (req, res, next) => pqrsController.listarPersonal(req, res, next),
);
router.get('/:uuid', requireAuth, validate(uuidParamSchema, 'params'), (req, res, next) =>
  pqrsController.obtener(req, res, next),
);
router.patch(
  '/:uuid/asignacion',
  requireAuth,
  requireRoles('ADMIN', 'STAFF'),
  validate(uuidParamSchema, 'params'),
  validate(asignacionSchema),
  (req, res, next) => pqrsController.asignar(req, res, next),
);
router.post(
  '/:uuid/respuestas',
  requireAuth,
  requireRoles('ADMIN', 'STAFF'),
  validate(uuidParamSchema, 'params'),
  validate(respuestaSchema),
  (req, res, next) => pqrsController.responder(req, res, next),
);
router.patch(
  '/:uuid/estado',
  requireAuth,
  requireRoles('ADMIN', 'STAFF'),
  validate(uuidParamSchema, 'params'),
  validate(cambiarEstadoSchema),
  (req, res, next) => pqrsController.cambiarEstado(req, res, next),
);
router.post(
  '/:uuid/calificacion',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  validate(calificacionSchema),
  (req, res, next) => pqrsController.calificar(req, res, next),
);

module.exports = router;
