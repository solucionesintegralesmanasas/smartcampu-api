const express = require('express');

const { getRedisClient } = require('../../config/database/redis');
const { ValidationError } = require('../../core/exceptions');
const FacultadRepository = require('../facultad/facultad.repository');
const TerceroRepository = require('../tercero/tercero.repository');

const DocenteController = require('./docente.controller');
const DocenteRepository = require('./docente.repository');
const DocenteService = require('./docente.service');
const {
  createDocenteSchema,
  updateDocenteSchema,
  queryDocenteSchema,
} = require('./docente.validation');

const router = express.Router();

const docenteRepository = new DocenteRepository();
const terceroRepository = new TerceroRepository();
const facultadRepository = new FacultadRepository();
let redisClient = null;
try {
  redisClient = getRedisClient();
} catch (err) {
  // Sin Redis
}
const docenteService = new DocenteService(
  docenteRepository,
  terceroRepository,
  facultadRepository,
  redisClient,
);
const docenteController = new DocenteController(docenteService);

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

router.get('/search', (req, res, next) => docenteController.search(req, res, next));
router.get('/', validate(queryDocenteSchema, 'query'), (req, res, next) => docenteController.findAll(req, res, next));
router.post('/', validate(createDocenteSchema, 'body'), (req, res, next) => docenteController.create(req, res, next));
router.get('/:id', (req, res, next) => docenteController.findById(req, res, next));
router.put('/:id', validate(updateDocenteSchema, 'body'), (req, res, next) => docenteController.update(req, res, next));
router.delete('/:id', (req, res, next) => docenteController.delete(req, res, next));

module.exports = router;
