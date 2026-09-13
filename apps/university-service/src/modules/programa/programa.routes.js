const express = require('express');

const { getRedisClient } = require('../../config/database/redis');
const { ValidationError } = require('../../core/exceptions');
const FacultadRepository = require('../facultad/facultad.repository');

const ProgramaController = require('./programa.controller');
const ProgramaRepository = require('./programa.repository');
const ProgramaService = require('./programa.service');
const {
  createProgramaSchema,
  updateProgramaSchema,
  queryProgramaSchema,
} = require('./programa.validation');

const router = express.Router();

const programaRepository = new ProgramaRepository();
const facultadRepository = new FacultadRepository();
let redisClient = null;
try {
  redisClient = getRedisClient();
} catch (err) {
  // Sin Redis
}
const programaService = new ProgramaService(programaRepository, facultadRepository, redisClient);
const programaController = new ProgramaController(programaService);

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

router.get('/search', (req, res, next) => programaController.search(req, res, next));
router.get('/', validate(queryProgramaSchema, 'query'), (req, res, next) => programaController.findAll(req, res, next));
router.post('/', validate(createProgramaSchema, 'body'), (req, res, next) => programaController.create(req, res, next));
router.get('/:id', (req, res, next) => programaController.findById(req, res, next));
router.put('/:id', validate(updateProgramaSchema, 'body'), (req, res, next) => programaController.update(req, res, next));
router.delete('/:id', (req, res, next) => programaController.delete(req, res, next));

module.exports = router;
