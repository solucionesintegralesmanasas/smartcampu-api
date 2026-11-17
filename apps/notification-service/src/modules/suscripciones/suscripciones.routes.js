const express = require('express');

const { requireAuth } = require('../../core/middleware/auth.middleware');
const { validate } = require('../../core/middleware/validate.middleware');

const SuscripcionesController = require('./suscripciones.controller');
const SuscripcionesRepository = require('./suscripciones.repository');
const SuscripcionesService = require('./suscripciones.service');
const { uuidParamSchema, crearSchema } = require('./suscripciones.validation');

const router = express.Router();

const controller = new SuscripcionesController(
  new SuscripcionesService(new SuscripcionesRepository()),
);

router.use(requireAuth);

router.post('/suscripciones-push', validate(crearSchema), (req, res, next) =>
  controller.registrar(req, res, next),
);
router.delete('/suscripciones-push/:uuid', validate(uuidParamSchema, 'params'), (req, res, next) =>
  controller.eliminar(req, res, next),
);

module.exports = router;
