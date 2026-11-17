const express = require('express');

const { requireAuth, requireWriteRole } = require('../../core/middlewares/auth.middleware');
const { validate } = require('../../core/middlewares/validate.middleware');
const { idParamsSchema } = require('../../core/validation/common.validation');
const ResourceProducer = require('../../jobs/producers/resource.producer');
const availabilityRoutes = require('../availability/availability.routes');
const blackoutsRoutes = require('../blackouts/blackouts.routes');
const inventoryRoutes = require('../inventory/inventory.routes');
const schedulesRoutes = require('../schedules/schedules.routes');

const ResourcesController = require('./resources.controller');
const ResourcesRepository = require('./resources.repository');
const ResourcesService = require('./resources.service');
const {
  createResourceSchema,
  updateResourceSchema,
  searchResourcesSchema,
} = require('./resources.validation');

const router = express.Router();

const resourcesRepository = new ResourcesRepository();
const resourceProducer = new ResourceProducer();
const resourcesService = new ResourcesService(resourcesRepository, resourceProducer);
const resourcesController = new ResourcesController(resourcesService);

router.get('/', validate(searchResourcesSchema, 'query'), (req, res, next) =>
  resourcesController.findAll(req, res, next));
router.post(
  '/',
  requireAuth,
  requireWriteRole,
  validate(createResourceSchema),
  (req, res, next) => resourcesController.create(req, res, next),
);
router.get('/:id', validate(idParamsSchema, 'params'), (req, res, next) =>
  resourcesController.findOne(req, res, next));
router.put(
  '/:id',
  requireAuth,
  requireWriteRole,
  validate(idParamsSchema, 'params'),
  validate(updateResourceSchema),
  (req, res, next) => resourcesController.update(req, res, next),
);
router.delete('/:id', requireAuth, requireWriteRole, validate(idParamsSchema, 'params'), (req, res, next) =>
  resourcesController.remove(req, res, next));

router.use('/:id/horarios', schedulesRoutes);
router.use('/:id/bloqueos', blackoutsRoutes);
router.use('/:id/inventario', inventoryRoutes);
router.use('/:id/disponibilidad', availabilityRoutes);

module.exports = router;
