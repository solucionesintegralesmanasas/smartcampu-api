const express = require('express');

const { requireAuth, requireWriteRole } = require('../../core/middlewares/auth.middleware');
const { validate } = require('../../core/middlewares/validate.middleware');
const {
  identifierSchema,
  idParamsSchema,
  paginationQuerySchema,
} = require('../../core/validation/common.validation');
const ResourcesRepository = require('../resources/resources.repository');

const BlackoutsController = require('./blackouts.controller');
const BlackoutsRepository = require('./blackouts.repository');
const BlackoutsService = require('./blackouts.service');
const { createBlackoutSchema } = require('./blackouts.validation');

const router = express.Router({ mergeParams: true });

const blackoutsRepository = new BlackoutsRepository();
const resourcesRepository = new ResourcesRepository();
const blackoutsService = new BlackoutsService(blackoutsRepository, resourcesRepository);
const blackoutsController = new BlackoutsController(blackoutsService);

const bloqueoParamsSchema = idParamsSchema.extend({ bloqueoId: identifierSchema });

router.get(
  '/',
  validate(idParamsSchema, 'params'),
  validate(paginationQuerySchema, 'query'),
  (req, res, next) => blackoutsController.findAll(req, res, next),
);
router.post(
  '/',
  requireAuth,
  requireWriteRole,
  validate(idParamsSchema, 'params'),
  validate(createBlackoutSchema),
  (req, res, next) => blackoutsController.create(req, res, next),
);
router.delete(
  '/:bloqueoId',
  requireAuth,
  requireWriteRole,
  validate(bloqueoParamsSchema, 'params'),
  (req, res, next) => blackoutsController.remove(req, res, next),
);

module.exports = router;
