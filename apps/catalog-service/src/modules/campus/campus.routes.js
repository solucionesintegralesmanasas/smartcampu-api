const express = require('express');

const { ValidationError } = require('../../core/exceptions');

const CampusController = require('./campus.controller');
const CampusRepository = require('./campus.repository');
const CampusService = require('./campus.service');
const { createSchema, updateSchema } = require('./campus.validation');

const router = express.Router();

const campusRepository = new CampusRepository();

let campusService = null;
let campusController = null;

const getService = (req) => {
  if (!campusService) {
    campusService = new CampusService(campusRepository, req.app.locals.redisClient);
    campusController = new CampusController(campusService);
  }
  return campusController;
};

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

router.post('/', validate(createSchema), (req, res, next) => getService(req).create(req, res, next));
router.get('/', (req, res, next) => getService(req).findAll(req, res, next));
router.get('/search', (req, res, next) => getService(req).search(req, res, next));
router.get('/city/:cityId', (req, res, next) => getService(req).findByCityId(req, res, next));
router.get('/:id', (req, res, next) => getService(req).findById(req, res, next));
router.put('/:id', validate(updateSchema), (req, res, next) => getService(req).update(req, res, next));
router.delete('/:id', (req, res, next) => getService(req).delete(req, res, next));

module.exports = router;
