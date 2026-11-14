const express = require('express');

const { requireAuth, requireWriteRole } = require('../../core/middlewares/auth.middleware');
const { validate } = require('../../core/middlewares/validate.middleware');
const {
  identifierSchema,
  idParamsSchema,
  paginationQuerySchema,
} = require('../../core/validation/common.validation');
const ResourcesRepository = require('../resources/resources.repository');

const InventoryController = require('./inventory.controller');
const InventoryRepository = require('./inventory.repository');
const InventoryService = require('./inventory.service');
const { createInventorySchema, updateInventorySchema } = require('./inventory.validation');

const router = express.Router({ mergeParams: true });

const inventoryRepository = new InventoryRepository();
const resourcesRepository = new ResourcesRepository();
const inventoryService = new InventoryService(inventoryRepository, resourcesRepository);
const inventoryController = new InventoryController(inventoryService);

const itemParamsSchema = idParamsSchema.extend({ itemId: identifierSchema });

router.get(
  '/',
  validate(idParamsSchema, 'params'),
  validate(paginationQuerySchema, 'query'),
  (req, res, next) => inventoryController.findAll(req, res, next),
);
router.get('/:itemId', validate(itemParamsSchema, 'params'), (req, res, next) =>
  inventoryController.findOne(req, res, next));
router.post(
  '/',
  requireAuth,
  requireWriteRole,
  validate(idParamsSchema, 'params'),
  validate(createInventorySchema),
  (req, res, next) => inventoryController.create(req, res, next),
);
router.put(
  '/:itemId',
  requireAuth,
  requireWriteRole,
  validate(itemParamsSchema, 'params'),
  validate(updateInventorySchema),
  (req, res, next) => inventoryController.update(req, res, next),
);
router.delete(
  '/:itemId',
  requireAuth,
  requireWriteRole,
  validate(itemParamsSchema, 'params'),
  (req, res, next) => inventoryController.remove(req, res, next),
);

module.exports = router;
