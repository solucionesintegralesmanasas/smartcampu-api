const express = require('express');

const { buildDispatcher } = require('../../core/container');
const { ROLES_GESTION } = require('../../core/constants/notification.constants');
const { requireAuth, requireRole } = require('../../core/middleware/auth.middleware');
const { validate } = require('../../core/middleware/validate.middleware');

const NotificacionesController = require('./notificaciones.controller');
const NotificacionesRepository = require('./notificaciones.repository');
const NotificacionesService = require('./notificaciones.service');
const { uuidParamSchema, listarQuerySchema, difusionSchema } = require('./notificaciones.validation');

const router = express.Router();

const notificacionesService = new NotificacionesService(
  new NotificacionesRepository(),
  buildDispatcher(),
);
const controller = new NotificacionesController(notificacionesService);

router.use(requireAuth);

router.get('/', validate(listarQuerySchema, 'query'), (req, res, next) => controller.listar(req, res, next));
router.patch('/leer-todas', (req, res, next) => controller.marcarTodasLeidas(req, res, next));
router.patch('/:uuid/leida', validate(uuidParamSchema, 'params'), (req, res, next) =>
  controller.marcarLeida(req, res, next),
);
router.post(
  '/difusion',
  requireRole(...ROLES_GESTION),
  validate(difusionSchema),
  (req, res, next) => controller.difundir(req, res, next),
);

module.exports = router;
