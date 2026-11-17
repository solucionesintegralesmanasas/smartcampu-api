const express = require('express');

const { requireAuth, requireWriteRole } = require('../../core/middlewares/auth.middleware');
const { validate } = require('../../core/middlewares/validate.middleware');
const { idParamsSchema } = require('../../core/validation/common.validation');
const ResourcesRepository = require('../resources/resources.repository');

const SchedulesController = require('./schedules.controller');
const SchedulesRepository = require('./schedules.repository');
const SchedulesService = require('./schedules.service');
const { replaceSchedulesSchema } = require('./schedules.validation');

const router = express.Router({ mergeParams: true });

const schedulesRepository = new SchedulesRepository();
const resourcesRepository = new ResourcesRepository();
const schedulesService = new SchedulesService(schedulesRepository, resourcesRepository);
const schedulesController = new SchedulesController(schedulesService);

router.get('/', validate(idParamsSchema, 'params'), (req, res, next) =>
  schedulesController.findByResource(req, res, next));
router.put(
  '/',
  requireAuth,
  requireWriteRole,
  validate(idParamsSchema, 'params'),
  validate(replaceSchedulesSchema),
  (req, res, next) => schedulesController.replace(req, res, next),
);

module.exports = router;
