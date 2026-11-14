const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { catalogWriteAccess } = require('../auth/auth.middleware');

const CityController = require('./city.controller');
const CityRepository = require('./city.repository');
const CityService = require('./city.service');
const { createSchema, updateSchema } = require('./city.validation');

const router = express.Router();

const cityRepository = new CityRepository();

let cityService = null;
let cityController = null;

const getService = (req) => {
  if (!cityService) {
    cityService = new CityService(cityRepository, req.app.locals.redisClient);
    cityController = new CityController(cityService);
  }
  return cityController;
};

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Error de validación', result.error.errors));
  }
  req.body = result.data;
  next();
};

router.get('/', (req, res, next) => getService(req).findAll(req, res, next));
router.get('/search', (req, res, next) => getService(req).search(req, res, next));
router.get('/state/:stateId', (req, res, next) => getService(req).findByStateId(req, res, next));
router.get('/:id', (req, res, next) => getService(req).findById(req, res, next));
router.post('/', catalogWriteAccess, validate(createSchema), (req, res, next) => getService(req).create(req, res, next));
router.put('/:id', catalogWriteAccess, validate(updateSchema), (req, res, next) => getService(req).update(req, res, next));
router.delete('/:id', catalogWriteAccess, (req, res, next) => getService(req).delete(req, res, next));

module.exports = router;
