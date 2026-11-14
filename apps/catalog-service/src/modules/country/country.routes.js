const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { catalogWriteAccess } = require('../auth/auth.middleware');

const CountryController = require('./country.controller');
const CountryRepository = require('./country.repository');
const CountryService = require('./country.service');
const { createSchema, updateSchema } = require('./country.validation');

const router = express.Router();

const countryRepository = new CountryRepository();

let countryService = null;
let countryController = null;

const getService = (req) => {
  if (!countryService) {
    countryService = new CountryService(countryRepository, req.app.locals.redisClient);
    countryController = new CountryController(countryService);
  }
  return countryController;
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
router.get('/:id', (req, res, next) => getService(req).findById(req, res, next));
router.post('/', catalogWriteAccess, validate(createSchema), (req, res, next) => getService(req).create(req, res, next));
router.put('/:id', catalogWriteAccess, validate(updateSchema), (req, res, next) => getService(req).update(req, res, next));
router.delete('/:id', catalogWriteAccess, (req, res, next) => getService(req).delete(req, res, next));

module.exports = router;
