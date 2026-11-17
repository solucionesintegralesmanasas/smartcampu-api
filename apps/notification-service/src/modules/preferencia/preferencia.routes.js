const express = require('express');

const { ValidationError } = require('../../core/exceptions');
const { requireAuth } = require('../../core/middleware/authz.middleware');

const PreferenciaController = require('./preferencia.controller');
const PreferenciaRepository = require('./preferencia.repository');
const PreferenciaService = require('./preferencia.service');
const { setSchema } = require('./preferencia.validation');

const router = express.Router();

const preferenciaRepository = new PreferenciaRepository();
const preferenciaService = new PreferenciaService(preferenciaRepository);
const preferenciaController = new PreferenciaController(preferenciaService);

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new ValidationError('Validation error', result.error.errors));
  }
  req.body = result.data;
  next();
};

router.get('/', requireAuth, (req, res, next) => preferenciaController.findMine(req, res, next));
router.put('/', requireAuth, validate(setSchema), (req, res, next) => preferenciaController.setMine(req, res, next));

module.exports = router;
