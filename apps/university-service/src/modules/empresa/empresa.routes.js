const express = require('express');

const { getRedisClient } = require('../../config/database/redis');
const { ValidationError } = require('../../core/exceptions');

const EmpresaController = require('./empresa.controller');
const EmpresaRepository = require('./empresa.repository');
const EmpresaService = require('./empresa.service');
const {
  createEmpresaSchema,
  updateEmpresaSchema,
  queryEmpresaSchema,
} = require('./empresa.validation');

const router = express.Router();

const empresaRepository = new EmpresaRepository();
let redisClient = null;
try {
  redisClient = getRedisClient();
} catch (err) {
  // Sin Redis
}
const empresaService = new EmpresaService(empresaRepository, redisClient);
const empresaController = new EmpresaController(empresaService);

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

router.get('/search', (req, res, next) => empresaController.search(req, res, next));
router.get('/', validate(queryEmpresaSchema, 'query'), (req, res, next) => empresaController.findAll(req, res, next));
router.post('/', validate(createEmpresaSchema, 'body'), (req, res, next) => empresaController.create(req, res, next));
router.get('/:id', (req, res, next) => empresaController.findById(req, res, next));
router.put('/:id', validate(updateEmpresaSchema, 'body'), (req, res, next) => empresaController.update(req, res, next));
router.delete('/:id', (req, res, next) => empresaController.delete(req, res, next));

module.exports = router;
