const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { getReservaProducer } = require('../../jobs/producers/reserva.producer');
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const { ROLES_GESTION } = require('../auth/auth.roles');
const catalogoRoutes = require('../catalogo/catalogo.routes');
const CatalogoRepository = require('../catalogo/catalogo.repository');

const ResourceAvailabilityClient = require('./reserva.availability.client');
const ReservaController = require('./reserva.controller');
const ReservaRepository = require('./reserva.repository');
const ReservaService = require('./reserva.service');
const {
  crearReservaSchema,
  listarReservasQuerySchema,
  uuidParamSchema,
  cambiarEstadoSchema,
  cancelarReservaSchema,
} = require('./reserva.validation');

const router = express.Router();

const reservaRepository = new ReservaRepository();
const catalogoRepository = new CatalogoRepository();
const reservaService = new ReservaService(
  reservaRepository,
  catalogoRepository,
  new ResourceAvailabilityClient(),
  getReservaProducer(),
);
const reservaController = new ReservaController(reservaService);

const validate = (schema, property = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[property] ?? {});
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
router.use(catalogoRoutes);

router.post('/', validate(crearReservaSchema), (req, res, next) =>
  reservaController.crear(req, res, next));
router.get('/', validate(listarReservasQuerySchema, 'query'), (req, res, next) =>
  reservaController.listar(req, res, next));
router.get('/:uuid', validate(uuidParamSchema, 'params'), (req, res, next) =>
  reservaController.obtener(req, res, next));
router.patch(
  '/:uuid/estado',
  requireRole(...ROLES_GESTION),
  validate(uuidParamSchema, 'params'),
  validate(cambiarEstadoSchema),
  (req, res, next) => reservaController.cambiarEstado(req, res, next),
);
router.post(
  '/:uuid/cancelar',
  validate(uuidParamSchema, 'params'),
  validate(cancelarReservaSchema),
  (req, res, next) => reservaController.cancelar(req, res, next),
);

module.exports = router;
