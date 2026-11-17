const express = require('express');

// eslint-disable-next-line import/no-extraneous-dependencies
const { USER_ROLES } = require('@uajs/shared-types');

const { ROLES_GESTION } = require('../../core/constants/notification.constants');
const { requireAuth, requireRole } = require('../../core/middleware/auth.middleware');
const { validate } = require('../../core/middleware/validate.middleware');

const PlantillasController = require('./plantillas.controller');
const PlantillasRepository = require('./plantillas.repository');
const PlantillasService = require('./plantillas.service');
const { codeParamSchema, listarQuerySchema, upsertSchema } = require('./plantillas.validation');

const router = express.Router();

const controller = new PlantillasController(new PlantillasService(new PlantillasRepository()));

router.use(requireAuth);

router.get(
  '/plantillas',
  requireRole(...ROLES_GESTION),
  validate(listarQuerySchema, 'query'),
  (req, res, next) => controller.listar(req, res, next),
);
router.put(
  '/plantillas/:code',
  requireRole(USER_ROLES.ADMIN),
  validate(codeParamSchema, 'params'),
  validate(upsertSchema),
  (req, res, next) => controller.actualizar(req, res, next),
);

module.exports = router;
