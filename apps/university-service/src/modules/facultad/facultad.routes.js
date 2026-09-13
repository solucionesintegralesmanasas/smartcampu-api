const express = require('express');

const { getRedisClient } = require('../../config/database/redis');
const { ValidationError } = require('../../core/exceptions');

const FacultadController = require('./facultad.controller');
const FacultadRepository = require('./facultad.repository');
const FacultadService = require('./facultad.service');
const {
  createFacultadSchema,
  updateFacultadSchema,
  queryFacultadSchema,
} = require('./facultad.validation');

const router = express.Router();

const facultadRepository = new FacultadRepository();
let redisClient = null;
try {
  redisClient = getRedisClient();
} catch (err) {
  // Sin Redis
}
const facultadService = new FacultadService(facultadRepository, redisClient);
const facultadController = new FacultadController(facultadService);

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

router.get('/search', (req, res, next) => facultadController.search(req, res, next));
router.get('/', validate(queryFacultadSchema, 'query'), (req, res, next) => facultadController.findAll(req, res, next));
router.post('/', validate(createFacultadSchema, 'body'), (req, res, next) => facultadController.create(req, res, next));
router.get('/:id', (req, res, next) => facultadController.findById(req, res, next));
router.put('/:id', validate(updateFacultadSchema, 'body'), (req, res, next) => facultadController.update(req, res, next));
router.delete('/:id', (req, res, next) => facultadController.delete(req, res, next));

module.exports = router;
