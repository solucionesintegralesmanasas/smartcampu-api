const express = require('express');

const { requireAuth, requireWriteRole } = require('../../core/middlewares/auth.middleware');
const { validate } = require('../../core/middlewares/validate.middleware');
const { idParamsSchema, paginationQuerySchema } = require('../../core/validation/common.validation');

const CategoriesController = require('./categories.controller');
const CategoriesRepository = require('./categories.repository');
const CategoriesService = require('./categories.service');
const { createCategorySchema, updateCategorySchema } = require('./categories.validation');

const router = express.Router();

const categoriesRepository = new CategoriesRepository();
const categoriesService = new CategoriesService(categoriesRepository);
const categoriesController = new CategoriesController(categoriesService);

router.get('/', validate(paginationQuerySchema, 'query'), (req, res, next) =>
  categoriesController.findAll(req, res, next));
router.get('/:id', validate(idParamsSchema, 'params'), (req, res, next) =>
  categoriesController.findOne(req, res, next));
router.post('/', requireAuth, requireWriteRole, validate(createCategorySchema), (req, res, next) =>
  categoriesController.create(req, res, next));
router.put(
  '/:id',
  requireAuth,
  requireWriteRole,
  validate(idParamsSchema, 'params'),
  validate(updateCategorySchema),
  (req, res, next) => categoriesController.update(req, res, next),
);
router.delete('/:id', requireAuth, requireWriteRole, validate(idParamsSchema, 'params'), (req, res, next) =>
  categoriesController.remove(req, res, next));

module.exports = router;
