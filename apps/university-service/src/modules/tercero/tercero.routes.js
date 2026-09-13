const express = require('express');

const { getRedisClient } = require('../../config/database/redis');
const { ValidationError } = require('../../core/exceptions');
const EmpresaRepository = require('../empresa/empresa.repository');

const TerceroController = require('./tercero.controller');
const TerceroRepository = require('./tercero.repository');
const TerceroService = require('./tercero.service');
const {
  createTerceroSchema,
  updateTerceroSchema,
  queryTerceroSchema,
} = require('./tercero.validation');

const router = express.Router();

const terceroRepository = new TerceroRepository();
const empresaRepository = new EmpresaRepository();
let redisClient = null;
try {
  redisClient = getRedisClient();
} catch (err) {
  // Sin Redis
}
const terceroService = new TerceroService(terceroRepository, empresaRepository, redisClient);
const terceroController = new TerceroController(terceroService);

const validate = (schema, property = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[property]);
  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return next(new ValidationError('Error de validación en los datos suministrados', details));
  }
  req[property] = result.data;
  next();
};

router.get('/search', (req, res, next) => terceroController.search(req, res, next));
router.get('/', validate(queryTerceroSchema, 'query'), (req, res, next) => terceroController.findAll(req, res, next));
router.post('/', validate(createTerceroSchema, 'body'), (req, res, next) => terceroController.create(req, res, next));
router.get('/:id', (req, res, next) => terceroController.findById(req, res, next));
router.put('/:id', validate(updateTerceroSchema, 'body'), (req, res, next) => terceroController.update(req, res, next));
router.delete('/:id', (req, res, next) => terceroController.delete(req, res, next));

module.exports = router;
