const express = require('express');

const { requireUserOrService } = require('../../core/middlewares/auth.middleware');
const { validate } = require('../../core/middlewares/validate.middleware');
const { idParamsSchema } = require('../../core/validation/common.validation');

const ResourcesRepository = require('../resources/resources.repository');
const SchedulesRepository = require('../schedules/schedules.repository');
const BlackoutsRepository = require('../blackouts/blackouts.repository');

const AvailabilityController = require('./availability.controller');
const AvailabilityService = require('./availability.service');
const { disponibilidadQuerySchema } = require('./availability.validation');

const router = express.Router({ mergeParams: true });

const availabilityService = new AvailabilityService(
  new ResourcesRepository(),
  new SchedulesRepository(),
  new BlackoutsRepository(),
);
const availabilityController = new AvailabilityController(availabilityService);

// Accesible con JWT de usuario o con SERVICE_AUTH_TOKEN (booking-service).
router.get(
  '/',
  requireUserOrService,
  validate(idParamsSchema, 'params'),
  validate(disponibilidadQuerySchema, 'query'),
  (req, res, next) => availabilityController.consultar(req, res, next),
);

module.exports = router;
