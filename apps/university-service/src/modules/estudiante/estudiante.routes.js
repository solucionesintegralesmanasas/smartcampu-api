const express = require('express');

const { getRedisClient } = require('../../config/database/redis');
const { ValidationError } = require('../../core/exceptions');
const ProgramaRepository = require('../programa/programa.repository');
const TerceroRepository = require('../tercero/tercero.repository');

const EstudianteController = require('./estudiante.controller');
const EstudianteRepository = require('./estudiante.repository');
const EstudianteService = require('./estudiante.service');
const {
  createEstudianteSchema,
  updateEstudianteSchema,
  queryEstudianteSchema,
} = require('./estudiante.validation');

const router = express.Router();

const estudianteRepository = new EstudianteRepository();
const terceroRepository = new TerceroRepository();
const programaRepository = new ProgramaRepository();
let redisClient = null;
try {
  redisClient = getRedisClient();
} catch (err) {
  // Sin Redis
}
const estudianteService = new EstudianteService(
  estudianteRepository,
  terceroRepository,
  programaRepository,
  redisClient,
);
const estudianteController = new EstudianteController(estudianteService);

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

router.get('/search', (req, res, next) => estudianteController.search(req, res, next));
router.get('/', validate(queryEstudianteSchema, 'query'), (req, res, next) => estudianteController.findAll(req, res, next));
router.post('/', validate(createEstudianteSchema, 'body'), (req, res, next) => estudianteController.create(req, res, next));
router.get('/:id', (req, res, next) => estudianteController.findById(req, res, next));
router.put('/:id', validate(updateEstudianteSchema, 'body'), (req, res, next) => estudianteController.update(req, res, next));
router.delete('/:id', (req, res, next) => estudianteController.delete(req, res, next));

module.exports = router;
