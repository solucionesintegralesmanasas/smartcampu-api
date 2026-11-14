const express = require('express');

const { ROLES_GESTION } = require('../../core/helpers/roles.helper');
const { optionalAuth, requireAuth, requireRole } = require('../../core/middlewares/auth.middleware');
const { validate } = require('../../core/middlewares/validate.middleware');
const {
  uuidParamSchema,
} = require('../../core/validation/common.validation');

const CatalogoRepository = require('../catalogo/catalogo.repository');
const catalogoRoutes = require('../catalogo/catalogo.routes');
const InscripcionController = require('../inscripcion/inscripcion.controller');
const InscripcionRepository = require('../inscripcion/inscripcion.repository');
const InscripcionService = require('../inscripcion/inscripcion.service');
const { listarInscripcionesSchema } = require('../inscripcion/inscripcion.validation');

const EventoController = require('./evento.controller');
const EventoRepository = require('./evento.repository');
const EventoService = require('./evento.service');
const {
  createEventoSchema,
  updateEventoSchema,
  listarEventosQuerySchema,
  cambiarEstadoSchema,
} = require('./evento.validation');

const router = express.Router();

const eventoRepository = new EventoRepository();
const catalogoRepository = new CatalogoRepository();
const inscripcionRepository = new InscripcionRepository();

const eventoService = new EventoService({
  eventoRepository,
  catalogoRepository,
  inscripcionRepository,
});
const eventoController = new EventoController(eventoService);

const inscripcionService = new InscripcionService({ eventoRepository, inscripcionRepository });
const inscripcionController = new InscripcionController(inscripcionService);

// Catálogos públicos (/categorias, /estados) antes de las rutas parametrizadas.
router.use(catalogoRoutes);

router.get('/', optionalAuth, validate(listarEventosQuerySchema, 'query'), (req, res, next) =>
  eventoController.listar(req, res, next),
);
router.post(
  '/',
  requireAuth,
  requireRole(...ROLES_GESTION),
  validate(createEventoSchema),
  (req, res, next) => eventoController.crear(req, res, next),
);
router.get('/:uuid', optionalAuth, validate(uuidParamSchema, 'params'), (req, res, next) =>
  eventoController.obtener(req, res, next),
);
router.put(
  '/:uuid',
  requireAuth,
  requireRole(...ROLES_GESTION),
  validate(uuidParamSchema, 'params'),
  validate(updateEventoSchema),
  (req, res, next) => eventoController.actualizar(req, res, next),
);
router.delete(
  '/:uuid',
  requireAuth,
  requireRole(...ROLES_GESTION),
  validate(uuidParamSchema, 'params'),
  (req, res, next) => eventoController.eliminar(req, res, next),
);
router.patch(
  '/:uuid/estado',
  requireAuth,
  requireRole(...ROLES_GESTION),
  validate(uuidParamSchema, 'params'),
  validate(cambiarEstadoSchema),
  (req, res, next) => eventoController.cambiarEstado(req, res, next),
);

router.post(
  '/:uuid/inscripciones',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  (req, res, next) => inscripcionController.inscribir(req, res, next),
);
router.get(
  '/:uuid/inscripciones',
  requireAuth,
  requireRole(...ROLES_GESTION),
  validate(uuidParamSchema, 'params'),
  validate(listarInscripcionesSchema, 'query'),
  (req, res, next) => inscripcionController.listar(req, res, next),
);
router.delete(
  '/:uuid/inscripciones',
  requireAuth,
  validate(uuidParamSchema, 'params'),
  (req, res, next) => inscripcionController.cancelar(req, res, next),
);

module.exports = router;
