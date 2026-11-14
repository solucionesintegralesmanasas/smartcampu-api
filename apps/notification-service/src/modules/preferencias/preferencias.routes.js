const express = require('express');

const { requireAuth } = require('../../core/middleware/auth.middleware');
const { validate } = require('../../core/middleware/validate.middleware');

const PreferenciasController = require('./preferencias.controller');
const PreferenciasRepository = require('./preferencias.repository');
const PreferenciasService = require('./preferencias.service');
const { actualizarSchema } = require('./preferencias.validation');

const router = express.Router();

const controller = new PreferenciasController(new PreferenciasService(new PreferenciasRepository()));

router.use(requireAuth);

router.get('/preferencias', (req, res, next) => controller.obtener(req, res, next));
router.put('/preferencias', validate(actualizarSchema), (req, res, next) =>
  controller.actualizar(req, res, next),
);

module.exports = router;
